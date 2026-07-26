const express = require('express');
const { autenticar } = require('../middleware/auth');
const Evento = require('../models/Evento');

const router = express.Router();

// GET /api/eventos — lista eventos (admin vê todos, funcionário vê só os seus)
router.get('/', autenticar, async (req, res) => {
  try {
    const filtro = { empresa: req.usuario.empresa._id };
    if (req.usuario.cargo === 'colaborador') filtro.usuario = req.usuario._id;

    // Filtro por usuário específico (admin pode passar ?usuarioId=...)
    if (req.query.usuarioId && req.usuario.cargo === 'admin') {
      filtro.usuario = req.query.usuarioId;
    }

    const eventos = await Evento.find(filtro)
      .populate('usuario', 'nome')
      .sort({ data: 1, horaInicio: 1 });

    res.json(eventos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar eventos.' });
  }
});

// POST /api/eventos — criar evento
router.post('/', autenticar, async (req, res) => {
  const { titulo, descricao, data, horaInicio, horaFim, cor } = req.body;

  if (!titulo || !data) {
    return res.status(400).json({ erro: 'Título e data são obrigatórios.' });
  }

  try {
    const evento = await Evento.create({
      titulo,
      descricao,
      data,
      horaInicio,
      horaFim,
      cor,
      usuario: req.usuario._id,
      empresa: req.usuario.empresa._id
    });

    const populado = await evento.populate('usuario', 'nome');
    res.status(201).json(populado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar evento.' });
  }
});

// PUT /api/eventos/:id — editar evento
router.put('/:id', autenticar, async (req, res) => {
  try {
    const filtro = { _id: req.params.id, empresa: req.usuario.empresa._id };
    if (req.usuario.cargo === 'colaborador') filtro.usuario = req.usuario._id;

    const { empresa, usuario, _id, criadoEm, ...dados } = req.body;
    const evento = await Evento.findOneAndUpdate(filtro, { $set: dados }, { new: true })
      .populate('usuario', 'nome');
    res.json(evento);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar evento.' });
  }
});

// DELETE /api/eventos/:id — excluir evento
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const filtro = { _id: req.params.id, empresa: req.usuario.empresa._id };
    if (req.usuario.cargo === 'colaborador') filtro.usuario = req.usuario._id;

    await Evento.findOneAndDelete(filtro);
    res.json({ mensagem: 'Evento excluído.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir evento.' });
  }
});

module.exports = router;
