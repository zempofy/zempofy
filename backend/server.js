require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  credentials: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rotas
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

app.get('/', (req, res) => {
  res.json({ mensagem: 'Zempofy API rodando 🚀' });
});

// Conectar ao MongoDB e iniciar servidor
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado ao MongoDB!');
    app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
  })
  .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));
