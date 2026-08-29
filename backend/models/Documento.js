const mongoose = require('mongoose');

const documentoSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true, index: true },

  tipo: { type: String, enum: ['geral', 'demanda'], required: true },
  setor: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', default: null }, // obrigatório se tipo === 'demanda'
  competencia: { type: String, default: null }, // "YYYY-MM", obrigatório se tipo === 'demanda'

  nomeOriginal: { type: String, required: true },
  chave: { type: String, required: true }, // caminho no bucket R2
  tipoConteudo: { type: String, required: true }, // MIME real, detectado no upload
  tamanho: { type: Number, required: true }, // bytes

  enviadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  enviadoEm: { type: Date, default: Date.now },

  // ── Lixeira ──
  // Documento não segue mais o padrão "inativar antes de excluir" dos outros models (Setor, Cliente):
  // excluir manda pra lixeira, de onde some da listagem de origem e é apagado de vez (banco + R2)
  // 30 dias depois, via purge lazy em GET /lixeira. A data de expiração é derivada de
  // excluidoEm + 30 dias — não existe campo separado pra isso.
  excluido: { type: Boolean, default: false, index: true },
  excluidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  excluidoEm: { type: Date, default: null },
});

documentoSchema.index({ cliente: 1, tipo: 1 });
documentoSchema.index({ cliente: 1, setor: 1, competencia: 1 });

module.exports = mongoose.model('Documento', documentoSchema);
