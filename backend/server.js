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
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Rate Limit global — 200 req/15min por IP ──
const limitadorGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
});
app.use('/api', limitadorGeral);

// ── Rate Limit específico pra autenticação — 10 tentativas/15min ──
const limitadorAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});
app.use('/api/auth/login', limitadorAuth);
app.use('/api/auth/cadastro', limitadorAuth);

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

app.get('/', (req, res) => {
  res.json({ mensagem: 'Zempofy API rodando 🚀' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Conectar ao MongoDB e iniciar servidor ──
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado ao MongoDB!');
    app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
  })
  .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));
