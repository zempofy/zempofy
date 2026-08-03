const express = require('express');
const jwt = require('jsonwebtoken');
const Empresa = require('../models/Empresa');
const { autenticar } = require('../middleware/auth');
const { enviarVerificacaoEmail } = require('../services/email');
const crypto = require('crypto');

// Lazy require para evitar dependência circular com middleware/auth
const getUsuario = () => require('../models/Usuario');

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
    const emailExiste = await getUsuario().findOne({ email: email.toLowerCase().trim() }).lean();
    if (emailExiste) {
      return res.status(400).json({ erro: 'Este e-mail já está em uso.' });
    }

    // Criar slug único da empresa (ex: "Minha Empresa" → "minha-empresa")
    let slug = nomeEmpresa.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Garantir slug único
    const slugExiste = await Empresa.findOne({ slug }).lean();
    if (slugExiste) slug = `${slug}-${Date.now()}`;

    // Criar empresa
    const empresa = await Empresa.create({ nome: nomeEmpresa, slug, cnpj });

    // Criar usuário admin
    const admin = await getUsuario().create({
      nome: nomeAdmin,
      email,
      senha,
      cargo: 'admin',
      empresa: empresa._id
    });

    const token = gerarToken(admin);

    // Gerar token de verificação e enviar e-mail
    const tokenVerif = crypto.randomBytes(32).toString('hex');
    await getUsuario().findByIdAndUpdate(admin._id, { tokenVerificacao: tokenVerif });
    setImmediate(() => enviarVerificacaoEmail({ destinatario: email, nome: nomeAdmin, token: tokenVerif }));

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
    if (err.code === 11000) return res.status(400).json({ erro: 'Este e-mail já está em uso.' });
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
    const usuario = await getUsuario().findOne({ email }).populate('empresa').populate('setores', 'nome cor');

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const senhaCorreta = await usuario.verificarSenha(senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const token = gerarToken(usuario);

    // Não bloqueia a resposta do login por causa disso
    getUsuario().updateOne({ _id: usuario._id }, { $set: { ultimoAcesso: new Date() } }).catch(() => {});

    res.json({
      token,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        cargo: usuario.cargo,
        avatar: usuario.avatar || '',
        permissoes: usuario.permissoes || {},
        setores: usuario.setores || [],
        emailVerificado: usuario.emailVerificado || false,
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
    permissoes: u.permissoes || {},
    setores: u.setores || [],
    emailVerificado: u.emailVerificado || false,
    empresa: { id: u.empresa._id, nome: u.empresa.nome }
  });
});

// POST /api/auth/esqueci-senha
router.post('/esqueci-senha', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: 'E-mail obrigatório.' });
    const usuario = await getUsuario().findOne({ email: email.toLowerCase() });
    // Sempre retorna sucesso pra não revelar se e-mail existe
    if (!usuario) return res.json({ mensagem: 'Se o e-mail estiver cadastrado, você receberá as instruções.' });

    const token = require('crypto').randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 3600000); // 1 hora

    usuario.tokenResetSenha = token;
    usuario.tokenResetExpira = expira;
    await usuario.save();

    const { enviarRedefinicaoSenha } = require('../services/email');
    await enviarRedefinicaoSenha({ destinatario: email, nome: usuario.nome, token });

    res.json({ mensagem: 'Se o e-mail estiver cadastrado, você receberá as instruções.' });
  } catch (err) {
    console.error('Esqueci senha:', err.message);
    res.status(500).json({ erro: 'Erro ao processar solicitação.' });
  }
});

// POST /api/auth/redefinir-senha
router.post('/redefinir-senha', async (req, res) => {
  try {
    const { token, novaSenha } = req.body;
    if (!token || !novaSenha) return res.status(400).json({ erro: 'Dados inválidos.' });
    if (novaSenha.length < 6) return res.status(400).json({ erro: 'Senha deve ter ao menos 6 caracteres.' });

    const usuario = await getUsuario().findOne({
      tokenResetSenha: token,
      tokenResetExpira: { $gt: new Date() }
    });
    if (!usuario) return res.status(400).json({ erro: 'Link inválido ou expirado.' });

    usuario.senha = novaSenha;
    usuario.tokenResetSenha = undefined;
    usuario.tokenResetExpira = undefined;
    await usuario.save();

    res.json({ mensagem: 'Senha redefinida com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao redefinir senha.' });
  }
});

module.exports = router;

// GET /api/auth/verificar-email?token=xxx
router.get('/verificar-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ erro: 'Token inválido.' });
  try {
    const usuario = await getUsuario().findOne({ tokenVerificacao: token }).lean();
    if (!usuario) return res.status(400).json({ erro: 'Token inválido ou expirado.' });
    await getUsuario().findByIdAndUpdate(usuario._id, { emailVerificado: true, tokenVerificacao: null });
    res.json({ mensagem: 'E-mail verificado com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao verificar e-mail.' });
  }
});

// POST /api/auth/reenviar-verificacao
router.post('/reenviar-verificacao', autenticar, async (req, res) => {
  try {
    if (req.usuario.emailVerificado) return res.json({ mensagem: 'E-mail já verificado.' });
    const token = crypto.randomBytes(32).toString('hex');
    await getUsuario().findByIdAndUpdate(req.usuario._id, { tokenVerificacao: token });
    setImmediate(() => enviarVerificacaoEmail({ destinatario: req.usuario.email, nome: req.usuario.nome, token }));
    res.json({ mensagem: 'E-mail de verificação reenviado!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao reenviar e-mail.' });
  }
});

