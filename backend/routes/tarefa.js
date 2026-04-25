const express = require('express');
const { enviarTarefaAtribuida, enviarEtapaDesbloqueada } = require('../services/email');
const { autenticar } = require('../middleware/auth');
const Tarefa = require('../models/Tarefa');
const Implantacao = require('../models/Implantacao');
const Usuario = require('../models/Usuario');

const router = express.Router();

// Função auxiliar: sincroniza status da tarefa na implantação vinculada
async function sincronizarImplantacao(tarefaId, novoStatus, usuarioId) {
  try {
    const implantacao = await Implantacao.findOne({
      'etapas.tarefas.tarefa': tarefaId
    });
    if (!implantacao) return;

    let alterou = false;
    for (const etapa of implantacao.etapas) {
      const tarefaEtapa = etapa.tarefas.find(t => t.tarefa?.toString() === tarefaId.toString());
      if (!tarefaEtapa) continue;

      tarefaEtapa.status = novoStatus;
      if (novoStatus === 'concluida') {
        tarefaEtapa.concluidaEm = new Date();
        tarefaEtapa.concluidaPor = usuarioId;
      } else {
        tarefaEtapa.concluidaEm = undefined;
        tarefaEtapa.concluidaPor = undefined;
      }

      // Verifica se todas as tarefas da etapa foram concluídas
      const todasConcluidas = etapa.tarefas.every(t => t.status === 'concluida');
      if (todasConcluidas && novoStatus === 'concluida') {
        etapa.status = 'concluida';
        etapa.concluidaEm = new Date();
        // Desbloqueia próxima etapa
        const proxima = implantacao.etapas.find(e => e.ordem === etapa.ordem + 1);
        if (proxima && proxima.status === 'bloqueada') {
          proxima.status = 'em_andamento';
          proxima.iniciadaEm = new Date();
          // Dispara e-mail pra quem vai agir na próxima etapa
          setImmediate(async () => {
            try {
              const setorProximo = await require('../models/Setor').findById(proxima.setor);
              const tarefasProximas = await Tarefa.find({
                _id: { $in: proxima.tarefas.map(t => t.tarefa) }
              }).populate('responsavel', 'email');
              const emailsProximos = [...new Set(
                tarefasProximas.map(t => t.responsavel?.email).filter(Boolean)
              )];
              const imp = await Implantacao.findOne({ 'etapas._id': etapa._id });
              if (imp && emailsProximos.length) {
                await enviarEtapaDesbloqueada({
                  destinatarios: emailsProximos,
                  nomeCliente: imp.nomeCliente,
                  setor: setorProximo?.nome || 'próximo setor',
                  empresa: '',
                });
              }
            } catch (e) { console.error('Erro e-mail etapa:', e); }
          });
        } else if (!proxima) {
          implantacao.status = 'concluida';
          implantacao.concluidaEm = new Date();
        }
      } else if (novoStatus === 'pendente' && etapa.status === 'concluida') {
        // Se desmarcou, reabre a etapa
        etapa.status = 'em_andamento';
        etapa.concluidaEm = undefined;
        if (implantacao.status === 'concluida') {
          implantacao.status = 'em_andamento';
          implantacao.concluidaEm = undefined;
        }
      }

      alterou = true;
      break;
    }

    if (alterou) await implantacao.save();
  } catch (err) {
    console.error('Erro ao sincronizar implantação:', err);
  }
}

const populateTarefa = (q) => q
  .populate('responsavel', 'nome email avatar')
  .populate('criadaPor', 'nome')
  .populate('concluidaPor', 'nome');

// GET /api/tarefas
router.get('/', autenticar, async (req, res) => {
  try {
    const filtro = { empresa: req.usuario.empresa._id, tarefaMae: null };
    if (req.usuario.cargo === 'colaborador') filtro.responsavel = req.usuario._id;
    const tarefas = await populateTarefa(Tarefa.find(filtro)).sort({ criadaEm: -1 });
    res.json(tarefas);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar tarefas.' });
  }
});

// GET /api/tarefas/:id/subtarefas
router.get('/:id/subtarefas', autenticar, async (req, res) => {
  try {
    const subtarefas = await populateTarefa(
      Tarefa.find({ tarefaMae: req.params.id, empresa: req.usuario.empresa._id })
    ).sort({ criadaEm: 1 });
    res.json(subtarefas);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar subtarefas.' });
  }
});

// GET /api/tarefas/historico - Tarefas concluídas (registro de conquistas)
router.get('/historico/conquistas', autenticar, async (req, res) => {
  try {
    const filtro = {
      empresa: req.usuario.empresa._id,
      status: 'concluida',
    };
    if (req.usuario.cargo === 'colaborador') filtro.responsavel = req.usuario._id;
    const tarefas = await populateTarefa(Tarefa.find(filtro)).sort({ concluidaEm: -1 }).limit(100);
    res.json(tarefas);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar histórico.' });
  }
});

// POST /api/tarefas
router.post('/', autenticar, async (req, res) => {
  const { descricao, data, hora, local, cor, responsavelId, etiquetas, prioridade, tarefaMaeId } = req.body;
  if (!descricao) return res.status(400).json({ erro: 'Descrição é obrigatória.' });
  try {
    const podeAtribuir = req.usuario.cargo === 'admin' || req.usuario.permissoes?.criarTarefas;
    const responsavel = podeAtribuir && responsavelId ? responsavelId : req.usuario._id;
    const tarefa = await Tarefa.create({
      descricao, data, hora, local, cor,
      etiquetas: etiquetas || [],
      prioridade: prioridade || '',
      tarefaMae: tarefaMaeId || null,
      responsavel,
      criadaPor: req.usuario._id,
      empresa: req.usuario.empresa._id
    });
    const populada = await populateTarefa(Tarefa.findById(tarefa._id));
    res.status(201).json(populada);

    // Dispara e-mail se tarefa foi atribuída a outro colaborador
    const ehOutraPessoa = responsavel.toString() !== req.usuario._id.toString();
    if (ehOutraPessoa) {
      setImmediate(async () => {
        try {
          const resp = await Usuario.findById(responsavel).select('email');
          if (resp?.email) {
            await enviarTarefaAtribuida({
              destinatario: resp.email,
              descricao,
              criadoPor: req.usuario.nome,
              data,
              empresa: req.usuario.empresa?.nome || 'seu escritório',
            });
          }
        } catch (e) {
          console.error('Erro ao enviar e-mail de tarefa:', e);
        }
      });
    }
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar tarefa.' });
  }
});

// PUT /api/tarefas/:id
router.put('/:id', autenticar, async (req, res) => {
  try {
    const filtro = { _id: req.params.id, empresa: req.usuario.empresa._id };
    if (req.usuario.cargo === 'colaborador') filtro.responsavel = req.usuario._id;
    const tarefa = await populateTarefa(
      Tarefa.findOneAndUpdate(filtro, req.body, { new: true })
    );
    res.json(tarefa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar tarefa.' });
  }
});

// PATCH /api/tarefas/:id/etiquetas
router.patch('/:id/etiquetas', autenticar, async (req, res) => {
  try {
    const tarefa = await populateTarefa(
      Tarefa.findOneAndUpdate(
        { _id: req.params.id, empresa: req.usuario.empresa._id },
        { etiquetas: req.body.etiquetas || [] },
        { new: true }
      )
    );
    res.json(tarefa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar etiquetas.' });
  }
});

// PATCH /api/tarefas/:id/prioridade
router.patch('/:id/prioridade', autenticar, async (req, res) => {
  try {
    const tarefa = await populateTarefa(
      Tarefa.findOneAndUpdate(
        { _id: req.params.id, empresa: req.usuario.empresa._id },
        { prioridade: req.body.prioridade || '' },
        { new: true }
      )
    );
    res.json(tarefa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar prioridade.' });
  }
});

// PATCH /api/tarefas/:id/concluir
router.patch('/:id/concluir', autenticar, async (req, res) => {
  try {
    const filtro = { _id: req.params.id, empresa: req.usuario.empresa._id };
    if (req.usuario.cargo === 'colaborador') filtro.responsavel = req.usuario._id;
    const tarefa = await Tarefa.findOneAndUpdate(filtro,
      { status: 'concluida', concluidaEm: new Date(), concluidaPor: req.usuario._id },
      { new: true });
    if (!tarefa) return res.status(404).json({ erro: 'Tarefa não encontrada.' });
    // Sincroniza o status na implantação vinculada (se houver)
    await sincronizarImplantacao(tarefa._id, 'concluida', req.usuario._id);
    res.json(tarefa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao concluir tarefa.' });
  }
});

// PATCH /api/tarefas/:id/desmarcar
router.patch('/:id/desmarcar', autenticar, async (req, res) => {
  try {
    const filtro = { _id: req.params.id, empresa: req.usuario.empresa._id };
    if (req.usuario.cargo === 'colaborador') filtro.responsavel = req.usuario._id;
    const tarefa = await Tarefa.findOneAndUpdate(filtro,
      { status: 'pendente', $unset: { concluidaEm: '', concluidaPor: '' } },
      { new: true });
    if (!tarefa) return res.status(404).json({ erro: 'Tarefa não encontrada.' });
    // Sincroniza o status na implantação vinculada (se houver)
    await sincronizarImplantacao(tarefa._id, 'pendente', req.usuario._id);
    res.json(tarefa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao desmarcar tarefa.' });
  }
});

// DELETE /api/tarefas/:id
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const filtro = { _id: req.params.id, empresa: req.usuario.empresa._id };
    if (req.usuario.cargo === 'colaborador') filtro.responsavel = req.usuario._id;
    // Remove também subtarefas
    await Tarefa.deleteMany({ tarefaMae: req.params.id, empresa: req.usuario.empresa._id });
    await Tarefa.findOneAndDelete(filtro);
    res.json({ mensagem: 'Tarefa excluída.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir tarefa.' });
  }
});

module.exports = router;
