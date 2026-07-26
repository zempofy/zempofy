const express = require('express');
const { autenticar, temPermissao } = require('../middleware/auth');
const Aviso = require('../models/Aviso');

const router = express.Router();

// GET /api/mural - Lista avisos da empresa
router.get('/', autenticar, async (req, res) => {
  try {
    const avisos = await Aviso.find({ empresa: req.usuario.empresa._id })
      .populate('autor', 'nome cargo')
      .sort({ fixado: -1, criadoEm: -1 });
    res.json(avisos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar avisos.' });
  }
});

// POST /api/mural - Criar aviso (só gestores)
router.post('/', autenticar, temPermissao('publicarMural'), async (req, res) => {
  const { titulo, texto, imagem, fixado } = req.body;
  if (!titulo?.trim() || !texto?.trim()) {
    return res.status(400).json({ erro: 'Título e texto são obrigatórios.' });
  }
  try {
    const aviso = await Aviso.create({
      titulo, texto, imagem, fixado,
      autor: req.usuario._id,
      empresa: req.usuario.empresa._id
    });
    const populado = await aviso.populate('autor', 'nome cargo');
    res.status(201).json(populado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar aviso.' });
  }
});

// PUT /api/mural/:id - Editar aviso (só gestores)
router.put('/:id', autenticar, temPermissao('publicarMural'), async (req, res) => {
  try {
    const { empresa, autor, _id, reacoes, criadoEm, ...dados } = req.body;
    const aviso = await Aviso.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { $set: dados },
      { new: true }
    ).populate('autor', 'nome cargo');
    res.json(aviso);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar aviso.' });
  }
});

// DELETE /api/mural/:id - Excluir aviso (só gestores)
router.delete('/:id', autenticar, temPermissao('publicarMural'), async (req, res) => {
  try {
    await Aviso.findOneAndDelete({ _id: req.params.id, empresa: req.usuario.empresa._id });
    res.json({ mensagem: 'Aviso excluído.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir aviso.' });
  }
});

// POST /api/mural/:id/reagir - Reagir a um aviso
router.post('/:id/reagir', autenticar, async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ erro: 'Emoji obrigatório.' });

  try {
    const aviso = await Aviso.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!aviso) return res.status(404).json({ erro: 'Aviso não encontrado.' });

    const jaReagiu = aviso.reacoes.findIndex(
      r => r.usuario.toString() === req.usuario._id.toString() && r.emoji === emoji
    );

    if (jaReagiu >= 0) {
      // Remove reação se já tinha
      aviso.reacoes.splice(jaReagiu, 1);
    } else {
      // Remove reação anterior do mesmo usuário com emoji diferente
      const outraReacao = aviso.reacoes.findIndex(
        r => r.usuario.toString() === req.usuario._id.toString()
      );
      if (outraReacao >= 0) aviso.reacoes.splice(outraReacao, 1);
      // Adiciona nova
      aviso.reacoes.push({ usuario: req.usuario._id, emoji });
    }

    await aviso.save();
    const populado = await aviso.populate('autor', 'nome cargo');
    res.json(populado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao reagir.' });
  }
});

module.exports = router;
