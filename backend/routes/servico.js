const express = require('express');
const { autenticar } = require('../middleware/auth');
const Servico = require('../models/Servico');

const router = express.Router();

// GET /api/servicos
router.get('/', autenticar, async (req, res) => {
  try {
    const servicos = await Servico.find({ empresa: req.usuario.empresa._id }).sort({ criadoEm: 1 }).lean();
    res.json(servicos);
  } catch { res.status(500).json({ erro: 'Erro ao buscar serviços.' }); }
});

// POST /api/servicos
router.post('/', autenticar, async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const existe = await Servico.findOne({ empresa: req.usuario.empresa._id, nome: { $regex: `^${nome.trim()}$`, $options: 'i' } }).lean();
    if (existe) return res.status(400).json({ erro: 'Já existe um serviço com esse nome.' });
    const servico = await Servico.create({ nome: nome.trim(), descricao: descricao?.trim() || '', empresa: req.usuario.empresa._id, criadoPor: req.usuario._id });
    res.status(201).json(servico);
  } catch { res.status(500).json({ erro: 'Erro ao criar serviço.' }); }
});

// PUT /api/servicos/:id
router.put('/:id', autenticar, async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const servico = await Servico.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { nome: nome.trim(), descricao: descricao?.trim() || '' },
      { new: true }
    );
    if (!servico) return res.status(404).json({ erro: 'Serviço não encontrado.' });
    res.json(servico);
  } catch { res.status(500).json({ erro: 'Erro ao editar serviço.' }); }
});

// DELETE /api/servicos/:id
router.delete('/:id', autenticar, async (req, res) => {
  try {
    await Servico.findOneAndDelete({ _id: req.params.id, empresa: req.usuario.empresa._id });
    res.json({ mensagem: 'Serviço removido.' });
  } catch { res.status(500).json({ erro: 'Erro ao remover serviço.' }); }
});

module.exports = router;
