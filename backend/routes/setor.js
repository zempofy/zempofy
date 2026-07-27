const express = require('express');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const Setor = require('../models/Setor');

const router = express.Router();

const SETORES_PADRAO = [
  { nome: 'Comercial', cor: '#378ADD' },
  { nome: 'Legalização', cor: '#EF9F27' },
  { nome: 'Contábil', cor: '#2DAA59' },
  { nome: 'Fiscal', cor: '#7F77DD' },
  { nome: 'Departamento Pessoal', cor: '#D85A30' },
  { nome: 'Financeiro', cor: '#1D9E75' },
];

// GET /api/setores - Lista todos os setores ativos da empresa
router.get('/', autenticar, async (req, res) => {
  try {
    const setores = await Setor.find({
      empresa: req.usuario.empresa._id,
      ativo: true
    }).populate('membros', 'nome email avatar cargo').sort({ padrao: -1, criadoEm: 1 }).lean();
    res.json(setores);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar setores.' });
  }
});

// POST /api/setores/inicializar - Cria os setores padrão (chamado na criação da empresa)
router.post('/inicializar', autenticar, async (req, res) => {
  try {
    const jaExistem = await Setor.countDocuments({ empresa: req.usuario.empresa._id });
    if (jaExistem > 0) return res.json({ mensagem: 'Setores já inicializados.' });

    const setores = SETORES_PADRAO.map(s => ({
      ...s,
      empresa: req.usuario.empresa._id,
      padrao: true
    }));
    await Setor.insertMany(setores);
    const criados = await Setor.find({ empresa: req.usuario.empresa._id }).lean();
    res.status(201).json(criados);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao inicializar setores.' });
  }
});

// POST /api/setores - Criar novo setor
router.post('/', autenticar, apenasAdmin, async (req, res) => {
  const { nome, cor, membros } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const setor = await Setor.create({
      nome: nome.trim(),
      cor: cor || '#2DAA59',
      membros: membros || [],
      empresa: req.usuario.empresa._id,
      padrao: false
    });
    const populado = await Setor.findById(setor._id).populate('membros', 'nome email avatar cargo').lean();
    res.status(201).json(populado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar setor.' });
  }
});

// PUT /api/setores/:id - Editar setor
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  const { nome, cor, membros } = req.body;
  try {
    const Usuario = require('../models/Usuario');
    const setorAntigo = await Setor.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    const membrosAntigos = setorAntigo?.membros?.map(m => m.toString()) || [];
    const membrosNovos = (membros || []).map(m => m.toString());

    const setor = await Setor.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { nome: nome?.trim(), cor, membros: membros || [] },
      { new: true }
    ).populate('membros', 'nome email avatar cargo');
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });

    // Sincronizar campo setores nos usuários
    const adicionados = membrosNovos.filter(m => !membrosAntigos.includes(m));
    const removidos = membrosAntigos.filter(m => !membrosNovos.includes(m));
    await Promise.all([
      ...adicionados.map(uid => Usuario.updateOne({ _id: uid }, { $addToSet: { setores: req.params.id } })),
      ...removidos.map(uid => Usuario.updateOne({ _id: uid }, { $pull: { setores: req.params.id } })),
    ]);

    res.json(setor);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar setor.' });
  }
});

// DELETE /api/setores/:id - Desativar setor (soft delete)

// PATCH /api/setores/:id/membros — adiciona ou remove membro
router.patch('/:id/membros', autenticar, apenasAdmin, async (req, res) => {
  const { usuarioId, acao } = req.body; // acao: 'adicionar' | 'remover'
  if (!usuarioId) return res.status(400).json({ erro: 'usuarioId é obrigatório.' });
  try {
    const op = acao === 'remover' ? { $pull: { membros: usuarioId } } : { $addToSet: { membros: usuarioId } }
    const setor = await Setor.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      op,
      { new: true }
    ).populate('membros', 'nome email avatar cargo');
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });

    // Sincronizar campo setores no Usuario
    const Usuario = require('../models/Usuario');
    if (acao === 'remover') {
      await Usuario.updateOne({ _id: usuarioId }, { $pull: { setores: req.params.id } });
    } else {
      await Usuario.updateOne({ _id: usuarioId }, { $addToSet: { setores: req.params.id } });
    }

    res.json(setor);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar membro do setor.' });
  }
});

// PATCH /api/setores/:id/membros/remover (compatibilidade)
router.patch('/:id/membros/remover', autenticar, apenasAdmin, async (req, res) => {
  const { usuarioId } = req.body;
  if (!usuarioId) return res.status(400).json({ erro: 'usuarioId é obrigatório.' });
  try {
    const setor = await Setor.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { $pull: { membros: usuarioId } },
      { new: true }
    ).populate('membros', 'nome email avatar cargo');
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });

    const Usuario = require('../models/Usuario');
    await Usuario.updateOne({ _id: usuarioId }, { $pull: { setores: req.params.id } });

    res.json(setor);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar membro do setor.' });
  }
});

router.delete('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const setor = await Setor.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { ativo: false },
      { new: true }
    );
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    res.json({ mensagem: 'Setor removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover setor.' });
  }
});

module.exports = router;
