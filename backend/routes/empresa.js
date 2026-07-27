const express = require('express');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const Empresa = require('../models/Empresa');

const router = express.Router();

// GET /api/empresa - Dados da empresa do usuário logado
router.get('/', autenticar, async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.usuario.empresa._id).lean();
    res.json(empresa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar empresa.' });
  }
});

// PUT /api/empresa - Atualizar dados da empresa (só admin)
router.put('/', autenticar, apenasAdmin, async (req, res) => {
  const { nome, colaboradoresPodeAtribuirTitular } = req.body;
  const atualizacao = {}
  if (nome !== undefined) atualizacao.nome = nome
  if (colaboradoresPodeAtribuirTitular !== undefined) atualizacao.colaboradoresPodeAtribuirTitular = colaboradoresPodeAtribuirTitular
  try {
    const empresa = await Empresa.findByIdAndUpdate(
      req.usuario.empresa._id,
      atualizacao,
      { new: true }
    );
    res.json(empresa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar empresa.' });
  }
});

// PUT /api/empresa/configuracoes
router.put('/configuracoes', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { alertaOnboardingDias, resumoFrequencia } = req.body;
    const Empresa = require('../models/Empresa');
    await Empresa.findByIdAndUpdate(req.usuario.empresa._id, { alertaOnboardingDias, resumoFrequencia });
    res.json({ ok: true });
  } catch { res.status(500).json({ erro: 'Erro ao salvar configuração.' }); }
});

module.exports = router;
