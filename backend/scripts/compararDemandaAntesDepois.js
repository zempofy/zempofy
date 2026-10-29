// Comparativo antes × depois da vigência de demanda (Spec A, seção 6 — REGRAS_DEMANDA.md).
// SÓ LEITURA: nunca grava nada. Rode DEPOIS da migração (node scripts/migrarVigenciaDemanda.js --aplicar,
// ou simplesmente depois de subir o servidor uma vez).
//
// Pra cada setor e cada competência dos últimos 24 meses e dos próximos 12, compara a lista de clientes
// com demanda pela regra ANTIGA (setor atribuído + não inativo + Fiscal com regime) com a da regra NOVA
// (a mesma função que a tela de Demandas usa). Resultado esperado: zero diferenças, EXCETO clientes com onboarding
// em andamento naquele setor — esses saem de propósito (regra de onboarding do Spec B, seção 2) e são listados à parte
// como "esperadas". Qualquer outra diferença é inesperada e faz o script terminar com erro.
//
// Uso (dentro de backend/):
//   node scripts/compararDemandaAntesDepois.js                 # todas as empresas do banco
//   node scripts/compararDemandaAntesDepois.js --empresa=<id>  # só uma

require('dotenv').config();
const mongoose = require('mongoose');
const Cliente = require('../models/Cliente');
const Setor = require('../models/Setor');
const Empresa = require('../models/Empresa');
const { listarClientesComDemanda, normalizarNome, setoresDeOnboardingEmAndamento } = require('../services/vigenciaDemanda');

const empresaArg = process.argv.find(a => a.startsWith('--empresa='));

// Mês corrente no fuso de Brasília (UTC−3 fixo, como no resto do projeto)
const agoraBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
const somarMeses = (ano, mes, n) => { const d = new Date(Date.UTC(ano, mes - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const COMPETENCIAS = [];
for (let n = -24; n <= 12; n++) COMPETENCIAS.push(somarMeses(agoraBrasilia.getUTCFullYear(), agoraBrasilia.getUTCMonth() + 1, n));

// A regra de ANTES, copiada de routes/cliente.js (GET /clientes/demandas/:setorId/:competencia)
const listaAntiga = async (empresaId, setorId, setorNome) => {
  const filtro = { empresa: empresaId, setores: setorId, status: { $ne: 'inativo' } };
  if (normalizarNome(setorNome) === 'fiscal') filtro.regime = { $nin: [null, '', 'outro'] };
  return (await Cliente.find(filtro).select('_id razaoSocial').lean());
};

(async () => {
  const banco = (process.env.MONGODB_URI || '').match(/\/([^/?]+)(\?|$)/)?.[1] || '(desconhecido)';
  await mongoose.connect(process.env.MONGODB_URI);
  const filtroEmpresa = empresaArg ? { _id: empresaArg.split('=')[1] } : {};
  const empresas = await Empresa.find(filtroEmpresa).select('nome').lean();
  console.log(`Banco: ${banco} | ${empresas.length} empresa(s) | competências ${COMPETENCIAS[0]} a ${COMPETENCIAS.at(-1)} (${COMPETENCIAS.length})\n`);

  let comparacoes = 0, diferencas = 0, setoresLidos = 0, esperadas = 0;
  const pendentesCache = new Map(); // clienteId -> Set(setores de onboarding em andamento)
  const pendentesDe = async (id) => {
    if (!pendentesCache.has(id)) {
      const c = await Cliente.findById(id).select('empresa cnpj').lean();
      pendentesCache.set(id, c ? await setoresDeOnboardingEmAndamento(c) : new Set());
    }
    return pendentesCache.get(id);
  };
  const esperadasPorCliente = new Map(); // "nome / setor" -> nº de meses
  const linhas = [];
  for (const empresa of empresas) {
    const setores = await Setor.find({ empresa: empresa._id }).select('nome').lean();
    for (const setor of setores) {
      setoresLidos++;
      const antiga = await listaAntiga(empresa._id, setor._id, setor.nome);
      const idsAntigos = new Set(antiga.map(c => String(c._id)));
      const nomes = new Map(antiga.map(c => [String(c._id), c.razaoSocial]));
      let menor = Infinity, maior = 0, difSetor = 0;
      for (const competencia of COMPETENCIAS) {
        const nova = await listarClientesComDemanda({ empresaId: empresa._id, setorId: setor._id, setorNome: setor.nome, competencia });
        const idsNovos = new Set(nova.map(c => String(c._id)));
        comparacoes++;
        menor = Math.min(menor, idsNovos.size); maior = Math.max(maior, idsNovos.size);
        let faltando = [...idsAntigos].filter(id => !idsNovos.has(id));
        const sobrando = [...idsNovos].filter(id => !idsAntigos.has(id));
        // Sumiu porque está com onboarding em andamento neste setor: diferença esperada
        const filtrados = [];
        for (const id of faltando) {
          if ((await pendentesDe(id)).has(String(setor._id))) {
            esperadas++;
            const chave = `${nomes.get(id) || id} / ${setor.nome}`;
            esperadasPorCliente.set(chave, (esperadasPorCliente.get(chave) || 0) + 1);
          } else filtrados.push(id);
        }
        faltando = filtrados;
        if (faltando.length || sobrando.length) {
          diferencas++; difSetor++;
          const resumo = (ids) => ids.slice(0, 5).map(id => nomes.get(id) || id).join('; ') + (ids.length > 5 ? ` … (+${ids.length - 5})` : '');
          if (difSetor <= 3) console.log(`  DIFERENÇA ${empresa.nome} / ${setor.nome} / ${competencia}: sumiram ${faltando.length} [${resumo(faltando)}] apareceram ${sobrando.length} [${resumo(sobrando)}]`);
        }
      }
      if (antiga.length || menor > 0 || difSetor) linhas.push({ empresa: String(empresa.nome).slice(0, 28), setor: setor.nome, 'antes (todos os meses)': antiga.length, 'depois (mín–máx)': `${menor}–${maior}`, 'meses com diferença': difSetor });
    }
  }
  if (linhas.length) console.table(linhas);
  if (esperadasPorCliente.size) {
    console.log('\nDiferenças ESPERADAS (cliente com onboarding em andamento no setor — sem demanda até concluir):');
    for (const [chave, n] of esperadasPorCliente) console.log(`  ${chave}: fora em ${n} competência(s)`);
  }
  console.log(`\nSetores comparados: ${setoresLidos}   |   comparações setor×competência: ${comparacoes}   |   com diferença inesperada: ${diferencas}   |   ausências esperadas (onboarding): ${esperadas}`);
  console.log(diferencas === 0 ? 'RESULTADO: zero diferenças inesperadas.' : 'RESULTADO: HÁ DIFERENÇAS INESPERADAS — ver acima.');
  await mongoose.disconnect();
  process.exit(diferencas === 0 ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(1); });
