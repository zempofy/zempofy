// Cálculo das retiradas de lucro dos sócios (Contábil › Retiradas). Funções puras, sem acesso ao
// banco — as rotas buscam os dados e chamam daqui, e nada de imposto calculado é gravado: tudo é
// recalculado na leitura. Assim, se o limite ou a alíquota mudarem, basta mexer em PARAMETROS.

// Teste mensal por sócio (mesma empresa + mesmo sócio + mesmo mês): total ESTRITAMENTE maior que
// o limite torna tributável o total inteiro (não só o excedente). Exatamente o limite é isento.
const PARAMETROS = {
  limiteMensal: 50000,
  aliquota: 0.10,
};

// Arredonda a 2 casas tolerando o erro de ponto flutuante (ex: 1.005 * 100 = 100.49999...).
const round2 = (n) => {
  const num = Number(n) || 0;
  const sinal = num < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs(num) * 100 + 1e-9)) / 100;
};

const totalDoSocioMes = (doc) => {
  if (!doc) return 0;
  if (doc.modo === 'detalhado') {
    return round2((doc.lancamentos || []).reduce((soma, l) => round2(soma + (Number(l.valor) || 0)), 0));
  }
  return round2(doc.valorTotal);
};

const calcularSocioMes = (total) => {
  const t = round2(total);
  if (t <= 0) return { total: 0, tributavel: 0, irrf: 0, situacao: 'sem_retirada' };
  if (t <= PARAMETROS.limiteMensal) return { total: t, tributavel: 0, irrf: 0, situacao: 'isento' };
  return { total: t, tributavel: t, irrf: round2(t * PARAMETROS.aliquota), situacao: 'tributavel' };
};

// Trimestre de calendário: jan–mar, abr–jun, jul–set, out–dez.
const trimestreDaCompetencia = (competencia) => {
  const [ano, mes] = competencia.split('-').map(Number);
  const trimestre = Math.ceil(mes / 3);
  const primeiroMes = (trimestre - 1) * 3 + 1;
  const meses = [0, 1, 2].map(i => `${ano}-${String(primeiroMes + i).padStart(2, '0')}`);
  return { ano, trimestre, meses };
};

// Lucro não informado (null) = sem saldo e sem excedente: só o distribuído é mostrado.
const calcularTrimestre = ({ lucroApurado, saldoAnterior, distribuido }) => {
  if (lucroApurado === null || lucroApurado === undefined) return { saldo: null, excedente: null };
  const saldo = round2(round2(lucroApurado) + round2(saldoAnterior || 0) - round2(distribuido || 0));
  return { saldo, excedente: saldo < 0 ? round2(-saldo) : 0 };
};

module.exports = {
  PARAMETROS,
  round2,
  totalDoSocioMes,
  calcularSocioMes,
  trimestreDaCompetencia,
  calcularTrimestre,
};
