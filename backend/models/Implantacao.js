const mongoose = require('mongoose');

// Cada tarefa dentro de uma etapa do processo real
const tarefaEtapaSchema = new mongoose.Schema({
  tarefa: { type: mongoose.Schema.Types.ObjectId, ref: 'Tarefa', required: true },
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
  inicioServicos: { type: Date, default: null },
  modelo: { type: mongoose.Schema.Types.ObjectId, ref: 'ModeloOnboarding' },
  etapas: [etapaSchema],
  status: { type: String, enum: ['em_andamento', 'concluida', 'cancelada'], default: 'em_andamento' },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  concluidaEm: { type: Date },
  criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Implantacao', implantacaoSchema);
