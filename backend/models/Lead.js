const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true, trim: true },
  nomeEmpresa: { type: String, default: '', trim: true },
  telefone: { type: String, default: '' },
  email: { type: String, default: '' },
  // Etapa atual — derivada da última entrada de historicoEtapas e mantida em sincronia com ela
  etapa: { type: String, enum: ['prospeccao', 'contato', 'reuniao', 'proposta', 'negocio_fechado', 'ganho', 'perdido'], default: 'prospeccao' },
  // Movimentações de etapa (append-only: nunca editar nem apagar entradas). É o que permite o
  // filtro de mês do CRM mostrar cada lead na etapa em que ele estava no fim daquele mês
  historicoEtapas: [{
    etapa: { type: String, required: true },
    em: { type: Date, required: true },
    por: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    _id: false,
  }],
  valor: { type: Number, default: 0 },
  origem: { type: String, default: '' },
  tipoServico: { type: String, default: '' },
  obs: { type: String, default: '' },
  criadoEm: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Lead', leadSchema);
