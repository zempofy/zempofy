// Testes da regra central de vigência de demanda (Spec A — REGRAS_DEMANDA.md, seção 3).
// Não toca no banco. Uso (dentro de backend/):  node scripts/testarVigenciaDemanda.js
//
// Cenários S1–S9, S11, S12 e S14 do gabarito (hoje = 15/11/2026) + casos de borda + conferência de
// que o espelho do frontend responde igual ao backend. Os cenários que dependem de eventos do Spec B
// (onboarding, inativar com mês, reativar, remover setor) são testados com os períodos já montados.

const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const V = require('../services/vigenciaDemanda');

let ok = 0, falhas = 0;
const teste = (nome, fn) => {
  try { fn(); ok++; } catch (e) { falhas++; console.log(`  FALHOU  ${nome}\n          ${e.message.split('\n')[0]}`); }
};

const FISCAL = { id: 'setor-fiscal', nome: 'Fiscal' };
const DP = { id: 'setor-dp', nome: 'Departamento Pessoal' };

// competências de 2025-01 a 2028-12, em ordem
const MESES = [];
for (let a = 2025; a <= 2028; a++) for (let m = 1; m <= 12; m++) MESES.push(`${a}-${String(m).padStart(2, '0')}`);

const cliente = ({ status = 'ativo', regime = 'simples_nacional', vigencia = {} } = {}) => ({
  status, regime,
  vigenciaDemanda: Object.entries(vigencia).map(([setor, periodos]) => ({ setor, periodos })),
});
const existe = (c, setor, competencia) => V.existeDemanda({ cliente: c, setorId: setor.id, setorNome: setor.nome, competencia });
const comDemanda = (c, setor) => MESES.filter(m => existe(c, setor, m));
const esperado = (de, ate) => MESES.filter(m => (!de || m >= de) && (!ate || m <= ate));
const igual = (real, esp, msg) => assert.deepStrictEqual(real, esp, msg);

console.log('Gabarito (REGRAS_DEMANDA.md, seção 3)');
teste('S1  cliente antigo, Fiscal com regime, desde sempre → todos os meses', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: null, fim: null }] } });
  igual(comDemanda(c, FISCAL), MESES);
  ['2025-01', '2026-10', '2026-11', '2027-03'].forEach(m => assert.ok(existe(c, FISCAL, m), m));
});
teste('S2  onboarding em andamento (nenhum período) → nenhuma competência', () => {
  igual(comDemanda(cliente({ vigencia: {} }), FISCAL), []);
  igual(comDemanda(cliente({ vigencia: { [FISCAL.id]: [] } }), FISCAL), []);
});
teste('S3  concluído em 20/11/2026, início 01/11/2026 → 2026-11 em diante', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: '2026-11', fim: null }] } });
  igual(comDemanda(c, FISCAL), esperado('2026-11', null));
  assert.ok(!existe(c, FISCAL, '2026-10'));
});
teste('S4  concluído em 20/11/2026, início 01/09/2026 → 2026-09 em diante', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: '2026-09', fim: null }] } });
  igual(comDemanda(c, FISCAL), esperado('2026-09', null));
  assert.ok(!existe(c, FISCAL, '2026-08'));
});
teste('S5  concluído em 05/11/2026, início 01/01/2027 → 2027-01 em diante', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: '2027-01', fim: null }] } });
  igual(comDemanda(c, FISCAL), esperado('2027-01', null));
  assert.ok(!existe(c, FISCAL, '2026-12'));
});
teste('S6  ativo desde 2026-03, inativado em 12/11/2026 (fim 2026-10) → 2026-03 a 2026-10', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: '2026-03', fim: '2026-10' }] } });
  igual(comDemanda(c, FISCAL), esperado('2026-03', '2026-10'));
  assert.ok(!existe(c, FISCAL, '2026-11'));
});
teste('S7  S6 e reativado em 05/02/2027 → 2026-03..2026-10 e 2027-02 em diante', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: '2026-03', fim: '2026-10' }, { inicio: '2027-02', fim: null }] } });
  igual(comDemanda(c, FISCAL), [...esperado('2026-03', '2026-10'), ...esperado('2027-02', null)]);
  ['2026-11', '2026-12', '2027-01'].forEach(m => assert.ok(!existe(c, FISCAL, m), m));
});
teste('S8  remover Fiscal daqui pra frente em 08/11/2026: Fiscal até 2026-10, DP em todos', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: null, fim: '2026-10' }], [DP.id]: [{ inicio: null, fim: null }] } });
  igual(comDemanda(c, FISCAL), esperado(null, '2026-10'));
  igual(comDemanda(c, DP), MESES);
});
teste('S9  S8 e adicionar Fiscal de novo em 03/03/2027 → até 2026-10 e de 2027-03 em diante', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: null, fim: '2026-10' }, { inicio: '2027-03', fim: null }] } });
  igual(comDemanda(c, FISCAL), [...esperado(null, '2026-10'), ...esperado('2027-03', null)]);
  ['2026-11', '2027-02'].forEach(m => assert.ok(!existe(c, FISCAL, m), m));
});
teste('S11 inativar escolhendo "a partir de 2026-12" → até 2026-11 inclusive', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: null, fim: '2026-11' }] } });
  igual(comDemanda(c, FISCAL), esperado(null, '2026-11'));
  assert.ok(existe(c, FISCAL, '2026-11') && !existe(c, FISCAL, '2026-12'));
});
teste('S12 Fiscal sem regime ou regime "outro", vigência aberta → nenhuma', () => {
  for (const regime of ['', null, 'outro']) {
    const c = cliente({ regime, vigencia: { [FISCAL.id]: [{ inicio: null, fim: null }] } });
    igual(comDemanda(c, FISCAL), [], `regime=${regime}`);
  }
  // campo regime ausente (cadastro de onboarding ainda sem regime)
  igual(comDemanda({ status: 'ativo', vigenciaDemanda: [{ setor: FISCAL.id, periodos: [{ inicio: null, fim: null }] }] }, FISCAL), []);
});
teste('S12 a regra do Fiscal não vale para DP e Contábil', () => {
  const c = cliente({ regime: '', vigencia: { [DP.id]: [{ inicio: null, fim: null }] } });
  igual(comDemanda(c, DP), MESES);
  igual(comDemanda(c, { id: DP.id, nome: 'Contábil' }), MESES);
});
teste('S14 cliente em encerramento = igual ao ativo', () => {
  const v = { [FISCAL.id]: [{ inicio: '2026-03', fim: null }] };
  igual(comDemanda(cliente({ status: 'encerramento', vigencia: v }), FISCAL), comDemanda(cliente({ status: 'ativo', vigencia: v }), FISCAL));
  assert.ok(existe(cliente({ status: 'encerramento', vigencia: v }), FISCAL, '2026-11'));
});

console.log('Bordas');
teste('cliente/setor sem nenhum período nunca tem demanda', () => {
  igual(comDemanda(cliente({}), FISCAL), []);
  igual(comDemanda({ status: 'ativo', regime: 'mei' }, FISCAL), []); // sem o campo (cliente antigo, antes da migração)
  igual(comDemanda(cliente({ vigencia: { [DP.id]: [{ inicio: null, fim: null }] } }), FISCAL), []); // vigência é de outro setor
});
teste('mês de fim é inclusivo e o de início também', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: '2026-05', fim: '2026-05' }] } });
  igual(comDemanda(c, FISCAL), ['2026-05']);
});
teste('virada de ano: fim em dezembro, início em janeiro', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: null, fim: '2026-12' }, { inicio: '2027-01', fim: null }] } });
  assert.ok(existe(c, FISCAL, '2026-12') && existe(c, FISCAL, '2027-01'));
  const c2 = cliente({ vigencia: { [FISCAL.id]: [{ inicio: '2026-06', fim: '2026-12' }] } });
  assert.ok(existe(c2, FISCAL, '2026-12') && !existe(c2, FISCAL, '2027-01'));
  const c3 = cliente({ vigencia: { [FISCAL.id]: [{ inicio: '2027-01', fim: null }] } });
  assert.ok(!existe(c3, FISCAL, '2026-12') && existe(c3, FISCAL, '2027-01'));
});
teste('dois períodos com intervalo: o meio fica de fora; ordem dos períodos não importa', () => {
  const a = { inicio: '2026-01', fim: '2026-03' }, b = { inicio: '2026-07', fim: null };
  igual(comDemanda(cliente({ vigencia: { [FISCAL.id]: [a, b] } }), FISCAL), comDemanda(cliente({ vigencia: { [FISCAL.id]: [b, a] } }), FISCAL));
  const c = cliente({ vigencia: { [FISCAL.id]: [a, b] } });
  ['2026-04', '2026-05', '2026-06'].forEach(m => assert.ok(!existe(c, FISCAL, m), m));
});
teste('período desde sempre cobre o passado distante e o futuro', () => {
  const c = cliente({ vigencia: { [FISCAL.id]: [{ inicio: null, fim: null }] } });
  assert.ok(existe(c, FISCAL, '1999-01') && existe(c, FISCAL, '2099-12'));
});
teste('TRANSIÇÃO: inativo não tem demanda em mês nenhum, mesmo com período; reativar devolve', () => {
  const v = { [FISCAL.id]: [{ inicio: null, fim: null }] };
  igual(comDemanda(cliente({ status: 'inativo', vigencia: v }), FISCAL), []);
  igual(comDemanda(cliente({ status: 'ativo', vigencia: v }), FISCAL), MESES);
});
teste('setor identificado por string ou ObjectId dá o mesmo resultado', () => {
  const { Types } = require('mongoose');
  const id = new Types.ObjectId();
  const c = { status: 'ativo', regime: 'mei', vigenciaDemanda: [{ setor: id, periodos: [{ inicio: null, fim: null }] }] };
  assert.ok(V.existeDemanda({ cliente: c, setorId: String(id), setorNome: 'Fiscal', competencia: '2026-11' }));
  assert.ok(V.existeDemanda({ cliente: c, setorId: id, setorNome: 'Fiscal', competencia: '2026-11' }));
});
teste('clientesComDemanda filtra a lista em lote', () => {
  const lista = [
    { _id: 1, ...cliente({ vigencia: { [FISCAL.id]: [{ inicio: null, fim: null }] } }) },
    { _id: 2, ...cliente({ status: 'inativo', vigencia: { [FISCAL.id]: [{ inicio: null, fim: null }] } }) },
    { _id: 3, ...cliente({ regime: 'outro', vigencia: { [FISCAL.id]: [{ inicio: null, fim: null }] } }) },
    { _id: 4, ...cliente({ vigencia: { [FISCAL.id]: [{ inicio: '2027-01', fim: null }] } }) },
    { _id: 5, ...cliente({}) },
  ];
  igual(V.clientesComDemanda(lista, { setorId: FISCAL.id, setorNome: 'Fiscal', competencia: '2026-11' }).map(c => c._id), [1]);
  igual(V.clientesComDemanda(lista, { setorId: FISCAL.id, setorNome: 'Fiscal', competencia: '2027-02' }).map(c => c._id), [1, 4]);
});

console.log('Escrita da vigência (Spec A: reproduz o comportamento de antes)');
teste('entradasQueFaltam: ativo ganha "desde sempre" só nos setores sem vigência', () => {
  const faltam = V.entradasQueFaltam({ status: 'ativo', setores: ['a', 'b', 'a'], vigenciaDemanda: [{ setor: 'a', periodos: [{ inicio: '2026-01', fim: null }] }] });
  igual(faltam, [{ setor: 'b', periodos: [{ inicio: null, fim: null }] }]);
});
teste('entradasQueFaltam: inativo não ganha período; encerramento ganha', () => {
  igual(V.entradasQueFaltam({ status: 'inativo', setores: ['a'], vigenciaDemanda: [] }), []);
  igual(V.entradasQueFaltam({ status: 'encerramento', setores: ['a'], vigenciaDemanda: [] }).length, 1);
});
teste('entradasQueFaltam: idempotente (rodar de novo não acrescenta nada)', () => {
  const c = { status: 'ativo', setores: ['a', 'b'], vigenciaDemanda: [] };
  c.vigenciaDemanda.push(...V.entradasQueFaltam(c));
  igual(V.entradasQueFaltam(c), []);
  igual(c.vigenciaDemanda.length, 2);
});
teste('garantirVigenciaPadrao / removerVigenciaDoSetor em documento', () => {
  const doc = { status: 'ativo', setores: ['a', 'b'], vigenciaDemanda: [] };
  assert.strictEqual(V.garantirVigenciaPadrao(doc), true);
  assert.strictEqual(V.garantirVigenciaPadrao(doc), false);
  V.removerVigenciaDoSetor(doc, 'a');
  igual(doc.vigenciaDemanda.map(v => v.setor), ['b']);
});

console.log('Espelho do frontend responde igual ao backend');
const rodarParidade = async () => {
  const F = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/utils/vigenciaDemanda.js')).href);
  let semente = 12345;
  const rnd = () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const mes = () => pick([null, ...MESES]);
  let diferentes = 0;
  for (let i = 0; i < 4000; i++) {
    const periodos = Array.from({ length: Math.floor(rnd() * 4) }, () => ({ inicio: mes(), fim: mes() }));
    const c = {
      status: pick(['ativo', 'inativo', 'encerramento']),
      regime: pick(['', null, 'outro', 'mei', 'simples_nacional']),
      vigenciaDemanda: rnd() < 0.2 ? [] : [{ setor: 's1', periodos }],
    };
    const setorNome = pick(['Fiscal', 'fiscal', 'Departamento Pessoal', 'Contábil', 'Legalização']);
    const competencia = pick(MESES);
    const a = V.existeDemanda({ cliente: c, setorId: 's1', setorNome, competencia });
    const b = F.existeDemanda({ cliente: c, setorId: 's1', setorNome, competencia });
    if (a !== b) diferentes++;
  }
  teste(`4000 combinações aleatórias: backend == frontend (${diferentes} diferença(s))`, () => assert.strictEqual(diferentes, 0));
  teste('pastaVisivel: ativo com vigência aberta vê todos os meses; inativo sem período segue vendo (transição)', () => {
    const setor = { _id: 's1', nome: 'Fiscal' };
    const ativo = { status: 'ativo', regime: 'mei', setores: [setor], vigenciaDemanda: [{ setor: 's1', periodos: [{ inicio: null, fim: null }] }] };
    assert.ok(MESES.every(m => F.pastaVisivel({ cliente: ativo, setor, competencia: m })));
    const inativo = { ...ativo, status: 'inativo', vigenciaDemanda: [] };
    assert.ok(MESES.every(m => F.pastaVisivel({ cliente: inativo, setor, competencia: m })));
  });
  teste('pastaVisivel: mês sem demanda some, mas mês com lançamento salvo nunca some', () => {
    const setor = { _id: 's1', nome: 'Fiscal' };
    const c = { status: 'ativo', regime: 'mei', setores: [setor], vigenciaDemanda: [{ setor: 's1', periodos: [{ inicio: '2026-06', fim: null }] }] };
    assert.ok(!F.pastaVisivel({ cliente: c, setor, competencia: '2026-05' }));
    assert.ok(F.pastaVisivel({ cliente: c, setor, competencia: '2026-05', temLancamento: true }));
    assert.ok(F.pastaVisivel({ cliente: c, setor, competencia: '2026-06' }));
  });
};

rodarParidade().then(() => {
  console.log(`\n${ok} verificações passaram, ${falhas} falharam.`);
  process.exit(falhas ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
