const mongoose = require('mongoose');

const lancamentoSetorSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  setor: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', required: true },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  competencia: { type: String, required: true }, // formato "YYYY-MM"
  dados: { type: Object, default: {} },
  preenchidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  preenchidoEm: { type: Date },
  fechado: { type: Boolean, default: false },
});

lancamentoSetorSchema.index({ cliente: 1, setor: 1, competencia: 1 }, { unique: true });

module.exports = mongoose.model('LancamentoSetor', lancamentoSetorSchema);
