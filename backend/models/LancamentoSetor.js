const mongoose = require('mongoose');

const lancamentoSetorSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  setor: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', required: true },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  competencia: { type: String, required: true }, // formato "YYYY-MM"
  dados: { type: Object, default: {} },
  // Ids de campo que NÃO contam pra decidir se este lançamento está completo — usado pela
  // migração que isenta lançamentos já concluídos antes de um campo novo entrar na conta
  // (ex: Fiscal ganhando irRetido/csllRetido/crf sem reabrir o que já tava fechado).
  camposIsentos: { type: [String], default: [] },
  preenchidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  preenchidoEm: { type: Date },
});

lancamentoSetorSchema.index({ cliente: 1, setor: 1, competencia: 1 }, { unique: true });

module.exports = mongoose.model('LancamentoSetor', lancamentoSetorSchema);
