const mongoose = require('mongoose');
const Tarefa = require('../models/Tarefa');
const Implantacao = require('../models/Implantacao');
const Setor = require('../models/Setor');
const Usuario = require('../models/Usuario');
const { enviarEtapaDesbloqueada } = require('./email');
const { pularEtapasVaziasEmCadeia } = require('./implantacao');

// ── Concluir / reabrir atividade de onboarding — regra ÚNICA (Spec E) ──
// Toda conclusão ou reabertura de tarefa passa por aqui, venha da tela de Tarefas (PATCH /tarefas/:id/concluir|desmarcar)
// ou da bolinha na tela de Implantação (PATCH /implantacoes/:id/tarefas/:etapaId/:tarefaId/concluir|desmarcar).
// Tarefa e andamento do onboarding são gravados juntos (transação), com as mesmas permissões e os mesmos efeitos:
// liberar a próxima etapa (pulando as vazias), e-mail pra quem age nela (uma vez) e, na última etapa, concluir o
// onboarding — o que abre a demanda do cliente nos setores (Spec B, vigenciaOnboarding.abrirVigenciaAoConcluir).

const MENSAGENS = {
  naoResponsavel: 'Só o responsável pela atividade pode concluí-la.',
  etapaBloqueada: 'Esta etapa será liberada quando a anterior for concluída.',
  travada: 'Esta atividade já liberou a próxima etapa e não pode ser reaberta aqui.',
  jaAtualizada: 'Esta atividade já foi atualizada por outra pessoa.',
};

class ErroAtividade extends Error {
  constructor(status, mensagem, codigo) { super(mensagem); this.status = status; this.codigo = codigo; }
}

// Titular (cargo admin) mexe em qualquer atividade; colaborador só nas que é o responsável — igual à tela de Tarefas.
const podeAlterar = (usuario, tarefa) =>
  usuario.cargo === 'admin' || (!!tarefa.responsavel && String(tarefa.responsavel) === String(usuario._id));

// E-mail pra quem vai agir na etapa que acabou de ficar em andamento (mesmo conteúdo de antes)
const avisarEtapaLiberada = async (implantacao, etapa) => {
  try {
    const setor = await Setor.findById(etapa.setor).lean();
    const tarefas = await Tarefa.find({ _id: { $in: etapa.tarefas.map(t => t.tarefa) } }).populate('responsavel', 'email nome').lean();
    let emails = [...new Set(tarefas.map(t => t.responsavel?.email).filter(Boolean))];
    // Sem responsável nas tarefas: todos os membros do setor
    if (!emails.length && setor?.membros?.length) {
      const membros = await Usuario.find({ _id: { $in: setor.membros }, ativo: true }).select('email').lean();
      emails = membros.map(m => m.email).filter(Boolean);
    }
    if (!emails.length) { console.log('⚠️ Nenhum e-mail encontrado para a etapa liberada. Setor:', etapa.setor); return; }
    await enviarEtapaDesbloqueada({ destinatarios: emails, nomeCliente: implantacao.nomeCliente, setor: setor?.nome || 'próximo setor', empresa: '' });
    console.log('✅ E-mail etapa desbloqueada enviado para:', emails);
  } catch (e) { console.error('Erro e-mail etapa:', e); }
};

// concluir: true = concluir, false = reabrir. Devolve { tarefa, implantacao, semMudanca, efeitos }.
// efeitos: { etapaConcluida, etapaLiberada, onboardingConcluido } (ids de setor) quando a ação andou o onboarding.
const alterarAtividade = async ({ usuario, tarefaId, concluir }) => {
  const empresa = usuario.empresa._id || usuario.empresa;
  const alvo = concluir ? 'concluida' : 'pendente';
  const session = await mongoose.startSession();
  let r;
  try {
    await session.withTransaction(async () => {
      r = { tarefa: null, implantacao: null, semMudanca: false, efeitos: null };
      const tarefa = await Tarefa.findOne({ _id: tarefaId, empresa }).session(session);
      if (!tarefa) throw new ErroAtividade(404, 'Tarefa não encontrada.', 'nao_encontrada');
      if (!podeAlterar(usuario, tarefa)) throw new ErroAtividade(403, MENSAGENS.naoResponsavel, 'nao_responsavel');

      const implantacao = await Implantacao.findOne({ empresa, 'etapas.tarefas.tarefa': tarefa._id }).session(session);
      const etapa = implantacao?.etapas.find(e => e.tarefas.some(t => String(t.tarefa) === String(tarefa._id)));
      const tarefaEtapa = etapa?.tarefas.find(t => String(t.tarefa) === String(tarefa._id));
      r.tarefa = tarefa; r.implantacao = implantacao;

      const jaNoAlvo = tarefa.status === alvo && (!tarefaEtapa || tarefaEtapa.status === alvo);
      if (etapa) {
        if (etapa.status === 'bloqueada') throw new ErroAtividade(409, MENSAGENS.etapaBloqueada, 'etapa_bloqueada');
        // Reabrir só enquanto a etapa não terminou: depois que ela liberou a próxima (ou concluiu o onboarding), trava
        if (!concluir && !jaNoAlvo && (etapa.status === 'concluida' || implantacao.status === 'concluida')) {
          throw new ErroAtividade(409, MENSAGENS.travada, 'travada');
        }
      }
      if (jaNoAlvo) { r.semMudanca = true; return; }

      if (concluir) { tarefa.status = 'concluida'; tarefa.concluidaEm = new Date(); tarefa.concluidaPor = usuario._id; }
      else { tarefa.status = 'pendente'; tarefa.concluidaEm = undefined; tarefa.concluidaPor = undefined; }
      await tarefa.save({ session });
      if (!implantacao) return; // tarefa avulsa

      const impAntes = implantacao.status;
      tarefaEtapa.status = alvo;
      tarefaEtapa.concluidaEm = concluir ? new Date() : undefined;
      tarefaEtapa.concluidaPor = concluir ? usuario._id : undefined;
      const efeitos = { etapaConcluida: null, etapaLiberada: null, onboardingConcluido: false };
      if (concluir && etapa.tarefas.every(t => t.status === 'concluida')) {
        etapa.status = 'concluida';
        etapa.concluidaEm = new Date();
        efeitos.etapaConcluida = etapa.setor;
        const proxima = implantacao.etapas.find(e => e.ordem === etapa.ordem + 1);
        if (proxima) {
          if (proxima.status === 'bloqueada') {
            proxima.status = 'em_andamento';
            proxima.iniciadaEm = new Date();
            pularEtapasVaziasEmCadeia(implantacao); // etapas vazias seguintes são puladas (pode concluir o onboarding)
            efeitos.etapaLiberada = implantacao.etapas.find(e => e.status === 'em_andamento') || null;
          }
        } else {
          implantacao.status = 'concluida';
          implantacao.concluidaEm = new Date();
        }
      }
      efeitos.onboardingConcluido = impAntes !== 'concluida' && implantacao.status === 'concluida';
      // A vigência da demanda é aberta aqui mesmo, depois da transação confirmar — não pelo gatilho do model
      implantacao.$locals.vigenciaPeloChamador = true;
      await implantacao.save({ session });
      r.efeitos = efeitos;
    });
  } finally {
    await session.endSession();
  }

  // Efeitos que saem do banco: só depois de tarefa + onboarding confirmados juntos
  if (r.efeitos?.etapaLiberada) {
    const etapa = r.efeitos.etapaLiberada;
    setImmediate(() => avisarEtapaLiberada(r.implantacao, etapa));
  }
  if (r.efeitos?.onboardingConcluido) {
    try { await require('./vigenciaOnboarding').abrirVigenciaAoConcluir(r.implantacao); }
    catch (err) { console.error('⚠️ Erro ao abrir a vigência de demanda na conclusão do onboarding:', err.message); }
  }
  return r;
};

module.exports = { alterarAtividade, ErroAtividade, MENSAGENS, podeAlterar };
