const mongoose = require('mongoose');

const setorSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  cor: { type: String, default: '#2DAA59' },
  membros: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  padrao: { type: Boolean, default: false },
  ativo: { type: Boolean, default: true },
  criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Setor', setorSchema);
