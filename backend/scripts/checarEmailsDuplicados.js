// Checagem pré-requisito da spec de e-mail único global — só lê, não escreve nada.
// Verifica se já existe algum e-mail duplicado entre usuários (em qualquer empresa) antes de
// aplicar o índice unique:true no schema, que falharia na inicialização se houver duplicata.
//
// Uso: node scripts/checarEmailsDuplicados.js

require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const duplicados = await Usuario.aggregate([
    { $group: { _id: { $toLower: '$email' }, count: { $sum: 1 }, docs: { $push: { id: '$_id', email: '$email', empresa: '$empresa', ativo: '$ativo', criadoEm: '$criadoEm' } } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (duplicados.length === 0) {
    console.log('Nenhum e-mail duplicado encontrado. Seguro aplicar unique:true.');
  } else {
    console.log(`Encontrados ${duplicados.length} e-mail(s) duplicado(s):`);
    duplicados.forEach(d => {
      console.log(`\n- ${d._id} (${d.count}x)`);
      d.docs.forEach(doc => console.log(`  id=${doc.id} email=${doc.email} empresa=${doc.empresa} ativo=${doc.ativo} criadoEm=${doc.criadoEm}`));
    });
  }

  await mongoose.disconnect();
  process.exit(duplicados.length > 0 ? 1 : 0);
})();
