// Migração do histórico versionado por vigência (Fiscal/DP/Contábil) — ver
// historico_versionado_config.md. Cria a entrada inicial de historicoRegime/historicoSituacao
// pra clientes que já têm regime/situação preenchidos hoje mas nenhum histórico ainda, usando a
// competência do lançamento mais antigo salvo (ou a data de cadastro do cliente, se não houver
// nenhum lançamento) — garante que o Histórico desses clientes continue exatamente igual até a
// primeira vez que alguém mudar a configuração deles.
//
// Dry-run por padrão — NÃO escreve nada a menos que --aplicar seja passado explicitamente.
//
// Uso:
//   node scripts/migrarHistoricoVigencia.js                          # dry-run (default)
//   node scripts/migrarHistoricoVigencia.js --dry-run                # dry-run explícito
//   node scripts/migrarHistoricoVigencia.js --aplicar                # escreve de verdade
//   node scripts/migrarHistoricoVigencia.js --aplicar --empresa=<id> # escopo a 1 empresa

require('dotenv').config();
const mongoose = require('mongoose');
const Cliente = require('../models/Cliente');
const Empresa = require('../models/Empresa');
const Setor = require('../models/Setor');
const { aplicarMudancaComHistorico, buscarCompetenciaMaisAntiga } = require('../services/historicoVigencia');

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const empresaArg = args.find(a => a.startsWith('--empresa='));
const EMPRESA_ID = empresaArg ? empresaArg.split('=')[1] : null;

const normalizarNome = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// nomeAlvo é comparado via normalizarNome (sem acento/lowercase) — comparar direto com regex
// contra o nome cru do setor no banco (ex: "Contábil") falha silenciosamente por causa do acento.
const CAMPOS_A_MIGRAR = [
  {
    label: 'Fiscal (regime)',
    nomeAlvo: 'fiscal',
    getValorAtual: (cliente) => cliente.regime,
    getHistoricoAtual: (cliente) => cliente.historicoRegime,
    aplicar: (cliente, entrada) => { cliente.historicoRegime = entrada; },
  },
  {
    label: 'Departamento Pessoal (situação)',
    nomeAlvo: 'departamento pessoal',
    getValorAtual: (cliente) => cliente.configSetores?.['departamento pessoal']?.situacao,
    getHistoricoAtual: (cliente) => cliente.configSetores?.['departamento pessoal']?.historicoSituacao,
    aplicar: (cliente, entrada) => { cliente.configSetores['departamento pessoal'].historicoSituacao = entrada; cliente.markModified('configSetores'); },
  },
  {
    label: 'Contábil (situação)',
    nomeAlvo: 'contabil',
    getValorAtual: (cliente) => cliente.configSetores?.contabil?.situacao,
    getHistoricoAtual: (cliente) => cliente.configSetores?.contabil?.historicoSituacao,
    aplicar: (cliente, entrada) => { cliente.configSetores.contabil.historicoSituacao = entrada; cliente.markModified('configSetores'); },
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const resumo = CAMPOS_A_MIGRAR.map(c => ({ label: c.label, alterados: 0, jaTinhamHistorico: 0, setorNaoEncontrado: 0, erros: 0 }));

  const filtroEmpresa = EMPRESA_ID ? { _id: EMPRESA_ID } : {};
  const empresas = await Empresa.find(filtroEmpresa).select('_id nome').lean();
  let empresasProcessadas = 0;
  let clientesVerificados = 0;

  for (const empresa of empresas) {
    empresasProcessadas++;

    const todosSetores = await Setor.find({ empresa: empresa._id, ativo: true }).select('_id nome').lean();
    const setoresPorLabel = {};
    for (const campo of CAMPOS_A_MIGRAR) {
      setoresPorLabel[campo.label] = todosSetores.find(s => normalizarNome(s.nome) === campo.nomeAlvo);
    }

    const clientes = await Cliente.find({ empresa: empresa._id });
    clientesVerificados += clientes.length;

    for (const cliente of clientes) {
      let mudou = false;

      for (let i = 0; i < CAMPOS_A_MIGRAR.length; i++) {
        const campo = CAMPOS_A_MIGRAR[i];
        const r = resumo[i];
        try {
          const valorAtual = campo.getValorAtual(cliente);
          if (!valorAtual) continue;

          const historicoAtual = campo.getHistoricoAtual(cliente);
          if (historicoAtual?.length) { r.jaTinhamHistorico++; continue; }

          const setor = setoresPorLabel[campo.label];
          if (!setor) r.setorNaoEncontrado++;

          const competenciaMaisAntiga = await buscarCompetenciaMaisAntiga({
            clienteId: cliente._id,
            setorId: setor?._id,
            criadoEmCliente: cliente.criadoEm,
          });
          const entrada = aplicarMudancaComHistorico([], valorAtual, 'inicio', competenciaMaisAntiga);

          const prefixo = APLICAR ? 'APLICADO' : 'DRY-RUN';
          console.log(`[${prefixo}] Cliente "${cliente.razaoSocial}" (${cliente._id}): ${campo.label} ← ${JSON.stringify(entrada)}`);

          if (APLICAR) {
            campo.aplicar(cliente, entrada);
            mudou = true;
          }
          r.alterados++;
        } catch (err) {
          r.erros++;
          console.error(`[ERRO] Cliente "${cliente.razaoSocial}" (${cliente._id}) — ${campo.label}: ${err.message}`);
        }
      }

      if (APLICAR && mudou) {
        try {
          await cliente.save();
        } catch (err) {
          console.error(`[ERRO] Falha ao salvar cliente "${cliente.razaoSocial}" (${cliente._id}): ${err.message}`);
        }
      }
    }
  }

  console.log('\n── Resumo ──');
  console.log(`Empresas processadas: ${empresasProcessadas}`);
  console.log(`Clientes verificados: ${clientesVerificados}`);
  let houveErro = false;
  for (const r of resumo) {
    console.log(`${r.label} — ${APLICAR ? 'alterados' : 'seriam alterados'}: ${r.alterados} | já tinham histórico (pulados): ${r.jaTinhamHistorico} | setor não encontrado (fallback p/ criadoEm): ${r.setorNaoEncontrado} | erros: ${r.erros}`);
    if (r.erros > 0) houveErro = true;
  }
  console.log(`Modo: ${APLICAR ? 'APLICADO (escreveu de verdade)' : 'DRY-RUN (nenhuma escrita foi feita)'}`);

  await mongoose.disconnect();
  if (APLICAR && houveErro) process.exitCode = 1;
}

main().catch(err => { console.error(err); process.exit(1); });
