// Espelho, no frontend, da regra de vigência de demanda (REGRAS_DEMANDA.md). A regra de verdade é
// a do backend (services/vigenciaDemanda.js) — as listas de Demandas e o card do Início já vêm
// dela prontas. Aqui só entra o que a tela do cliente precisa decidir sozinha (a aba de cada
// setor e as pastas de ano/mês). O teste backend/scripts/testarVigenciaDemanda.js confere que os
// dois lados respondem igual.
//
// Cada cliente tem, por setor, uma lista de períodos { inicio, fim } em competência "AAAA-MM":
// inicio null = desde sempre, fim null = em aberto, fim inclusivo. Setor sem período = sem demanda.

const normalizar = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export const periodoCobre = (periodo, competencia) =>
  (!periodo.inicio || periodo.inicio <= competencia) && (!periodo.fim || periodo.fim >= competencia)

export const periodosDoSetor = (cliente, setorId) =>
  (cliente?.vigenciaDemanda || []).find(v => String(v.setor) === String(setorId))?.periodos || []

// Regra adicional do setor, independente de competência. Fiscal: sem regime, ou "outro", não gera demanda.
export const regraDoSetorPermite = (cliente, setorNome) => {
  if (normalizar(setorNome) === 'fiscal') return !!cliente?.regime && cliente.regime !== 'outro'
  return true
}

// TRANSIÇÃO (Spec A, some no Spec B): inativo continua sem demanda em mês nenhum, lendo o status.
export const existeDemanda = ({ cliente, setorId, setorNome, competencia }) => {
  if (!cliente || cliente.status === 'inativo') return false
  if (!regraDoSetorPermite(cliente, setorNome)) return false
  return periodosDoSetor(cliente, setorId).some(p => periodoCobre(p, competencia))
}

// Pasta de ano/mês da aba do setor aparece quando há demanda naquele mês ou já existe lançamento
// salvo (um mês preenchido nunca some da lista). TRANSIÇÃO (Spec A): cliente inativo segue vendo
// todas as pastas do setor, somente leitura, como sempre foi — o Spec B troca isso pelo histórico real.
export const pastaVisivel = ({ cliente, setor, competencia, temLancamento = false }) => {
  if (temLancamento) return true
  if (existeDemanda({ cliente, setorId: setor._id, setorNome: setor.nome, competencia })) return true
  return cliente?.status === 'inativo'
    && regraDoSetorPermite(cliente, setor.nome)
    && (cliente.setores || []).some(s => String(s._id || s) === String(setor._id))
}
