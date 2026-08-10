// Script único: popula a empresa de teste (ver criarContaTeste.js / seedClientesTeste.js) com
// Demandas preenchidas em meses passados (mix de pendente/concluído), Onboardings reais (com
// Tarefas geradas a partir de Modelos, igual ao fluxo de verdade), Tarefas avulsas e Leads de
// CRM — pra testar o sistema inteiro rodando junto com volume realista de dado.
// Roda manualmente: `node scripts/seedCargaTeste.js`. Não faz parte do runtime do app.
// Não é idempotente — cada execução soma mais dado em cima do que já existe.
require('dotenv').config();
const mongoose = require('mongoose');
const Empresa = require('../models/Empresa');
const Usuario = require('../models/Usuario');
const Setor = require('../models/Setor');
const Cliente = require('../models/Cliente');
const LancamentoSetor = require('../models/LancamentoSetor');
const AtividadeChecklist = require('../models/AtividadeChecklist');
const ModeloOnboarding = require('../models/ModeloOnboarding');
const Implantacao = require('../models/Implantacao');
const Tarefa = require('../models/Tarefa');
const Lead = require('../models/Lead');

const SLUG_TESTE = 'zempofy-conta-teste-interna';
const normalizarNome = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const aleatorio = (arr) => arr[Math.floor(Math.random() * arr.length)];
const competenciaAtual = () => new Date().toISOString().slice(0, 7);
const competenciaMenos = (comp, n) => {
  const [a, m] = comp.split('-').map(Number);
  const d = new Date(a, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Campos por regime (fiscal) e por situação (DP) — espelha CONFIG_DEMANDA do frontend,
// sem o campo 'calculado' (faturamentoTotal), que nunca é salvo.
const CAMPOS_FISCAL = {
  simples_nacional: ['totalVendas', 'totalServicos', 'das', 'issRetido', 'icmsDifal', 'icmsAntecipado'],
  lucro_presumido: ['totalVendas', 'totalServicos', 'pis', 'cofins', 'irpj', 'csll', 'issProprio', 'issRetido', 'icmsAntecipado', 'icmsDifal'],
  lucro_real: ['totalVendas', 'totalServicos', 'pis', 'cofins', 'irpj', 'csll', 'issProprio', 'issRetido', 'icmsAntecipado', 'icmsDifal'],
};
const CAMPOS_DP = {
  clt: ['funcionariosAtivos', 'folhaProcessada', 'admissoes', 'rescisoes', 'ferias', 'esocialEnviado', 'fgtsInssRecolhidos'],
  pro_labore: ['valorProLabore', 'inssProLabore', 'irrfProLabore'],
};
CAMPOS_DP.ambos = [...CAMPOS_DP.clt, ...CAMPOS_DP.pro_labore];

const CAMPOS_BOOLEANOS = new Set(['folhaProcessada', 'esocialEnviado', 'fgtsInssRecolhidos', 'contabilFeito']);
const CAMPOS_NUMERO = new Set(['funcionariosAtivos', 'admissoes', 'rescisoes', 'ferias']);
const valorCampo = (campo) => {
  if (CAMPOS_BOOLEANOS.has(campo)) return Math.random() < 0.85;
  if (CAMPOS_NUMERO.has(campo)) return Math.floor(Math.random() * 10);
  return Math.round(Math.random() * 50000) / 100; // moeda, em reais
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const empresa = await Empresa.findOne({ slug: SLUG_TESTE });
  if (!empresa) throw new Error('Empresa de teste não existe — rode scripts/criarContaTeste.js primeiro.');
  const usuario = await Usuario.findOne({ email: 'teste@zempofy.com.br' });

  const setores = await Setor.find({ empresa: empresa._id, ativo: true });
  const mapaSetores = {};
  setores.forEach(s => { mapaSetores[normalizarNome(s.nome)] = s });
  const fiscal = mapaSetores['fiscal'], dp = mapaSetores['departamento pessoal'], contabil = mapaSetores['contabil'];

  const clientes = await Cliente.find({ empresa: empresa._id }).lean();
  console.log(`Base atual: ${clientes.length} clientes.`);

  // ── 1) Demandas em meses passados (mix de pendente/concluído) ──
  const defasada = competenciaMenos(competenciaAtual(), 1);
  const competencias = [defasada, competenciaMenos(defasada, 1), competenciaMenos(defasada, 2)];
  const lancamentos = [];

  for (const c of clientes) {
    const setoresCliente = (c.setores || []).map(String);
    for (const competencia of competencias) {
      if (Math.random() < 0.3) continue; // ~30% dos meses ficam sem lançamento nenhum (pendente vazio)

      if (fiscal && setoresCliente.includes(String(fiscal._id)) && CAMPOS_FISCAL[c.regime]) {
        const campos = CAMPOS_FISCAL[c.regime];
        const completo = Math.random() < 0.5;
        const dados = {};
        campos.forEach(campo => { if (completo || Math.random() < 0.6) dados[campo] = valorCampo(campo) });
        if (Object.keys(dados).length) lancamentos.push({ cliente: c._id, setor: fiscal._id, empresa: empresa._id, competencia, dados, preenchidoPor: usuario._id, preenchidoEm: new Date() });
      }
      const situacaoDp = c.configSetores?.['departamento pessoal']?.situacao;
      if (dp && setoresCliente.includes(String(dp._id)) && situacaoDp && CAMPOS_DP[situacaoDp]) {
        const campos = CAMPOS_DP[situacaoDp];
        const completo = Math.random() < 0.5;
        const dados = {};
        campos.forEach(campo => { if (completo || Math.random() < 0.6) dados[campo] = valorCampo(campo) });
        if (Object.keys(dados).length) lancamentos.push({ cliente: c._id, setor: dp._id, empresa: empresa._id, competencia, dados, preenchidoPor: usuario._id, preenchidoEm: new Date() });
      }
      if (contabil && setoresCliente.includes(String(contabil._id)) && c.configSetores?.contabil?.situacao && Math.random() < 0.7) {
        lancamentos.push({ cliente: c._id, setor: contabil._id, empresa: empresa._id, competencia, dados: { contabilFeito: true }, preenchidoPor: usuario._id, preenchidoEm: new Date() });
      }
    }
  }
  let lancamentosCriados = lancamentos.length;
  try {
    await LancamentoSetor.insertMany(lancamentos, { ordered: false });
  } catch (err) {
    // Duplicatas acontecem se algum cliente já tinha lançamento salvo daquele mês (ex: testes
    // manuais anteriores) — insertMany com ordered:false já inseriu o resto normalmente.
    lancamentosCriados = err.result?.insertedCount ?? lancamentosCriados;
    console.log(`(${err.writeErrors?.length || 0} lançamento(s) já existiam pra aquele cliente/setor/mês — ignorados)`);
  }
  console.log(`Lançamentos de Demanda criados: ${lancamentosCriados} (competências: ${competencias.join(', ')})`);

  // ── 2) Atividades de checklist + Modelos de onboarding ──
  const NOMES_ATIVIDADE = {
    comercial: ['Assinar contrato', 'Coletar dados iniciais'],
    legalizacao: ['Abrir CNPJ', 'Emitir alvará'],
    contabil: ['Configurar sistema contábil', 'Cadastrar plano de contas'],
    fiscal: ['Configurar regime tributário', 'Cadastrar NF-e'],
    'departamento pessoal': ['Cadastrar funcionários', 'Configurar folha de pagamento'],
  };
  const atividadesPorSetor = {};
  for (const chave of Object.keys(NOMES_ATIVIDADE)) {
    const setor = mapaSetores[chave];
    if (!setor) continue;
    atividadesPorSetor[chave] = await AtividadeChecklist.insertMany(
      NOMES_ATIVIDADE[chave].map(descricao => ({ descricao, setor: setor._id, empresa: empresa._id, criadoPor: usuario._id }))
    );
  }

  const construirSetoresModelo = (chaves) => chaves.filter(k => mapaSetores[k]).map((chave, i) => ({
    setor: mapaSetores[chave]._id, ordem: i + 1, tarefas: (atividadesPorSetor[chave] || []).map(a => a._id)
  }));

  const modelos = [
    await ModeloOnboarding.create({ nome: 'Simples Nacional + Comércio', descricao: 'Fluxo padrão', setores: construirSetoresModelo(['comercial', 'legalizacao', 'contabil', 'fiscal']), empresa: empresa._id, criadoPor: usuario._id }),
    await ModeloOnboarding.create({ nome: 'Lucro Presumido + Funcionários', descricao: 'Fluxo completo com DP', setores: construirSetoresModelo(['comercial', 'legalizacao', 'contabil', 'fiscal', 'departamento pessoal']), empresa: empresa._id, criadoPor: usuario._id }),
    await ModeloOnboarding.create({ nome: 'Só Contábil', descricao: 'Cliente que só contrata contábil', setores: construirSetoresModelo(['comercial', 'contabil']), empresa: empresa._id, criadoPor: usuario._id }),
  ];
  console.log(`Modelos de onboarding criados: ${modelos.length}`);

  // ── 3) Onboardings (Implantacao) reais, com Tarefas geradas de verdade — igual ao fluxo real ──
  const clientesParaOnboarding = [...clientes].sort(() => Math.random() - 0.5).slice(0, 40);
  let tarefasDeOnboarding = 0;
  for (const c of clientesParaOnboarding) {
    const modelo = aleatorio(modelos);
    const setoresOrdenados = [...modelo.setores].sort((a, b) => a.ordem - b.ordem);
    const progresso = Math.random(); // 0 = recém criado .. 1 = concluído
    const etapas = [];
    for (let idx = 0; idx < setoresOrdenados.length; idx++) {
      const s = setoresOrdenados[idx];
      const atividades = await AtividadeChecklist.find({ _id: { $in: s.tarefas } }).lean();
      const etapaConcluida = (idx + 1) / setoresOrdenados.length <= progresso;
      const tarefasCriadas = await Promise.all(atividades.map(a => Tarefa.create({
        descricao: a.descricao, setor: s.setor, responsavel: usuario._id, criadaPor: usuario._id, empresa: empresa._id,
        status: etapaConcluida ? 'concluida' : 'pendente',
      })));
      tarefasDeOnboarding += tarefasCriadas.length;
      const statusEtapa = etapaConcluida ? 'concluida' : (idx === Math.floor(progresso * setoresOrdenados.length) ? 'em_andamento' : 'bloqueada');
      etapas.push({
        setor: s.setor, ordem: s.ordem, status: statusEtapa,
        tarefas: tarefasCriadas.map(t => ({ tarefa: t._id, status: t.status })),
        iniciadaEm: statusEtapa !== 'bloqueada' ? new Date() : undefined,
        concluidaEm: statusEtapa === 'concluida' ? new Date() : undefined,
      });
    }
    const tudoConcluido = etapas.every(e => e.status === 'concluida');
    await Implantacao.create({
      nomeCliente: c.razaoSocial, cnpj: c.cnpj, inicioServicos: new Date(), modelo: modelo._id, etapas,
      status: tudoConcluido ? 'concluida' : 'em_andamento', empresa: empresa._id, criadoPor: usuario._id,
      concluidaEm: tudoConcluido ? new Date() : undefined,
    });
  }
  console.log(`Onboardings criados: ${clientesParaOnboarding.length} (${tarefasDeOnboarding} tarefas geradas a partir deles)`);

  // ── 4) Tarefas avulsas (fora de onboarding) ──
  const ACOES = ['Ligar pro cliente', 'Enviar documento', 'Revisar guia', 'Conferir NF', 'Atualizar cadastro', 'Responder e-mail', 'Organizar pasta digital', 'Validar CND'];
  const tarefasAvulsas = Array.from({ length: 70 }, () => ({
    descricao: `${aleatorio(ACOES)} — ${aleatorio(clientes).razaoSocial}`,
    responsavel: usuario._id, criadaPor: usuario._id, empresa: empresa._id,
    status: Math.random() < 0.4 ? 'concluida' : 'pendente',
    prioridade: aleatorio(['alta', 'media', 'baixa', '']),
    etiquetas: Math.random() < 0.3 ? [aleatorio(['urgente', 'financeiro', 'documentacao'])] : [],
  }));
  await Tarefa.insertMany(tarefasAvulsas);
  console.log(`Tarefas avulsas criadas: ${tarefasAvulsas.length}`);

  // ── 5) Leads de CRM ──
  const leads = Array.from({ length: 35 }, (_, i) => ({
    empresa: empresa._id, criadoPor: usuario._id,
    nome: `Contato ${i + 1}`, nomeEmpresa: `${aleatorio(['Prospect', 'Lead', 'Oportunidade'])} ${i + 1} Ltda`,
    etapa: aleatorio(['prospeccao', 'contato', 'reuniao', 'proposta', 'fechado', 'perdido']),
    valor: Math.round(Math.random() * 5000), tipoServico: aleatorio(['Fiscal', 'Contábil', 'DP', 'Completo']),
  }));
  await Lead.insertMany(leads);
  console.log(`Leads de CRM criados: ${leads.length}`);

  console.log('\nCarga de teste concluída.');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
