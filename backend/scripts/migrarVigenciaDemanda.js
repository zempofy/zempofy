// Migração da vigência de demanda (Spec A + B — REGRAS_DEMANDA.md). É a mesma função que roda sozinha
// na partida do servidor (services/vigenciaDemanda.js → migrarVigenciaDemanda); este script existe pra
// SIMULAR antes e conferir os números.
//
//  M1  cliente ainda não migrado: ativo/encerramento → "desde sempre" nos setores (menos nos de onboarding em andamento);
//      inativo → vigência até o mês do último lançamento do setor (sem lançamento, sem período)
//  M2  cliente nascido de um onboarding ainda em andamento que tinha ficado com "desde sempre" → perde essa vigência
//  M3  cliente inativo antigo com setor sem vigência → até o mês do último lançamento do setor
//
// Simulação por padrão — NÃO grava nada a menos que --aplicar seja passado explicitamente.
//
// Uso (dentro de backend/):
//   node scripts/migrarVigenciaDemanda.js                          # simulação (padrão)
//   node scripts/migrarVigenciaDemanda.js --aplicar                # grava de verdade
//   node scripts/migrarVigenciaDemanda.js --empresa=<id>           # escopo a 1 empresa

require('dotenv').config();
const mongoose = require('mongoose');
const { migrarVigenciaDemanda } = require('../services/vigenciaDemanda');

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const empresaArg = args.find(a => a.startsWith('--empresa='));

(async () => {
  const banco = (process.env.MONGODB_URI || '').match(/\/([^/?]+)(\?|$)/)?.[1] || '(desconhecido)';
  console.log(`Banco: ${banco}  |  modo: ${APLICAR ? 'APLICAR (grava)' : 'simulação (não grava)'}`);
  await mongoose.connect(process.env.MONGODB_URI);
  const s = await migrarVigenciaDemanda({ simular: !APLICAR, empresaId: empresaArg ? empresaArg.split('=')[1] : null });
  const verbo = APLICAR ? 'gravados' : 'seriam gravados';
  console.log(`
Clientes lidos ..................................................... ${s.clientes}

M1  clientes ainda não migrados .................................... ${s.m1Clientes}
      setores com "desde sempre, em aberto" (${verbo}) ......... ${s.m1DesdeSempre}
      setores sem período (onboarding em andamento) ................ ${s.m1SemPeriodoOnboarding}
      setores de inativo com período até o último lançamento ....... ${s.m1InativosComPeriodo}
      setores de inativo sem período (nunca houve lançamento) ...... ${s.m1InativosSemPeriodo}
M2  clientes de onboarding em andamento sem demanda até concluir ... ${s.m2Ajustados}  (${s.m2PeriodosRemovidos} período(s) removido(s))
M3  setores de inativo antigo com período até o último lançamento .. ${s.m3ComPeriodo}
      setores de inativo antigo que continuam sem período .......... ${s.m3SemPeriodo}`);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
