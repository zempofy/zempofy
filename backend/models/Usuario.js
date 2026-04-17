const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  senha: { type: String, required: true },
  cargo: { type: String, enum: ['admin', 'administrador', 'colaborador'], default: 'colaborador' },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  avatar: { type: String, default: '' },
  ativo: { type: Boolean, default: true },
  permissoes: { type: [String], default: [] },
  criadoEm: { type: Date, default: Date.now }
});

// Antes de salvar, criptografa a senha
usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('senha')) return next();
  this.senha = await bcrypt.hash(this.senha, 10);
  next();
});

// Método para verificar senha
usuarioSchema.methods.verificarSenha = async function (senhaDigitada) {
  return bcrypt.compare(senhaDigitada, this.senha);
};

module.exports = mongoose.model('Usuario', usuarioSchema);
