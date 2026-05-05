const mongoose = require('mongoose');

const empresaSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  cnpj: { type: String, trim: true, default: '' },
  slug: { type: String, required: true, unique: true, lowercase: true },
  plano: { type: String, enum: ['gratuito', 'premium'], default: 'gratuito' },
  maxFuncionarios: { type: Number, default: 5 },
  ativa: { type: Boolean, default: true },
  criadaEm: { type: Date, default: Date.now },
  colaboradoresPodeAtribuirTitular: { type: Boolean, default: true }
});

module.exports = mongoose.model('Empresa', empresaSchema);
