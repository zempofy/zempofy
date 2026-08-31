// Gera um token de sessão válido pra uma conta de teste, sem precisar digitar senha em lugar
// nenhum — mesma lógica de gerarToken() em routes/auth.js, só que direto no banco.
// SÓ funciona local: depende do JWT_SECRET do .env, que não existe (e não deve existir) em produção.
//
// Uso:
//   node scripts/gerarTokenTeste.js                → cria/reaproveita a empresa+titular padrão e imprime o token
//   node scripts/gerarTokenTeste.js seu@email.com   → gera token pra um usuário já existente, por e-mail
//
// Cole o token no DevTools do navegador (aba onde o app local está aberto):
//   localStorage.setItem('zempofy_token', 'COLE_AQUI'); location.reload()

require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Empresa = require('../models/Empresa');
const Usuario = require('../models/Usuario');

const SLUG_PADRAO = 'empresa-teste-dev';
const EMAIL_PADRAO = 'titular.dev@zempofy.com.br';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const emailAlvo = process.argv[2];
  let usuario;

  if (emailAlvo) {
    usuario = await Usuario.findOne({ email: emailAlvo.toLowerCase().trim() });
    if (!usuario) { console.error(`Usuário ${emailAlvo} não encontrado.`); process.exit(1); }
  } else {
    let empresa = await Empresa.findOne({ slug: SLUG_PADRAO });
    if (!empresa) empresa = await Empresa.create({ nome: 'Empresa Teste Dev', slug: SLUG_PADRAO, cnpj: '00000000000191', ativa: true });

    usuario = await Usuario.findOne({ email: EMAIL_PADRAO });
    if (!usuario) {
      usuario = await Usuario.create({ nome: 'Titular Dev', email: EMAIL_PADRAO, senha: 'apenas-para-teste-local', cargo: 'admin', empresa: empresa._id, emailVerificado: true });
      console.error(`Criado: titular ${EMAIL_PADRAO} na empresa "${empresa.nome}" (${empresa._id})`);
    }
  }

  const token = jwt.sign({ id: usuario._id, cargo: usuario.cargo, empresa: usuario.empresa }, process.env.JWT_SECRET, { expiresIn: '30d' });
  console.log(token);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
