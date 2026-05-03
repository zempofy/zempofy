const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  cnpj: { type: String, default: '', trim: true },
  regime: { type: String, enum: ['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei', 'outro', ''], default: '' },
  tipo: { type: String, enum: ['servico', 'comercio', 'ambos', ''], default: '' },
  observacoes: { type: String, default: '' },
  inicioServicos: { type: Date, default: null },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cliente', clienteSchema);
