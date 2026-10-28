const mongoose = require('mongoose');

// Cada tarefa dentro de uma etapa do processo real
const tarefaEtapaSchema = new mongoose.Schema({
  tarefa: { type: mongoose.Schema.Types.ObjectId, ref: 'Tarefa', required: true },
  ultimoAlertaParado: { type: Date },
  status: { type: String, enum: ['pendente', 'concluida'], default: 'pendente' },
  concluidaEm: { type: Date },
  concluidaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }
}, { _id: true });

// Cada etapa (setor) do processo real de uma empresa
const etapaSchema = new mongoose.Schema({
  setor: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', required: true },
  ordem: { type: Number, required: true },
  status: { type: String, enum: ['bloqueada', 'em_andamento', 'concluida'], default: 'bloqueada' },
  tarefas: [tarefaEtapaSchema],
  iniciadaEm: { type: Date },
  concluidaEm: { type: Date }
}, { _id: true });

const implantacaoSchema = new mongoose.Schema({
  nomeCliente: { type: String, required: true, trim: true },
  cnpj: { type: String, trim: true, default: '' },
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  inicioServicos: { type: Date, default: null },
  modelo: { type: mongoose.Schema.Types.ObjectId, ref: 'ModeloOnboarding' },
  etapas: [etapaSchema],
  status: { type: String, enum: ['em_andamento', 'concluida', 'cancelada'], default: 'em_andamento' },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  concluidaEm: { type: Date },
  criadoEm: { type: Date, default: Date.now },
  ultimoAlertaParado: { type: Date, default: null }
});

// Concluir o onboarding abre a vigência de demanda do cliente (Spec B, seção 2). O gatilho fica no model porque a
// conclusão acontece em mais de um lugar (concluir tarefa, sincronização por Tarefa, pulo de etapas vazias).
// Implantação nova (isNew) é tratada pela própria rota de criação, que só liga o cliente depois de salvar.
implantacaoSchema.pre('save', function (next) {
  this.$locals.concluiuAgora = this.status === 'concluida' && !this.isNew && this.isModified('status');
  next();
});
implantacaoSchema.post('save', async function (doc) {
  if (!doc.$locals?.concluiuAgora) return;
  doc.$locals.concluiuAgora = false;
  try {
    await require('../services/vigenciaOnboarding').abrirVigenciaAoConcluir(doc);
  } catch (err) {
    console.error('⚠️ Erro ao abrir a vigência de demanda na conclusão do onboarding:', err.message);
  }
});

module.exports = mongoose.model('Implantacao', implantacaoSchema);
