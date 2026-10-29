const Cliente = require('../models/Cliente');
const Implantacao = require('../models/Implantacao');

// ── Vigência de demanda — REGRAS_DEMANDA.md ──
// Fonte única de "a demanda do cliente X no setor Y existe na competência C?". Nenhuma tela, rota,
// exportação ou relatório decide isso por conta própria: todos perguntam pra cá. O espelho do
// frontend (src/utils/vigenciaDemanda.js) segue a mesma regra e é conferido contra esta pelo teste
// scripts/testarVigenciaDemanda.js.
//
// Cada cliente tem, por setor, uma lista de períodos { inicio, fim } em competência "AAAA-MM":
// inicio null = "desde sempre", fim null = "em aberto", fim inclusivo. Setor sem período = sem demanda.

const normalizarNome = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

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

// TRANSIÇÃO (Spec A, some no Spec B): hoje inativar não mexe nos períodos — o status do cliente
// é lido aqui pra "inativo some de todos os meses" continuar valendo. "encerramento" conta como ativo.
const existeDemanda = ({ cliente, setorId, setorNome, competencia }) => {
  if (cliente.status === 'inativo') return false;
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

// ── Escrita da vigência (Spec A: tudo reproduz o comportamento de antes) ──

const entradaDesdeSempre = (setorId) => ({ setor: setorId, periodos: [{ inicio: null, fim: null }] });

// Setores atribuídos que ainda não têm vigência ganham "desde sempre, em aberto" — só pra cliente
// que não está inativo (inativo fica sem período, como hoje). Devolve as entradas que faltam.
// `pular`: setores de um onboarding em andamento — esses só ganham vigência quando o onboarding conclui.
const entradasQueFaltam = (cliente, pular = new Set()) => {
  if (cliente.status === 'inativo') return [];
  const tem = new Set((cliente.vigenciaDemanda || []).map(v => String(v.setor)));
  const faltam = [];
  for (const setor of cliente.setores || []) {
    const id = String(setor._id || setor);
    if (tem.has(id) || pular.has(id)) continue;
    tem.add(id);
    faltam.push(entradaDesdeSempre(setor._id || setor));
  }
  return faltam;
};

// Versão pra documento Mongoose (create/save): completa e diz se mudou algo.
const garantirVigenciaPadrao = (doc, pular = new Set()) => {
  const faltam = entradasQueFaltam(doc, pular);
  faltam.forEach(e => doc.vigenciaDemanda.push(e));
  return faltam.length > 0;
};

// Tirar o setor do cliente tira a demanda dele (hoje isso vale pra todos os meses).
const removerVigenciaDoSetor = (doc, setorId) => {
  doc.vigenciaDemanda = (doc.vigenciaDemanda || []).filter(v => String(v.setor) !== String(setorId));
};

// ── Competências e períodos (usados pela regra de onboarding — Spec B, seção 2) ──

const somarMeses = (competencia, n) => {
  const [a, m] = competencia.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const BRASILIA_MS = 3 * 60 * 60 * 1000;
// Instante real (ex: conclusão do onboarding) → mês no calendário de Brasília
const mesDeInstanteBrasilia = (data) => new Date(new Date(data).getTime() - BRASILIA_MS).toISOString().slice(0, 7);
// Data só de calendário (ex: início dos serviços, gravada como meia-noite UTC do dia escolhido) → mês dela mesma
const mesDeDataCivil = (data) => new Date(data).toISOString().slice(0, 7);

const copiarEntradas = (cliente) => (cliente.vigenciaDemanda || []).map(v => ({
  setor: v.setor,
  periodos: (v.periodos || []).map(p => ({ inicio: p.inicio ?? null, fim: p.fim ?? null })),
}));

const temPeriodoAberto = (entradas, setorId) =>
  entradas.some(v => String(v.setor) === String(setorId) && v.periodos.some(p => !p.fim));

// Abre período a partir do mês, em aberto. Já aberto = não faz nada (idempotente). Se o período anterior termina no
// mês anterior (ou depois), ele é reaberto em vez de criar um segundo período emendado.
const abrirPeriodo = (entradas, setorId, mesInicio) => {
  const idx = entradas.findIndex(v => String(v.setor) === String(setorId));
  if (idx === -1) return { entradas: [...entradas, { setor: setorId, periodos: [{ inicio: mesInicio, fim: null }] }], abriu: true };
  if (entradas[idx].periodos.some(p => !p.fim)) return { entradas, abriu: false };
  const periodos = entradas[idx].periodos.map(p => ({ ...p }));
  const ultimo = periodos.reduce((a, p) => (!a || (p.fim || '') > (a.fim || '') ? p : a), null);
  if (ultimo && ultimo.fim >= somarMeses(mesInicio, -1)) ultimo.fim = null;
  else periodos.push({ inicio: mesInicio, fim: null });
  return { entradas: entradas.map((v, i) => (i === idx ? { setor: v.setor, periodos } : v)), abriu: true };
};

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

// Setores de onboarding(s) em andamento do cliente (pelo vínculo `cliente` ou, nas implantações antigas, pelo CNPJ).
// Enquanto o onboarding não conclui, esses setores não ganham vigência.
const setoresDeOnboardingEmAndamento = async (cliente) => {
  const digitos = (cliente.cnpj || '').replace(/\D/g, '');
  const imps = await Implantacao.find({
    empresa: cliente.empresa, status: 'em_andamento',
    $or: [{ cliente: cliente._id }, ...(digitos ? [{ cnpj: cnpjTolerante(digitos) }] : [])],
  }).select('etapas.setor').lean();
  return new Set(imps.flatMap(i => (i.etapas || []).map(e => String(e.setor))));
};

// ── Migração dos dados existentes — idempotente (roda a cada start do server.js). Não toca em setores, lançamentos,
// documentos nem status. Ativo/encerramento → "desde sempre, em aberto" nos setores sem vigência, MENOS nos setores de
// um onboarding em andamento (Spec B, seção 2: só abre quando o onboarding conclui); inativo → nenhum período.
// Também tira o "desde sempre" exato dos setores do onboarding de quem nasceu de um onboarding ainda em andamento
// (origem 'onboarding' e esse é o único onboarding dele) — caso o Spec A tenha rodado antes sem a regra de onboarding.
// Com `simular`, só conta. ──
const migrarVigencia = async ({ simular = false, empresaId = null } = {}) => {
  const stats = { clientes: 0, pares: 0, jaTinham: 0, desdeSempre: 0, semPeriodoInativos: 0, semPeriodoOnboarding: 0, clientesAtualizados: 0, onboardingAjustados: 0, periodosRemovidos: 0 };
  const filtro = empresaId ? { empresa: empresaId } : {};

  // Setores de onboarding em andamento por cliente, e quantos onboardings (qualquer status) cada cliente já teve
  const emAndamento = new Map();
  const totalImplantacoes = new Map();
  for (const imp of await Implantacao.find(filtro).select('empresa cliente cnpj status etapas.setor').lean()) {
    const c = await clienteDaImplantacao(imp);
    if (!c) continue;
    const cid = String(c._id);
    totalImplantacoes.set(cid, (totalImplantacoes.get(cid) || 0) + 1);
    if (imp.status !== 'em_andamento') continue;
    const set = emAndamento.get(cid) || new Set();
    (imp.etapas || []).forEach(e => set.add(String(e.setor)));
    emAndamento.set(cid, set);
  }

  const cursor = Cliente.find(filtro).select('status origem setores vigenciaDemanda').lean().cursor();
  for await (const cliente of cursor) {
    stats.clientes++;
    const id = String(cliente._id);
    const pendentes = emAndamento.get(id) || new Set();
    const setores = [...new Set((cliente.setores || []).map(String))];
    const tem = new Set((cliente.vigenciaDemanda || []).map(v => String(v.setor)));
    stats.pares += setores.length;
    stats.jaTinham += setores.filter(s => tem.has(s)).length;

    // Cliente que nasceu de um onboarding ainda em andamento e ficou com "desde sempre" nos setores dele: tira
    if (cliente.origem === 'onboarding' && pendentes.size && totalImplantacoes.get(id) === 1) {
      let removidos = 0;
      const entradas = copiarEntradas(cliente).map(v => {
        if (!pendentes.has(String(v.setor))) return v;
        const periodos = v.periodos.filter(p => !(p.inicio === null && p.fim === null));
        removidos += v.periodos.length - periodos.length;
        return { setor: v.setor, periodos };
      });
      if (removidos) {
        stats.onboardingAjustados++; stats.periodosRemovidos += removidos;
        if (!simular) await Cliente.updateOne({ _id: cliente._id }, { $set: { vigenciaDemanda: entradas } });
      }
    }

    const semVigencia = setores.filter(s => !tem.has(s));
    if (cliente.status === 'inativo') { stats.semPeriodoInativos += semVigencia.length; continue; }
    const aAbrir = semVigencia.filter(s => !pendentes.has(s));
    stats.semPeriodoOnboarding += semVigencia.length - aAbrir.length;
    if (!aAbrir.length) continue;
    stats.desdeSempre += aAbrir.length;
    stats.clientesAtualizados++;
    if (simular) continue;
    // O filtro garante que uma execução concorrente não duplica a entrada de um setor
    await Cliente.updateOne(
      { _id: cliente._id, 'vigenciaDemanda.setor': { $nin: aAbrir } },
      { $push: { vigenciaDemanda: { $each: aAbrir.map(entradaDesdeSempre) } } }
    );
  }
  return stats;
};

module.exports = {
  periodoCobre, periodosDoSetor, regraDoSetorPermite, existeDemanda, clientesComDemanda,
  listarClientesComDemanda, entradaDesdeSempre, entradasQueFaltam, garantirVigenciaPadrao,
  removerVigenciaDoSetor, migrarVigencia, normalizarNome,
  somarMeses, mesDeInstanteBrasilia, mesDeDataCivil, copiarEntradas, temPeriodoAberto, abrirPeriodo,
  clienteDaImplantacao, setoresDeOnboardingEmAndamento,
};
