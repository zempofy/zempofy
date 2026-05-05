const express = require('express');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const ModeloOnboarding = require('../models/ModeloOnboarding');

const router = express.Router();

const populateModelo = (q) => q
  .populate('setores.setor', 'nome cor')
  .populate({ path: 'setores.tarefas', model: 'AtividadeChecklist', populate: { path: 'responsavel', select: 'nome' } })
  .populate('criadoPor', 'nome');

// GET /api/modelos-onboarding
router.get('/', autenticar, async (req, res) => {
  try {
    const modelos = await populateModelo(
      ModeloOnboarding.find({ empresa: req.usuario.empresa._id, ativo: true })
    ).sort({ criadoEm: -1 });
    res.json(modelos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar modelos.' });
  }
});

// GET /api/modelos-onboarding/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const modelo = await populateModelo(
      ModeloOnboarding.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id })
    );
    if (!modelo) return res.status(404).json({ erro: 'Modelo não encontrado.' });
    res.json(modelo);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar modelo.' });
  }
});

// POST /api/modelos-onboarding
router.post('/', autenticar, apenasAdmin, async (req, res) => {
  const { nome, descricao, setores } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const modelo = await ModeloOnboarding.create({
      nome: nome.trim(),
      descricao: descricao || '',
      setores: setores || [],
      empresa: req.usuario.empresa._id,
      criadoPor: req.usuario._id
    });
    const populado = await populateModelo(ModeloOnboarding.findById(modelo._id));
    res.status(201).json(populado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar modelo.' });
  }
});

// PUT /api/modelos-onboarding/:id
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  const { nome, descricao, setores } = req.body;
  try {
    const modelo = await populateModelo(
      ModeloOnboarding.findOneAndUpdate(
        { _id: req.params.id, empresa: req.usuario.empresa._id },
        { nome: nome?.trim(), descricao, setores },
        { new: true }
      )
    );
    if (!modelo) return res.status(404).json({ erro: 'Modelo não encontrado.' });
    res.json(modelo);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar modelo.' });
  }
});

// DELETE /api/modelos-onboarding/:id
router.delete('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    await ModeloOnboarding.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { ativo: false }
    );
    res.json({ mensagem: 'Modelo removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover modelo.' });
  }
});

module.exports = router;
