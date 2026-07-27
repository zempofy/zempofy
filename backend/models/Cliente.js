const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  criadoEm: { type: Date, default: Date.now },
  status: { type: String, enum: ['ativo', 'inativo', 'encerramento'], default: 'ativo' },

  // Dados básicos — obrigatórios
  razaoSocial: { type: String, required: true, trim: true },
  nomeFantasia: { type: String, default: '', trim: true },
  cnpj: { type: String, default: '', trim: true },
  porte: { type: String, enum: ['mei', 'me', 'epp', 'grande', ''], default: '' },
  regime: { type: String, enum: ['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei', 'outro', ''], default: '' },

  // Dados complementares
  dataAbertura: { type: Date, default: null },
  cnaePrincipal: { type: String, default: '' },
  atividade: { type: String, default: '' },

  // Contato
  telefone: { type: String, default: '' },
  email: { type: String, default: '' },
  endereco: {
    logradouro: { type: String, default: '' },
    numero: { type: String, default: '' },
    complemento: { type: String, default: '' },
    bairro: { type: String, default: '' },
    cidade: { type: String, default: '' },
    estado: { type: String, default: '' },
    cep: { type: String, default: '' },
  },

  // Sócio/Responsável
  socios: [{
    nome: { type: String, default: '' },
    cpf: { type: String, default: '' },
    telefone: { type: String, default: '' },
    email: { type: String, default: '' },
    qualificacao: { type: String, default: '' },
  }],

  // Serviços contratados — obrigatório
  servicosContratados: [{
    nome: { type: String, required: true },
    dataInicio: { type: Date, default: null },
    honorarioMensal: { type: Number, default: 0 },
    diaVencimento: { type: Number, default: null },
  }],

  // Certidões
  certidoes: [{
    tipo: { type: String, enum: ['federal', 'estadual', 'municipal', 'fgts', 'trabalhista', 'outro'] },
    vencimento: { type: Date, default: null },
    situacao: { type: String, enum: ['regular', 'irregular', 'a_vencer'], default: 'regular' },
  }],

  // Observações internas
  setores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Setor' }],
  origem: { type: String, enum: ['manual', 'onboarding'], default: 'manual' },
  observacoes: { type: String, default: '' },

  // Campos extras da Demanda mensal, criados sob demanda e específicos deste cliente
  camposExtrasDemanda: [{
    setor: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', required: true },
    id: { type: String, required: true },
    label: { type: String, required: true },
    tipo: { type: String, enum: ['moeda', 'texto'], default: 'moeda' },
  }],

  // Particularidades do cliente por setor (anotações livres, independentes de competência)
  particularidadesSetor: [{
    setor: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', required: true },
    texto: { type: String, default: '' },
    atualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    atualizadoEm: { type: Date },
  }],
});

module.exports = mongoose.model('Cliente', clienteSchema);
