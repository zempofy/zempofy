const LancamentoSetor = require('../models/LancamentoSetor');

// "YYYY-MM" — usado como âncora por toda a feature de histórico versionado.
const competenciaAtual = () => new Date().toISOString().slice(0, 7);

// Resolve qual valor valia numa competência X: pega, dentro do histórico, a entrada com
// vigenteDesde mais recente que seja <= X (comparação lexicográfica de "YYYY-MM", que já é
// cronológica). Sem entrada qualificável, usa a mais antiga do array. Sem histórico nenhum
// (cliente ainda não migrado, ou nunca teve o valor mudado), cai no valor ao vivo (fallback).
const resolverPorVigencia = (historico, competencia, fallback) => {
  if (!historico?.length) return fallback;
  const ordenado = [...historico].sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde));
  const validos = ordenado.filter(h => h.vigenteDesde <= competencia);
  return (validos.at(-1) || ordenado[0]).valor;
};

// Aplica uma mudança de valor com histórico versionado.
// modo 'inicio': substitui todo o histórico por uma única entrada, valendo retroativamente
// desde competenciaMaisAntiga (passado e futuro, já que fica sendo a única entrada).
// modo 'agora' (default): preserva o histórico anterior intacto e só acrescenta a entrada nova
// a partir da competência de hoje — meses já preenchidos continuam resolvendo pro valor antigo.
const aplicarMudancaComHistorico = (historicoAtual = [], novoValor, modo, competenciaMaisAntiga) => {
  if (modo === 'inicio') {
    return [{ valor: novoValor, vigenteDesde: competenciaMaisAntiga }];
  }
  const agora = competenciaAtual();
  return [...historicoAtual.filter(h => h.vigenteDesde !== agora), { valor: novoValor, vigenteDesde: agora }];
};

// Competência mais antiga conhecida pra um cliente/setor: a do lançamento mais antigo já salvo
// (LancamentoSetor), ou a data de cadastro do cliente se ele ainda não tiver nenhum lançamento.
const buscarCompetenciaMaisAntiga = async ({ clienteId, setorId, criadoEmCliente }) => {
  if (setorId) {
    const lancamento = await LancamentoSetor.findOne({ cliente: clienteId, setor: setorId })
      .sort({ competencia: 1 })
      .select('competencia')
      .lean();
    if (lancamento) return lancamento.competencia;
  }
  return new Date(criadoEmCliente).toISOString().slice(0, 7);
};

// Prepara o histórico pra receber uma mudança, semeando a entrada do valor ANTIGO quando ainda
// não existe nenhum histórico registrado (cliente nunca migrado e essa é a primeira mudança ao
// vivo). Sem isso, a primeira chamada de aplicarMudancaComHistorico perderia de vista o valor
// que valia antes — meses passados passariam a resolver pro valor novo por engano, exatamente o
// bug que essa feature existe pra corrigir. Também calcula a "competência mais antiga" pro modo
// 'inicio' reaproveitando a semente já resolvida, em vez de consultar o banco de novo.
const prepararHistoricoParaMudanca = async ({ historicoAtual, valorAntigo, modo, clienteId, setorId, criadoEmCliente }) => {
  let historico = historicoAtual || [];
  if (!historico.length && valorAntigo) {
    const competenciaSemente = await buscarCompetenciaMaisAntiga({ clienteId, setorId, criadoEmCliente });
    historico = [{ valor: valorAntigo, vigenteDesde: competenciaSemente }];
  }
  let competenciaMaisAntiga = null;
  if (modo === 'inicio') {
    competenciaMaisAntiga = historico.length
      ? historico[0].vigenteDesde
      : await buscarCompetenciaMaisAntiga({ clienteId, setorId, criadoEmCliente });
  }
  return { historico, competenciaMaisAntiga };
};

module.exports = {
  competenciaAtual,
  resolverPorVigencia,
  aplicarMudancaComHistorico,
  buscarCompetenciaMaisAntiga,
  prepararHistoricoParaMudanca,
};
