const mongoose = require('mongoose');

// Apuração do lucro de um trimestre de calendário, digitada à mão pelo contador. Saldo e excedente
// são calculados na leitura (services/retiradas.js). O sistema não decide o tratamento fiscal do
// excedente — só registra a classificação feita pelo contador.
const TRATAMENTOS_EXCEDENTE = ['', 'adiantamento', 'a_regularizar', 'rendimento_tributavel', 'outro'];

const apuracaoTrimestreSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  ano: { type: Number, required: true },
  trimestre: { type: Number, required: true, min: 1, max: 4 },
  lucroApurado: { type: Number, default: null }, // null = "não informado"
  saldoAnterior: { type: Number, default: 0 },
  tratamentoExcedente: { type: String, enum: TRATAMENTOS_EXCEDENTE, default: '' },
  obsExcedente: { type: String, default: '' },
  atualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  atualizadoEm: { type: Date, default: Date.now },
});

apuracaoTrimestreSchema.index({ cliente: 1, ano: 1, trimestre: 1 }, { unique: true });

module.exports = mongoose.model('ApuracaoTrimestre', apuracaoTrimestreSchema);
module.exports.TRATAMENTOS_EXCEDENTE = TRATAMENTOS_EXCEDENTE;
