const mongoose = require('mongoose');

// Retirada de lucro de um sócio numa competência. Guarda só o que foi digitado — tributável/IRRF
// são sempre recalculados na leitura (services/retiradas.js), nunca gravados.
const retiradaMesSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  socioId: { type: mongoose.Schema.Types.ObjectId, required: true }, // _id do subdocumento em ControleRetiradas.socios
  competencia: { type: String, required: true }, // "YYYY-MM"
  modo: { type: String, enum: ['total', 'detalhado'], default: 'total' },
  valorTotal: { type: Number, default: 0 }, // usado quando modo === 'total'
  // usado quando modo === 'detalhado'. Data como string "YYYY-MM-DD" (igual competencia) pra não
  // ter bug de fuso horário.
  lancamentos: [{
    data: { type: String, required: true },
    valor: { type: Number, required: true },
    obs: { type: String, default: '' },
    _id: false,
  }],
  atualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  atualizadoEm: { type: Date, default: Date.now },
});

retiradaMesSchema.index({ cliente: 1, socioId: 1, competencia: 1 }, { unique: true });

module.exports = mongoose.model('RetiradaMes', retiradaMesSchema);
