const Cliente = require('../models/Cliente');

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
const entradasQueFaltam = (cliente) => {
  if (cliente.status === 'inativo') return [];
  const tem = new Set((cliente.vigenciaDemanda || []).map(v => String(v.setor)));
  const faltam = [];
  for (const setor of cliente.setores || []) {
    const id = String(setor._id || setor);
    if (tem.has(id)) continue;
    tem.add(id);
    faltam.push(entradaDesdeSempre(setor._id || setor));
  }
  return faltam;
};

// Versão pra documento Mongoose (create/save): completa e diz se mudou algo.
const garantirVigenciaPadrao = (doc) => {
  const faltam = entradasQueFaltam(doc);
  faltam.forEach(e => doc.vigenciaDemanda.push(e));
  return faltam.length > 0;
};

// Tirar o setor do cliente tira a demanda dele (hoje isso vale pra todos os meses).
const removerVigenciaDoSetor = (doc, setorId) => {
  doc.vigenciaDemanda = (doc.vigenciaDemanda || []).filter(v => String(v.setor) !== String(setorId));
};

// ── Migração dos dados existentes — idempotente e só soma (não toca em setores, lançamentos,
// documentos nem status). Ativo/encerramento → "desde sempre, em aberto"; inativo → nenhum período.
// Com `simular`, só conta. ──
const migrarVigencia = async ({ simular = false, empresaId = null } = {}) => {
  const stats = { clientes: 0, pares: 0, jaTinham: 0, desdeSempre: 0, semPeriodoInativos: 0, clientesAtualizados: 0 };
  const filtro = empresaId ? { empresa: empresaId } : {};
  const cursor = Cliente.find(filtro).select('status setores vigenciaDemanda').lean().cursor();
  for await (const cliente of cursor) {
    stats.clientes++;
    const setores = [...new Set((cliente.setores || []).map(String))];
    const tem = new Set((cliente.vigenciaDemanda || []).map(v => String(v.setor)));
    stats.pares += setores.length;
    stats.jaTinham += setores.filter(id => tem.has(id)).length;
    const semVigencia = setores.filter(id => !tem.has(id));
    if (cliente.status === 'inativo') { stats.semPeriodoInativos += semVigencia.length; continue; }
    if (!semVigencia.length) continue;
    stats.desdeSempre += semVigencia.length;
    stats.clientesAtualizados++;
    if (simular) continue;
    // O filtro garante que uma execução concorrente não duplica a entrada de um setor
    await Cliente.updateOne(
      { _id: cliente._id, 'vigenciaDemanda.setor': { $nin: semVigencia } },
      { $push: { vigenciaDemanda: { $each: semVigencia.map(entradaDesdeSempre) } } }
    );
  }
  return stats;
};

module.exports = {
  periodoCobre, periodosDoSetor, regraDoSetorPermite, existeDemanda, clientesComDemanda,
  listarClientesComDemanda, entradaDesdeSempre, entradasQueFaltam, garantirVigenciaPadrao,
  removerVigenciaDoSetor, migrarVigencia, normalizarNome,
};
