const express = require('express');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const Empresa = require('../models/Empresa');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// Gerar token JWT
function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario._id, cargo: usuario.cargo, empresa: usuario.empresa },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/cadastro - Cadastrar nova empresa + admin
router.post('/cadastro', async (req, res) => {
  const { nomeEmpresa, cnpj, nomeAdmin, email, senha } = req.body;

  if (!nomeEmpresa || !cnpj || !nomeAdmin || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }

  try {
    // Verificar se email já existe
    const emailExiste = await Usuario.findOne({ email });
    if (emailExiste) {
      return res.status(400).json({ erro: 'Este e-mail já está em uso.' });
    }

    // Criar slug único da empresa (ex: "Minha Empresa" → "minha-empresa")
    let slug = nomeEmpresa.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Garantir slug único
    const slugExiste = await Empresa.findOne({ slug });
    if (slugExiste) slug = `${slug}-${Date.now()}`;

    // Criar empresa
    const empresa = await Empresa.create({ nome: nomeEmpresa, slug, cnpj });

    // Criar usuário admin
    const admin = await Usuario.create({
      nome: nomeAdmin,
      email,
      senha,
      cargo: 'admin',
      empresa: empresa._id
    });

    const token = gerarToken(admin);

    res.status(201).json({
      token,
      usuario: {
        id: admin._id,
        nome: admin.nome,
        email: admin.email,
        cargo: admin.cargo,
        empresa: { id: empresa._id, nome: empresa.nome }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar conta.' });
  }
});

// POST /api/auth/login - Login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  }

  try {
    const usuario = await Usuario.findOne({ email }).populate('empresa');

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const senhaCorreta = await usuario.verificarSenha(senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const token = gerarToken(usuario);

    res.json({
      token,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        cargo: usuario.cargo,
        avatar: usuario.avatar || '',
        empresa: { id: usuario.empresa._id, nome: usuario.empresa.nome }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao fazer login.' });
  }
});

// GET /api/auth/me - Retorna dados do usuário logado
router.get('/me', autenticar, (req, res) => {
  const u = req.usuario;
  res.json({
    id: u._id,
    nome: u.nome,
    email: u.email,
    cargo: u.cargo,
    avatar: u.avatar || '',
    permissoes: u.permissoes || [],
    empresa: { id: u.empresa._id, nome: u.empresa.nome }
  });
});

module.exports = router;
