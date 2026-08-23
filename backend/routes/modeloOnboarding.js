const express = require('express');
const registrarLog = require('../services/log');
const { autenticar, temPermissao } = require('../middleware/auth');
const ModeloOnboarding = require('../models/ModeloOnboarding');
const { modeloOnboardingCreateSchema, modeloOnboardingUpdateSchema, validar } = require('../validacao');

const router = express.Router();

const populateModelo = (q) => q
  .populate('setores.setor', 'nome cor')
  .populate({ path: 'setores.tarefas', model: 'AtividadeChecklist', populate: { path: 'responsavel', select: 'nome' } })
  .populate('criadoPor', 'nome');

// GET /api/modelos-onboarding
// Por padrão só traz modelos ativos (uso ao aplicar um modelo num onboarding novo).
// ?incluirInativos=true traz todos — usado na tela de gerenciar modelos em Configurações.
router.get('/', autenticar, async (req, res) => {
  try {
    const filtro = { empresa: req.usuario.empresa._id };
    if (req.query.incluirInativos !== 'true') filtro.ativo = true;
    const modelos = await populateModelo(
      ModeloOnboarding.find(filtro)
    ).sort({ criadoEm: -1 }).lean();
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
    ).lean();
    if (!modelo) return res.status(404).json({ erro: 'Modelo não encontrado.' });
    res.json(modelo);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar modelo.' });
  }
});

// POST /api/modelos-onboarding
router.post('/', autenticar, temPermissao('gerenciarModelos'), validar(modeloOnboardingCreateSchema), async (req, res) => {
  const { nome, descricao, setores } = req.body;
  try {
    const modelo = await ModeloOnboarding.create({
      nome: nome.trim(),
      descricao: descricao || '',
      setores: setores || [],
      empresa: req.usuario.empresa._id,
      criadoPor: req.usuario._id
    });
    const populado = await populateModelo(ModeloOnboarding.findById(modelo._id)).lean();
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'modelo_criado', descricao: 'Criou o modelo ' + nome, meta: { nome } });
    res.status(201).json(populado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar modelo.' });
  }
});

// PUT /api/modelos-onboarding/:id
router.put('/:id', autenticar, temPermissao('gerenciarModelos'), validar(modeloOnboardingUpdateSchema), async (req, res) => {
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

// DELETE /api/modelos-onboarding/:id — inativa (soft delete)
router.delete('/:id', autenticar, temPermissao('gerenciarModelos'), async (req, res) => {
  try {
    const modelo = await ModeloOnboarding.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { ativo: false },
      { new: true }
    );
    if (!modelo) return res.status(404).json({ erro: 'Modelo não encontrado.' });
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'modelo_excluido', categoria: 'modelo', descricao: 'Inativou o modelo ' + modelo.nome, meta: { nome: modelo.nome } });
    res.json({ mensagem: 'Modelo inativado.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao inativar modelo.' });
  }
});

// PATCH /api/modelos-onboarding/:id/reativar
router.patch('/:id/reativar', autenticar, temPermissao('gerenciarModelos'), async (req, res) => {
  try {
    const modelo = await ModeloOnboarding.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { ativo: true },
      { new: true }
    );
    if (!modelo) return res.status(404).json({ erro: 'Modelo não encontrado.' });
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'modelo_reativado', categoria: 'modelo', descricao: 'Reativou o modelo ' + modelo.nome, meta: { nome: modelo.nome } });
    res.json({ mensagem: 'Modelo reativado.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao reativar modelo.' });
  }
});

// DELETE /api/modelos-onboarding/:id/permanente — só permitido se já estiver inativo
router.delete('/:id/permanente', autenticar, temPermissao('gerenciarModelos'), async (req, res) => {
  try {
    const modelo = await ModeloOnboarding.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!modelo) return res.status(404).json({ erro: 'Modelo não encontrado.' });
    if (modelo.ativo) return res.status(400).json({ erro: 'Inative o modelo antes de excluir permanentemente.' });
    await ModeloOnboarding.deleteOne({ _id: modelo._id });
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'modelo_excluido_permanente', categoria: 'modelo', descricao: 'Excluiu permanentemente o modelo ' + modelo.nome, meta: { nome: modelo.nome } });
    res.json({ mensagem: 'Modelo excluído permanentemente.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir modelo.' });
  }
});

module.exports = router;
