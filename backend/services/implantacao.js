// Uma etapa só é marcada concluída quando alguém completa uma tarefa dela — mas se a etapa
// não tem nenhuma tarefa (setor incluído no modelo de onboarding sem nenhuma atividade do
// checklist associada), esse gatilho nunca acontece e a implantação trava ali pra sempre,
// travando também todas as etapas seguintes.
//
// Sempre que uma etapa é desbloqueada (status vira 'em_andamento'), chamar essa função depois:
// se a etapa que acabou de ficar em_andamento estiver vazia, marca ela como concluída na hora
// e desbloqueia a próxima — em cadeia, até achar uma etapa com tarefa de verdade (que fica
// em_andamento normalmente) ou não sobrar mais etapa (a implantação inteira vira concluída).
//
// Recebe algo com `etapas` (array com ordem/status/tarefas), `status` e `concluidaEm` —
// funciona tanto num objeto plano (implantação ainda não criada, no POST) quanto num
// documento Mongoose já salvo (nas rotas de conclusão de tarefa).
const pularEtapasVaziasEmCadeia = (implantacaoLike) => {
  let atual = implantacaoLike.etapas.find(e => e.status === 'em_andamento');
  while (atual && atual.tarefas.length === 0) {
    atual.status = 'concluida';
    atual.concluidaEm = new Date();

    const proxima = implantacaoLike.etapas.find(e => e.ordem === atual.ordem + 1);
    if (proxima) {
      proxima.status = 'em_andamento';
      proxima.iniciadaEm = new Date();
      atual = proxima;
    } else {
      implantacaoLike.status = 'concluida';
      implantacaoLike.concluidaEm = new Date();
      atual = null;
    }
  }
};

module.exports = { pularEtapasVaziasEmCadeia };
