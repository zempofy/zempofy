const Log = require('../models/Log');

const CATEGORIAS = {
  implantacao_criada:          'onboarding',
  implantacao_excluida:        'onboarding',
  implantacao_etapa_concluida: 'onboarding',
  modelo_criado:               'modelo',
  modelo_editado:              'modelo',
  modelo_excluido:             'modelo',
  modelo_reativado:            'modelo',
  modelo_excluido_permanente:  'modelo',
  atividade_criada:            'atividade',
  atividade_editada:           'atividade',
  atividade_excluida:          'atividade',
  cliente_criado:              'cliente',
  cliente_editado:             'cliente',
  cliente_excluido:            'cliente',
  clientes_importados:         'cliente',
  membro_adicionado:           'equipe',
  membro_removido:             'equipe',
  membro_reativado:            'equipe',
  membro_excluido_permanente:  'equipe',
  membro_convite_reenviado:    'equipe',
  membro_senha_resetada:       'equipe',
  tarefa_concluida:            'tarefa',
  documento_enviado:           'documento',
  documento_inativado:         'documento',
  documento_reativado:         'documento',
  documento_excluido_permanente: 'documento',
};

async function registrarLog({ empresa, usuario, tipo, descricao, meta = {} }) {
  try {
    await Log.create({
      empresa,
      usuario,
      tipo,
      categoria: CATEGORIAS[tipo] || 'onboarding',
      descricao,
      meta,
    });
  } catch (err) {
    // Log nunca deve quebrar a operação principal
    console.error('Erro ao registrar log:', err.message);
  }
}

module.exports = registrarLog;
