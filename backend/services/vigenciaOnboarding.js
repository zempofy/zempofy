const Cliente = require('../models/Cliente');
const Setor = require('../models/Setor');
const registrarLog = require('./log');
const V = require('./vigenciaDemanda');

// ── Onboarding e vigência de demanda (Spec B, seção 2 — REGRAS_DEMANDA.md, linhas 1 e 2 da tabela) ──
// Enquanto o onboarding está em andamento, os setores dele não geram demanda pro cliente. Ao concluir, cada setor
// do onboarding sem período aberto ganha um período a partir do mês de início dos serviços (implantação antiga sem
// essa data: mês da conclusão, em Brasília). Idempotente: setor que já tem período aberto não é tocado.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const nomeMes = (c) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`;

const entradasAoConcluir = (entradas, setorIds, mesInicio) => {
  const abertos = [];
  let atual = entradas;
  for (const setorId of setorIds) {
    if (V.temPeriodoAberto(atual, setorId)) continue;
    atual = V.abrirPeriodo(atual, setorId, mesInicio).entradas;
    abertos.push(String(setorId));
  }
  return { entradas: atual, abertos };
};

const mesDeInicioDaImplantacao = (imp) =>
  imp.inicioServicos ? V.mesDeDataCivil(imp.inicioServicos) : V.mesDeInstanteBrasilia(imp.concluidaEm || new Date());

const abrirVigenciaAoConcluir = async (imp) => {
  const cliente = await V.clienteDaImplantacao(imp);
  if (!cliente) return { abertos: [] }; // implantação sem cliente vinculado (sem CNPJ) não gera demanda
  const setorIds = [...new Set((imp.etapas || []).map(e => String(e.setor)))];
  const mes = mesDeInicioDaImplantacao(imp);
  const { entradas, abertos } = entradasAoConcluir(V.copiarEntradas(cliente), setorIds, mes);
  if (!abertos.length) return { abertos };
  await Cliente.updateOne({ _id: cliente._id }, { $set: { vigenciaDemanda: entradas }, $addToSet: { setores: { $each: abertos } } });
  const setores = await Setor.find({ _id: { $in: abertos } }).select('nome').lean();
  await registrarLog({
    empresa: imp.empresa, usuario: imp.criadoPor, tipo: 'vigencia_alterada',
    descricao: `Onboarding de ${cliente.razaoSocial} concluído: demanda de ${setores.map(s => s.nome).join(', ')} começa em ${nomeMes(mes)}`,
    meta: { clienteId: cliente._id, evento: 'onboarding_concluido', setores: abertos, inicio: mes },
  });
  return { abertos, mes };
};

module.exports = { entradasAoConcluir, mesDeInicioDaImplantacao, abrirVigenciaAoConcluir };
