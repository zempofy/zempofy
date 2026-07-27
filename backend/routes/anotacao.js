const express = require('express');
const { autenticar } = require('../middleware/auth');
const Anotacao = require('../models/Anotacao');

const router = express.Router();

// GET /api/anotacoes - Lista anotações do usuário logado
router.get('/', autenticar, async (req, res) => {
  try {
    const anotacoes = await Anotacao.find({
      usuario: req.usuario._id,
      empresa: req.usuario.empresa._id
    }).sort({ fixada: -1, atualizadaEm: -1 }).lean();
    res.json(anotacoes);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar anotações.' });
  }
});

// POST /api/anotacoes - Criar anotação
router.post('/', autenticar, async (req, res) => {
  const { titulo, texto, cor, fixada } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ erro: 'Título obrigatório.' });
  try {
    const anotacao = await Anotacao.create({
      titulo, texto, cor, fixada,
      usuario: req.usuario._id,
      empresa: req.usuario.empresa._id
    });
    res.status(201).json(anotacao);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar anotação.' });
  }
});

// PUT /api/anotacoes/:id - Editar anotação
router.put('/:id', autenticar, async (req, res) => {
  try {
    const anotacao = await Anotacao.findOneAndUpdate(
      { _id: req.params.id, usuario: req.usuario._id },
      { ...req.body, atualizadaEm: new Date() },
      { new: true }
    );
    if (!anotacao) return res.status(404).json({ erro: 'Anotação não encontrada.' });
    res.json(anotacao);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar anotação.' });
  }
});

// DELETE /api/anotacoes/:id - Excluir anotação
router.delete('/:id', autenticar, async (req, res) => {
  try {
    await Anotacao.findOneAndDelete({ _id: req.params.id, usuario: req.usuario._id });
    res.json({ mensagem: 'Anotação excluída.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir anotação.' });
  }
});

module.exports = router;
