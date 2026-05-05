const express = require('express');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { enviarVerificacaoEmail } = require('../services/email');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');

const router = express.Router();

// PUT /api/usuarios/meu-perfil
router.put('/meu-perfil', autenticar, async (req, res) => {
  const { email, nome } = req.body;
  try {
    const atualizacao = {}
    if (nome?.trim()) atualizacao.nome = nome.trim()
    if (email) {
      const emailExiste = await Usuario.findOne({ email, _id: { $ne: req.usuario._id } });
      if (emailExiste) return res.status(400).json({ erro: 'E-mail já está em uso.' });
      atualizacao.email = email
    }
    const usuario = await Usuario.findByIdAndUpdate(req.usuario._id, atualizacao, { new: true }).select('-senha');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
  }
});

// PUT /api/usuarios/minha-foto
router.put('/minha-foto', autenticar, async (req, res) => {
  const { foto } = req.body;
  try {
    const usuario = await Usuario.findByIdAndUpdate(req.usuario._id, { avatar: foto || '' }, { new: true }).select('-senha');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar foto.' });
  }
});

// PUT /api/usuarios/minha-senha
router.put('/minha-senha', autenticar, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  try {
    const usuario = await Usuario.findById(req.usuario._id);
    const senhaCorreta = await usuario.verificarSenha(senhaAtual);
    if (!senhaCorreta) return res.status(400).json({ erro: 'Senha atual incorreta.' });
    usuario.senha = novaSenha;
    await usuario.save();
    res.json({ mensagem: 'Senha atualizada com sucesso.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar senha.' });
  }
});

// GET /api/usuarios
router.get('/', autenticar, async (req, res) => {
  try {
    const usuarios = await Usuario.find({ empresa: req.usuario.empresa._id, ativo: true }).select('-senha').populate('setores', 'nome cor');
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar usuários.' });
  }
});

// POST /api/usuarios — só o titular cria colaboradores
router.post('/', autenticar, apenasAdmin, async (req, res) => {
  const { nome, email, senha, permissoes, setores } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos.' });
  if (!setores || setores.length === 0) return res.status(400).json({ erro: 'Selecione pelo menos um setor.' });
  try {
    const emailExiste = await Usuario.findOne({ email });
    if (emailExiste) return res.status(400).json({ erro: 'E-mail já em uso.' });
    const tokenVerif = crypto.randomBytes(32).toString('hex');
    const usuario = await Usuario.create({
      nome, email, senha,
      cargo: 'colaborador',
      permissoes: permissoes || {},
      setores: setores || [],
      empresa: req.usuario.empresa._id,
      tokenVerificacao: tokenVerif,
      emailVerificado: false,
    });
    // Envia e-mail de verificação pro colaborador
    setImmediate(() => enviarVerificacaoEmail({ destinatario: email, nome, token: tokenVerif }));
    res.status(201).json({ id: usuario._id, nome: usuario.nome, email: usuario.email, cargo: usuario.cargo, permissoes: usuario.permissoes });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
});

// PUT /api/usuarios/:id — titular edita nome/email e permissões
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  const { nome, email, permissoes, setores } = req.body;
  try {
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (alvo.cargo === 'admin') return res.status(403).json({ erro: 'Não é possível editar o titular.' });
    const atualizacao = {};
    if (nome?.trim()) atualizacao.nome = nome.trim();
    if (email) atualizacao.email = email;
    if (permissoes) atualizacao.permissoes = permissoes;
    if (setores !== undefined) atualizacao.setores = setores;
    const usuario = await Usuario.findByIdAndUpdate(req.params.id, atualizacao, { new: true }).select('-senha').populate('setores', 'nome cor');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar usuário.' });
  }
});

// DELETE /api/usuarios/:id — só titular remove
router.delete('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (alvo.cargo === 'admin') return res.status(403).json({ erro: 'Não é possível remover o titular.' });
    await Usuario.findByIdAndUpdate(req.params.id, { ativo: false });
    res.json({ mensagem: 'Usuário removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover usuário.' });
  }
});

module.exports = router;
