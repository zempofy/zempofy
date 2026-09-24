const mongoose = require('mongoose');

// Empresa da carteira (Cliente) sob controle de retiradas de sócios — Contábil › Retiradas.
const controleRetiradasSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  ativo: { type: Boolean, default: true },
  inativadoEm: { type: Date, default: null },
  // O _id de cada subdocumento é a identidade do sócio: RetiradaMes aponta pra ele (socioId), então
  // nunca pode mudar — editar nome/CPF mexe no mesmo subdocumento, e sócio sai por inativação.
  socios: [{
    nome: { type: String, required: true, trim: true },
    cpf: { type: String, default: '' }, // só dígitos
    percentual: { type: Number, default: null },
    ativo: { type: Boolean, default: true },
    inativadoEm: { type: Date, default: null },
  }],
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  criadoEm: { type: Date, default: Date.now },
});

controleRetiradasSchema.index({ empresa: 1, cliente: 1 }, { unique: true });

module.exports = mongoose.model('ControleRetiradas', controleRetiradasSchema);
