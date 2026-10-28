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

// Só a vigência e a regra do setor decidem; o status do cliente não entra ("inativo" fecha os períodos).
export const existeDemanda = ({ cliente, setorId, setorNome, competencia }) => {
  if (!cliente) return false
  if (!regraDoSetorPermite(cliente, setorNome)) return false
  return periodosDoSetor(cliente, setorId).some(p => periodoCobre(p, competencia))
}

// A competência está dentro de algum período do setor? (a aba do cliente mostra "Fora da vigência" quando não)
export const competenciaNaVigencia = (cliente, setorId, competencia) =>
  periodosDoSetor(cliente, setorId).some(p => periodoCobre(p, competencia))

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const rotuloMes = (competencia) => (competencia ? `${MESES[Number(competencia.slice(5, 7)) - 1]}/${competencia.slice(0, 4)}` : '')

export const mesAnterior = (competencia) => {
  const [a, m] = competencia.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// Texto da vigência do setor pra mostrar na aba (um item por período):
// "desde sempre, em aberto" · "desde sempre até Outubro/2026" · "de Março/2026 em diante" · "de Março/2026 até Outubro/2026"
const descreverPeriodo = (p) => {
  if (!p.inicio && !p.fim) return 'desde sempre, em aberto'
  if (!p.inicio) return `desde sempre até ${rotuloMes(p.fim)}`
  if (!p.fim) return `de ${rotuloMes(p.inicio)} em diante`
  return `de ${rotuloMes(p.inicio)} até ${rotuloMes(p.fim)}`
}
export const descreverPeriodos = (periodos) =>
  [...periodos].sort((a, b) => (a.inicio || '').localeCompare(b.inicio || '')).map(descreverPeriodo)
