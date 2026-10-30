const mongoose = require('mongoose');
const Cliente = require('../models/Cliente');
const Setor = require('../models/Setor');
const LancamentoSetor = require('../models/LancamentoSetor');
const Documento = require('../models/Documento');
const Implantacao = require('../models/Implantacao');
const Tarefa = require('../models/Tarefa');
const ControleRetiradas = require('../models/ControleRetiradas');
const RetiradaMes = require('../models/RetiradaMes');
const ApuracaoTrimestre = require('../models/ApuracaoTrimestre');
const registrarLog = require('./log');
const V = require('./vigenciaDemanda');

// ── Ciclo de vida da demanda (Spec B — REGRAS_DEMANDA.md, tabela da seção 2) ──
// Onboarding, inativar/reativar, remover setor e excluir cliente. Tudo que muda vigência passa por aqui
// e usa as funções puras de services/vigenciaDemanda.js — nunca uma segunda forma de decidir "existe demanda?".

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const nomeMes = (c) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`;

const logVigencia = ({ empresa, usuario, descricao, meta }) =>
  registrarLog({ empresa, usuario, tipo: 'vigencia_alterada', descricao, meta });

// ── Onboarding ──

// Concluir o onboarding: cada setor da implantação sem período aberto ganha um período a partir do mês de início
// dos serviços (implantação antiga sem essa data: mês da conclusão). Já aberto = não faz nada (idempotente).
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
  await logVigencia({
    empresa: imp.empresa, usuario: imp.criadoPor,
    descricao: `Onboarding de ${cliente.razaoSocial} concluído: demanda de ${setores.map(s => s.nome).join(', ')} começa em ${nomeMes(mes)}`,
    meta: { clienteId: cliente._id, evento: 'onboarding_concluido', setores: abertos, inicio: mes },
  });
  return { abertos, mes };
};

// ── Adicionar setor a um cliente (cadastro, edição) ──
// Setor que nunca teve vigência: "desde sempre" (ou a partir de `comecaEm`, se informado).
// Setor que já teve: nunca "desde sempre" — período novo a partir de `comecaEm` (padrão: mês atual).
const entradasAoAdicionarSetores = (entradas, setorIds, { comecaEm = null, mesAtual }) => {
  let atual = entradas;
  for (const setorId of setorIds) {
    if (V.temPeriodoAberto(atual, setorId)) continue;
    if (V.jaTeveVigencia(atual, setorId)) atual = V.abrirPeriodo(atual, setorId, comecaEm || mesAtual).entradas;
    else if (comecaEm) atual = V.abrirPeriodo(atual, setorId, comecaEm).entradas;
    else atual = [...atual.filter(v => String(v.setor) !== String(setorId)), V.entradaDesdeSempre(setorId)];
  }
  return atual;
};

// ── Meses com dado salvo que saem da vigência (Spec D, seção 3) ──
// Competências com lançamento ou documento de demanda (fora da lixeira) que estão dentro da vigência em `antes` e
// ficam fora em `depois`. Usado pelo aviso dos diálogos (POST /clientes/:id/vigencia/simular) e pelo histórico,
// sempre com as mesmas listas de entradas que a ação de verdade grava.
const mesesComDadosQueSaem = async ({ empresaId, clienteId, antes, depois, setorIds = null }) => {
  const filtro = { empresa: empresaId, cliente: clienteId, ...(setorIds ? { setor: { $in: setorIds } } : {}) };
  const [lancamentos, documentos] = await Promise.all([
    LancamentoSetor.find(filtro).select('setor competencia').lean(),
    Documento.find({ ...filtro, tipo: 'demanda', excluido: { $ne: true } }).select('setor competencia').lean(),
  ]);
  const cobre = (entradas, setor, competencia) => V.periodosDoSetor({ vigenciaDemanda: entradas }, setor).some(p => V.periodoCobre(p, competencia));
  const meses = new Set();
  for (const d of [...lancamentos, ...documentos]) {
    if (d.competencia && cobre(antes, d.setor, d.competencia) && !cobre(depois, d.setor, d.competencia)) meses.add(d.competencia);
  }
  return [...meses].sort();
};

const textoMesesForaDaVigencia = (meses) =>
  meses.length ? `. Meses com dados salvos que ficaram fora da vigência: ${meses.map(nomeMes).join(', ')}` : '';

// ── Arquivos no armazenamento (R2): sempre DEPOIS de o banco confirmar; falha vira registro de limpeza manual ──
const apagarArquivosDoArmazenamento = async (chaves, { empresa, usuario, descricao }) => {
  if (!chaves.length) return { apagados: 0, pendentes: [] };
  const { apagarArquivo } = require('./storage');
  const pendentes = [];
  for (const chave of chaves) {
    try { await apagarArquivo(chave); } catch (err) { pendentes.push(chave); console.error(`⚠️ Falha ao apagar ${chave} no R2:`, err.message); }
  }
  if (pendentes.length) {
    await registrarLog({
      empresa, usuario, tipo: 'arquivos_limpeza_pendente',
      descricao: `${pendentes.length} arquivo(s) não puderam ser apagados do armazenamento e precisam de limpeza manual — ${descricao}`,
      meta: { chaves: pendentes },
    });
  }
  return { apagados: chaves.length - pendentes.length, pendentes };
};

const emTransacao = async (fn) => {
  const session = await mongoose.startSession();
  try {
    let resultado;
    await session.withTransaction(async () => { resultado = await fn(session); });
    return resultado;
  } finally {
    await session.endSession();
  }
};

// Ponto de falha injetável SÓ pelos testes ("tudo ou nada"): lança no ponto pedido, no meio da operação.
const falharSe = (simularFalha, ponto) => { if (simularFalha === ponto) throw new Error(`Falha simulada em ${ponto}`); };

// ── Remover setor — contagens para o diálogo e "Remover tudo" ──

const contarImpactoSetor = async (empresaId, clienteId, setorId) => {
  const cliente = await Cliente.findOne({ _id: clienteId, empresa: empresaId }).select('configSetores particularidadesSetor').lean();
  const setor = await Setor.findOne({ _id: setorId, empresa: empresaId }).select('nome').lean();
  const chave = setor ? V.normalizarNome(setor.nome) : null;
  const config = chave ? cliente?.configSetores?.[chave] : null;
  const [lancamentos, documentos] = await Promise.all([
    LancamentoSetor.countDocuments({ empresa: empresaId, cliente: clienteId, setor: setorId }),
    Documento.countDocuments({ empresa: empresaId, cliente: clienteId, tipo: 'demanda', setor: setorId }),
  ]);
  return {
    lancamentos,
    documentos,
    configuracoes: config ? (1 + (config.camposExtras?.length || 0) + (config.bancos?.length || 0)) : 0,
    particularidades: (cliente?.particularidadesSetor || []).filter(p => String(p.setor) === String(setorId) && p.texto).length,
  };
};

// "Remover tudo": uma única transação no banco remove vigência, lançamentos, registros de documentos, configurações,
// particularidades e a atribuição do setor — toda ou nenhuma. Só depois os arquivos saem do R2.
const removerSetorTudo = async ({ empresaId, clienteId, setorId, usuarioId, simularFalha = null }) => {
  const setor = await Setor.findOne({ _id: setorId, empresa: empresaId }).select('nome').lean();
  if (!setor) { const e = new Error('Setor não encontrado.'); e.status = 404; throw e; }
  const chaveConfig = V.normalizarNome(setor.nome);

  const r = await emTransacao(async (session) => {
    const cliente = await Cliente.findOne({ _id: clienteId, empresa: empresaId }).session(session).lean();
    if (!cliente) { const e = new Error('Cliente não encontrado.'); e.status = 404; throw e; }
    const docs = await Documento.find({ empresa: empresaId, cliente: clienteId, tipo: 'demanda', setor: setorId }).select('chave').session(session).lean();
    const lanc = await LancamentoSetor.deleteMany({ empresa: empresaId, cliente: clienteId, setor: setorId }, { session });
    falharSe(simularFalha, 'apos_lancamentos');
    await Documento.deleteMany({ empresa: empresaId, cliente: clienteId, tipo: 'demanda', setor: setorId }, { session });
    falharSe(simularFalha, 'apos_documentos');
    const config = { ...(cliente.configSetores || {}) };
    const tinhaConfig = chaveConfig in config;
    delete config[chaveConfig];
    await Cliente.updateOne({ _id: clienteId, empresa: empresaId }, {
      $set: { configSetores: config },
      $pull: { setores: setor._id, particularidadesSetor: { setor: setor._id }, vigenciaDemanda: { setor: setor._id } },
    }, { session });
    falharSe(simularFalha, 'apos_cliente');
    return { chaves: docs.map(d => d.chave), lancamentos: lanc.deletedCount, documentos: docs.length, tinhaConfig, nomeCliente: cliente.razaoSocial };
  });

  const arquivos = await apagarArquivosDoArmazenamento(r.chaves, {
    empresa: empresaId, usuario: usuarioId, descricao: `remoção total do setor ${setor.nome} de ${r.nomeCliente}`,
  });
  return { setor: setor.nome, nomeCliente: r.nomeCliente, lancamentos: r.lancamentos, documentos: r.documentos, arquivosPendentes: arquivos.pendentes.length };
};

// "Daqui pra frente": só fecha a vigência do setor e tira o setor da lista. Nada é apagado.
// Usa updateOne (sem validar o documento inteiro): um campo antigo inválido em outro lugar do cadastro não trava a remoção.
const removerSetorDaquiPraFrente = async ({ empresaId, cliente, setorId, mes }) => {
  const entradas = V.fecharPeriodosAbertos(V.copiarEntradas(cliente), mes, setorId);
  const setores = (cliente.setores || []).filter(s => String(s) !== String(setorId));
  await Cliente.updateOne({ _id: cliente._id, empresa: empresaId }, { $set: { vigenciaDemanda: entradas, setores } });
  return { fimVigencia: V.somarMeses(mes, -1) };
};

// ── Excluir cliente ──

const buscarVinculosDoCliente = async (empresaId, cliente, session = null) => {
  const comSessao = (q) => (session ? q.session(session) : q);
  const digitos = (cliente.cnpj || '').replace(/\D/g, '');
  const filtroImplantacao = {
    empresa: empresaId,
    $or: [
      { cliente: cliente._id },
      // implantações antigas, de antes de o campo `cliente` existir, ligadas só pelo CNPJ
      ...(digitos ? [{ $and: [{ $or: [{ cliente: { $exists: false } }, { cliente: null }] }, { cnpj: new RegExp(digitos.split('').join('[.\\-/]*')) }] }] : []),
    ],
  };
  const implantacoes = await comSessao(Implantacao.find(filtroImplantacao).select('status etapas.tarefas.tarefa')).lean();
  const tarefaIds = implantacoes.flatMap(i => (i.etapas || []).flatMap(e => (e.tarefas || []).map(t => t.tarefa).filter(Boolean)));
  const controles = await comSessao(ControleRetiradas.find({ empresa: empresaId, cliente: cliente._id }).select('_id')).lean();
  const documentos = await comSessao(Documento.find({ empresa: empresaId, cliente: cliente._id }).select('chave excluido')).lean();
  const [lancamentos, retiradasMes, apuracoes] = await Promise.all([
    comSessao(LancamentoSetor.countDocuments({ empresa: empresaId, cliente: cliente._id })),
    comSessao(RetiradaMes.countDocuments({ empresa: empresaId, cliente: cliente._id })),
    comSessao(ApuracaoTrimestre.countDocuments({ empresa: empresaId, cliente: cliente._id })),
  ]);
  return {
    filtroImplantacao, tarefaIds, chaves: documentos.map(d => d.chave),
    contagem: {
      setores: (cliente.setores || []).length,
      lancamentos,
      documentos: documentos.filter(d => !d.excluido).length,
      documentosNaLixeira: documentos.filter(d => d.excluido).length,
      implantacoes: implantacoes.length,
      tarefasDeOnboarding: tarefaIds.length,
      controlesDeRetiradas: controles.length,
      retiradasLancadas: retiradasMes,
      apuracoesDeTrimestre: apuracoes,
    },
  };
};

const contarImpactoExclusao = async (empresaId, cliente) => (await buscarVinculosDoCliente(empresaId, cliente)).contagem;

// Tudo ou nada: o banco apaga tudo ligado ao cliente numa única transação; depois os arquivos saem do R2.
// As linhas do histórico do sistema (Log) NÃO são apagadas: é a prova de quem excluiu.
const excluirClienteCompleto = async ({ empresaId, clienteId, usuarioId, simularFalha = null }) => {
  const r = await emTransacao(async (session) => {
    const cliente = await Cliente.findOne({ _id: clienteId, empresa: empresaId }).session(session).lean();
    if (!cliente) { const e = new Error('Cliente não encontrado.'); e.status = 404; throw e; }
    const v = await buscarVinculosDoCliente(empresaId, cliente, session);

    await LancamentoSetor.deleteMany({ empresa: empresaId, cliente: clienteId }, { session });
    falharSe(simularFalha, 'apos_lancamentos');
    await Documento.deleteMany({ empresa: empresaId, cliente: clienteId }, { session });
    falharSe(simularFalha, 'apos_documentos');
    await Implantacao.deleteMany(v.filtroImplantacao, { session });
    if (v.tarefaIds.length) await Tarefa.deleteMany({ _id: { $in: v.tarefaIds }, empresa: empresaId }, { session });
    falharSe(simularFalha, 'apos_implantacoes');
    await RetiradaMes.deleteMany({ empresa: empresaId, cliente: clienteId }, { session });
    await ApuracaoTrimestre.deleteMany({ empresa: empresaId, cliente: clienteId }, { session });
    await ControleRetiradas.deleteMany({ empresa: empresaId, cliente: clienteId }, { session });
    falharSe(simularFalha, 'apos_retiradas');
    await Cliente.deleteOne({ _id: clienteId, empresa: empresaId }, { session });
    return { chaves: v.chaves, contagem: v.contagem, nomeCliente: cliente.razaoSocial };
  });

  const arquivos = await apagarArquivosDoArmazenamento(r.chaves, {
    empresa: empresaId, usuario: usuarioId, descricao: `exclusão do cliente ${r.nomeCliente}`,
  });
  return { nomeCliente: r.nomeCliente, contagem: r.contagem, arquivosPendentes: arquivos.pendentes.length };
};

module.exports = {
  nomeMes, logVigencia, mesesComDadosQueSaem, textoMesesForaDaVigencia, entradasAoConcluir, mesDeInicioDaImplantacao, abrirVigenciaAoConcluir, entradasAoAdicionarSetores,
  apagarArquivosDoArmazenamento, contarImpactoSetor, removerSetorTudo, removerSetorDaquiPraFrente,
  buscarVinculosDoCliente, contarImpactoExclusao, excluirClienteCompleto,
};
