// Casos de teste do cálculo de retiradas de sócios (spec Contábil › Retiradas, seção 2).
// Rodar com: node scripts/testarRetiradas.js  (dentro de zempofy/backend) — não toca no banco.
const assert = require('node:assert/strict');
const {
  round2, totalDoSocioMes, calcularSocioMes, trimestreDaCompetencia, calcularTrimestre,
} = require('../services/retiradas');

let ok = 0;
const caso = (nome, fn) => { fn(); ok++; console.log(`✓ ${nome}`); };

// R1 — teste mensal por sócio
caso('0 → sem_retirada', () => assert.deepEqual(calcularSocioMes(0), { total: 0, tributavel: 0, irrf: 0, situacao: 'sem_retirada' }));
caso('49.999,99 → isento', () => assert.deepEqual(calcularSocioMes(49999.99), { total: 49999.99, tributavel: 0, irrf: 0, situacao: 'isento' }));
caso('50.000,00 → isento', () => assert.deepEqual(calcularSocioMes(50000), { total: 50000, tributavel: 0, irrf: 0, situacao: 'isento' }));
caso('50.000,01 → tributável, IRRF 5.000,00', () => assert.deepEqual(calcularSocioMes(50000.01), { total: 50000.01, tributavel: 50000.01, irrf: 5000, situacao: 'tributavel' }));
caso('68.500,00 → tributável, IRRF 6.850,00', () => assert.deepEqual(calcularSocioMes(68500), { total: 68500, tributavel: 68500, irrf: 6850, situacao: 'tributavel' }));

// R3 — trimestre
caso('lucro 210.000, distribuído 155.000 → saldo 55.000', () => assert.deepEqual(calcularTrimestre({ lucroApurado: 210000, saldoAnterior: 0, distribuido: 155000 }), { saldo: 55000, excedente: 0 }));
caso('lucro 100.000, distribuído 130.000 → excedente 30.000', () => assert.deepEqual(calcularTrimestre({ lucroApurado: 100000, saldoAnterior: 0, distribuido: 130000 }), { saldo: -30000, excedente: 30000 }));
caso('lucro null → sem saldo e sem excedente', () => assert.deepEqual(calcularTrimestre({ lucroApurado: null, saldoAnterior: 0, distribuido: 80000 }), { saldo: null, excedente: null }));
caso('saldo anterior entra na conta', () => assert.deepEqual(calcularTrimestre({ lucroApurado: 100000, saldoAnterior: 40000, distribuido: 130000 }), { saldo: 10000, excedente: 0 }));

// Soma de lançamentos e arredondamento (R5)
caso('modo total usa valorTotal', () => assert.equal(totalDoSocioMes({ modo: 'total', valorTotal: 32000, lancamentos: [{ valor: 1 }] }), 32000));
caso('modo detalhado soma os lançamentos sem erro de float', () => assert.equal(totalDoSocioMes({ modo: 'detalhado', lancamentos: [{ valor: 0.1 }, { valor: 0.2 }, { valor: 49999.71 }] }), 50000.01));
caso('round2(1.005) = 1.01', () => assert.equal(round2(1.005), 1.01));
caso('sem registro → 0', () => assert.equal(totalDoSocioMes(null), 0));

// Trimestre da competência
caso('2026-08 → 3º tri 2026 (jul–set)', () => assert.deepEqual(trimestreDaCompetencia('2026-08'), { ano: 2026, trimestre: 3, meses: ['2026-07', '2026-08', '2026-09'] }));
caso('2026-01 → 1º tri', () => assert.deepEqual(trimestreDaCompetencia('2026-01').meses, ['2026-01', '2026-02', '2026-03']));
caso('2026-12 → 4º tri', () => assert.equal(trimestreDaCompetencia('2026-12').trimestre, 4));

console.log(`\n${ok} casos passaram.`);
