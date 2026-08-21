const express = require('express');
const { autenticar, temPermissao } = require('../middleware/auth');
const Setor = require('../models/Setor');
const { setorCreateSchema, setorUpdateSchema, setorMembroSchema, setorMembroRemoverSchema, validar } = require('../validacao');

const router = express.Router();

// Admin e quem tem gerenciarSetores sempre podem; além disso, o responsável designado
// daquele setor específico também pode gerenciar (só) os membros dele.
const podeGerenciarMembros = async (req, setorId) => {
  if (req.usuario.cargo === 'admin' || req.usuario.permissoes?.gerenciarSetores) return true;
  const setor = await Setor.findOne({ _id: setorId, empresa: req.usuario.empresa._id }).select('responsavel').lean();
  return !!setor?.responsavel && setor.responsavel.toString() === req.usuario._id.toString();
};

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
    }).populate('membros', 'nome email avatar cargo').populate('responsavel', 'nome email avatar cargo').sort({ padrao: -1, criadoEm: 1 }).lean();
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
router.post('/', autenticar, temPermissao('gerenciarSetores'), validar(setorCreateSchema), async (req, res) => {
  const { nome, cor, membros, responsavel } = req.body;
  try {
    // O responsável precisa ter acesso à Demanda desse setor pra poder responder a pergunta
    // inicial (situação/regime) — garante que ele também entra como membro.
    const membrosFinal = new Set((membros || []).map(m => m.toString()));
    if (responsavel) membrosFinal.add(responsavel.toString());

    const setor = await Setor.create({
      nome: nome.trim(),
      cor: cor || '#2DAA59',
      responsavel: responsavel || null,
      membros: [...membrosFinal],
      empresa: req.usuario.empresa._id,
      padrao: false
    });

    const Usuario = require('../models/Usuario');
    await Promise.all([...membrosFinal].map(uid => Usuario.updateOne({ _id: uid }, { $addToSet: { setores: setor._id } })));

    const populado = await Setor.findById(setor._id).populate('membros', 'nome email avatar cargo').populate('responsavel', 'nome email avatar cargo').lean();
    res.status(201).json(populado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar setor.' });
  }
});

// PUT /api/setores/:id - Editar setor
router.put('/:id', autenticar, temPermissao('gerenciarSetores'), validar(setorUpdateSchema), async (req, res) => {
  const { nome, cor, membros, responsavel } = req.body;
  try {
    const Usuario = require('../models/Usuario');
    const setorAntigo = await Setor.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    const membrosAntigos = setorAntigo?.membros?.map(m => m.toString()) || [];
    // O responsável precisa ter acesso à Demanda desse setor pra poder responder a pergunta
    // inicial (situação/regime) — garante que ele também entra como membro.
    const membrosFinal = new Set((membros || []).map(m => m.toString()));
    if (responsavel) membrosFinal.add(responsavel.toString());
    const membrosNovos = [...membrosFinal];

    const setor = await Setor.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { nome: nome?.trim(), cor, responsavel: responsavel || null, membros: membrosNovos },
      { new: true }
    ).populate('membros', 'nome email avatar cargo').populate('responsavel', 'nome email avatar cargo');
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
router.patch('/:id/membros', autenticar, validar(setorMembroSchema), async (req, res) => {
  const { usuarioId, acao } = req.body; // acao: 'adicionar' | 'remover'
  try {
    if (!(await podeGerenciarMembros(req, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão pra gerenciar os membros deste setor.' });
    }
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
router.patch('/:id/membros/remover', autenticar, validar(setorMembroRemoverSchema), async (req, res) => {
  const { usuarioId } = req.body;
  try {
    if (!(await podeGerenciarMembros(req, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão pra gerenciar os membros deste setor.' });
    }
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

router.delete('/:id', autenticar, temPermissao('gerenciarSetores'), async (req, res) => {
  try {
    const setor = await Setor.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { ativo: false },
      { new: true }
    );
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });

    // Setor inativo não deve mais contar como participação atual de ninguém — só limpa
    // o vínculo em Usuario.setores, sem tocar em registro histórico (Demanda, Implantação).
    const Usuario = require('../models/Usuario');
    await Usuario.updateMany(
      { empresa: req.usuario.empresa._id, setores: setor._id },
      { $pull: { setores: setor._id } }
    );

    res.json({ mensagem: 'Setor removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover setor.' });
  }
});

module.exports = router;
