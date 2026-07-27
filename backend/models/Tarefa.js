const mongoose = require('mongoose');

const tarefaSchema = new mongoose.Schema({
  descricao: { type: String, required: true },
  data: { type: String },
  hora: { type: String },
  local: { type: String, default: '' },
  observacoes: { type: String, default: '' },
  cor: { type: String, default: '#2DAA59' },
  etiquetas: [{ type: String }],
  prioridade: { type: String, enum: ['alta', 'media', 'baixa', ''], default: '' },
  status: { type: String, enum: ['pendente', 'concluida'], default: 'pendente' },
  concluidaEm: { type: Date },
  concluidaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  tarefaMae: { type: mongoose.Schema.Types.ObjectId, ref: 'Tarefa', default: null },
  setor: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', default: null },
  responsavel: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  criadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  criadaEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tarefa', tarefaSchema);
