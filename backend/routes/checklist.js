const express = require('express');
const registrarLog = require('../services/log');
const { autenticar, temPermissao } = require('../middleware/auth');
const AtividadeChecklist = require('../models/AtividadeChecklist');

const router = express.Router();

const populate = (q) => q
  .populate('setor', 'nome cor')
  .populate('responsavel', 'nome email avatar')
  .populate('criadoPor', 'nome');

// GET /api/checklist — lista todas as atividades da empresa
router.get('/', autenticar, async (req, res) => {
  try {
    const atividades = await populate(
      AtividadeChecklist.find({ empresa: req.usuario.empresa._id, ativo: true })
    ).sort({ criadoEm: 1 }).lean();
    res.json(atividades);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar atividades.' });
  }
});

// GET /api/checklist/setor/:setorId — atividades de um setor específico
router.get('/setor/:setorId', autenticar, async (req, res) => {
  try {
    const atividades = await populate(
      AtividadeChecklist.find({
        empresa: req.usuario.empresa._id,
        setor: req.params.setorId,
        ativo: true
      })
    ).sort({ criadoEm: 1 }).lean();
    res.json(atividades);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar atividades do setor.' });
  }
});

// POST /api/checklist
router.post('/', autenticar, temPermissao('gerenciarBancoAtividades'), async (req, res) => {
  const { descricao, observacoes, setor, responsavelId } = req.body;
  if (!descricao?.trim()) return res.status(400).json({ erro: 'Descrição é obrigatória.' });
  if (!setor) return res.status(400).json({ erro: 'Setor é obrigatório.' });
  try {
    const atividade = await AtividadeChecklist.create({
      descricao: descricao.trim(),
      observacoes: observacoes?.trim() || '',
      setor,
      responsavel: responsavelId || null,
      empresa: req.usuario.empresa._id,
      criadoPor: req.usuario._id,
    });
    const populada = await populate(AtividadeChecklist.findById(atividade._id)).lean();
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'atividade_criada', categoria: 'atividade', descricao: 'Criou a atividade ' + descricao });
    res.status(201).json(populada);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar atividade.' });
  }
});

// PUT /api/checklist/:id
router.put('/:id', autenticar, temPermissao('gerenciarBancoAtividades'), async (req, res) => {
  const { descricao, observacoes, responsavelId } = req.body;
  try {
    const atividade = await populate(
      AtividadeChecklist.findOneAndUpdate(
        { _id: req.params.id, empresa: req.usuario.empresa._id },
        {
          descricao: descricao?.trim(),
          observacoes: observacoes?.trim() || '',
          responsavel: responsavelId || null,
        },
        { new: true }
      )
    );
    if (!atividade) return res.status(404).json({ erro: 'Atividade não encontrada.' });
    res.json(atividade);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar atividade.' });
  }
});

// DELETE /api/checklist/:id
router.delete('/:id', autenticar, temPermissao('gerenciarBancoAtividades'), async (req, res) => {
  try {
    await AtividadeChecklist.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { ativo: false }
    );
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'atividade_excluida', categoria: 'atividade', descricao: 'Removeu uma atividade do banco' });
    res.json({ mensagem: 'Atividade removida.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover atividade.' });
  }
});

module.exports = router;
