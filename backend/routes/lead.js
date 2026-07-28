const express = require('express');
const { autenticar } = require('../middleware/auth');
const Lead = require('../models/Lead');

const router = express.Router();

const ETAPAS_VALIDAS = ['prospeccao', 'contato', 'reuniao', 'proposta', 'fechado', 'perdido'];

const podeEditarLead = (usuario, lead) =>
  usuario.cargo === 'admin' || lead.criadoPor.toString() === usuario._id.toString();

// GET /api/leads — titular vê todos os leads da empresa; colaborador vê só os próprios
router.get('/', autenticar, async (req, res) => {
  try {
    const filtro = { empresa: req.usuario.empresa._id };
    if (req.usuario.cargo !== 'admin') filtro.criadoPor = req.usuario._id;

    const leads = await Lead.find(filtro).populate('criadoPor', 'nome').sort({ criadoEm: -1 }).lean();
    res.json(leads);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar leads.' });
  }
});

// POST /api/leads — criar lead (qualquer colaborador autenticado)
router.post('/', autenticar, async (req, res) => {
  const { nome, nomeEmpresa, telefone, email, valor, origem, tipoServico, obs, etapa } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome do contato é obrigatório.' });
  try {
    const lead = await Lead.create({
      nome: nome.trim(),
      nomeEmpresa: nomeEmpresa?.trim() || '',
      telefone: telefone || '',
      email: email || '',
      valor: valor || 0,
      origem: origem || '',
      tipoServico: tipoServico || '',
      obs: obs || '',
      etapa: ETAPAS_VALIDAS.includes(etapa) ? etapa : 'prospeccao',
      empresa: req.usuario.empresa._id,
      criadoPor: req.usuario._id,
    });
    const populado = await Lead.findById(lead._id).populate('criadoPor', 'nome').lean();
    res.status(201).json(populado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar lead.' });
  }
});

// PUT /api/leads/:id — editar campos e/ou mover de etapa (quem criou ou o titular)
router.put('/:id', autenticar, async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' });
    if (!podeEditarLead(req.usuario, lead)) return res.status(403).json({ erro: 'Você só pode editar os próprios leads.' });

    const { empresa, criadoPor, _id, criadoEm, ...dados } = req.body;
    if (dados.etapa && !ETAPAS_VALIDAS.includes(dados.etapa)) return res.status(400).json({ erro: 'Etapa inválida.' });

    const atualizado = await Lead.findByIdAndUpdate(lead._id, { $set: dados }, { new: true })
      .populate('criadoPor', 'nome').lean();
    res.json(atualizado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar lead.' });
  }
});

// DELETE /api/leads/:id — excluir (quem criou ou o titular)
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' });
    if (!podeEditarLead(req.usuario, lead)) return res.status(403).json({ erro: 'Você só pode excluir os próprios leads.' });

    await Lead.findByIdAndDelete(lead._id);
    res.json({ mensagem: 'Lead removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover lead.' });
  }
});

module.exports = router;
