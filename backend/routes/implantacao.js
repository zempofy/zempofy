const express = require('express');
const { autenticar } = require('../middleware/auth');
const Implantacao = require('../models/Implantacao');
const ModeloOnboarding = require('../models/ModeloOnboarding');

const router = express.Router();

const populateImplantacao = (q) => q
  .populate('etapas.setor', 'nome cor')
  .populate('etapas.tarefas.tarefa', 'descricao responsavel')
  .populate('etapas.tarefas.concluidaPor', 'nome')
  .populate('modelo', 'nome')
  .populate('criadoPor', 'nome');

// GET /api/implantacoes
router.get('/', autenticar, async (req, res) => {
  try {
    const implantacoes = await populateImplantacao(
      Implantacao.find({ empresa: req.usuario.empresa._id, status: { $ne: 'cancelada' } })
    ).sort({ criadoEm: -1 });
    res.json(implantacoes);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar implantações.' });
  }
});

// GET /api/implantacoes/por-tarefa/:tarefaId — busca a implantação que contém essa tarefa
router.get('/por-tarefa/:tarefaId', autenticar, async (req, res) => {
  try {
    const implantacao = await Implantacao.findOne({
      empresa: req.usuario.empresa._id,
      'etapas.tarefas.tarefa': req.params.tarefaId
    })
    .populate('criadoPor', 'nome')
    .populate('modelo', 'nome');
    if (!implantacao) return res.status(404).json({ erro: 'Implantação não encontrada.' });
    res.json({
      _id: implantacao._id,
      nomeCliente: implantacao.nomeCliente,
      cnpj: implantacao.cnpj,
      modelo: implantacao.modelo?.nome || '',
      criadoPor: implantacao.criadoPor?.nome || '',
      criadoEm: implantacao.criadoEm,
      status: implantacao.status,
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar implantação.' });
  }
});

// GET /api/implantacoes/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const implantacao = await populateImplantacao(
      Implantacao.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id })
    );
    if (!implantacao) return res.status(404).json({ erro: 'Implantação não encontrada.' });
    res.json(implantacao);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar implantação.' });
  }
});

// POST /api/implantacoes - Cria uma nova implantação a partir de um modelo
router.post('/', autenticar, async (req, res) => {
  const { nomeCliente, cnpj, modeloId } = req.body;
  if (!nomeCliente?.trim()) return res.status(400).json({ erro: 'Nome do cliente é obrigatório.' });
  try {
    let etapas = [];

    if (modeloId) {
      const modelo = await ModeloOnboarding.findOne({
        _id: modeloId,
        empresa: req.usuario.empresa._id
      });
      if (!modelo) return res.status(404).json({ erro: 'Modelo não encontrado.' });

      // Monta etapas a partir do modelo, ordenadas
      etapas = modelo.setores
        .sort((a, b) => a.ordem - b.ordem)
        .map((s, idx) => ({
          setor: s.setor,
          ordem: s.ordem,
          // Primeira etapa já começa em andamento, as demais ficam bloqueadas
          status: idx === 0 ? 'em_andamento' : 'bloqueada',
          tarefas: s.tarefas.map(t => ({ tarefa: t, status: 'pendente' })),
          iniciadaEm: idx === 0 ? new Date() : undefined
        }));
    }

    const implantacao = await Implantacao.create({
      nomeCliente: nomeCliente.trim(),
      cnpj: cnpj?.trim() || '',
      modelo: modeloId || null,
      etapas,
      empresa: req.usuario.empresa._id,
      criadoPor: req.usuario._id
    });

    const populada = await populateImplantacao(Implantacao.findById(implantacao._id));
    res.status(201).json(populada);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar implantação.' });
  }
});

// PATCH /api/implantacoes/:id/tarefas/:etapaId/:tarefaId/concluir
router.patch('/:id/tarefas/:etapaId/:tarefaId/concluir', autenticar, async (req, res) => {
  try {
    const implantacao = await Implantacao.findOne({
      _id: req.params.id,
      empresa: req.usuario.empresa._id
    });
    if (!implantacao) return res.status(404).json({ erro: 'Implantação não encontrada.' });

    const etapa = implantacao.etapas.id(req.params.etapaId);
    if (!etapa) return res.status(404).json({ erro: 'Etapa não encontrada.' });

    const tarefaEtapa = etapa.tarefas.id(req.params.tarefaId);
    if (!tarefaEtapa) return res.status(404).json({ erro: 'Tarefa não encontrada.' });

    tarefaEtapa.status = 'concluida';
    tarefaEtapa.concluidaEm = new Date();
    tarefaEtapa.concluidaPor = req.usuario._id;

    // Verifica se todas as tarefas da etapa foram concluídas
    const todasConcluidas = etapa.tarefas.every(t => t.status === 'concluida');
    if (todasConcluidas) {
      etapa.status = 'concluida';
      etapa.concluidaEm = new Date();

      // Desbloqueia a próxima etapa
      const proxima = implantacao.etapas.find(e => e.ordem === etapa.ordem + 1);
      if (proxima) {
        proxima.status = 'em_andamento';
        proxima.iniciadaEm = new Date();
      } else {
        // Era a última etapa, implantação concluída!
        implantacao.status = 'concluida';
        implantacao.concluidaEm = new Date();
      }
    }

    await implantacao.save();
    const populada = await populateImplantacao(Implantacao.findById(implantacao._id));
    res.json(populada);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao concluir tarefa.' });
  }
});

// PATCH /api/implantacoes/:id/tarefas/:etapaId/:tarefaId/desmarcar
router.patch('/:id/tarefas/:etapaId/:tarefaId/desmarcar', autenticar, async (req, res) => {
  try {
    const implantacao = await Implantacao.findOne({
      _id: req.params.id,
      empresa: req.usuario.empresa._id
    });
    if (!implantacao) return res.status(404).json({ erro: 'Implantação não encontrada.' });

    const etapa = implantacao.etapas.id(req.params.etapaId);
    const tarefaEtapa = etapa?.tarefas.id(req.params.tarefaId);
    if (!etapa || !tarefaEtapa) return res.status(404).json({ erro: 'Tarefa não encontrada.' });

    tarefaEtapa.status = 'pendente';
    tarefaEtapa.concluidaEm = undefined;
    tarefaEtapa.concluidaPor = undefined;

    // Se a etapa estava concluída, reabre
    if (etapa.status === 'concluida') {
      etapa.status = 'em_andamento';
      etapa.concluidaEm = undefined;
    }

    await implantacao.save();
    const populada = await populateImplantacao(Implantacao.findById(implantacao._id));
    res.json(populada);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao desmarcar tarefa.' });
  }
});

// DELETE /api/implantacoes/:id
router.delete('/:id', autenticar, async (req, res) => {
  try {
    await Implantacao.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { status: 'cancelada' }
    );
    res.json({ mensagem: 'Implantação cancelada.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cancelar implantação.' });
  }
});

module.exports = router;
