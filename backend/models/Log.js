const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  // Este enum precisa acompanhar o mapa CATEGORIAS de services/log.js: tipo fora da lista faz o
  // Log.create falhar, e registrarLog engole o erro de propósito (log não pode derrubar a operação
  // principal) — ou seja, a ação some do histórico silenciosamente. Foi o que acontecia com todos
  // os tipos 'documento_*' e com os de modelo/membro adicionados depois deste schema.
  tipo: {
    type: String,
    enum: [
      'implantacao_criada', 'implantacao_excluida', 'implantacao_etapa_concluida',
      'modelo_criado', 'modelo_editado', 'modelo_excluido', 'modelo_reativado', 'modelo_excluido_permanente',
      'atividade_criada', 'atividade_editada', 'atividade_excluida',
      'cliente_criado', 'cliente_editado', 'cliente_excluido', 'clientes_importados',
      'membro_adicionado', 'membro_removido', 'membro_reativado', 'membro_excluido_permanente',
      'membro_convite_reenviado', 'membro_senha_resetada',
      'tarefa_concluida',
      'documento_enviado', 'documento_excluido', 'documento_restaurado', 'documento_excluido_permanente',
    ],
    required: true,
  },
  categoria: {
    type: String,
    enum: ['onboarding', 'modelo', 'atividade', 'cliente', 'equipe', 'tarefa', 'documento'],
    required: true,
  },
  descricao: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  criadoEm: { type: Date, default: Date.now },
});

logSchema.index({ empresa: 1, criadoEm: -1 });

module.exports = mongoose.model('Log', logSchema);
