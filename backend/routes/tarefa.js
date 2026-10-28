const express = require('express');
const { enviarTarefaAtribuida } = require('../services/email');
const { alterarAtividade, ErroAtividade } = require('../services/atividadeOnboarding');
const { autenticar } = require('../middleware/auth');
const Tarefa = require('../models/Tarefa');
const Implantacao = require('../models/Implantacao');
const Usuario = require('../models/Usuario');
const { tarefaCreateSchema, tarefaUpdateSchema, tarefaEtiquetasSchema, tarefaPrioridadeSchema, validar } = require('../validacao');

const router = express.Router();

const populateTarefa = (q) => q
  .populate('responsavel', 'nome email avatar')
  .populate('criadaPor', 'nome')
  .populate('concluidaPor', 'nome');

// GET /api/tarefas
router.get('/', autenticar, async (req, res) => {
  try {
    const filtro = { empresa: req.usuario.empresa._id, tarefaMae: null };
    if (req.usuario.cargo === 'colaborador') filtro.responsavel = req.usuario._id;

    // Buscar IDs de tarefas que estão em etapas BLOQUEADAS — não devem aparecer
    const implantacoes = await Implantacao.find({ empresa: req.usuario.empresa._id, status: { $ne: 'cancelada' } }).lean();
    const idsBloqueadas = new Set();
    implantacoes.forEach(imp => {
      imp.etapas.forEach(etapa => {
        if (etapa.status === 'bloqueada') {
          etapa.tarefas.forEach(t => {
            if (t.tarefa) idsBloqueadas.add(t.tarefa.toString());
          });
        }
      });
    });

    // Excluir tarefas bloqueadas do resultado
    if (idsBloqueadas.size > 0) {
      filtro._id = { $nin: [...idsBloqueadas] };
    }

    const tarefas = await populateTarefa(Tarefa.find(filtro)).sort({ criadaEm: -1 }).lean();
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
    ).sort({ criadaEm: 1 }).lean();
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
    const tarefas = await populateTarefa(Tarefa.find(filtro)).sort({ concluidaEm: -1 }).limit(100).lean();
    res.json(tarefas);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar histórico.' });
  }
});

// POST /api/tarefas
router.post('/', autenticar, validar(tarefaCreateSchema), async (req, res) => {
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
    const populada = await populateTarefa(Tarefa.findById(tarefa._id)).lean();
    res.status(201).json(populada);

    // Dispara e-mail se tarefa foi atribuída a outro colaborador
    const ehOutraPessoa = responsavel.toString() !== req.usuario._id.toString();
    if (ehOutraPessoa) {
      setImmediate(async () => {
        try {
          const resp = await Usuario.findById(responsavel).select('email').lean();
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
router.put('/:id', autenticar, validar(tarefaUpdateSchema), async (req, res) => {
  try {
    const filtro = { _id: req.params.id, empresa: req.usuario.empresa._id };
    if (req.usuario.cargo === 'colaborador') filtro.responsavel = req.usuario._id;
    // status/conclusão só mudam por /concluir e /desmarcar (regra única): por aqui deixariam tarefa e onboarding em desacordo
    const { empresa, criadaPor, _id, criadaEm, status, concluidaEm, concluidaPor, ...dados } = req.body;
    const tarefa = await populateTarefa(
      Tarefa.findOneAndUpdate(filtro, { $set: dados }, { new: true })
    );
    res.json(tarefa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar tarefa.' });
  }
});

// PATCH /api/tarefas/:id/etiquetas
router.patch('/:id/etiquetas', autenticar, validar(tarefaEtiquetasSchema), async (req, res) => {
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
router.patch('/:id/prioridade', autenticar, validar(tarefaPrioridadeSchema), async (req, res) => {
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

// PATCH /api/tarefas/:id/concluir e /desmarcar — mesma regra da bolinha da tela de Implantação
// (services/atividadeOnboarding.js): permissão, tarefa + onboarding gravados juntos, etapas, e-mail e vigência.
const alterarPelaTelaDeTarefas = (concluir) => async (req, res) => {
  try {
    const r = await alterarAtividade({ usuario: req.usuario, tarefaId: req.params.id, concluir });
    res.json(r.tarefa);
  } catch (err) {
    if (err instanceof ErroAtividade) return res.status(err.status).json({ erro: err.message, codigo: err.codigo });
    console.error(err);
    res.status(500).json({ erro: concluir ? 'Erro ao concluir tarefa.' : 'Erro ao desmarcar tarefa.' });
  }
};
router.patch('/:id/concluir', autenticar, alterarPelaTelaDeTarefas(true));
router.patch('/:id/desmarcar', autenticar, alterarPelaTelaDeTarefas(false));

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
