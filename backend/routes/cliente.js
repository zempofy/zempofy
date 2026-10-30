const express = require('express');
const registrarLog = require('../services/log');
const { autenticar, temPermissao } = require('../middleware/auth');
const Cliente = require('../models/Cliente');
const Implantacao = require('../models/Implantacao');
const LancamentoSetor = require('../models/LancamentoSetor');
const Setor = require('../models/Setor');
const Documento = require('../models/Documento');
const { clienteCreateSchema, clienteUpdateSchema, validar } = require('../validacao');
const { competenciaAtual, competenciaAtualDoSetor, resolverPorVigencia, aplicarMudancaComHistorico, buscarCompetenciaMaisAntiga, prepararHistoricoParaMudanca } = require('../services/historicoVigencia');

const V = require('../services/vigenciaDemanda');
const ciclos = require('../services/ciclosCliente');

const router = express.Router();

// Existe alguma Implantacao vinculada a este cliente que ainda não terminou?
const temOnboardingAtivo = (clienteId) => Implantacao.exists({ cliente: clienteId, status: { $ne: 'concluida' } });

// ── Mescla de cadastro em duplicata de CNPJ ──
// Quando o mesmo CNPJ é cadastrado de novo (manual ou importação), atualiza o registro existente
// em vez de criar um duplicado. Só sobrescreve campos que vieram preenchidos na nova entrada —
// campo vazio na nova entrada não apaga o que já estava cadastrado.
const preenchido = (v) => {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(preenchido);
  return true;
};

const CAMPOS_CADASTRAIS = ['razaoSocial', 'nomeFantasia', 'cnpj', 'tipoPessoa', 'porte', 'regime', 'dataAbertura', 'cnaePrincipal', 'atividade', 'telefone', 'email', 'socios'];

// Compara CNPJ tolerando máscara — o valor salvo no banco pode estar com ou sem pontuação
// dependendo de como o cliente foi cadastrado, então um regex com dígitos puros (ex: "$regex: cnpjLimpo")
// nunca batia contra um cnpj salvo como "12.345.678/0001-90". Aceita pontuação opcional entre os dígitos.
const cnpjRegexTolerante = (cnpjDigitos) => new RegExp(cnpjDigitos.split('').join('[.\\-/]*'));

// Documento de 11 dígitos é CPF (pessoa física); 14 dígitos (ou vazio) é CNPJ (pessoa jurídica).
// Deriva sempre a partir do documento em vez de confiar no que o cliente envia.
const tipoPessoaDoDocumento = (documento) => (documento || '').replace(/\D/g, '').length === 11 ? 'fisica' : 'juridica';

const mesclarCadastro = async (existente, novo) => {
  const regimeAntigo = existente.regime;
  CAMPOS_CADASTRAIS.forEach(campo => {
    if (preenchido(novo[campo])) existente[campo] = novo[campo];
  });
  // Fluxo em lote (CNPJ duplicado no cadastro manual ou na importação) — sem diálogo de vigência,
  // sempre modo 'agora': preserva o Histórico já preenchido, só o mês corrente em diante reflete
  // o regime novo.
  if (regimeAntigo && preenchido(novo.regime) && novo.regime !== regimeAntigo) {
    const setorFiscal = await Setor.findOne({ empresa: existente.empresa, nome: /^fiscal$/i, ativo: true }).select('_id').lean();
    const { historico } = await prepararHistoricoParaMudanca({
      historicoAtual: existente.historicoRegime,
      valorAntigo: regimeAntigo,
      modo: 'agora',
      clienteId: existente._id,
      setorId: setorFiscal?._id,
      criadoEmCliente: existente.criadoEm,
    });
    existente.historicoRegime = aplicarMudancaComHistorico(historico, novo.regime, 'agora');
  }
  // honorario fica fora do CAMPOS_CADASTRAIS/preenchido genérico porque 0 é um valor válido
  // pra outros tipos de campo mas aqui só significa "não veio preenchido" — não pode apagar
  // um honorário já cadastrado só porque a nova entrada (ex: linha da planilha) veio em branco.
  if (novo.honorario) existente.honorario = novo.honorario;
  if (novo.endereco) {
    if (!existente.endereco) existente.endereco = {};
    Object.entries(novo.endereco).forEach(([k, v]) => {
      if (preenchido(v)) existente.endereco[k] = v;
    });
    existente.markModified('endereco');
  }
};

// GET /api/clientes
router.get('/', autenticar, async (req, res) => {
  try {
    const clientes = await Cliente.find({ empresa: req.usuario.empresa._id })
      .populate('criadoPor', 'nome')
      .populate('setores', 'nome cor responsavel').sort({ criadoEm: -1 }).lean();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar clientes.' });
  }
});

// GET /api/clientes/demandas/:setorId/:competencia — status (dados brutos) de todos os clientes
// do setor numa competência, em lote — usado pela tela Demandas pra não precisar de 1 chamada por cliente
router.get('/demandas/:setorId/:competencia', autenticar, async (req, res) => {
  try {
    const { setorId, competencia } = req.params;
    if (!/^\d{4}-\d{2}$/.test(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });

    const setor = await Setor.findOne({ _id: setorId, empresa: req.usuario.empresa._id }).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    const setorNome = normalizarNome(setor.nome);

    // Quem decide se o cliente tem Demanda nesta competência é a vigência (services/vigenciaDemanda.js):
    // períodos do cliente no setor + regra adicional do setor (Fiscal: sem regime ou "outro" não gera).
    const clientes = await V.listarClientesComDemanda({
      empresaId: req.usuario.empresa._id, setorId, setorNome, competencia,
      campos: 'razaoSocial nomeFantasia historicoRegime configSetores',
    });

    const lancamentos = await LancamentoSetor.find({ empresa: req.usuario.empresa._id, setor: setorId, competencia })
      .select('cliente dados camposIsentos').lean();
    const dadosPorCliente = new Map(lancamentos.map(l => [l.cliente.toString(), l.dados || {}]));
    const isentosPorCliente = new Map(lancamentos.map(l => [l.cliente.toString(), l.camposIsentos || []]));
    // existe: true só quando o lançamento realmente foi salvo pra essa competência (documento
    // encontrado no banco) — diferente de "não existe" (nunca clicou em Salvar), que resulta no
    // mesmo dados:{} por fora mas precisa contar como pendente quando não há campo nenhum pra preencher.
    const existePorCliente = new Set(lancamentos.map(l => l.cliente.toString()));

    // Busca em lote (não 1 chamada por cliente) quais clientes têm pelo menos um documento
    // dessa competência/setor — mesmo filtro de "não excluído" usado em documento.js, pra não
    // contar um documento já mandado pra lixeira como anexo existente.
    const clientesComDoc = await Documento.distinct('cliente', {
      empresa: req.usuario.empresa._id,
      tipo: 'demanda',
      setor: setorId,
      competencia,
      excluido: { $ne: true },
    });
    const comDocSet = new Set(clientesComDoc.map(id => id.toString()));

    res.json(clientes.map(c => ({
      clienteId: c._id,
      nome: c.razaoSocial || c.nomeFantasia,
      status: c.status,
      regime: resolverPorVigencia(c.historicoRegime, competencia, c.regime),
      situacao: resolverPorVigencia(c.configSetores?.[setorNome]?.historicoSituacao, competencia, c.configSetores?.[setorNome]?.situacao),
      dados: dadosPorCliente.get(c._id.toString()) || {},
      camposIsentos: isentosPorCliente.get(c._id.toString()) || [],
      bancos: c.configSetores?.contabil?.bancos || [],
      existe: existePorCliente.has(c._id.toString()),
      temAnexo: comDocSet.has(c._id.toString()),
    })));
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar demandas.' });
  }
});

// GET /api/clientes/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id })
      .populate('criadoPor', 'nome').populate('setores', 'nome cor responsavel')
      .populate('particularidadesSetor.atualizadoPor', 'nome').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    // Setores que o cliente já teve (removidos "daqui pra frente") continuam na aba dele, só pra consulta
    const atribuidos = new Set((cliente.setores || []).map(s => String(s._id)));
    const idsHistoricos = (cliente.vigenciaDemanda || []).filter(v => v.periodos?.length && !atribuidos.has(String(v.setor))).map(v => v.setor);
    const setoresHistoricos = idsHistoricos.length
      ? await Setor.find({ _id: { $in: idsHistoricos }, empresa: req.usuario.empresa._id }).select('nome cor responsavel').lean()
      : [];

    // Buscar onboardings vinculados ao CNPJ do cliente
    const cnpjLimpo = cliente.cnpj?.replace(/\D/g, '');
    const onboardings = cnpjLimpo
      ? await Implantacao.find({ empresa: req.usuario.empresa._id, cnpj: cnpjRegexTolerante(cnpjLimpo) })
          .select('nomeCliente status criadoEm etapas')
          .populate('modelo', 'nome')
          .sort({ criadoEm: -1 })
          .lean()
      : [];

    res.json({ ...cliente, onboardings, setoresHistoricos });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar cliente.' });
  }
});

// POST /api/clientes
router.post('/', autenticar, temPermissao('gerenciarClientes'), validar(clienteCreateSchema), async (req, res) => {
  const { razaoSocial, cnpj, regime, porte, servicosContratados } = req.body;
  delete req.body.vigenciaDemanda; // vigência só o servidor grava
  const comecaEm = req.body.demandaComecaEm || null; // "A demanda começa em" (opcional): em branco = desde sempre
  if (comecaEm && !V.mesValido(comecaEm)) return res.status(400).json({ erro: 'Mês de início da demanda inválido.' });
  if (!razaoSocial?.trim()) return res.status(400).json({ erro: 'Razão social é obrigatória.' });
  const tipoPessoa = tipoPessoaDoDocumento(cnpj);
  // Clientes criados via onboarding (origem: 'onboarding') não exigem todos os campos.
  // Pessoa física não tem porte (não se aplica).
  const viaOnboarding = req.body.origem === 'onboarding';
  if (!viaOnboarding && tipoPessoa !== 'fisica') {
    if (!porte) return res.status(400).json({ erro: 'Porte é obrigatório.' });
    if (!regime) return res.status(400).json({ erro: 'Regime tributário é obrigatório.' });
  }
  try {
    if (cnpj) {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const existente = await Cliente.findOne({ empresa: req.usuario.empresa._id, cnpj: cnpjRegexTolerante(cnpjLimpo) });
      if (existente) {
        // CNPJ/CPF já cadastrado: atualiza o registro existente com os dados mais recentes em vez de duplicar
        await mesclarCadastro(existente, { ...req.body, razaoSocial: razaoSocial.trim(), tipoPessoa });
        await existente.save();
        registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'cliente_editado', categoria: 'cliente', descricao: `Atualizou o cadastro de ${existente.razaoSocial} (CNPJ/CPF já existente)` });
        return res.json(existente);
      }
    }
    const cliente = new Cliente({
      ...req.body,
      razaoSocial: razaoSocial.trim(),
      tipoPessoa,
      historicoRegime: regime ? [{ valor: regime, vigenteDesde: competenciaAtual() }] : [],
      empresa: req.usuario.empresa._id,
      criadoPor: req.usuario._id,
    });
    // Setores escolhidos no cadastro: demanda desde sempre (ou a partir de "A demanda começa em"). Cliente criado
    // pelo onboarding nasce sem vigência: ela só abre quando o onboarding conclui. Cliente já cadastrado como inativo
    // (Spec D): a data em que ele foi inativado é desconhecida → sem período (REGRAS_DEMANDA.md, linha 11).
    const nasceInativo = cliente.status === 'inativo';
    cliente.vigenciaDemanda = viaOnboarding || nasceInativo ? [] : ciclos.entradasAoAdicionarSetores([], cliente.setores.map(String), { comecaEm, mesAtual: V.mesAtualBrasilia() });
    await cliente.save();
    if (nasceInativo && cliente.setores.length) ciclos.logVigencia({
      empresa: req.usuario.empresa._id, usuario: req.usuario._id,
      descricao: `${cliente.razaoSocial} cadastrado já como inativo: sem demanda (data de inativação desconhecida)`,
      meta: { clienteId: cliente._id, evento: 'cadastrado_inativo' },
    });
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'cliente_criado', categoria: 'cliente', descricao: 'Cadastrou o cliente ' + razaoSocial.trim(), meta: { nome: razaoSocial } });
    res.status(201).json(cliente);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar cliente.' });
  }
});

// PUT /api/clientes/:id
router.put('/:id', autenticar, temPermissao('gerenciarClientes'), validar(clienteUpdateSchema), async (req, res) => {
  try {
    const { empresa, criadoPor, _id, criadoEm, modoVigenciaRegime, vigenciaDemanda, mesVigencia, demandaComecaEm, ...dados } = req.body;
    if (dados.cnpj !== undefined) dados.tipoPessoa = tipoPessoaDoDocumento(dados.cnpj);

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    // Inativar só é permitido com o onboarding concluído (ou sem onboarding nenhum) —
    // senão a implantação fica com um cliente inativo no meio do processo.
    if (dados.status === 'inativo' && cliente.status !== 'inativo' && await temOnboardingAtivo(cliente._id)) {
      return res.status(403).json({ erro: 'Não é possível inativar: esta empresa ainda está em onboarding.' });
    }

    // Regime mudou de verdade (não é edição inicial nem o mesmo valor) — decide a vigência
    // conforme a escolha do usuário no diálogo (default 'agora' se não vier, ex: fluxos antigos).
    if (dados.regime !== undefined && dados.regime !== cliente.regime && cliente.regime) {
      const setorFiscal = await Setor.findOne({ empresa: cliente.empresa, nome: /^fiscal$/i, ativo: true }).select('_id').lean();
      // Definir o regime pela primeira vez é liberado (ex: cadastro novo) — mas MUDAR um regime já
      // definido só pode quem é titular ou o responsável designado do setor Fiscal.
      if (!(await podeMudarConfigSetor(req.usuario, setorFiscal?._id?.toString()))) {
        return res.status(403).json({ erro: 'Só o titular ou o responsável do Fiscal pode mudar o regime tributário.' });
      }
      const modo = modoVigenciaRegime === 'inicio' ? 'inicio' : 'agora';
      const { historico, competenciaMaisAntiga } = await prepararHistoricoParaMudanca({
        historicoAtual: cliente.historicoRegime,
        valorAntigo: cliente.regime,
        modo,
        clienteId: cliente._id,
        setorId: setorFiscal?._id,
        criadoEmCliente: cliente.criadoEm,
      });
      cliente.historicoRegime = aplicarMudancaComHistorico(historico, dados.regime, modo, competenciaMaisAntiga);
    }

    // Por aqui só dá pra ADICIONAR setor: tirar um setor já atribuído (que apaga a Demanda dele pro
    // cliente) só pela rota DELETE /:id/setores/:setorId, que exige confirmação de escopo. Sem isso,
    // uma lista de setores incompleta removia o setor na hora e deixava os lançamentos órfãos.
    let setoresNovos = [];
    if (dados.setores !== undefined) {
      const atuais = cliente.setores.map(s => s.toString());
      const novos = dados.setores.map(s => String(s._id || s)).filter(id => !atuais.includes(id));
      setoresNovos = novos;
      dados.setores = [...cliente.setores, ...novos];
    }

    // Vigência da demanda (Spec B): inativar fecha os períodos abertos; reativar abre período novo nos setores
    // atribuídos; setor adicionado abre período (desde sempre, se nunca teve; senão a partir do mês escolhido).
    // O mês da ação é o mês atual (Brasília), a menos que o usuário escolha outro.
    const statusAntes = cliente.status;
    const inativando = dados.status === 'inativo' && statusAntes !== 'inativo';
    const reativando = statusAntes === 'inativo' && dados.status !== undefined && dados.status !== 'inativo';
    const mesAcao = mesVigencia || V.mesAtualBrasilia();
    if ((inativando || reativando) && !V.mesDentroDaJanela(mesAcao)) {
      return res.status(400).json({ erro: 'Mês inválido: escolha entre 12 meses atrás e 12 meses à frente.' });
    }
    if (demandaComecaEm && !V.mesValido(demandaComecaEm)) return res.status(400).json({ erro: 'Mês de início da demanda inválido.' });

    Object.assign(cliente, dados);

    const eventosVigencia = [];
    let entradas = V.copiarEntradas(cliente);
    let mesesForaDaVigencia = [];
    if (inativando) {
      const antesDeInativar = entradas;
      entradas = V.fecharPeriodosAbertos(entradas, mesAcao);
      // Meses com lançamento/documento que saem da vigência: o usuário viu o aviso e confirmou (Spec D) — fica no histórico
      mesesForaDaVigencia = await ciclos.mesesComDadosQueSaem({ empresaId: req.usuario.empresa._id, clienteId: cliente._id, antes: antesDeInativar, depois: entradas });
      eventosVigencia.push(`Cliente inativado a partir de ${ciclos.nomeMes(mesAcao)}: demandas até ${ciclos.nomeMes(V.somarMeses(mesAcao, -1))} continuam no histórico${ciclos.textoMesesForaDaVigencia(mesesForaDaVigencia)}`);
    } else if (reativando) {
      for (const setorId of cliente.setores.map(String)) entradas = V.abrirPeriodo(entradas, setorId, mesAcao).entradas;
      eventosVigencia.push(`Cliente reativado: demandas voltam a partir de ${ciclos.nomeMes(mesAcao)}`);
    }
    if (setoresNovos.length && cliente.status !== 'inativo') {
      entradas = ciclos.entradasAoAdicionarSetores(entradas, setoresNovos, { comecaEm: demandaComecaEm || null, mesAtual: V.mesAtualBrasilia() });
      eventosVigencia.push(`Setor(es) adicionado(s)${demandaComecaEm ? `: demanda começa em ${ciclos.nomeMes(demandaComecaEm)}` : ''}`);
    }
    if (eventosVigencia.length) cliente.vigenciaDemanda = entradas;
    await cliente.save();
    eventosVigencia.forEach(ev => ciclos.logVigencia({
      empresa: req.usuario.empresa._id, usuario: req.usuario._id, descricao: `${ev} — ${cliente.razaoSocial}`,
      meta: { clienteId: cliente._id, mes: mesAcao, ...(mesesForaDaVigencia.length ? { mesesForaDaVigencia } : {}) },
    }));
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'cliente_editado', categoria: 'cliente', descricao: 'Editou o cliente ' + cliente.razaoSocial });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar cliente.' });
  }
});

// GET /api/clientes/:id/impacto-exclusao — o que a exclusão permanente vai apagar (números pro diálogo de confirmação)
router.get('/:id/impacto-exclusao', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).select('cnpj setores').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.json(await ciclos.contarImpactoExclusao(req.usuario.empresa._id, cliente));
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao calcular o que será apagado.' });
  }
});

// DELETE /api/clientes/:id — exclusão permanente. Só é permitida com o cliente já inativo, sem onboarding em
// andamento, pra evitar apagar por engano um cliente que ainda está ativo na carteira. Apaga TUDO ligado ao cliente
// (demandas, documentos e arquivos, onboardings, controles de retiradas), tudo ou nada: o banco confirma primeiro,
// os arquivos saem do armazenamento depois. As linhas do histórico do sistema ficam (provam quem excluiu).
router.delete('/:id', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).select('razaoSocial status').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status !== 'inativo') {
      return res.status(403).json({ erro: 'Só é possível excluir um cliente depois de inativá-lo.' });
    }

    // Implantações antigas (criadas antes do campo `cliente` existir) não têm essa ligação —
    // a trava não pega esses casos, é uma limitação conhecida e aceita.
    if (await temOnboardingAtivo(cliente._id)) {
      return res.status(403).json({ erro: 'Este cliente ainda está em onboarding. Conclua ou cancele a implantação antes de excluir.' });
    }

    let r;
    try {
      r = await ciclos.excluirClienteCompleto({ empresaId: req.usuario.empresa._id, clienteId: cliente._id, usuarioId: req.usuario._id });
    } catch (err) {
      console.error('Erro ao excluir cliente (nada foi apagado):', err);
      return res.status(500).json({ erro: 'Não foi possível excluir o cliente. Nada foi apagado — tente de novo.' });
    }
    registrarLog({
      empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'cliente_excluido', categoria: 'cliente',
      descricao: 'Excluiu permanentemente o cliente ' + r.nomeCliente, meta: { clienteId: cliente._id, apagado: r.contagem, arquivosPendentes: r.arquivosPendentes },
    });
    res.json({ mensagem: 'Cliente removido.', arquivosPendentes: r.arquivosPendentes });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover cliente.' });
  }
});

// GET /api/clientes/:id/setores/:setorId/impacto — o que "Remover tudo" vai apagar (números pro diálogo)
router.get('/:id/setores/:setorId/impacto', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  try {
    const cliente = await Cliente.exists({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.json(await ciclos.contarImpactoSetor(req.usuario.empresa._id, req.params.id, req.params.setorId));
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao calcular o que será apagado.' });
  }
});

// DELETE /api/clientes/:id/setores/:setorId?escopo=frente|todas[&mes=AAAA-MM] — tira o setor do cliente.
// 'frente': fecha a vigência do setor (fim = mês anterior ao escolhido; padrão: mês atual) e tira o setor da lista.
// Nada é apagado: lançamentos, documentos, configurações e particularidades ficam guardados, os meses anteriores
// seguem visíveis (somente leitura) e, se o setor voltar, o que foi guardado volta a ser usado.
// 'todas': apaga de vez, tudo ou nada (ver ciclosCliente.removerSetorTudo): vigência, lançamentos, documentos
// (registro + arquivo), configurações e particularidades. O setor, se voltar, nasce limpo.
router.delete('/:id/setores/:setorId', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  try {
    const { escopo } = req.query;
    if (!['frente', 'todas'].includes(escopo)) return res.status(400).json({ erro: 'Escopo inválido.' });

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).select('razaoSocial setores vigenciaDemanda').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    const setor = await Setor.findOne({ _id: req.params.setorId, empresa: req.usuario.empresa._id }).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    const empresa = req.usuario.empresa._id;

    if (escopo === 'frente') {
      const mes = req.query.mes || V.mesAtualBrasilia();
      if (!V.mesDentroDaJanela(mes)) return res.status(400).json({ erro: 'Mês inválido: escolha entre 12 meses atrás e 12 meses à frente.' });
      const mesesForaDaVigencia = await ciclos.mesesComDadosQueSaem({
        empresaId: empresa, clienteId: cliente._id, antes: V.copiarEntradas(cliente),
        depois: V.fecharPeriodosAbertos(V.copiarEntradas(cliente), mes, setor._id), setorIds: [setor._id],
      });
      const { fimVigencia } = await ciclos.removerSetorDaquiPraFrente({ empresaId: empresa, cliente, setorId: setor._id, mes });
      registrarLog({ empresa, usuario: req.usuario._id, tipo: 'cliente_editado', categoria: 'cliente', descricao: `Removeu ${cliente.razaoSocial} do setor ${setor.nome} (daqui pra frente)` });
      ciclos.logVigencia({
        empresa, usuario: req.usuario._id,
        descricao: `Setor ${setor.nome} removido de ${cliente.razaoSocial} a partir de ${ciclos.nomeMes(mes)}: demandas até ${ciclos.nomeMes(fimVigencia)} continuam no histórico${ciclos.textoMesesForaDaVigencia(mesesForaDaVigencia)}`,
        meta: { clienteId: cliente._id, evento: 'setor_removido_frente', setor: setor._id, aPartirDe: mes, ...(mesesForaDaVigencia.length ? { mesesForaDaVigencia } : {}) },
      });
      return res.json({ mensagem: 'Setor removido daqui pra frente.', fimVigencia });
    }

    let r;
    try {
      r = await ciclos.removerSetorTudo({ empresaId: empresa, clienteId: cliente._id, setorId: setor._id, usuarioId: req.usuario._id });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ erro: err.message });
      console.error('Erro ao remover tudo do setor (nada foi apagado):', err);
      return res.status(500).json({ erro: 'Não foi possível remover o setor. Nada foi apagado — tente de novo.' });
    }
    registrarLog({
      empresa, usuario: req.usuario._id, tipo: 'cliente_editado', categoria: 'cliente',
      descricao: `Removeu ${cliente.razaoSocial} do setor ${setor.nome} e apagou todo o histórico (${r.lancamentos} lançamento(s), ${r.documentos} documento(s))`,
      meta: { clienteId: cliente._id, setor: setor._id, lancamentos: r.lancamentos, documentos: r.documentos, arquivosPendentes: r.arquivosPendentes },
    });
    res.json({ mensagem: 'Setor removido e histórico apagado.', lancamentos: r.lancamentos, documentos: r.documentos, arquivosPendentes: r.arquivosPendentes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao remover setor do cliente.' });
  }
});

// ── Demanda mensal por setor ──

// Cliente inativo: ninguém edita, nem titular. Mês corrente: quem tem acesso ao setor edita
// normalmente. Mês passado sem lançamento salvo ainda: dá pra preencher atrasado (útil pra
// empresa que começou a usar o sistema agora e quer registrar meses anteriores). Mês corrente e
// mês futuro sempre abertos pra quem tem acesso ao setor — dado de um mês que ainda não chegou
// não é definitivo, então não trava mesmo já tendo algo salvo ali. Só quando o mês realmente
// vira passado (o calendário avança) é que a trava passa a valer: fecha pra colaborador se já
// tem dado salvo, fecha pra colaborador comum — titular e o responsável designado do setor sempre
// podem reabrir e editar. Exceção: setor Contábil nunca trava, em nenhuma competência.
const podeEditarCompetencia = (usuario, setorId, competencia, clienteAtivo, setorNome, temDadosSalvos, responsavelSetor) => {
  if (!clienteAtivo) return false;
  const temAcesso = usuario.cargo === 'admin' || usuario.setores?.some(s => (s._id || s).toString() === setorId);
  if (!temAcesso) return false;
  const ehResponsavel = !!responsavelSetor && responsavelSetor.toString() === usuario._id.toString();
  if (usuario.cargo === 'admin' || ehResponsavel) return true;
  if (setorNome === 'contabil' || competencia >= competenciaAtualDoSetor(setorNome)) return true;
  return !temDadosSalvos;
};

const temAcessoAoSetor = (usuario, setorId) =>
  usuario.cargo === 'admin' || usuario.setores?.some(s => (s._id || s).toString() === setorId);

// Só o titular ou o responsável designado daquele setor podem MUDAR a configuração (situação do
// DP/Contábil, regime do Fiscal) — qualquer membro do setor continua podendo ver/preencher a
// Demanda normalmente (isso é `temAcessoAoSetor`, não muda). Setor sem responsável definido: só
// o titular pode mudar, até alguém ser designado.
const podeMudarConfigSetor = async (usuario, setorId) => {
  if (usuario.cargo === 'admin') return true;
  if (!setorId) return false;
  const setor = await Setor.findById(setorId).select('responsavel').lean();
  return !!setor?.responsavel && setor.responsavel.toString() === usuario._id.toString();
};

// Mesma normalização usada no frontend (CONFIG_DEMANDA é chaveado por nome de setor normalizado)
const normalizarNome = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// Garante que cliente.configSetores[setorNome] exista antes de gravar nele
const garantirConfigSetor = (cliente, setorNome) => {
  if (!cliente.configSetores) cliente.configSetores = {};
  if (!cliente.configSetores[setorNome]) cliente.configSetores[setorNome] = { situacao: null, camposExtras: [] };
  if (!cliente.configSetores[setorNome].camposExtras) cliente.configSetores[setorNome].camposExtras = [];
  return cliente.configSetores[setorNome];
};

// Situação da competência diante da vigência do setor (Spec B): fora da vigência / setor removido ficam só leitura.
const situacaoDaVigencia = (cliente, setorId, competencia) => {
  const periodos = V.periodosDoSetor(cliente, setorId);
  const foraDaVigencia = !periodos.some(p => V.periodoCobre(p, competencia));
  const setorAtribuido = (cliente.setores || []).some(s => String(s._id || s) === String(setorId));
  return { foraDaVigencia, setorAtribuido, bloqueadoPelaVigencia: foraDaVigencia || !setorAtribuido };
};

// POST /api/clientes/:id/vigencia/simular — antes de confirmar inativar, remover setor "daqui pra frente" ou ajustar a
// vigência, devolve os meses que já têm lançamento ou documento e vão ficar fora da vigência (Spec D, seção 3).
// Só calcula; usa as MESMAS funções das ações de verdade. Body: { acao: 'inativar'|'remover_setor'|'ajustar', mes, setorId, inicio, fim }
router.post('/:id/vigencia/simular', autenticar, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).select('vigenciaDemanda').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    const { acao, mes, setorId, inicio, fim } = req.body || {};
    const antes = V.copiarEntradas(cliente);
    let depois, setorIds = null;
    if (acao === 'inativar' || acao === 'remover_setor') {
      if (!V.mesValido(mes)) return res.status(400).json({ erro: 'Mês inválido.' });
      if (acao === 'remover_setor') {
        if (!setorId) return res.status(400).json({ erro: 'Setor é obrigatório.' });
        setorIds = [setorId];
      }
      depois = V.fecharPeriodosAbertos(antes, mes, acao === 'remover_setor' ? setorId : null);
    } else if (acao === 'ajustar') {
      if (!setorId) return res.status(400).json({ erro: 'Setor é obrigatório.' });
      const r = V.ajustarVigencia(antes, setorId, { inicio, fim });
      if (r.erro) return res.json({ meses: [], erro: r.erro });
      depois = r.entradas; setorIds = [setorId];
    } else {
      return res.status(400).json({ erro: 'Ação inválida.' });
    }
    res.json({ meses: await ciclos.mesesComDadosQueSaem({ empresaId: req.usuario.empresa._id, clienteId: cliente._id, antes, depois, setorIds }) });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao verificar os meses.' });
  }
});

// PATCH /api/clientes/:id/vigencia/:setorId — ajuste manual da vigência do setor (válvula de escape).
// Titular e responsável designado do setor (mesma regra de quem muda a configuração do setor — nenhuma permissão nova)
// ajustam o INÍCIO do primeiro período e o FIM do último. Body: { inicio, fim } em AAAA-MM; null = desde sempre / em aberto.
router.patch('/:id/vigencia/:setorId', autenticar, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).select('razaoSocial status vigenciaDemanda').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    const setor = await Setor.findOne({ _id: req.params.setorId, empresa: req.usuario.empresa._id }).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    if (!(await podeMudarConfigSetor(req.usuario, req.params.setorId))) {
      return res.status(403).json({ erro: 'Só o titular ou o responsável do setor pode ajustar a vigência da demanda.' });
    }
    const { inicio, fim } = req.body || {};
    const entradas = V.copiarEntradas(cliente);
    const antes = JSON.stringify(V.periodosDoSetor({ vigenciaDemanda: entradas }, setor._id));
    // Fim antes de meses com dado salvo não é mais bloqueado (Spec D): a tela avisa e pede "Confirmar mesmo assim",
    // igual ao diálogo de inativar, e os meses que saem da vigência ficam no histórico
    const r = V.ajustarVigencia(entradas, setor._id, { inicio, fim });
    if (r.erro) return res.status(400).json({ erro: r.erro });
    if (cliente.status === 'inativo' && V.periodosDoSetor({ vigenciaDemanda: r.entradas }, setor._id).some(p => !p.fim)) {
      return res.status(400).json({ erro: 'Cliente inativo: reative o cliente para reabrir a vigência.' });
    }
    const mesesForaDaVigencia = await ciclos.mesesComDadosQueSaem({ empresaId: req.usuario.empresa._id, clienteId: cliente._id, antes: entradas, depois: r.entradas, setorIds: [setor._id] });
    await Cliente.updateOne({ _id: cliente._id }, { $set: { vigenciaDemanda: r.entradas } });
    const depois = V.periodosDoSetor({ vigenciaDemanda: r.entradas }, setor._id);
    ciclos.logVigencia({
      empresa: req.usuario.empresa._id, usuario: req.usuario._id,
      descricao: `Ajustou a vigência de ${setor.nome} de ${cliente.razaoSocial}${ciclos.textoMesesForaDaVigencia(mesesForaDaVigencia)}`,
      meta: { clienteId: cliente._id, evento: 'vigencia_ajustada', setor: setor._id, antes: JSON.parse(antes), depois, ...(mesesForaDaVigencia.length ? { mesesForaDaVigencia } : {}) },
    });
    res.json({ periodos: depois });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao ajustar a vigência.' });
  }
});

// GET /api/clientes/:id/lancamentos/:setorId — lista os lançamentos já salvos (pra montar as pastas de ano/mês)
router.get('/:id/lancamentos/:setorId', autenticar, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const lancamentos = await LancamentoSetor.find({
      cliente: req.params.id,
      setor: req.params.setorId,
      empresa: req.usuario.empresa._id,
    }).sort({ competencia: -1 }).populate('preenchidoPor', 'nome').lean();

    res.json(lancamentos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar histórico.' });
  }
});

// GET /api/clientes/:id/lancamentos/:setorId/:competencia — lançamento de uma competência específica (ou vazio)
router.get('/:id/lancamentos/:setorId/:competencia', autenticar, async (req, res) => {
  try {
    const { competencia } = req.params;
    if (!/^\d{4}-\d{2}$/.test(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const setor = await Setor.findById(req.params.setorId).select('nome responsavel').lean();
    const setorNome = normalizarNome(setor?.nome || '');

    const lancamento = await LancamentoSetor.findOne({
      cliente: req.params.id, setor: req.params.setorId, competencia, empresa: req.usuario.empresa._id,
    }).populate('preenchidoPor', 'nome').lean();

    const base = lancamento || { cliente: req.params.id, setor: req.params.setorId, competencia, dados: {}, preenchidoPor: null, preenchidoEm: null };
    // Resolvido aqui, uma vez só: pro mês atual, a última entrada do histórico já É o valor ao
    // vivo (é o que as rotas de escrita mantêm); pra mês passado, resolve pro que valia então.
    res.json({
      ...base,
      preenchido: !!lancamento,
      podeEditar: !situacaoDaVigencia(cliente, req.params.setorId, competencia).bloqueadoPelaVigencia
        && podeEditarCompetencia(req.usuario, req.params.setorId, competencia, cliente.status !== 'inativo', setorNome, !!lancamento, setor?.responsavel),
      ...situacaoDaVigencia(cliente, req.params.setorId, competencia),
      regimeResolvido: resolverPorVigencia(cliente.historicoRegime, competencia, cliente.regime),
      situacaoResolvida: resolverPorVigencia(cliente.configSetores?.[setorNome]?.historicoSituacao, competencia, cliente.configSetores?.[setorNome]?.situacao),
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar lançamento.' });
  }
});

// POST /api/clientes/:id/lancamentos/:setorId/:competencia — cria ou atualiza o lançamento daquela competência
router.post('/:id/lancamentos/:setorId/:competencia', autenticar, async (req, res) => {
  try {
    const { competencia } = req.params;
    if (!/^\d{4}-\d{2}$/.test(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const setor = await Setor.findById(req.params.setorId).select('nome responsavel').lean();
    const setorNome = normalizarNome(setor?.nome || '');

    const jaExiste = await LancamentoSetor.exists({
      cliente: req.params.id, setor: req.params.setorId, competencia, empresa: req.usuario.empresa._id,
    });

    // Mês fora da vigência da demanda, ou setor já removido do cliente: só leitura, ninguém preenche
    const vig = situacaoDaVigencia(cliente, req.params.setorId, competencia);
    if (vig.foraDaVigencia) return res.status(403).json({ erro: 'Este mês está fora da vigência da demanda deste setor — não dá pra preencher.' });
    if (!vig.setorAtribuido) return res.status(403).json({ erro: 'Este setor foi removido do cliente — somente leitura.' });

    if (!podeEditarCompetencia(req.usuario, req.params.setorId, competencia, cliente.status !== 'inativo', setorNome, !!jaExiste, setor?.responsavel)) {
      const temAcesso = req.usuario.cargo === 'admin' || req.usuario.setores?.some(s => (s._id || s).toString() === req.params.setorId);
      const motivo = cliente.status === 'inativo'
        ? 'Cliente inativo — reative pra poder editar.'
        : (!temAcesso ? 'Você não tem acesso a este setor.' : 'Esta competência já tem dado salvo — só o titular ou o responsável do setor podem editar.');
      return res.status(403).json({ erro: motivo });
    }

    const { dados } = req.body;
    const lancamento = await LancamentoSetor.findOneAndUpdate(
      { cliente: req.params.id, setor: req.params.setorId, competencia, empresa: req.usuario.empresa._id },
      { $set: { dados: dados || {}, preenchidoPor: req.usuario._id, preenchidoEm: new Date() } },
      { new: true, upsert: true }
    ).populate('preenchidoPor', 'nome');

    res.json({ ...lancamento.toObject(), preenchido: true, podeEditar: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao salvar lançamento.' });
  }
});

// POST /api/clientes/:id/campos-extras/:setorId — cria um campo personalizado de Demanda, específico deste cliente
router.post('/:id/campos-extras/:setorId', autenticar, async (req, res) => {
  try {
    if (!temAcessoAoSetor(req.usuario, req.params.setorId)) {
      return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });
    }
    const { label, tipo } = req.body;
    if (!label?.trim()) return res.status(400).json({ erro: 'Nome do campo é obrigatório.' });

    const setor = await Setor.findById(req.params.setorId).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    const setorNome = normalizarNome(setor.nome);

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status === 'inativo') return res.status(403).json({ erro: 'Cliente inativo — reative pra poder editar.' });

    const configSetor = garantirConfigSetor(cliente, setorNome);

    const slug = label.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'campo';
    let id = slug;
    let n = 1;
    while (configSetor.camposExtras.some(c => c.id === id)) { n++; id = `${slug}_${n}`; }

    const tiposValidos = ['moeda', 'texto', 'numero', 'booleano'];
    configSetor.camposExtras.push({
      id,
      label: label.trim(),
      tipo: tiposValidos.includes(tipo) ? tipo : 'moeda',
      ativo: true,
    });

    cliente.markModified('configSetores');
    await cliente.save();

    res.status(201).json(cliente.configSetores[setorNome]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar campo.' });
  }
});

// PATCH /api/clientes/:id/campos-extras/:setorId/:campoId — ativa/desativa um campo adicional
// (mesmo padrão do banco: não apaga os valores já salvos em LancamentoSetor de meses anteriores,
// só tira o campo do formulário de preenchimento dali em diante)
router.patch('/:id/campos-extras/:setorId/:campoId', autenticar, async (req, res) => {
  try {
    if (!temAcessoAoSetor(req.usuario, req.params.setorId)) {
      return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });
    }
    const { ativo } = req.body;

    const setor = await Setor.findById(req.params.setorId).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    const setorNome = normalizarNome(setor.nome);

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status === 'inativo') return res.status(403).json({ erro: 'Cliente inativo — reative pra poder editar.' });

    const configSetor = garantirConfigSetor(cliente, setorNome);
    const campo = configSetor.camposExtras?.find(c => c.id === req.params.campoId);
    if (!campo) return res.status(404).json({ erro: 'Campo não encontrado.' });
    campo.ativo = !!ativo;

    cliente.markModified('configSetores');
    await cliente.save();

    res.json(cliente.configSetores[setorNome]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar campo.' });
  }
});

// DELETE /api/clientes/:id/campos-extras/:setorId/:campoId — exclusão permanente (apaga também os
// valores salvos em meses anteriores). Só permitida com o campo já inativo, mesmo padrão de
// "inativar antes de excluir" usado no resto do sistema (Setor/Equipe/Modelos/banco).
router.delete('/:id/campos-extras/:setorId/:campoId', autenticar, async (req, res) => {
  try {
    if (!temAcessoAoSetor(req.usuario, req.params.setorId)) {
      return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });
    }

    const setor = await Setor.findById(req.params.setorId).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    const setorNome = normalizarNome(setor.nome);

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status === 'inativo') return res.status(403).json({ erro: 'Cliente inativo — reative pra poder editar.' });

    const configSetor = garantirConfigSetor(cliente, setorNome);
    const campo = configSetor.camposExtras?.find(c => c.id === req.params.campoId);
    if (!campo) return res.status(404).json({ erro: 'Campo não encontrado.' });
    if (campo.ativo !== false) return res.status(400).json({ erro: 'Remova o campo antes de excluir de vez.' });

    configSetor.camposExtras = configSetor.camposExtras.filter(c => c.id !== req.params.campoId);

    cliente.markModified('configSetores');
    await cliente.save();

    res.json(cliente.configSetores[setorNome]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir campo.' });
  }
});

// PATCH /api/clientes/:id/config-setor/:setorId — salva a "situação" (resposta da pergunta inicial) do setor pra este cliente
router.patch('/:id/config-setor/:setorId', autenticar, async (req, res) => {
  try {
    if (!temAcessoAoSetor(req.usuario, req.params.setorId)) {
      return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });
    }
    const { situacao, modoVigencia } = req.body;
    if (!situacao) return res.status(400).json({ erro: 'Situação é obrigatória.' });

    const setor = await Setor.findById(req.params.setorId).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    const setorNome = normalizarNome(setor.nome);

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status === 'inativo') return res.status(403).json({ erro: 'Cliente inativo — reative pra poder editar.' });

    const configSetor = garantirConfigSetor(cliente, setorNome);
    const situacaoAntiga = configSetor.situacao;

    if (situacaoAntiga && situacaoAntiga !== situacao) {
      // Responder a primeira vez é liberado pra quem tem acesso ao setor — mas MUDAR uma
      // situação já definida só pode quem é titular ou o responsável designado do setor.
      if (!(await podeMudarConfigSetor(req.usuario, req.params.setorId))) {
        return res.status(403).json({ erro: 'Só o titular ou o responsável deste setor pode mudar essa configuração.' });
      }
      const modo = modoVigencia === 'inicio' ? 'inicio' : 'agora';
      const { historico, competenciaMaisAntiga } = await prepararHistoricoParaMudanca({
        historicoAtual: configSetor.historicoSituacao,
        valorAntigo: situacaoAntiga,
        modo,
        clienteId: cliente._id,
        setorId: req.params.setorId,
        criadoEmCliente: cliente.criadoEm,
      });
      configSetor.historicoSituacao = aplicarMudancaComHistorico(historico, situacao, modo, competenciaMaisAntiga);
    }
    configSetor.situacao = situacao;

    cliente.markModified('configSetores');
    await cliente.save();

    res.json(cliente.configSetores[setorNome]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao salvar configuração do setor.' });
  }
});

// POST /api/clientes/:id/particularidades/:setorId — adiciona uma anotação de particularidade (lista, não sobrescreve)
router.post('/:id/particularidades/:setorId', autenticar, async (req, res) => {
  try {
    if (!temAcessoAoSetor(req.usuario, req.params.setorId)) {
      return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });
    }
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ erro: 'Escreva algo antes de salvar.' });

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status === 'inativo') return res.status(403).json({ erro: 'Cliente inativo — reative pra poder editar.' });

    cliente.particularidadesSetor.push({ setor: req.params.setorId, texto: texto.trim(), atualizadoPor: req.usuario._id, atualizadoEm: new Date() });
    await cliente.save();

    const populado = await Cliente.findById(cliente._id).populate('particularidadesSetor.atualizadoPor', 'nome').lean();
    const lista = populado.particularidadesSetor
      .filter(p => p.setor.toString() === req.params.setorId)
      .sort((a, b) => b.atualizadoEm - a.atualizadoEm);
    res.status(201).json(lista);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao salvar particularidades.' });
  }
});

// POST /api/clientes/:id/bancos/:setorId — adiciona um banco na lista de extratos do cliente (Contábil)
router.post('/:id/bancos/:setorId', autenticar, async (req, res) => {
  try {
    if (!temAcessoAoSetor(req.usuario, req.params.setorId)) {
      return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });
    }
    const { nome, competencia } = req.body;
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome do banco é obrigatório.' });
    if (competencia && !/^\d{4}-\d{2}$/.test(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });

    const setor = await Setor.findById(req.params.setorId).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    const setorNome = normalizarNome(setor.nome);

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status === 'inativo') return res.status(403).json({ erro: 'Cliente inativo — reative pra poder editar.' });

    const configSetor = garantirConfigSetor(cliente, setorNome);
    if (!configSetor.bancos) configSetor.bancos = [];

    const slug = nome.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'banco';
    let id = slug;
    let n = 1;
    while (configSetor.bancos.some(b => b.id === id)) { n++; id = `${slug}_${n}`; }

    // adicionadoNaCompetencia usa a competência que a pessoa está navegando (não a data real do
    // calendário) — é a partir dela que o banco passa a aparecer nas telas de Demanda.
    configSetor.bancos.push({ id, nome: nome.trim(), ativo: true, adicionadoNaCompetencia: competencia || competenciaAtual() });

    cliente.markModified('configSetores');
    await cliente.save();

    res.status(201).json(cliente.configSetores[setorNome]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao adicionar banco.' });
  }
});

// PATCH /api/clientes/:id/bancos/:setorId/:bancoId — ativa/desativa um banco (não apaga histórico dos meses anteriores)
router.patch('/:id/bancos/:setorId/:bancoId', autenticar, async (req, res) => {
  try {
    if (!temAcessoAoSetor(req.usuario, req.params.setorId)) {
      return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });
    }
    const { ativo, competencia } = req.body;
    if (competencia && !/^\d{4}-\d{2}$/.test(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });

    const setor = await Setor.findById(req.params.setorId).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    const setorNome = normalizarNome(setor.nome);

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status === 'inativo') return res.status(403).json({ erro: 'Cliente inativo — reative pra poder editar.' });

    const configSetor = garantirConfigSetor(cliente, setorNome);
    const banco = configSetor.bancos?.find(b => b.id === req.params.bancoId);
    if (!banco) return res.status(404).json({ erro: 'Banco não encontrado.' });
    banco.ativo = !!ativo;
    // Mesma lógica da competência navegada (não data real) usada na criação — a desativação só
    // vale a partir dela em diante, meses anteriores continuam mostrando o banco normalmente.
    if (!banco.ativo) {
      banco.desativadoNaCompetencia = competencia || competenciaAtual();
    } else {
      banco.desativadoNaCompetencia = undefined;
    }

    cliente.markModified('configSetores');
    await cliente.save();

    res.json(cliente.configSetores[setorNome]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar banco.' });
  }
});

// DELETE /api/clientes/:id/bancos/:setorId/:bancoId — exclusão permanente (apaga também o
// histórico de conferência em meses anteriores). Só permitida com o banco já inativo, mesmo
// padrão de "inativar antes de excluir" usado no resto do sistema (Setor/Equipe/Modelos).
router.delete('/:id/bancos/:setorId/:bancoId', autenticar, async (req, res) => {
  try {
    if (!temAcessoAoSetor(req.usuario, req.params.setorId)) {
      return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });
    }

    const setor = await Setor.findById(req.params.setorId).select('nome').lean();
    if (!setor) return res.status(404).json({ erro: 'Setor não encontrado.' });
    const setorNome = normalizarNome(setor.nome);

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status === 'inativo') return res.status(403).json({ erro: 'Cliente inativo — reative pra poder editar.' });

    const configSetor = garantirConfigSetor(cliente, setorNome);
    const banco = configSetor.bancos?.find(b => b.id === req.params.bancoId);
    if (!banco) return res.status(404).json({ erro: 'Banco não encontrado.' });
    if (banco.ativo !== false) return res.status(400).json({ erro: 'Remova o banco antes de excluir de vez.' });

    configSetor.bancos = configSetor.bancos.filter(b => b.id !== req.params.bancoId);

    cliente.markModified('configSetores');
    await cliente.save();

    res.json(cliente.configSetores[setorNome]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir banco.' });
  }
});

// Reaproveitadas por routes/documento.js — mesmas regras de acesso a setor já usadas pra Demanda
module.exports = router;
module.exports.temAcessoAoSetor = temAcessoAoSetor;
module.exports.podeMudarConfigSetor = podeMudarConfigSetor;

// POST /api/clientes/importar — importar lista de clientes
router.post('/importar', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  try {
    const { clientes } = req.body;
    if (!clientes?.length) return res.status(400).json({ erro: 'Nenhum cliente para importar.' });

    const resultados = { importados: 0, atualizados: 0, ignorados: 0, erros: [] };
    const importadosInativos = [];

    for (const c of clientes) {
      try {
        if (!c.razaoSocial?.trim()) { resultados.ignorados++; continue; }
        const validacao = clienteCreateSchema.safeParse(c);
        if (!validacao.success) {
          resultados.ignorados++;
          resultados.erros.push(`${c.razaoSocial}: ${validacao.error.issues[0]?.message || 'dado inválido'}`);
          continue;
        }
        const tipoPessoa = tipoPessoaDoDocumento(c.cnpj);
        // CNPJ/CPF já cadastrado: atualiza o registro existente com os dados mais recentes em vez de duplicar
        if (c.cnpj) {
          const cnpjLimpo = c.cnpj.replace(/\D/g, '');
          const existente = await Cliente.findOne({ empresa: req.usuario.empresa._id, cnpj: cnpjRegexTolerante(cnpjLimpo) });
          if (existente) {
            await mesclarCadastro(existente, { ...c, tipoPessoa });
            await existente.save();
            resultados.atualizados++;
            continue;
          }
        }
        const comecaEm = V.mesValido(c.demandaComecaEm) ? c.demandaComecaEm : null;
        const novo = new Cliente({
          ...c,
          tipoPessoa,
          historicoRegime: c.regime ? [{ valor: c.regime, vigenteDesde: competenciaAtual() }] : [],
          empresa: req.usuario.empresa._id,
          criadoPor: req.usuario._id,
          status: c.status || 'ativo',
          servicosContratados: [],
          socios: c.socios || [],
          vigenciaDemanda: [], // vigência só o servidor grava
        });
        // Setores vindos da planilha: demanda desde sempre (ou a partir de "A demanda começa em"). Cliente que já vem
        // inativo na planilha: a data em que foi inativado é desconhecida → sem período (REGRAS_DEMANDA.md, linha 11)
        if (novo.status !== 'inativo') novo.vigenciaDemanda = ciclos.entradasAoAdicionarSetores([], novo.setores.map(String), { comecaEm, mesAtual: V.mesAtualBrasilia() });
        await novo.save();
        if (novo.status === 'inativo') importadosInativos.push(novo.razaoSocial);
        resultados.importados++;
      } catch (err) {
        resultados.erros.push(`${c.razaoSocial}: ${err.message}`);
        resultados.ignorados++;
      }
    }

    // Registrar no histórico
    if (resultados.importados > 0 || resultados.atualizados > 0) {
      const registrarLog = require('../services/log');
      registrarLog({
        empresa: req.usuario.empresa._id,
        usuario: req.usuario._id,
        tipo: 'clientes_importados',
        categoria: 'cliente',
        descricao: `Importou ${resultados.importados} cliente(s) e atualizou ${resultados.atualizados} via planilha Excel`,
        meta: { total: resultados.importados, atualizados: resultados.atualizados }
      });
    }
    if (importadosInativos.length) ciclos.logVigencia({
      empresa: req.usuario.empresa._id, usuario: req.usuario._id,
      descricao: `${importadosInativos.length} cliente(s) importado(s) já como inativo(s): sem demanda (data de inativação desconhecida)`,
      meta: { evento: 'importados_inativos', clientes: importadosInativos.slice(0, 50) },
    });
    res.json(resultados);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao importar clientes.' });
  }
});
