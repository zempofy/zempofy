const mongoose = require('mongoose');

const configuracaoSistemaSchema = new mongoose.Schema({
  chave: { type: String, required: true, unique: true },
  valor: { type: String },
});

module.exports = mongoose.model('ConfiguracaoSistema', configuracaoSistemaSchema);
