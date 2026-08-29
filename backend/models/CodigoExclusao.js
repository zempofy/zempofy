const mongoose = require('mongoose');

// Código de 6 dígitos que confirma a exclusão permanente de uma empresa pelo Painel Admin.
// O `expires: 600` cria um índice TTL do MongoDB: o próprio banco apaga o documento 10 minutos
// depois de criado, sem purge manual. O TTL do Mongo roda em background (~1x por minuto), então
// a rota de exclusão também confere a idade do código na mão — não dá pra confiar só no índice.
const codigoExclusaoSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  codigo: { type: String, required: true }, // 6 dígitos
  criadoEm: { type: Date, default: Date.now, expires: 600 },
});

module.exports = mongoose.model('CodigoExclusao', codigoExclusaoSchema);
