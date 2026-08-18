// Script único: corrige implantações que ficaram travadas numa etapa sem nenhuma tarefa
// (bug corrigido em routes/implantacao.js e routes/tarefa.js — esse script arruma as que já
// tinham sido criadas antes da correção).
// Roda manualmente: `node scripts/desempacarImplantacoesTravadas.js`. Não faz parte do
// runtime do app e não precisa ser agendado — é pra rodar uma vez só.
require('dotenv').config();
const mongoose = require('mongoose');
const Implantacao = require('../models/Implantacao');
const { pularEtapasVaziasEmCadeia } = require('../services/implantacao');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const implantacoes = await Implantacao.find({ status: 'em_andamento' });
  let corrigidas = 0;

  for (const implantacao of implantacoes) {
    const etapaAtual = implantacao.etapas.find(e => e.status === 'em_andamento');
    if (!etapaAtual || etapaAtual.tarefas.length > 0) continue; // etapa atual não está vazia, nada a fazer

    const ordemTravada = etapaAtual.ordem;
    pularEtapasVaziasEmCadeia(implantacao);
    await implantacao.save();
    corrigidas++;

    const situacaoFinal = implantacao.status === 'concluida'
      ? 'implantação concluída (todas as etapas seguintes também estavam vazias)'
      : `etapa ${implantacao.etapas.find(e => e.status === 'em_andamento')?.ordem} liberada`;
    console.log(`✅ ${implantacao.nomeCliente} (${implantacao._id}) — estava travada na etapa ${ordemTravada}, agora: ${situacaoFinal}`);
  }

  console.log(`\nTotal: ${corrigidas} implantação(ões) corrigida(s) de ${implantacoes.length} em andamento.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
