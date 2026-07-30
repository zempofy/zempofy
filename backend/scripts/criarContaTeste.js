// Script único: cria (ou reaproveita) uma empresa + usuário fixos de teste pro Josué explorar
// o sistema sem precisar passar pelo fluxo de cadastro toda vez. Não faz parte do runtime do
// app — roda uma vez manualmente com `node scripts/criarContaTeste.js` e pode ser reexecutado
// à vontade (é idempotente: se já existir, só informa as credenciais e sai).
require('dotenv').config();
const mongoose = require('mongoose');
const Empresa = require('../models/Empresa');
const Usuario = require('../models/Usuario');

const SLUG_TESTE = 'zempofy-conta-teste-interna';
const EMAIL_TESTE = 'teste@zempofy.com.br';
const SENHA_TESTE = 'Zempofy@teste2026';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  let empresa = await Empresa.findOne({ slug: SLUG_TESTE });
  if (!empresa) {
    empresa = await Empresa.create({
      nome: 'Zempofy — Conta de Teste (uso interno)',
      cnpj: '',
      slug: SLUG_TESTE,
      plano: 'premium',
      ativa: true,
    });
    console.log('Empresa de teste criada:', empresa._id.toString());
  } else {
    console.log('Empresa de teste já existia:', empresa._id.toString());
  }

  let usuario = await Usuario.findOne({ email: EMAIL_TESTE });
  if (!usuario) {
    usuario = await Usuario.create({
      nome: 'Josué (Teste)',
      email: EMAIL_TESTE,
      senha: SENHA_TESTE,
      cargo: 'admin',
      empresa: empresa._id,
      emailVerificado: true,
    });
    console.log('Usuário de teste criado:', usuario._id.toString());
  } else {
    console.log('Usuário de teste já existia:', usuario._id.toString());
  }

  console.log('\n── Credenciais da conta de teste ──');
  console.log('E-mail:', EMAIL_TESTE);
  console.log('Senha :', SENHA_TESTE);
  console.log('(Essa empresa não conta como cliente real/pagante — é só pra uso interno de testes.)');

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
