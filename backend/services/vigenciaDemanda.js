const Cliente = require('../models/Cliente');
const Implantacao = require('../models/Implantacao');
const LancamentoSetor = require('../models/LancamentoSetor');

// ── Vigência de demanda — REGRAS_DEMANDA.md ──
// Fonte única de "a demanda do cliente X no setor Y existe na competência C?". Nenhuma tela, rota,
// exportação ou relatório decide isso por conta própria: todos perguntam pra cá. O espelho do
// frontend (src/utils/vigenciaDemanda.js) segue a mesma regra e é conferido contra esta pelo teste
// scripts/testarVigenciaDemanda.js.
//
// Cada cliente tem, por setor, uma lista de períodos { inicio, fim } em competência "AAAA-MM":
// inicio null = "desde sempre", fim null = "em aberto", fim inclusivo. Setor sem período = sem demanda.
// Parar = fechar o período (nunca apagar); apagar só em "Remover tudo" e "Excluir cliente".

const normalizarNome = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// ── Regra única ──

const periodoCobre = (periodo, competencia) =>
  (!periodo.inicio || periodo.inicio <= competencia) && (!periodo.fim || periodo.fim >= competencia);

const periodosDoSetor = (cliente, setorId) =>
  (cliente.vigenciaDemanda || []).find(v => String(v.setor) === String(setorId))?.periodos || [];

// Regra adicional do setor, independente de competência. Fiscal: sem regime tributário definido,
// ou com regime "outro", não gera demanda (Spec 25). DP e Contábil não têm regra adicional.
const regraDoSetorPermite = (cliente, setorNome) => {
  if (normalizarNome(setorNome) === 'fiscal') return !!cliente.regime && cliente.regime !== 'outro';
  return true;
};

// Só a vigência e a regra do setor decidem. O status do cliente não entra: "inativo" fecha os
// períodos (Spec B) e "encerramento" continua gerando demanda como o ativo.
const existeDemanda = ({ cliente, setorId, setorNome, competencia }) => {
  if (!regraDoSetorPermite(cliente, setorNome)) return false;
  return periodosDoSetor(cliente, setorId).some(p => periodoCobre(p, competencia));
};

// Os clientes (já carregados) que têm demanda no setor nessa competência — usado pela lista de
// Demandas, pelo card do Início e pela exportação, em lote (uma consulta por setor).
const clientesComDemanda = (clientes, { setorId, setorNome, competencia }) =>
  clientes.filter(cliente => existeDemanda({ cliente, setorId, setorNome, competencia }));

// Carrega, numa consulta só, os clientes do escritório que têm vigência cadastrada no setor e
// devolve os que têm demanda na competência.
const listarClientesComDemanda = async ({ empresaId, setorId, setorNome, competencia, campos = '' }) => {
  const candidatos = await Cliente.find({ empresa: empresaId, 'vigenciaDemanda.setor': setorId })
    .select(`status regime vigenciaDemanda ${campos}`)
    .lean();
  return clientesComDemanda(candidatos, { setorId, setorNome, competencia });
};

// ── Competências (sempre "AAAA-MM"; fuso de Brasília = UTC−3 fixo, como no resto do projeto) ──

const mesValido = (c) => typeof c === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(c);

const somarMeses = (competencia, n) => {
  const [a, m] = competencia.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const BRASILIA_MS = 3 * 60 * 60 * 1000;
const mesAtualBrasilia = () => new Date(Date.now() - BRASILIA_MS).toISOString().slice(0, 7);
// Instante real (ex: conclusão do onboarding) → mês no calendário de Brasília
const mesDeInstanteBrasilia = (data) => new Date(new Date(data).getTime() - BRASILIA_MS).toISOString().slice(0, 7);
// Data só de calendário (ex: início dos serviços, gravada como meia-noite UTC do dia escolhido) → mês dela mesma
const mesDeDataCivil = (data) => new Date(data).toISOString().slice(0, 7);

// Mês escolhido pelo usuário numa ação (inativar, reativar, remover setor...): de 12 meses atrás a 12 à frente.
const mesDentroDaJanela = (mes) => mesValido(mes) && mes >= somarMeses(mesAtualBrasilia(), -12) && mes <= somarMeses(mesAtualBrasilia(), 12);

// ── Eventos sobre a vigência (funções puras sobre listas de entradas { setor, periodos }) ──

const copiarEntradas = (cliente) => (cliente.vigenciaDemanda || []).map(v => ({
  setor: v.setor,
  periodos: (v.periodos || []).map(p => ({ inicio: p.inicio ?? null, fim: p.fim ?? null })),
}));

const entradaDesdeSempre = (setorId) => ({ setor: setorId, periodos: [{ inicio: null, fim: null }] });

const temPeriodoAberto = (entradas, setorId) =>
  entradas.some(v => String(v.setor) === String(setorId) && v.periodos.some(p => !p.fim));

const jaTeveVigencia = (entradas, setorId) =>
  entradas.some(v => String(v.setor) === String(setorId) && v.periodos.length > 0);

// Inativar / remover setor "daqui pra frente" a partir do mês M: todo período aberto (de um setor, ou de todos)
// passa a terminar em M−1. Período que ainda nem tinha começado em M−1 deixa de existir (ficaria vazio).
const fecharPeriodosAbertos = (entradas, mesAcao, setorId = null) => {
  const fim = somarMeses(mesAcao, -1);
  return entradas.map(v => {
    if (setorId && String(v.setor) !== String(setorId)) return v;
    const periodos = v.periodos
      .map(p => (p.fim ? p : { inicio: p.inicio, fim }))
      .filter(p => !(p.inicio && p.fim && p.inicio > p.fim));
    return { setor: v.setor, periodos };
  });
};

// Reativar / adicionar de novo / concluir onboarding: abre período a partir do mês, em aberto.
// Já aberto = não faz nada (idempotente). Se o período anterior termina no mês anterior (ou depois), ele é reaberto
// em vez de criar um segundo período emendado.
const abrirPeriodo = (entradas, setorId, mesInicio) => {
  const idx = entradas.findIndex(v => String(v.setor) === String(setorId));
  if (idx === -1) return { entradas: [...entradas, { setor: setorId, periodos: [{ inicio: mesInicio, fim: null }] }], abriu: true };
  if (entradas[idx].periodos.some(p => !p.fim)) return { entradas, abriu: false };
  const periodos = entradas[idx].periodos.map(p => ({ ...p }));
  const ultimo = periodos.reduce((a, p) => (!a || (p.fim || '') > (a.fim || '') ? p : a), null);
  if (ultimo && ultimo.fim >= somarMeses(mesInicio, -1)) ultimo.fim = null;
  else periodos.push({ inicio: mesInicio, fim: null });
  const novas = entradas.map((v, i) => (i === idx ? { setor: v.setor, periodos } : v));
  return { entradas: novas, abriu: true };
};

// Ajuste manual (titular / responsável do setor): muda o início do primeiro período e o fim do último.
// Devolve { erro } ou { entradas }. `ultimoLancamento` = maior competência com lançamento salvo (ou null).
const ajustarVigencia = (entradas, setorId, { inicio, fim }, ultimoLancamento = null) => {
  const idx = entradas.findIndex(v => String(v.setor) === String(setorId));
  if (idx === -1 || !entradas[idx].periodos.length) return { erro: 'Este setor não tem vigência para ajustar.' };
  if (inicio !== null && inicio !== undefined && inicio !== '' && !mesValido(inicio)) return { erro: 'Mês de início inválido.' };
  if (fim !== null && fim !== undefined && fim !== '' && !mesValido(fim)) return { erro: 'Mês de fim inválido.' };
  const periodos = entradas[idx].periodos.map(p => ({ ...p }));
  const ordenados = [...periodos].sort((a, b) => (a.inicio || '') < (b.inicio || '') ? -1 : 1);
  const primeiro = ordenados[0], ultimo = ordenados[ordenados.length - 1];
  const novoInicio = inicio === '' || inicio === undefined ? primeiro.inicio : inicio;
  const novoFim = fim === '' || fim === undefined ? ultimo.fim : fim;
  if (ordenados.length === 1 && novoInicio && novoFim && novoInicio > novoFim) return { erro: 'O início não pode ser depois do fim.' };
  if (ordenados.length > 1 && novoInicio && ordenados[0].fim && novoInicio > ordenados[0].fim) return { erro: 'O início não pode ser depois do fim do primeiro período.' };
  if (ordenados.length > 1 && novoFim && ultimo.inicio && novoFim < ultimo.inicio) return { erro: 'O fim não pode ser antes do início do último período.' };
  if (novoFim && ultimoLancamento && novoFim < ultimoLancamento) {
    return { erro: `Existe lançamento salvo em ${ultimoLancamento}. O fim da vigência não pode ser anterior a esse mês.` };
  }
  primeiro.inicio = novoInicio;
  ultimo.fim = novoFim;
  return { entradas: entradas.map((v, i) => (i === idx ? { setor: v.setor, periodos } : v)) };
};

// Vigência de um cliente que já estava inativo antes do Spec B (data de inativação desconhecida):
// desde sempre até o mês do último lançamento salvo no setor; sem lançamento, sem período.
const periodoLegadoInativo = (ultimoLancamento) => (ultimoLancamento ? [{ inicio: null, fim: ultimoLancamento }] : []);

// ── Migração dos dados existentes (roda sozinha no startup do server.js; idempotente e só soma/ajusta o que é legado) ──
//
//  M1  Cliente que nunca foi migrado (campo vigenciaDemanda ainda não existe no documento): ativo/encerramento
//      ganha "desde sempre" em cada setor atribuído — exceto nos setores de um onboarding em andamento (Spec B,
//      seção 2) —, inativo ganha vigência até o último lançamento. Esse "campo ainda não existe" é a marca de
//      "ainda não migrado": cliente criado por backend antigo durante um deploy também cai aqui, no próximo start.
//  M2  Cliente criado por onboarding (origem 'onboarding') que ainda está em andamento e tinha ficado com "desde
//      sempre" (Spec A) nos setores do onboarding: perde essa vigência. Só mexe no período exato "desde sempre,
//      em aberto"; cliente cadastrado manualmente que apenas iniciou um onboarding não é alterado.
//  M3  Cliente inativo com setor atribuído sem nenhuma vigência (inativo antes do Spec B): vigência até o mês do
//      último lançamento daquele setor; sem lançamento, continua sem período.
//
// Com `simular`, só conta.
const cnpjTolerante = (digitos) => new RegExp(digitos.split('').join('[.\\-/]*'));

const clienteDaImplantacao = async (imp) => {
  if (imp.cliente) {
    const porId = await Cliente.findOne({ _id: imp.cliente, empresa: imp.empresa });
    if (porId) return porId;
  }
  const digitos = (imp.cnpj || '').replace(/\D/g, '');
  if (!digitos) return null;
  return Cliente.findOne({ empresa: imp.empresa, cnpj: cnpjTolerante(digitos) });
};

const ultimaCompetenciaComLancamento = async (clienteId, setorId) => {
  const l = await LancamentoSetor.findOne({ cliente: clienteId, setor: setorId }).sort({ competencia: -1 }).select('competencia').lean();
  return l?.competencia || null;
};

const migrarVigenciaDemanda = async ({ simular = false, empresaId = null } = {}) => {
  const s = {
    clientes: 0, m1Clientes: 0, m1DesdeSempre: 0, m1SemPeriodoOnboarding: 0, m1InativosComPeriodo: 0, m1InativosSemPeriodo: 0,
    m2Ajustados: 0, m2PeriodosRemovidos: 0, m3ComPeriodo: 0, m3SemPeriodo: 0,
  };
  const filtroEmpresa = empresaId ? { empresa: empresaId } : {};

  // Setores de onboarding em andamento, por cliente, e quantos onboardings o cliente já teve (qualquer status)
  const emAndamento = new Map(); // clienteId -> Set(setorId)
  const totalImplantacoes = new Map(); // clienteId -> n
  for (const imp of await Implantacao.find(filtroEmpresa).select('empresa cliente cnpj status etapas.setor').lean()) {
    const c = await clienteDaImplantacao(imp);
    if (!c) continue;
    const cid = String(c._id);
    totalImplantacoes.set(cid, (totalImplantacoes.get(cid) || 0) + 1);
    if (imp.status !== 'em_andamento') continue;
    const set = emAndamento.get(cid) || new Set();
    (imp.etapas || []).forEach(e => set.add(String(e.setor)));
    emAndamento.set(cid, set);
  }

  const cursor = Cliente.find(filtroEmpresa).select('status origem setores vigenciaDemanda').lean().cursor();
  for await (const c of cursor) {
    s.clientes++;
    const id = String(c._id);
    const setores = [...new Set((c.setores || []).map(String))];
    const naoMigrado = c.vigenciaDemanda === undefined;
    let entradas = copiarEntradas(c);
    let mudou = false;

    // M1
    if (naoMigrado && setores.length) {
      s.m1Clientes++;
      for (const setorId of setores) {
        if (c.status === 'inativo') {
          const periodos = periodoLegadoInativo(await ultimaCompetenciaComLancamento(c._id, setorId));
          if (periodos.length) { entradas.push({ setor: setorId, periodos }); s.m1InativosComPeriodo++; } else s.m1InativosSemPeriodo++;
        } else if (emAndamento.get(id)?.has(setorId)) {
          s.m1SemPeriodoOnboarding++;
        } else {
          entradas.push(entradaDesdeSempre(setorId)); s.m1DesdeSempre++;
        }
      }
      mudou = true;
    }

    // M2 — só cliente que nasceu desse onboarding (o único que ele teve): quem já tinha outros onboardings concluídos
    // pode ter "desde sempre" de verdade nesses setores
    if (!naoMigrado && c.origem === 'onboarding' && emAndamento.has(id) && totalImplantacoes.get(id) === 1) {
      const setoresOnb = emAndamento.get(id);
      const novas = entradas.map(v => {
        if (!setoresOnb.has(String(v.setor))) return v;
        const periodos = v.periodos.filter(p => !(p.inicio === null && p.fim === null));
        if (periodos.length !== v.periodos.length) { s.m2PeriodosRemovidos += v.periodos.length - periodos.length; mudou = true; }
        return { setor: v.setor, periodos };
      });
      if (mudou) { s.m2Ajustados++; entradas = novas; }
    }

    // M3
    if (!naoMigrado && c.status === 'inativo') {
      for (const setorId of setores) {
        if (entradas.some(v => String(v.setor) === setorId)) continue;
        const periodos = periodoLegadoInativo(await ultimaCompetenciaComLancamento(c._id, setorId));
        if (periodos.length) { entradas.push({ setor: setorId, periodos }); s.m3ComPeriodo++; mudou = true; } else s.m3SemPeriodo++;
      }
    }

    if (mudou && !simular) await Cliente.updateOne({ _id: c._id }, { $set: { vigenciaDemanda: entradas } });
  }
  return s;
};

module.exports = {
  periodoCobre, periodosDoSetor, regraDoSetorPermite, existeDemanda, clientesComDemanda, listarClientesComDemanda,
  mesValido, somarMeses, mesAtualBrasilia, mesDeInstanteBrasilia, mesDeDataCivil, mesDentroDaJanela,
  copiarEntradas, entradaDesdeSempre, temPeriodoAberto, jaTeveVigencia, fecharPeriodosAbertos, abrirPeriodo, ajustarVigencia,
  periodoLegadoInativo, clienteDaImplantacao, ultimaCompetenciaComLancamento, migrarVigenciaDemanda, normalizarNome,
};
