// Regras de etapa do CRM: lista de etapas válidas e cálculo de "em que etapa o lead estava"
// num instante, a partir do historicoEtapas.

const ETAPAS_VALIDAS = ['prospeccao', 'contato', 'reuniao', 'proposta', 'negocio_fechado', 'ganho', 'perdido'];

// Etapas finais: o lead só aparece no mês em que entrou nelas, e o card mostra a data da movimentação
const ETAPAS_FINAIS = ['ganho', 'perdido'];

// Brasil sem horário de verão desde 2019 → UTC−3 fixo
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000;

// Histórico do lead, com salvaguarda pra lead sem histórico (ex: criado pelo backend antigo durante
// a janela de deploy, depois da migração já ter rodado): trata como "na etapa atual desde a criação"
const historicoEfetivo = (lead) => {
  if (lead.historicoEtapas?.length) return lead.historicoEtapas;
  return [{ etapa: lead.etapa, em: lead.criadoEm || lead._id.getTimestamp(), por: null }];
};

// Posição do lead no instante `corte`: a última entrada com em < corte. null = o lead não existia ainda
const posicaoNoCorte = (lead, corte) => {
  const ordenado = [...historicoEfetivo(lead)].sort((a, b) => new Date(a.em) - new Date(b.em));
  let posicao = null;
  for (const h of ordenado) {
    if (new Date(h.em) < corte) posicao = h;
    else break;
  }
  return posicao;
};

// Campos extras que o frontend usa pra montar o quadro: etapaNoMes e movidoEm (só em Ganho/Perdido)
const comPosicao = (lead, posicao) => ({
  ...lead,
  etapaNoMes: posicao.etapa,
  movidoEm: ETAPAS_FINAIS.includes(posicao.etapa) ? posicao.em : null,
});

// "YYYY-MM" do mês corrente no horário de Brasília
const mesAtualBrasilia = () => new Date(Date.now() - OFFSET_BRASILIA_MS).toISOString().slice(0, 7);

// Limites do mês (YYYY-MM) em horário de Brasília: [inicio, fimExclusivo)
const limitesDoMes = (mes) => {
  const [ano, m] = mes.split('-').map(Number);
  return {
    inicioMes: new Date(Date.UTC(ano, m - 1, 1, 3, 0, 0)),
    fimExclusivo: new Date(Date.UTC(ano, m, 1, 3, 0, 0)), // Date.UTC já vira o ano em dezembro
  };
};

module.exports = { ETAPAS_VALIDAS, ETAPAS_FINAIS, historicoEfetivo, posicaoNoCorte, comPosicao, mesAtualBrasilia, limitesDoMes };
