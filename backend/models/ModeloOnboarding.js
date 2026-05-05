const mongoose = require('mongoose');

// Cada setor dentro do modelo tem uma lista de tarefas vinculadas
const setorModeloSchema = new mongoose.Schema({
  setor: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', required: true },
  ordem: { type: Number, required: true }, // posição no fluxo (1, 2, 3...)
  tarefas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AtividadeChecklist' }]
}, { _id: false });

const modeloOnboardingSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true }, // ex: "Simples Nacional + Comércio"
  descricao: { type: String, default: '' },
  setores: [setorModeloSchema],
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  ativo: { type: Boolean, default: true },
  criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ModeloOnboarding', modeloOnboardingSchema);
