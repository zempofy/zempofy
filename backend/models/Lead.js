const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true, trim: true },
  nomeEmpresa: { type: String, default: '', trim: true },
  telefone: { type: String, default: '' },
  email: { type: String, default: '' },
  etapa: { type: String, enum: ['prospeccao', 'contato', 'reuniao', 'proposta', 'fechado', 'perdido'], default: 'prospeccao' },
  valor: { type: Number, default: 0 },
  origem: { type: String, default: '' },
  tipoServico: { type: String, default: '' },
  obs: { type: String, default: '' },
  criadoEm: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Lead', leadSchema);
