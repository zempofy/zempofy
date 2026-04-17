const express = require('express');
const { autenticar, apenasAdmin, apenasGestores, isDono } = require('../middleware/auth');
const Usuario = require('../models/Usuario');

const router = express.Router();

// PUT /api/usuarios/meu-perfil - Atualizar próprio nome e/ou email
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
    const usuario = await Usuario.findByIdAndUpdate(
      req.usuario._id, atualizacao, { new: true }
    ).select('-senha');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
  }
});

// PUT /api/usuarios/minha-foto - Atualizar foto de perfil
router.put('/minha-foto', autenticar, async (req, res) => {
  const { foto } = req.body; // base64
  try {
    const usuario = await Usuario.findByIdAndUpdate(
      req.usuario._id, { avatar: foto || '' }, { new: true }
    ).select('-senha');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar foto.' });
  }
});

// PUT /api/usuarios/minha-senha - Atualizar própria senha
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

// GET /api/usuarios - Lista usuários da empresa
router.get('/', autenticar, async (req, res) => {
  try {
    const usuarios = await Usuario.find({
      empresa: req.usuario.empresa._id,
      ativo: true
    }).select('-senha');
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar usuários.' });
  }
});

// POST /api/usuarios - Gestor cria colaborador ou administrador
router.post('/', autenticar, apenasGestores, async (req, res) => {
  const { nome, email, senha, cargo } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }

  if (cargo === 'administrador' && !isDono(req.usuario)) {
    return res.status(403).json({ erro: 'Apenas o dono pode criar administradores.' });
  }

  if (cargo === 'admin') {
    return res.status(403).json({ erro: 'Não é possível criar outro dono.' });
  }

  try {
    const emailExiste = await Usuario.findOne({ email });
    if (emailExiste) return res.status(400).json({ erro: 'E-mail já em uso.' });

    const usuario = await Usuario.create({
      nome, email, senha,
      cargo: cargo || 'colaborador',
      empresa: req.usuario.empresa._id
    });

    res.status(201).json({
      id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      cargo: usuario.cargo
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
});

// PUT /api/usuarios/:id - Editar usuário
router.put('/:id', autenticar, apenasGestores, async (req, res) => {
  const { nome, email } = req.body;
  try {
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    if (!isDono(req.usuario) && ['admin', 'administrador'].includes(alvo.cargo)) {
      return res.status(403).json({ erro: 'Sem permissão para editar este usuário.' });
    }

    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id, { nome, email }, { new: true }
    ).select('-senha');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar usuário.' });
  }
});

// PUT /api/usuarios/:id/permissoes - Atualizar permissões de um colaborador
router.put('/:id/permissoes', autenticar, apenasGestores, async (req, res) => {
  const { permissoes } = req.body;
  try {
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (alvo.cargo !== 'colaborador') {
      return res.status(403).json({ erro: 'Permissões customizadas são apenas para colaboradores.' });
    }
    const permissoesValidas = ['clientes', 'implantacao', 'modelos_onboarding', 'checklist', 'setores', 'adicionar_colaboradores'];
    const permissoesFiltradas = (permissoes || []).filter(p => permissoesValidas.includes(p));
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id, { permissoes: permissoesFiltradas }, { new: true }
    ).select('-senha');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar permissões.' });
  }
});

// DELETE /api/usuarios/:id - Remover usuário
router.delete('/:id', autenticar, apenasGestores, async (req, res) => {
  try {
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    if (!isDono(req.usuario) && ['admin', 'administrador'].includes(alvo.cargo)) {
      return res.status(403).json({ erro: 'Sem permissão para remover este usuário.' });
    }

    await Usuario.findByIdAndUpdate(req.params.id, { ativo: false });
    res.json({ mensagem: 'Usuário removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover usuário.' });
  }
});

module.exports = router;
