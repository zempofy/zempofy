// Testes da regra central de vigência de demanda e dos eventos que mudam a vigência
// (Spec A e Spec B — REGRAS_DEMANDA.md, seções 2 e 3). Não toca no banco.
// Uso (dentro de backend/):  node scripts/testarVigenciaDemanda.js
//
// Gabarito S1–S9, S11, S12, S14, S15 (hoje = 15/11/2026): cada cenário é montado pelos MESMOS eventos que as rotas usam
// (concluir onboarding, inativar, reativar, remover/adicionar setor), não por períodos escritos à mão. Os eventos que
// dependem de banco (Remover tudo, Excluir cliente, migração) são testados no QA de integração, não aqui.
// Termina conferindo que o espelho do frontend responde igual ao backend.

const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const V = require('../services/vigenciaDemanda');
const { entradasAoConcluir, entradasAoAdicionarSetores, mesDeInicioDaImplantacao } = require('../services/ciclosCliente');

let ok = 0, falhas = 0;
const teste = (nome, fn) => {
  try { fn(); ok++; } catch (e) { falhas++; console.log(`  FALHOU  ${nome}\n          ${e.message.split('\n')[0]}`); }
};

const FISCAL = { id: 'setor-fiscal', nome: 'Fiscal' };
const DP = { id: 'setor-dp', nome: 'Departamento Pessoal' };
const CONTABIL = { id: 'setor-contabil', nome: 'Contábil' };

// competências de 2025-01 a 2028-12, em ordem
const MESES = [];
for (let a = 2025; a <= 2028; a++) for (let m = 1; m <= 12; m++) MESES.push(`${a}-${String(m).padStart(2, '0')}`);

const cliente = ({ status = 'ativo', regime = 'simples_nacional', entradas = [] } = {}) => ({ status, regime, vigenciaDemanda: entradas });
const entrada = (setor, ...periodos) => ({ setor: setor.id, periodos });
const existe = (c, setor, competencia) => V.existeDemanda({ cliente: c, setorId: setor.id, setorNome: setor.nome, competencia });
const comDemanda = (c, setor) => MESES.filter(m => existe(c, setor, m));
const esperado = (de, ate) => MESES.filter(m => (!de || m >= de) && (!ate || m <= ate));
const igual = (real, esp, msg) => assert.deepStrictEqual(real, esp, msg);
const DESDE_SEMPRE = { inicio: null, fim: null };

console.log('Gabarito (REGRAS_DEMANDA.md, seção 3) — montado pelos eventos reais');
teste('S1  cliente antigo, Fiscal com regime, desde sempre → todos os meses', () => {
  const c = cliente({ entradas: [entrada(FISCAL, DESDE_SEMPRE)] });
  igual(comDemanda(c, FISCAL), MESES);
  ['2025-01', '2026-10', '2026-11', '2027-03'].forEach(m => assert.ok(existe(c, FISCAL, m), m));
});
teste('S2  onboarding criado em 10/10/2026, início 01/11/2026, em andamento → nenhuma competência', () => {
  // criar o onboarding não abre período algum: o cliente nasce (ou já tinha o setor) sem vigência nos setores dele
  igual(comDemanda(cliente({ entradas: [] }), FISCAL), []);
  igual(comDemanda(cliente({ entradas: [entrada(DP, DESDE_SEMPRE)] }), FISCAL), []);
});
teste('S3  S2 concluído em 20/11/2026 (início 01/11) → 2026-11 em diante', () => {
  const imp = { inicioServicos: new Date('2026-11-01'), concluidaEm: new Date('2026-11-20T15:00:00Z') };
  const { entradas, abertos } = entradasAoConcluir([], [FISCAL.id], mesDeInicioDaImplantacao(imp));
  assert.deepStrictEqual(abertos, [FISCAL.id]);
  const c = cliente({ entradas });
  igual(comDemanda(c, FISCAL), esperado('2026-11', null));
  assert.ok(!existe(c, FISCAL, '2026-10'));
});
teste('S4  concluído em 20/11/2026 com início dos serviços em 01/09/2026 → 2026-09 em diante', () => {
  const imp = { inicioServicos: new Date('2026-09-01'), concluidaEm: new Date('2026-11-20T15:00:00Z') };
  const c = cliente({ entradas: entradasAoConcluir([], [FISCAL.id], mesDeInicioDaImplantacao(imp)).entradas });
  igual(comDemanda(c, FISCAL), esperado('2026-09', null));
  assert.ok(!existe(c, FISCAL, '2026-08'));
});
teste('S5  concluído em 05/11/2026 com início dos serviços em 01/01/2027 → 2027-01 em diante', () => {
  const imp = { inicioServicos: new Date('2027-01-01'), concluidaEm: new Date('2026-11-05T15:00:00Z') };
  const c = cliente({ entradas: entradasAoConcluir([], [FISCAL.id], mesDeInicioDaImplantacao(imp)).entradas });
  igual(comDemanda(c, FISCAL), esperado('2027-01', null));
  assert.ok(!existe(c, FISCAL, '2026-12'));
});
teste('S6  ativo desde 2026-03, inativado em 12/11/2026 (padrão: mês atual) → 2026-03 a 2026-10', () => {
  const antes = [entrada(FISCAL, { inicio: '2026-03', fim: null })];
  const c = cliente({ status: 'inativo', entradas: V.fecharPeriodosAbertos(antes, '2026-11') });
  igual(comDemanda(c, FISCAL), esperado('2026-03', '2026-10'));
  assert.ok(!existe(c, FISCAL, '2026-11'));
});
teste('S7  S6 e reativado em 05/02/2027 → 2026-03..2026-10 e 2027-02 em diante', () => {
  let e = V.fecharPeriodosAbertos([entrada(FISCAL, { inicio: '2026-03', fim: null })], '2026-11');
  e = V.abrirPeriodo(e, FISCAL.id, '2027-02').entradas;
  const c = cliente({ entradas: e });
  igual(comDemanda(c, FISCAL), [...esperado('2026-03', '2026-10'), ...esperado('2027-02', null)]);
  ['2026-11', '2026-12', '2027-01'].forEach(m => assert.ok(!existe(c, FISCAL, m), m));
});
teste('S8  remover Fiscal daqui pra frente em 08/11/2026 → Fiscal até 2026-10; DP em todos os meses', () => {
  const e = V.fecharPeriodosAbertos([entrada(FISCAL, DESDE_SEMPRE), entrada(DP, DESDE_SEMPRE)], '2026-11', FISCAL.id);
  const c = cliente({ entradas: e });
  igual(comDemanda(c, FISCAL), esperado(null, '2026-10'));
  igual(comDemanda(c, DP), MESES);
});
teste('S9  S8 e adicionar Fiscal de novo em 03/03/2027 → até 2026-10 e de 2027-03 em diante', () => {
  const removido = V.fecharPeriodosAbertos([entrada(FISCAL, DESDE_SEMPRE)], '2026-11', FISCAL.id);
  // setor que já teve vigência: nunca "desde sempre"; abre a partir do mês atual (03/2027)
  const e = entradasAoAdicionarSetores(removido, [FISCAL.id], { comecaEm: null, mesAtual: '2027-03' });
  const c = cliente({ entradas: e });
  igual(comDemanda(c, FISCAL), [...esperado(null, '2026-10'), ...esperado('2027-03', null)]);
  ['2026-11', '2027-02'].forEach(m => assert.ok(!existe(c, FISCAL, m), m));
});
teste('S11 inativar escolhendo "a partir de 2026-12" → até 2026-11 inclusive', () => {
  const c = cliente({ status: 'inativo', entradas: V.fecharPeriodosAbertos([entrada(FISCAL, DESDE_SEMPRE)], '2026-12') });
  igual(comDemanda(c, FISCAL), esperado(null, '2026-11'));
  assert.ok(existe(c, FISCAL, '2026-11') && !existe(c, FISCAL, '2026-12'));
});
teste('S12 Fiscal sem regime ou regime "outro", vigência aberta → nenhuma', () => {
  for (const regime of ['', null, 'outro']) {
    igual(comDemanda(cliente({ regime, entradas: [entrada(FISCAL, DESDE_SEMPRE)] }), FISCAL), [], `regime=${regime}`);
  }
  igual(comDemanda({ status: 'ativo', vigenciaDemanda: [entrada(FISCAL, DESDE_SEMPRE)] }, FISCAL), []); // campo regime ausente
});
teste('S12 a regra do Fiscal não vale para DP e Contábil', () => {
  const c = cliente({ regime: '', entradas: [entrada(DP, DESDE_SEMPRE), entrada(CONTABIL, DESDE_SEMPRE)] });
  igual(comDemanda(c, DP), MESES);
  igual(comDemanda(c, CONTABIL), MESES);
});
teste('S14 cliente em encerramento = igual ao ativo', () => {
  const e = [entrada(FISCAL, { inicio: '2026-03', fim: null })];
  igual(comDemanda(cliente({ status: 'encerramento', entradas: e }), FISCAL), comDemanda(cliente({ status: 'ativo', entradas: e }), FISCAL));
  assert.ok(existe(cliente({ status: 'encerramento', entradas: e }), FISCAL, '2026-11'));
});
teste('S15 cliente já inativo antes da mudança, último lançamento 2026-08 no Fiscal → até 2026-08; sem lançamento → nenhuma', () => {
  const c = cliente({ status: 'inativo', entradas: [{ setor: FISCAL.id, periodos: V.periodoLegadoInativo('2026-08') }] });
  igual(comDemanda(c, FISCAL), esperado(null, '2026-08'));
  assert.ok(!existe(c, FISCAL, '2026-09'));
  assert.deepStrictEqual(V.periodoLegadoInativo(null), []);
});

console.log('Eventos: bordas e idempotência');
teste('o status do cliente NÃO decide mais (só a vigência): inativo com período aberto/fechado segue a vigência', () => {
  igual(comDemanda(cliente({ status: 'inativo', entradas: [entrada(FISCAL, DESDE_SEMPRE)] }), FISCAL), MESES);
  igual(comDemanda(cliente({ status: 'ativo', entradas: [] }), FISCAL), []);
});
teste('cliente/setor sem nenhum período nunca tem demanda; vigência de outro setor não vale', () => {
  igual(comDemanda(cliente({}), FISCAL), []);
  igual(comDemanda({ status: 'ativo', regime: 'mei' }, FISCAL), []); // sem o campo
  igual(comDemanda(cliente({ entradas: [entrada(DP, DESDE_SEMPRE)] }), FISCAL), []);
});
teste('mês de início e de fim são inclusivos; virada de ano', () => {
  igual(comDemanda(cliente({ entradas: [entrada(FISCAL, { inicio: '2026-05', fim: '2026-05' })] }), FISCAL), ['2026-05']);
  const c = cliente({ entradas: [entrada(FISCAL, { inicio: null, fim: '2026-12' }, { inicio: '2027-01', fim: null })] });
  assert.ok(existe(c, FISCAL, '2026-12') && existe(c, FISCAL, '2027-01'));
  igual(V.somarMeses('2026-12', 1), '2027-01'); igual(V.somarMeses('2027-01', -1), '2026-12');
  const fechado = V.fecharPeriodosAbertos([entrada(FISCAL, DESDE_SEMPRE)], '2027-01'); // inativar em janeiro → fim em dezembro
  igual(fechado[0].periodos[0].fim, '2026-12');
});
teste('inativar: não mexe em período já fechado; é idempotente; fecha todos os setores', () => {
  const e = [entrada(FISCAL, { inicio: '2026-01', fim: '2026-04' }, { inicio: '2026-08', fim: null }), entrada(DP, DESDE_SEMPRE)];
  const f1 = V.fecharPeriodosAbertos(e, '2026-11');
  igual(f1[0].periodos, [{ inicio: '2026-01', fim: '2026-04' }, { inicio: '2026-08', fim: '2026-10' }]);
  igual(f1[1].periodos, [{ inicio: null, fim: '2026-10' }]);
  igual(V.fecharPeriodosAbertos(f1, '2026-11'), f1);
});
teste('inativar em mês anterior ao início do período: o período vazio deixa de existir', () => {
  const f = V.fecharPeriodosAbertos([entrada(FISCAL, { inicio: '2026-11', fim: null })], '2026-10'); // fim seria 2026-09 < início
  igual(f[0].periodos, []);
});
teste('abrir período: idempotente; reabre o que terminou no mês anterior; senão acrescenta', () => {
  const aberto = [entrada(FISCAL, DESDE_SEMPRE)];
  assert.strictEqual(V.abrirPeriodo(aberto, FISCAL.id, '2026-11').abriu, false);
  const fechado = [entrada(FISCAL, { inicio: '2026-03', fim: '2026-10' })];
  igual(V.abrirPeriodo(fechado, FISCAL.id, '2026-11').entradas[0].periodos, [{ inicio: '2026-03', fim: null }]); // emenda
  igual(V.abrirPeriodo(fechado, FISCAL.id, '2027-02').entradas[0].periodos, [{ inicio: '2026-03', fim: '2026-10' }, { inicio: '2027-02', fim: null }]);
  igual(V.abrirPeriodo([], FISCAL.id, '2026-11').entradas, [entrada(FISCAL, { inicio: '2026-11', fim: null })]);
});
teste('concluir onboarding duas vezes não duplica; setor que já tem período aberto não é tocado', () => {
  const a = entradasAoConcluir([], [FISCAL.id, DP.id], '2026-11');
  const b = entradasAoConcluir(a.entradas, [FISCAL.id, DP.id], '2026-11');
  assert.deepStrictEqual(b.abertos, []);
  igual(b.entradas, a.entradas);
  // cliente que já tinha o Fiscal "desde sempre" e inicia onboarding só de DP: Fiscal não muda
  const c = entradasAoConcluir([entrada(FISCAL, DESDE_SEMPRE)], [DP.id], '2026-11');
  igual(c.entradas[0].periodos, [DESDE_SEMPRE]);
  assert.deepStrictEqual(c.abertos, [DP.id]);
});
teste('mês de início do onboarding: data de início dos serviços (calendário) ou mês da conclusão em Brasília', () => {
  igual(mesDeInicioDaImplantacao({ inicioServicos: new Date('2026-11-01'), concluidaEm: new Date('2027-02-10T12:00:00Z') }), '2026-11');
  igual(mesDeInicioDaImplantacao({ inicioServicos: null, concluidaEm: new Date('2026-11-20T15:00:00Z') }), '2026-11');
  // 01/12/2026 01:00 UTC ainda é 30/11 em Brasília → mês da conclusão = novembro
  igual(mesDeInicioDaImplantacao({ inicioServicos: null, concluidaEm: new Date('2026-12-01T01:00:00Z') }), '2026-11');
});
teste('adicionar setor: nunca teve → desde sempre (ou "começa em"); já teve → período novo, nunca desde sempre', () => {
  igual(entradasAoAdicionarSetores([], [FISCAL.id], { mesAtual: '2026-11' })[0].periodos, [DESDE_SEMPRE]);
  igual(entradasAoAdicionarSetores([], [FISCAL.id], { comecaEm: '2026-05', mesAtual: '2026-11' })[0].periodos, [{ inicio: '2026-05', fim: null }]);
  const removido = [entrada(FISCAL, { inicio: null, fim: '2026-10' })];
  igual(entradasAoAdicionarSetores(removido, [FISCAL.id], { mesAtual: '2027-03' })[0].periodos, [{ inicio: null, fim: '2026-10' }, { inicio: '2027-03', fim: null }]);
  igual(entradasAoAdicionarSetores(removido, [FISCAL.id], { comecaEm: '2027-01', mesAtual: '2027-03' })[0].periodos[1], { inicio: '2027-01', fim: null });
  igual(entradasAoAdicionarSetores([entrada(FISCAL, DESDE_SEMPRE)], [FISCAL.id], { mesAtual: '2027-03' })[0].periodos, [DESDE_SEMPRE]); // já aberto
});
teste('mês da ação: janela de 12 meses pra trás e pra frente; formato AAAA-MM', () => {
  const hoje = V.mesAtualBrasilia();
  assert.ok(V.mesDentroDaJanela(hoje) && V.mesDentroDaJanela(V.somarMeses(hoje, -12)) && V.mesDentroDaJanela(V.somarMeses(hoje, 12)));
  assert.ok(!V.mesDentroDaJanela(V.somarMeses(hoje, -13)) && !V.mesDentroDaJanela(V.somarMeses(hoje, 13)));
  assert.ok(!V.mesValido('2026-13') && !V.mesValido('2026-1') && !V.mesValido('') && !V.mesValido(null) && V.mesValido('2026-01'));
});

console.log('Ajuste manual da vigência');
teste('ajustar início do primeiro período e fim do último; valida início > fim', () => {
  const e = [entrada(FISCAL, { inicio: '2026-03', fim: '2026-10' })];
  igual(V.ajustarVigencia(e, FISCAL.id, { inicio: '2025-01' }).entradas[0].periodos, [{ inicio: '2025-01', fim: '2026-10' }]);
  igual(V.ajustarVigencia(e, FISCAL.id, { inicio: null }).entradas[0].periodos, [{ inicio: null, fim: '2026-10' }]); // desde sempre
  igual(V.ajustarVigencia(e, FISCAL.id, { fim: '2026-12' }).entradas[0].periodos, [{ inicio: '2026-03', fim: '2026-12' }]);
  igual(V.ajustarVigencia(e, FISCAL.id, { fim: null }).entradas[0].periodos, [{ inicio: '2026-03', fim: null }]);
  assert.ok(V.ajustarVigencia(e, FISCAL.id, { inicio: '2026-11' }).erro);
  assert.ok(V.ajustarVigencia(e, FISCAL.id, { fim: '2026-01' }).erro);
  assert.ok(V.ajustarVigencia(e, FISCAL.id, { inicio: '2026-13' }).erro);
});
teste('o fim não pode ser anterior ao último lançamento salvo', () => {
  const e = [entrada(FISCAL, { inicio: '2026-03', fim: null })];
  assert.ok(V.ajustarVigencia(e, FISCAL.id, { fim: '2026-06' }, '2026-08').erro.includes('2026-08'));
  assert.ok(!V.ajustarVigencia(e, FISCAL.id, { fim: '2026-08' }, '2026-08').erro);
  assert.ok(!V.ajustarVigencia(e, FISCAL.id, { fim: null }, '2026-08').erro);
});
teste('vários períodos: ajusta só o início do primeiro e o fim do último; setor sem vigência dá erro', () => {
  const e = [entrada(FISCAL, { inicio: '2026-01', fim: '2026-03' }, { inicio: '2026-08', fim: '2026-10' })];
  const r = V.ajustarVigencia(e, FISCAL.id, { inicio: '2025-06', fim: '2026-12' });
  igual(r.entradas[0].periodos, [{ inicio: '2025-06', fim: '2026-03' }, { inicio: '2026-08', fim: '2026-12' }]);
  assert.ok(V.ajustarVigencia([], FISCAL.id, { inicio: '2026-01' }).erro);
});

console.log('Em lote');
teste('clientesComDemanda filtra a lista; o status não entra', () => {
  const lista = [
    { _id: 1, ...cliente({ entradas: [entrada(FISCAL, DESDE_SEMPRE)] }) },
    { _id: 2, ...cliente({ status: 'inativo', entradas: [entrada(FISCAL, { inicio: null, fim: '2026-08' })] }) },
    { _id: 3, ...cliente({ regime: 'outro', entradas: [entrada(FISCAL, DESDE_SEMPRE)] }) },
    { _id: 4, ...cliente({ entradas: [entrada(FISCAL, { inicio: '2027-01', fim: null })] }) },
    { _id: 5, ...cliente({}) },
  ];
  const ids = (competencia) => V.clientesComDemanda(lista, { setorId: FISCAL.id, setorNome: 'Fiscal', competencia }).map(c => c._id);
  igual(ids('2026-07'), [1, 2]); // o inativo ainda aparece nos meses anteriores à inativação (histórico)
  igual(ids('2026-11'), [1]);
  igual(ids('2027-02'), [1, 4]);
});
teste('setor identificado por string ou ObjectId dá o mesmo resultado', () => {
  const { Types } = require('mongoose');
  const id = new Types.ObjectId();
  const c = { status: 'ativo', regime: 'mei', vigenciaDemanda: [{ setor: id, periodos: [DESDE_SEMPRE] }] };
  assert.ok(V.existeDemanda({ cliente: c, setorId: String(id), setorNome: 'Fiscal', competencia: '2026-11' }));
  assert.ok(V.existeDemanda({ cliente: c, setorId: id, setorNome: 'Fiscal', competencia: '2026-11' }));
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
    const pb = V.periodosDoSetor(c, 's1').some(p => V.periodoCobre(p, competencia));
    const pf = F.competenciaNaVigencia(c, 's1', competencia);
    if (a !== b || pb !== pf) diferentes++;
  }
  teste(`4000 combinações aleatórias: backend == frontend (${diferentes} diferença(s))`, () => assert.strictEqual(diferentes, 0));
  teste('frontend: rótulos de mês e descrição dos períodos', () => {
    igual(F.rotuloMes('2026-10'), 'Outubro/2026');
    igual(F.mesAnterior('2027-01'), '2026-12');
    igual(F.descreverPeriodos([{ inicio: '2026-03', fim: '2026-10' }, { inicio: null, fim: null }]), ['desde sempre, em aberto', 'de Março/2026 até Outubro/2026']);
    igual(F.descreverPeriodos([{ inicio: null, fim: '2026-08' }, { inicio: '2027-02', fim: null }]), ['desde sempre até Agosto/2026', 'de Fevereiro/2027 em diante']);
  });
};

rodarParidade().then(() => {
  console.log(`\n${ok} verificações passaram, ${falhas} falharam.`);
  process.exit(falhas ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
