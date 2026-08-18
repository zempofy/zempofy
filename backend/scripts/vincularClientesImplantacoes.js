// Script único: preenche retroativamente o campo `cliente` de implantações que já existiam
// antes dele existir no model, casando por CNPJ com o cliente correspondente da mesma empresa.
// Sem isso, a trava de "não deixar excluir/inativar cliente em onboarding" só funciona pra
// implantações criadas depois da correção — essa é a parte que arruma o histórico.
// Roda manualmente: `node scripts/vincularClientesImplantacoes.js`. Não faz parte do runtime
// do app e não precisa ser agendado — é pra rodar uma vez só.
require('dotenv').config();
const mongoose = require('mongoose');
const Implantacao = require('../models/Implantacao');
const Cliente = require('../models/Cliente');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const implantacoes = await Implantacao.find({ cliente: { $exists: false } });
  let vinculadas = 0;
  let semCorrespondencia = 0;

  for (const imp of implantacoes) {
    const cnpjLimpo = (imp.cnpj || '').replace(/\D/g, '');
    if (!cnpjLimpo) { semCorrespondencia++; continue; }

    const cnpjRegexTolerante = cnpjLimpo.split('').join('[.\\-/]*');
    const cliente = await Cliente.findOne({ empresa: imp.empresa, cnpj: { $regex: cnpjRegexTolerante } });
    if (!cliente) {
      semCorrespondencia++;
      console.log(`⚠️ ${imp.nomeCliente} (${imp._id}) — nenhum cliente encontrado com CNPJ ${imp.cnpj || '(vazio)'}`);
      continue;
    }

    imp.cliente = cliente._id;
    await imp.save();
    vinculadas++;
    console.log(`✅ ${imp.nomeCliente} (${imp._id}) → ${cliente.razaoSocial} (${cliente._id})`);
  }

  console.log(`\nTotal: ${vinculadas} vinculada(s), ${semCorrespondencia} sem correspondência, de ${implantacoes.length} implantações sem esse vínculo.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
