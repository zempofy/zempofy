const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const Empresa = require('../models/Empresa');
const Usuario = require('../models/Usuario');
const Implantacao = require('../models/Implantacao');
const Cliente = require('../models/Cliente');

// Usados só na exclusão em cascata e no código de confirmação
const CodigoExclusao = require('../models/CodigoExclusao');
const Anotacao = require('../models/Anotacao');
const AtividadeChecklist = require('../models/AtividadeChecklist');
const Aviso = require('../models/Aviso');
const Documento = require('../models/Documento');
const Evento = require('../models/Evento');
const LancamentoSetor = require('../models/LancamentoSetor');
const Lead = require('../models/Lead');
const Log = require('../models/Log');
const Mensagem = require('../models/Mensagem');
const ModeloOnboarding = require('../models/ModeloOnboarding');
const Setor = require('../models/Setor');
const Tarefa = require('../models/Tarefa');
const { apagarArquivo } = require('../services/storage');
const { enviarCodigoExclusaoEmpresa } = require('../services/email');

const CODIGO_VALIDADE_MS = 10 * 60 * 1000; // 10 min — mesmo prazo do TTL em CodigoExclusao.js

const verificarChave = (req, res, next) => {
  const chave = req.headers['x-admin-key'];
  const esperada = process.env.ADMIN_SECRET_KEY;

  if (!chave || !esperada) {
    return res.status(401).json({ erro: 'Acesso negado. Faça login.' });
  }

  const bufChave = Buffer.from(chave);
  const bufEsperada = Buffer.from(esperada);

  if (bufChave.length !== bufEsperada.length || !crypto.timingSafeEqual(bufChave, bufEsperada)) {
    return res.status(401).json({ erro: 'Acesso negado. Faça login.' });
  }

  next();
};

router.get('/', verificarChave, async (req, res) => {
  try {
    const empresas = await Empresa.find().sort({ criadaEm: -1 }).lean();

    const dados = await Promise.all(empresas.map(async (emp) => {
      const [usuarios, implantacoes, clientes] = await Promise.all([
        Usuario.find({ empresa: emp._id, ativo: true }).select('nome email cargo ultimoAcesso emailVerificado setores').lean(),
        Implantacao.find({ empresa: emp._id, status: { $ne: 'cancelada' } }).lean(),
        Cliente.countDocuments({ empresa: emp._id }),
      ]);

      const titular = usuarios.find(u => u.cargo === 'admin');
      const colaboradores = usuarios.filter(u => u.cargo !== 'admin');
      const implAtivas = implantacoes.filter(i => i.status !== 'concluida');
      const implConcluidas = implantacoes.filter(i => i.status === 'concluida');

      // Progresso médio dos onboardings ativos
      const progressoMedio = implAtivas.length ? Math.round(
        implAtivas.reduce((acc, imp) => {
          const total = imp.etapas?.length || 0;
          const conc = imp.etapas?.filter(e => e.status === 'concluida').length || 0;
          return acc + (total ? (conc / total) * 100 : 0);
        }, 0) / implAtivas.length
      ) : 0;

      const ultimoAcesso = usuarios
        .map(u => u.ultimoAcesso).filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0];

      // ID de suporte: 3 letras do nome + ID sequencial
      const sigla = (emp.nome || 'EMP').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
      const idSuporte = `${sigla}-${emp._id.toString().slice(-5).toUpperCase()}`;

      return {
        id: emp._id,
        idSuporte,
        nome: emp.nome,
        cnpj: emp.cnpj,
        plano: emp.plano || 'starter',
        ativa: emp.ativa !== false,
        criadaEm: emp.criadaEm,
        alertaOnboardingDias: emp.alertaOnboardingDias || 7,
        resumoFrequencia: emp.resumoFrequencia || 'semanal',
        titular: titular ? { nome: titular.nome, email: titular.email, emailVerificado: titular.emailVerificado } : null,
        colaboradores: colaboradores.map(c => ({ nome: c.nome, email: c.email })),
        totalUsuarios: usuarios.length,
        clientes,
        implantacoesAtivas: implAtivas.length,
        implantacoesConcluidas: implConcluidas.length,
        progressoMedio,
        ultimoAcesso: ultimoAcesso || null,
      };
    }));

    const mrr = dados.reduce((acc, e) => {
      if (!e.ativa) return acc;
      const valores = { starter: 39, pro: 79, escala: 129 };
      return acc + (valores[e.plano] || 0);
    }, 0);

    res.json({
      totalEmpresas: empresas.length,
      empresasAtivas: dados.filter(e => e.ativa).length,
      totalUsuarios: dados.reduce((a, e) => a + e.totalUsuarios, 0),
      totalOnboardingsAtivos: dados.reduce((a, e) => a + e.implantacoesAtivas, 0),
      mrr,
      geradoEm: new Date(),
      empresas: dados,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar dados do painel.' });
  }
});

// ── PATCH /api/painel/empresas/:id/inativar ──
// Reversível. Bloqueia o login de todos os usuários da empresa (ver routes/auth.js).
router.patch('/empresas/:id/inativar', verificarChave, async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });

    empresa.ativa = false;
    await empresa.save();
    console.log(`[painel] Empresa inativada: ${empresa.nome} (${empresa._id})`);
    res.json({ id: empresa._id, nome: empresa.nome, ativa: empresa.ativa });
  } catch (err) {
    console.error('[painel] Erro ao inativar empresa:', err);
    res.status(500).json({ erro: 'Erro ao inativar empresa.' });
  }
});

// ── PATCH /api/painel/empresas/:id/reativar ──
router.patch('/empresas/:id/reativar', verificarChave, async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });

    empresa.ativa = true;
    await empresa.save();
    console.log(`[painel] Empresa reativada: ${empresa.nome} (${empresa._id})`);
    res.json({ id: empresa._id, nome: empresa.nome, ativa: empresa.ativa });
  } catch (err) {
    console.error('[painel] Erro ao reativar empresa:', err);
    res.status(500).json({ erro: 'Erro ao reativar empresa.' });
  }
});

// ── POST /api/painel/empresas/:id/solicitar-exclusao ──
// Gera o código de 6 dígitos e manda pro ADMIN_EMAIL. Só funciona com a empresa já inativa.
router.post('/empresas/:id/solicitar-exclusao', verificarChave, async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });
    if (empresa.ativa !== false) {
      return res.status(400).json({ erro: 'Inative a empresa antes de excluí-la.' });
    }

    const destinatario = process.env.ADMIN_EMAIL;
    if (!destinatario) {
      // Falha explícita: sem isso o código seria gerado e não chegaria em lugar nenhum
      return res.status(500).json({ erro: 'ADMIN_EMAIL não configurado no servidor. Configure a variável de ambiente antes de excluir empresas.' });
    }

    // randomInt é exclusivo no limite superior — 100000..999999 sempre dá 6 dígitos
    const codigo = String(crypto.randomInt(100000, 1000000));

    // Um código pendente por vez: o anterior deixa de valer assim que outro é pedido
    await CodigoExclusao.deleteMany({ empresa: empresa._id });
    await CodigoExclusao.create({ empresa: empresa._id, codigo });

    try {
      await enviarCodigoExclusaoEmpresa({ destinatario, nomeEmpresa: empresa.nome, codigo });
    } catch (erroEmail) {
      // Se o e-mail não saiu, ninguém tem o código — não deixar o registro no banco dando a
      // impressão de que existe um código pendente válido.
      await CodigoExclusao.deleteMany({ empresa: empresa._id });
      throw erroEmail;
    }

    console.log(`[painel] Código de exclusão enviado para ${destinatario} — empresa ${empresa.nome} (${empresa._id})`);
    res.json({ mensagem: 'Código enviado para o e-mail do administrador.' });
  } catch (err) {
    console.error('[painel] Erro ao solicitar exclusão:', err);
    res.status(500).json({ erro: 'Erro ao enviar o código de confirmação. Verifique a configuração de e-mail.' });
  }
});

// ── DELETE /api/painel/empresas/:id ──
// Exclusão permanente em cascata (banco + arquivos no R2). Exige o código enviado por e-mail.
router.delete('/empresas/:id', verificarChave, async (req, res) => {
  try {
    const { codigo } = req.body || {};
    if (!codigo) return res.status(400).json({ erro: 'Informe o código de confirmação.' });

    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });
    if (empresa.ativa !== false) {
      return res.status(400).json({ erro: 'Inative a empresa antes de excluí-la.' });
    }

    const registro = await CodigoExclusao.findOne({ empresa: empresa._id, codigo: String(codigo).trim() });
    if (!registro) return res.status(400).json({ erro: 'Código inválido ou expirado.' });

    // O TTL do Mongo roda em background e pode demorar até ~1 min depois do vencimento —
    // conferir a idade aqui evita aceitar um código que já deveria ter sumido.
    if (Date.now() - new Date(registro.criadoEm).getTime() > CODIGO_VALIDADE_MS) {
      await CodigoExclusao.deleteMany({ empresa: empresa._id });
      return res.status(400).json({ erro: 'Código inválido ou expirado.' });
    }

    const id = empresa._id;
    const nomeEmpresa = empresa.nome;
    console.log(`[painel] INICIANDO exclusão permanente da empresa ${nomeEmpresa} (${id})`);

    // 1) Arquivos no R2 primeiro — Documento é o único model que guarda arquivo lá fora
    // (Aviso.imagem e Usuario.avatar são base64 no próprio Mongo, somem com o registro).
    // Falha em um arquivo não interrompe o resto: o registro no banco sai de qualquer forma,
    // e o que sobrar no bucket fica registrado no log pra limpeza manual.
    const documentos = await Documento.find({ empresa: id }).select('chave nomeOriginal').lean();
    const falhasR2 = [];
    for (const doc of documentos) {
      try {
        await apagarArquivo(doc.chave);
      } catch (err) {
        falhasR2.push(doc.chave);
        console.error(`[painel] Falha ao apagar no R2: ${doc.chave} — ${err.message}`);
      }
    }

    // 2) Coleções vinculadas. Sem dependência entre si, então vão em paralelo.
    const [
      docs, anotacoes, atividades, avisos, clientes, eventos, implantacoes,
      lancamentos, leads, logs, mensagens, modelos, setores, tarefas, usuarios,
    ] = await Promise.all([
      Documento.deleteMany({ empresa: id }),
      Anotacao.deleteMany({ empresa: id }),
      AtividadeChecklist.deleteMany({ empresa: id }),
      Aviso.deleteMany({ empresa: id }),
      Cliente.deleteMany({ empresa: id }),
      Evento.deleteMany({ empresa: id }),
      Implantacao.deleteMany({ empresa: id }),
      LancamentoSetor.deleteMany({ empresa: id }),
      Lead.deleteMany({ empresa: id }),
      Log.deleteMany({ empresa: id }),
      Mensagem.deleteMany({ empresa: id }),
      ModeloOnboarding.deleteMany({ empresa: id }),
      Setor.deleteMany({ empresa: id }),
      Tarefa.deleteMany({ empresa: id }),
      Usuario.deleteMany({ empresa: id }),
    ]);

    // 3) Código usado e, por último, a própria empresa
    await CodigoExclusao.deleteMany({ empresa: id });
    await Empresa.deleteOne({ _id: id });

    const removidos = {
      documentos: docs.deletedCount, anotacoes: anotacoes.deletedCount,
      atividadesChecklist: atividades.deletedCount, avisos: avisos.deletedCount,
      clientes: clientes.deletedCount, eventos: eventos.deletedCount,
      implantacoes: implantacoes.deletedCount, lancamentosSetor: lancamentos.deletedCount,
      leads: leads.deletedCount, logs: logs.deletedCount, mensagens: mensagens.deletedCount,
      modelosOnboarding: modelos.deletedCount, setores: setores.deletedCount,
      tarefas: tarefas.deletedCount, usuarios: usuarios.deletedCount,
    };
    console.log(`[painel] Empresa ${nomeEmpresa} (${id}) EXCLUÍDA. Removidos:`, JSON.stringify(removidos));
    if (falhasR2.length) {
      console.error(`[painel] ATENÇÃO: ${falhasR2.length} arquivo(s) ficaram no R2 e precisam de limpeza manual:`, falhasR2);
    }

    res.json({
      mensagem: 'Empresa excluída permanentemente.',
      removidos,
      ...(falhasR2.length ? { avisoR2: `${falhasR2.length} arquivo(s) não puderam ser apagados do R2 — ver log do servidor.` } : {}),
    });
  } catch (err) {
    // A essa altura a exclusão pode ter parado no meio — erro visível de propósito, pra dar
    // o que investigar em vez de deixar a empresa num estado inconsistente sem aviso.
    console.error('[painel] ERRO NO MEIO DA EXCLUSÃO — pode ter ficado dado órfão:', err);
    res.status(500).json({ erro: 'Erro ao excluir a empresa. A exclusão pode ter sido parcial — confira os logs do servidor.' });
  }
});

module.exports = router;
