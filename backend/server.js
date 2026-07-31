require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const empresaRoutes = require('./routes/empresa');
const usuarioRoutes = require('./routes/usuario');
const tarefaRoutes = require('./routes/tarefa');
const eventoRoutes = require('./routes/evento');
const chatRoutes = require('./routes/chat');
const anotacaoRoutes = require('./routes/anotacao');
const muralRoutes = require('./routes/mural');
const setorRoutes = require('./routes/setor');
const modeloOnboardingRoutes = require('./routes/modeloOnboarding');
const implantacaoRoutes = require('./routes/implantacao');
const checklistRoutes = require('./routes/checklist');
const clienteRoutes = require('./routes/cliente');
const painelRoutes = require('./routes/painel');
const feedbackRoutes = require('./routes/feedback');
const logRoutes = require('./routes/log');
const servicoRoutes = require('./routes/servico');
const obrigacaoRoutes = require('./routes/obrigacao');
const leadRoutes = require('./routes/lead');
require('./models/Obrigacao'); // registrar model

const app = express();
const PORT = process.env.PORT || 3001;

// Necessário para o rate limit funcionar corretamente atrás do proxy do Render
app.set('trust proxy', 1);

// ── Origens permitidas ──
const ORIGENS_PERMITIDAS = [
  'https://zempofy.com.br',
  'https://app.zempofy.com.br',
  'https://zempofy.vercel.app',
  'https://zempofy-landing.vercel.app',
  'https://zempofy-painel.vercel.app',
  'https://painel.zempofy.com.br',
  // desenvolvimento local
  'http://localhost:5173',
  'http://localhost:3000',
];

// ── Helmet — headers de segurança ──
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS restrito ──
app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (Render health check, curl, etc)
    if (!origin) return callback(null, true);
    if (ORIGENS_PERMITIDAS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para origem: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Rate Limit global — 200 req/15min por IP ──
const limitadorGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // ~65 req/min — mais que suficiente pro uso normal
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
});
app.use('/api', limitadorGeral);

// ── Rate Limit específico pra autenticação — 10 tentativas/15min ──
const limitadorAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // tentativas de login
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  skip: (req) => req.path === '/me', // /auth/me nunca é limitado
});
app.use('/api/auth/login', limitadorAuth);
app.use('/api/auth/cadastro', limitadorAuth);

// ── Job: alerta de onboarding parado ──
const verificarOnboardingsParados = async () => {
  try {
    const Implantacao = require('./models/Implantacao');
    const Usuario = require('./models/Usuario');
    const { enviarAlertaOnboardingParado } = require('./services/email');
    const implantacoes = await Implantacao.find({ status: { $ne: 'concluida' } })
      .populate('empresa', 'nome alertaOnboardingDias')
      .populate('etapas.setor', 'nome');
    let enviados = 0;
    for (const imp of implantacoes) {
      const diasPadrao = imp.empresa?.alertaOnboardingDias || 7;
      // Usar updatedAt original, ignorando atualizações do campo ultimoAlertaParado
      const ultimaAtt = new Date(imp.updatedAt || imp.criadoEm);
      const diasParado = Math.floor((new Date() - ultimaAtt) / 86400000);
      if (diasParado >= diasPadrao) {
        // Só envia se nunca enviou ou se já passou diasPadrao desde o último envio
        const jaEnviou = imp.ultimoAlertaParado &&
          Math.floor((new Date() - new Date(imp.ultimoAlertaParado)) / 86400000) < diasPadrao;
        if (jaEnviou) continue;

        const titular = await Usuario.findOne({ empresa: imp.empresa._id, cargo: 'admin' }).select('email nome');
        if (!titular?.email) continue;
        const etapaAtual = imp.etapas?.find(e => e.status === 'em_andamento');
        await enviarAlertaOnboardingParado({
          destinatario: titular.email,
          nomeCliente: imp.nomeCliente,
          diasParado,
          etapaAtual: etapaAtual?.setor?.nome || 'Aguardando',
          empresa: imp.empresa?.nome || '',
        });
        // Registrar envio
        await Implantacao.findByIdAndUpdate(imp._id, { $set: { ultimoAlertaParado: new Date() } }, { timestamps: false });
        enviados++;
      }
    }
    console.log(`✅ Job onboarding parado: ${enviados} alerta(s) enviado(s) de ${implantacoes.length} onboarding(s) em aberto.`);
  } catch(e) { console.error('Job onboarding parado:', e.message); }
};
// ── Job: lembrete de tarefas com prazo próximo ──
const verificarTarefasComPrazo = async () => {
  try {
    const Tarefa = require('./models/Tarefa');
    const Usuario = require('./models/Usuario');
    const { enviarLembreteTarefa } = require('./services/email');
    // Tarefa não tem campo "prazo" — a data da tarefa é o campo "data" (String "YYYY-MM-DD",
    // mesmo formato do <input type="date"> usado na Agenda). Comparar como string funciona
    // corretamente nesse formato (ordem lexicográfica = ordem cronológica).
    const hojeStr = new Date().toISOString().slice(0, 10);
    const em3diasStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    const tarefas = await Tarefa.find({
      status: { $ne: 'concluida' },
      data: { $gte: hojeStr, $lte: em3diasStr },
      responsavel: { $exists: true }
    }).populate('responsavel', 'nome email').populate('criadoPor', 'nome');

    let enviados = 0;
    for (const t of tarefas) {
      if (!t.responsavel?.email) continue;
      const diasRestantes = Math.floor((new Date(t.data) - new Date(hojeStr)) / 86400000);
      await enviarLembreteTarefa({
        destinatario: t.responsavel.email,
        nome: t.responsavel.nome,
        titulo: t.descricao,
        prazo: t.data,
        criadoPor: t.criadoPor?.nome,
        diasRestantes,
      });
      enviados++;
    }
    console.log(`✅ Job lembrete tarefa: ${enviados} lembrete(s) enviado(s) de ${tarefas.length} tarefa(s) com prazo próximo.`);
  } catch(e) { console.error('Job lembrete tarefa:', e.message); }
};

// ── Job: resumo periódico ──
const enviarResumoPeriodico = async () => {
  try {
    const Empresa = require('./models/Empresa');
    const Usuario = require('./models/Usuario');
    const Implantacao = require('./models/Implantacao');
    const Cliente = require('./models/Cliente');
    const Tarefa = require('./models/Tarefa');
    const { enviarResumo } = require('./services/email');

    const empresas = await Empresa.find({ ativa: true, resumoFrequencia: { $exists: true, $ne: 'nunca' } });

    for (const emp of empresas) {
      const freq = emp.resumoFrequencia || 'semanal';
      const agora = new Date();
      const diaSemana = agora.getDay(); // 1 = segunda
      const diaMes = agora.getDate();

      // Verificar se hoje é o dia certo pra enviar
      const deveEnviar =
        (freq === 'semanal' && diaSemana === 1) ||
        (freq === 'quinzenal' && diaSemana === 1 && diaMes <= 7) ||
        (freq === 'mensal' && diaMes === 1);

      if (!deveEnviar) continue;

      const titular = await Usuario.findOne({ empresa: emp._id, cargo: 'admin' }).select('nome email');
      if (!titular?.email) continue;

      // Calcular período
      const diasPeriodo = freq === 'mensal' ? 30 : freq === 'quinzenal' ? 14 : 7;
      const inicioPeriodo = new Date(agora); inicioPeriodo.setDate(inicioPeriodo.getDate() - diasPeriodo);

      const [impsAtivas, impsConcluidas, clientes, clientesNovos, tarefas] = await Promise.all([
        Implantacao.countDocuments({ empresa: emp._id, status: { $ne: 'concluida' } }),
        Implantacao.countDocuments({ empresa: emp._id, status: 'concluida', updatedAt: { $gte: inicioPeriodo } }),
        Cliente.countDocuments({ empresa: emp._id }),
        Cliente.countDocuments({ empresa: emp._id, criadoEm: { $gte: inicioPeriodo } }),
        Tarefa.find({ empresa: emp._id }),
      ]);

      await enviarResumo({
        destinatario: titular.email,
        nome: titular.nome,
        empresa: emp.nome,
        frequencia: freq,
        dados: {
          onboardingsAtivos: impsAtivas,
          onboardingsConcluidos: impsConcluidas,
          tarefasPendentes: tarefas.filter(t => t.status !== 'concluida').length,
          tarefasConcluidas: tarefas.filter(t => t.status === 'concluida' && new Date(t.updatedAt) >= inicioPeriodo).length,
          clientesNovos,
          clientesTotal: clientes,
        }
      });
    }
  } catch(e) { console.error('Job resumo:', e.message); }
};

// Rodar às 8h todos os dias — checa a cada 5min (em vez de 1h) e trava por dia (em vez de
// só por hora), pra não depender do timing exato de quando o processo do Render subiu/reiniciou.
// Sem essa trava, um restart durante a janela das 8h faria o job rodar de novo no mesmo dia.
let ultimoDiaJobsExecutados = null;
setInterval(() => {
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10); // YYYY-MM-DD
  if (agora.getHours() === 8 && ultimoDiaJobsExecutados !== hoje) {
    ultimoDiaJobsExecutados = hoje;
    console.log(`⏰ Rodando jobs diários (${hoje})`);
    verificarOnboardingsParados();
    verificarTarefasComPrazo();
    enviarResumoPeriodico();
  }
}, 300000);

// ── Rotas ──
app.use('/api/auth', authRoutes);
app.use('/api/empresa', empresaRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/tarefas', tarefaRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/anotacoes', anotacaoRoutes);
app.use('/api/mural', muralRoutes);
app.use('/api/setores', setorRoutes);
app.use('/api/modelos-onboarding', modeloOnboardingRoutes);
app.use('/api/implantacoes', implantacaoRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/painel', painelRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/servicos', servicoRoutes);
app.use('/api/obrigacoes', obrigacaoRoutes);
app.use('/api/leads', leadRoutes);

app.get('/', (req, res) => {
  res.json({ mensagem: 'Zempofy API rodando 🚀' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Conectar ao MongoDB e iniciar servidor ──
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Conectado ao MongoDB!');

    // ── Migração: ativar subpermissões de onboarding para quem já tinha gerenciarOnboarding ──
    try {
      const Usuario = require('./models/Usuario');
      const resultado = await Usuario.updateMany(
        {
          'permissoes.gerenciarOnboarding': true,
          $or: [
            { 'permissoes.criarImplantacoes': { $exists: false } },
            { 'permissoes.criarImplantacoes': false },
          ]
        },
        {
          $set: {
            'permissoes.criarImplantacoes': true,
            'permissoes.gerenciarModelos': true,
            'permissoes.gerenciarBancoAtividades': true,
          }
        }
      );
      if (resultado.modifiedCount > 0) {
        console.log(`✅ Migração: ${resultado.modifiedCount} colaborador(es) com subpermissões de onboarding atualizados.`);
      }

      // Migração subpermissões de equipe
      const resultadoEquipe = await Usuario.updateMany(
        {
          'permissoes.gerenciarEquipe': true,
          $or: [
            { 'permissoes.gerenciarMembros': { $exists: false } },
            { 'permissoes.gerenciarMembros': false },
          ]
        },
        {
          $set: {
            'permissoes.gerenciarMembros': true,
            'permissoes.gerenciarSetores': true,
          }
        }
      );
      if (resultadoEquipe.modifiedCount > 0) {
        console.log(`✅ Migração: ${resultadoEquipe.modifiedCount} colaborador(es) com subpermissões de equipe atualizados.`);
      }

      // Migração clientes: campo nome -> razaoSocial
      const Cliente = require('./models/Cliente');
      const clientesAntigos = await Cliente.find({ razaoSocial: { $exists: false }, nome: { $exists: true } });
      for (const c of clientesAntigos) {
        await Cliente.updateOne({ _id: c._id }, { $set: { razaoSocial: c.nome, status: 'ativo', servicosContratados: [] } });
      }
      if (clientesAntigos.length > 0) {
        console.log(`✅ Migração: ${clientesAntigos.length} cliente(s) migrado(s) para novo modelo.`);
      }

      // Migração: marcar origem 'onboarding' em clientes que vieram de implantações
      const Implantacao = require('./models/Implantacao');
      const todasImplantacoes = await Implantacao.find({}).select('cnpj nomeCliente empresa etapas');
      const cnpjsOnboarding = new Set(
        todasImplantacoes.map(i => i.cnpj?.replace(/\D/g,'')).filter(Boolean)
      );
      const nomesOnboarding = new Set(
        todasImplantacoes.map(i => (i.nomeCliente||'').toLowerCase().trim()).filter(Boolean)
      );
      const clientesSemOrigem = await Cliente.find({ origem: { $exists: false } });
      for (const c of clientesSemOrigem) {
        const cnpjLimpo = c.cnpj?.replace(/\D/g,'') || '';
        const nomeLimpo = (c.razaoSocial || c.nome || '').toLowerCase().trim();
        const veiuDoOnboarding = (cnpjLimpo && cnpjsOnboarding.has(cnpjLimpo)) || nomesOnboarding.has(nomeLimpo);
        await Cliente.updateOne({ _id: c._id }, { $set: { origem: veiuDoOnboarding ? 'onboarding' : 'manual' } });
      }
      // Também atualizar clientes com origem errada
      const clientesComOrigem = await Cliente.find({ origem: 'manual' });
      let atualizados = 0;
      for (const c of clientesComOrigem) {
        const cnpjLimpo = c.cnpj?.replace(/\D/g,'') || '';
        const nomeLimpo = (c.razaoSocial || c.nome || '').toLowerCase().trim();
        if ((cnpjLimpo && cnpjsOnboarding.has(cnpjLimpo)) || nomesOnboarding.has(nomeLimpo)) {
          await Cliente.updateOne({ _id: c._id }, { $set: { origem: 'onboarding' } });
          atualizados++;
        }
      }
      if (atualizados > 0) console.log(`✅ Migração: ${atualizados} cliente(s) marcado(s) como origem onboarding.`);

      // Migração: criar clientes a partir de onboardings existentes
      const implantacoes = await Implantacao.find({}).select('nomeCliente cnpj empresa criadoPor etapas');
      let criados = 0;
      for (const imp of implantacoes) {
        const cnpjLimpo = imp.cnpj?.replace(/\D/g, '') || '';
        // Regex tolerante a máscara — o cnpj salvo pode estar com ou sem pontuação
        const cnpjRegexTolerante = cnpjLimpo ? cnpjLimpo.split('').join('[.\\-/]*') : '';
        // Verificar duplicata por CNPJ ou por nome (cobre clientes antigos sem CNPJ)
        const existe = await Cliente.findOne({
          empresa: imp.empresa,
          $or: [
            ...(cnpjRegexTolerante ? [{ cnpj: { $regex: cnpjRegexTolerante } }] : []),
            { $or: [{ razaoSocial: imp.nomeCliente }, { nome: imp.nomeCliente }] }
          ]
        });
        if (!existe) {
          // Pegar setores das etapas do onboarding
          const setoresIds = [...new Set(
            (imp.etapas || []).map(e => e.setor?.toString()).filter(Boolean)
          )];
          await Cliente.create({
            razaoSocial: imp.nomeCliente,
            cnpj: imp.cnpj,
            empresa: imp.empresa,
            criadoPor: imp.criadoPor || imp.empresa,
            status: 'ativo',
            porte: '',
            regime: '',
            setores: setoresIds,
            origem: 'onboarding',
            servicosContratados: [],
            socios: [],
          });
          criados++;
        } else if (existe && imp.etapas?.length) {
          // Atualizar setores do cliente existente com os do onboarding
          const setoresIds = [...new Set(
            imp.etapas.map(e => e.setor?.toString()).filter(Boolean)
          )];
          const setoresAtuais = existe.setores?.map(s => s.toString()) || [];
          const novoSetores = [...new Set([...setoresAtuais, ...setoresIds])];
          if (novoSetores.length > setoresAtuais.length) {
            await Cliente.updateOne({ _id: existe._id }, { $set: { setores: novoSetores } });
          }
        }
      }
      if (criados > 0) {
        console.log(`✅ Migração: ${criados} cliente(s) criado(s) a partir de onboardings existentes.`);
      }
    } catch (err) {
      console.error('⚠️ Erro na migração de subpermissões:', err.message);
    }

    app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
  })
  .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));
