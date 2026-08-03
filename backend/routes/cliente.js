const express = require('express');
const registrarLog = require('../services/log');
const { autenticar, temPermissao } = require('../middleware/auth');
const Cliente = require('../models/Cliente');
const Implantacao = require('../models/Implantacao');
const LancamentoSetor = require('../models/LancamentoSetor');
const Setor = require('../models/Setor');
const { clienteCreateSchema, clienteUpdateSchema, validar } = require('../validacao');
const { competenciaAtual, resolverPorVigencia, aplicarMudancaComHistorico, buscarCompetenciaMaisAntiga, prepararHistoricoParaMudanca } = require('../services/historicoVigencia');

const router = express.Router();

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
      .populate('setores', 'nome cor').sort({ criadoEm: -1 }).lean();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar clientes.' });
  }
});

// GET /api/clientes/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id })
      .populate('criadoPor', 'nome').populate('setores', 'nome cor')
      .populate('particularidadesSetor.atualizadoPor', 'nome').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    // Buscar onboardings vinculados ao CNPJ do cliente
    const cnpjLimpo = cliente.cnpj?.replace(/\D/g, '');
    const onboardings = cnpjLimpo
      ? await Implantacao.find({ empresa: req.usuario.empresa._id, cnpj: cnpjRegexTolerante(cnpjLimpo) })
          .select('nomeCliente status criadoEm etapas')
          .populate('modelo', 'nome')
          .sort({ criadoEm: -1 })
          .lean()
      : [];

    res.json({ ...cliente, onboardings });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar cliente.' });
  }
});

// POST /api/clientes
router.post('/', autenticar, temPermissao('gerenciarClientes'), validar(clienteCreateSchema), async (req, res) => {
  const { razaoSocial, cnpj, regime, porte, servicosContratados } = req.body;
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
    const cliente = await Cliente.create({
      ...req.body,
      razaoSocial: razaoSocial.trim(),
      tipoPessoa,
      historicoRegime: regime ? [{ valor: regime, vigenteDesde: competenciaAtual() }] : [],
      empresa: req.usuario.empresa._id,
      criadoPor: req.usuario._id,
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
    const { empresa, criadoPor, _id, criadoEm, modoVigenciaRegime, ...dados } = req.body;
    if (dados.cnpj !== undefined) dados.tipoPessoa = tipoPessoaDoDocumento(dados.cnpj);

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    // Regime mudou de verdade (não é edição inicial nem o mesmo valor) — decide a vigência
    // conforme a escolha do usuário no diálogo (default 'agora' se não vier, ex: fluxos antigos).
    if (dados.regime !== undefined && dados.regime !== cliente.regime && cliente.regime) {
      const modo = modoVigenciaRegime === 'inicio' ? 'inicio' : 'agora';
      const setorFiscal = await Setor.findOne({ empresa: cliente.empresa, nome: /^fiscal$/i, ativo: true }).select('_id').lean();
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

    Object.assign(cliente, dados);
    await cliente.save();
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'cliente_editado', categoria: 'cliente', descricao: 'Editou o cliente ' + cliente.razaoSocial });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar cliente.' });
  }
});

// DELETE /api/clientes/:id
router.delete('/:id', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  try {
    const cliente = await Cliente.findOneAndDelete({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (cliente) registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'cliente_excluido', categoria: 'cliente', descricao: 'Removeu o cliente ' + cliente.razaoSocial });
    res.json({ mensagem: 'Cliente removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover cliente.' });
  }
});

// ── Demanda mensal por setor ──

// Cliente inativo: ninguém edita, nem titular. Mês corrente: quem tem acesso ao setor edita
// normalmente. Mês passado sem lançamento salvo ainda: dá pra preencher atrasado (útil pra
// empresa que começou a usar o sistema agora e quer registrar meses anteriores). Mês passado
// que já tem dado salvo: fecha pra colaborador, só o titular pode reabrir e editar.
// Exceção: setor Contábil nunca trava, nem por mês nem por dado já salvo.
const podeEditarCompetencia = (usuario, setorId, competencia, clienteAtivo, setorNome, temDadosSalvos) => {
  if (!clienteAtivo) return false;
  const temAcesso = usuario.cargo === 'admin' || usuario.setores?.some(s => (s._id || s).toString() === setorId);
  if (!temAcesso) return false;
  if (usuario.cargo === 'admin') return true;
  if (setorNome === 'contabil' || competencia === competenciaAtual()) return true;
  if (competencia > competenciaAtual()) return false; // competência futura não é editável por colaborador
  return !temDadosSalvos;
};

const temAcessoAoSetor = (usuario, setorId) =>
  usuario.cargo === 'admin' || usuario.setores?.some(s => (s._id || s).toString() === setorId);

// Mesma normalização usada no frontend (CONFIG_DEMANDA é chaveado por nome de setor normalizado)
const normalizarNome = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// Garante que cliente.configSetores[setorNome] exista antes de gravar nele
const garantirConfigSetor = (cliente, setorNome) => {
  if (!cliente.configSetores) cliente.configSetores = {};
  if (!cliente.configSetores[setorNome]) cliente.configSetores[setorNome] = { situacao: null, camposExtras: [] };
  return cliente.configSetores[setorNome];
};

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

    const setor = await Setor.findById(req.params.setorId).select('nome').lean();
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
      podeEditar: podeEditarCompetencia(req.usuario, req.params.setorId, competencia, cliente.status !== 'inativo', setorNome, !!lancamento),
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
    if (competencia > competenciaAtual()) return res.status(400).json({ erro: 'Não é possível lançar uma competência futura.' });

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const setor = await Setor.findById(req.params.setorId).select('nome').lean();
    const setorNome = normalizarNome(setor?.nome || '');

    const jaExiste = await LancamentoSetor.exists({
      cliente: req.params.id, setor: req.params.setorId, competencia, empresa: req.usuario.empresa._id,
    });

    if (!podeEditarCompetencia(req.usuario, req.params.setorId, competencia, cliente.status !== 'inativo', setorNome, !!jaExiste)) {
      const temAcesso = req.usuario.cargo === 'admin' || req.usuario.setores?.some(s => (s._id || s).toString() === req.params.setorId);
      const motivo = cliente.status === 'inativo'
        ? 'Cliente inativo — reative pra poder editar.'
        : (!temAcesso ? 'Você não tem acesso a este setor.' : 'Esta competência já tem dado salvo — só o titular pode editar.');
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
    });

    cliente.markModified('configSetores');
    await cliente.save();

    res.status(201).json(cliente.configSetores[setorNome]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar campo.' });
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
    const { nome } = req.body;
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome do banco é obrigatório.' });

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

    configSetor.bancos.push({ id, nome: nome.trim(), ativo: true });

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
    const { ativo } = req.body;

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

    cliente.markModified('configSetores');
    await cliente.save();

    res.json(cliente.configSetores[setorNome]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar banco.' });
  }
});

module.exports = router;

// POST /api/clientes/importar — importar lista de clientes
router.post('/importar', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  try {
    const { clientes } = req.body;
    if (!clientes?.length) return res.status(400).json({ erro: 'Nenhum cliente para importar.' });

    const resultados = { importados: 0, atualizados: 0, ignorados: 0, erros: [] };

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
        await Cliente.create({
          ...c,
          tipoPessoa,
          historicoRegime: c.regime ? [{ valor: c.regime, vigenteDesde: competenciaAtual() }] : [],
          empresa: req.usuario.empresa._id,
          criadoPor: req.usuario._id,
          status: c.status || 'ativo',
          servicosContratados: [],
          socios: c.socios || [],
        });
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
    res.json(resultados);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao importar clientes.' });
  }
});
