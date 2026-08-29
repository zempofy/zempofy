const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  // Opcional: colaborador convidado começa sem senha utilizável até definir a primeira,
  // pelo link de convite (mesmo mecanismo de tokenResetSenha/tokenResetExpira do "esqueci a senha").
  senha: { type: String },
  cargo: { type: String, enum: ['admin', 'colaborador'], default: 'colaborador' },
  permissoes: {
    gerenciarEquipe:          { type: Boolean, default: false },
    gerenciarMembros:         { type: Boolean, default: false },
    gerenciarSetores:         { type: Boolean, default: false },
    gerenciarOnboarding:    { type: Boolean, default: false },
    // Subpermissões de onboarding
    criarImplantacoes:      { type: Boolean, default: false },
    gerenciarModelos:       { type: Boolean, default: false },
    gerenciarBancoAtividades: { type: Boolean, default: false },
    gerenciarClientes:      { type: Boolean, default: false },
    publicarMural:          { type: Boolean, default: false },
    criarTarefas:           { type: Boolean, default: false },
  },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  avatar: { type: String, default: '' },
  ativo: { type: Boolean, default: true },
  tokenResetSenha: { type: String },
  tokenResetExpira: { type: Date },
  emailVerificado: { type: Boolean, default: false },
  tokenVerificacao: { type: String, default: null },
  criadoEm: { type: Date, default: Date.now },
  ultimoAcesso: { type: Date, default: null },
  setores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Setor' }]
});

// Antes de salvar, criptografa a senha
usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('senha') || !this.senha) return next();
  this.senha = await bcrypt.hash(this.senha, 10);
  next();
});

// Método para verificar senha — colaborador convidado que ainda não definiu senha nunca bate aqui
usuarioSchema.methods.verificarSenha = async function (senhaDigitada) {
  if (!this.senha) return false;
  return bcrypt.compare(senhaDigitada, this.senha);
};

module.exports = mongoose.model('Usuario', usuarioSchema);
