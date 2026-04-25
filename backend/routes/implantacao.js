const express = require('express');
const { autenticar } = require('../middleware/auth');
const Implantacao = require('../models/Implantacao');
const ModeloOnboarding = require('../models/ModeloOnboarding');
const AtividadeChecklist = require('../models/AtividadeChecklist');
const Tarefa = require('../models/Tarefa');
const Setor = require('../models/Setor');
const Usuario = require('../models/Usuario');
const { enviarOnboardingCriado, enviarEtapaDesbloqueada } = require('../services/email');

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

// POST /api/implantacoes - Cria nova implantação e gera tarefas reais para cada colaborador
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

      const setoresOrdenados = [...modelo.setores].sort((a, b) => a.ordem - b.ordem);

      for (let idx = 0; idx < setoresOrdenados.length; idx++) {
        const s = setoresOrdenados[idx];

        // Busca o setor para pegar o primeiro membro
        const setorCompleto = await Setor.findById(s.setor);
        const responsavelId = setorCompleto?.membros?.[0] || req.usuario._id;

        // Busca as atividades do checklist pelos IDs salvos no modelo
        const atividades = await AtividadeChecklist.find({
          _id: { $in: s.tarefas },
          ativo: true
        });

        // Cria uma Tarefa real no banco para cada atividade
        const tarefasCriadas = await Promise.all(
          atividades.map(ativ =>
            Tarefa.create({
              descricao: ativ.descricao,
              setor: s.setor,
              responsavel: ativ.responsavel || responsavelId,
              criadaPor: req.usuario._id,
              empresa: req.usuario.empresa._id,
              status: 'pendente',
            })
          )
        );

        etapas.push({
          setor: s.setor,
          ordem: s.ordem,
          status: idx === 0 ? 'em_andamento' : 'bloqueada',
          tarefas: tarefasCriadas.map(t => ({ tarefa: t._id, status: 'pendente' })),
          iniciadaEm: idx === 0 ? new Date() : undefined
        });
      }
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

    // Dispara e-mails em background (não bloqueia a resposta)
    setImmediate(async () => {
      try {
        const nomeEmpresa = req.usuario.empresa?.nome || 'seu escritório';
        const criadoPor = req.usuario.nome;

        // Coleta todos os responsáveis únicos de todas as etapas
        const responsavelIds = new Set();
        implantacao.etapas.forEach(etapa => {
          etapa.tarefas.forEach(t => {
            if (t.tarefa) responsavelIds.add(t.tarefa.toString());
          });
        });

        // Busca e-mails de todos os responsáveis via tarefas criadas
        const tarefasPopuladas = await Tarefa.find({
          _id: { $in: [...responsavelIds] }
        }).populate('responsavel', 'email nome');

        const emailsEnvolvidos = [...new Set(
          tarefasPopuladas
            .map(t => t.responsavel?.email)
            .filter(Boolean)
            .filter(e => e !== req.usuario.email)
        )];

        // E-mail 1: avisa todos os envolvidos que o onboarding foi criado
        await enviarOnboardingCriado({
          destinatarios: emailsEnvolvidos,
          nomeCliente: nomeCliente.trim(),
          criadoPor,
          empresa: nomeEmpresa,
        });

        // E-mail 2: avisa o responsável da primeira etapa que é a vez dele
        const primeiraEtapa = implantacao.etapas.find(e => e.status === 'em_andamento');
        if (primeiraEtapa) {
          const setorDaPrimeira = await Setor.findById(primeiraEtapa.setor);
          const tarefasDaPrimeira = await Tarefa.find({
            _id: { $in: primeiraEtapa.tarefas.map(t => t.tarefa) }
          }).populate('responsavel', 'email');
          const emailsPrimeira = [...new Set(
            tarefasDaPrimeira.map(t => t.responsavel?.email).filter(Boolean)
          )];
          await enviarEtapaDesbloqueada({
            destinatarios: emailsPrimeira,
            nomeCliente: nomeCliente.trim(),
            setor: setorDaPrimeira?.nome || 'Primeiro setor',
            empresa: nomeEmpresa,
          });
        }
      } catch (e) {
        console.error('Erro ao enviar e-mails de onboarding:', e);
      }
    });
  } catch (err) {
    console.error(err);
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

// DELETE /api/implantacoes/:id — exclui a implantação e todas as tarefas geradas por ela
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const implantacao = await Implantacao.findOne({
      _id: req.params.id,
      empresa: req.usuario.empresa._id
    });
    if (!implantacao) return res.status(404).json({ erro: 'Implantação não encontrada.' });

    // Coleta todos os IDs de tarefas geradas e exclui do banco
    const tarefaIds = [];
    implantacao.etapas.forEach(etapa => {
      etapa.tarefas.forEach(t => {
        if (t.tarefa) tarefaIds.push(t.tarefa);
      });
    });
    if (tarefaIds.length > 0) {
      await Tarefa.deleteMany({ _id: { $in: tarefaIds } });
    }

    await Implantacao.findByIdAndDelete(req.params.id);
    res.json({ mensagem: 'Implantação excluída com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir implantação.' });
  }
});

module.exports = router;
