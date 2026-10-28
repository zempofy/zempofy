// Migração da vigência de demanda (Spec A — REGRAS_DEMANDA.md). É a mesma função que roda sozinha
// na partida do servidor (services/vigenciaDemanda.js → migrarVigencia); este script existe pra
// SIMULAR antes e conferir os números.
//
// Simulação por padrão — NÃO grava nada a menos que --aplicar seja passado explicitamente.
//
// Uso (dentro de backend/):
//   node scripts/migrarVigenciaDemanda.js                          # simulação (padrão)
//   node scripts/migrarVigenciaDemanda.js --aplicar                # grava de verdade
//   node scripts/migrarVigenciaDemanda.js --empresa=<id>           # escopo a 1 empresa

require('dotenv').config();
const mongoose = require('mongoose');
const { migrarVigencia } = require('../services/vigenciaDemanda');

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const empresaArg = args.find(a => a.startsWith('--empresa='));

(async () => {
  const banco = (process.env.MONGODB_URI || '').match(/\/([^/?]+)(\?|$)/)?.[1] || '(desconhecido)';
  console.log(`Banco: ${banco}  |  modo: ${APLICAR ? 'APLICAR (grava)' : 'simulação (não grava)'}`);
  await mongoose.connect(process.env.MONGODB_URI);
  const s = await migrarVigencia({ simular: !APLICAR, empresaId: empresaArg ? empresaArg.split('=')[1] : null });
  console.log(`
Clientes lidos .................................. ${s.clientes}
Pares cliente/setor (setores atribuídos) ........ ${s.pares}
  já tinham vigência (nada a fazer) ............. ${s.jaTinham}
  ${APLICAR ? 'gravados' : 'seriam gravados'} "desde sempre, em aberto" ...... ${s.desdeSempre}  (em ${s.clientesAtualizados} cliente(s))
  ficam sem período (cliente inativo) ........... ${s.semPeriodoInativos}`);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
