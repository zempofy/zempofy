const express = require('express');
const mongoose = require('mongoose');
const registrarLog = require('../services/log');
const { autenticar, apenasAdmin, apenasContabil } = require('../middleware/auth');
const Cliente = require('../models/Cliente');
const ControleRetiradas = require('../models/ControleRetiradas');
const RetiradaMes = require('../models/RetiradaMes');
const ApuracaoTrimestre = require('../models/ApuracaoTrimestre');
const { resolverPorVigencia } = require('../services/historicoVigencia');
const {
  PARAMETROS, round2, totalDoSocioMes, calcularSocioMes, trimestreDaCompetencia, calcularTrimestre,
} = require('../services/retiradas');
const {
  retiradasControleCreateSchema, retiradasSociosUpdateSchema, retiradaMesSchema, apuracaoTrimestreSchema,
  competenciaValida, cpfDuplicadoEntreAtivos, validarECorrigir,
} = require('../validacao');

// Contábil › Retiradas de sócios. Montado em /api/contabil/retiradas.
// Acesso: só titular e membros do setor Contábil (apenasContabil), em todas as rotas.
const router = express.Router();
router.use(autenticar, apenasContabil);

// ── Helpers ──

const normalizarNome = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const soDigitos = (v = '') => String(v || '').replace(/\D/g, '');
const mascaraCPF = (d) => d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const nomeDoCliente = (c) => c?.razaoSocial || c?.nomeFantasia || '';
const competenciaLegivel = (competencia) => `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
const formatarReais = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const erroClienteInativo = (res) => res.status(403).json({ erro: 'Cliente inativo — reative o cadastro pra poder editar.' });
const erroControleInativo = (res) => res.status(403).json({ erro: 'Controle de retiradas inativo — reative a empresa pra poder editar.' });

// Carrega cliente + controle da empresa logada. Responde 404 sozinho e devolve null quando não acha.
const carregarControle = async (req, res) => {
  const { clienteId } = req.params;
  if (!mongoose.isValidObjectId(clienteId)) {
    res.status(404).json({ erro: 'Empresa não encontrada.' });
    return null;
  }
  const empresa = req.usuario.empresa._id;
  const [cliente, controle] = await Promise.all([
    Cliente.findOne({ _id: clienteId, empresa }),
    ControleRetiradas.findOne({ empresa, cliente: clienteId }),
  ]);
  if (!cliente || !controle) {
    res.status(404).json({ erro: 'Controle de retiradas não encontrado.' });
    return null;
  }
  return { cliente, controle };
};

// Sócios do controle em formato de resposta (ids como string).
const sociosParaResposta = (socios) => socios.map(s => ({
  _id: s._id.toString(),
  nome: s.nome,
  cpf: s.cpf || '',
  percentual: s.percentual ?? null,
  ativo: s.ativo !== false,
  inativadoEm: s.inativadoEm || null,
}));

// Soma, por sócio, as retiradas de uma lista de RetiradaMes. Retorna Map socioId → total.
const totaisPorSocio = (docs) => {
  const mapa = new Map();
  for (const d of docs) {
    const id = d.socioId.toString();
    mapa.set(id, round2((mapa.get(id) || 0) + totalDoSocioMes(d)));
  }
  return mapa;
};

// Consolida o mês de uma empresa a partir das RetiradaMes daquela competência.
const resumirMes = (docsDoMes) => {
  let distribuido = 0, tributavel = 0, irrf = 0, algumTributavel = false;
  for (const total of totaisPorSocio(docsDoMes).values()) {
    const calc = calcularSocioMes(total);
    distribuido = round2(distribuido + calc.total);
    tributavel = round2(tributavel + calc.tributavel);
    irrf = round2(irrf + calc.irrf);
    if (calc.situacao === 'tributavel') algumTributavel = true;
  }
  return { distribuido, tributavel, irrf, algumTributavel };
};

// Sincroniza Cliente.socios com os sócios ATIVOS do controle (spec 4.5). Casa primeiro por CPF
// (quando os dois lados têm CPF completo), depois por nome normalizado nos que sobraram.
// Sócio casado preserva telefone/e-mail/qualificação do cadastro. Percentual não vai pro cadastro.
// updateOne em vez de cliente.save(): o save revalidaria o documento inteiro, e cadastro antigo com
// algum campo fora do padrão atual faria a sincronização falhar por um motivo que não tem a ver.
const sincronizarCadastro = async (cliente, controle, usuario) => {
  const ativos = controle.socios.filter(s => s.ativo !== false);
  const cadastro = (cliente.socios || []).map(s => (s.toObject ? s.toObject() : s));
  const usados = new Set();
  const pares = new Map(); // índice do ativo → índice no cadastro

  ativos.forEach((a, i) => {
    const cpfA = soDigitos(a.cpf);
    if (cpfA.length !== 11) return;
    const j = cadastro.findIndex((c, k) => !usados.has(k) && soDigitos(c.cpf) === cpfA);
    if (j >= 0) { usados.add(j); pares.set(i, j); }
  });
  ativos.forEach((a, i) => {
    if (pares.has(i)) return;
    const cpfA = soDigitos(a.cpf);
    const j = cadastro.findIndex((c, k) => {
      if (usados.has(k)) return false;
      const cpfC = soDigitos(c.cpf);
      if (cpfA.length === 11 && cpfC.length === 11) return false; // os dois têm CPF e não bateram
      return normalizarNome(c.nome) === normalizarNome(a.nome);
    });
    if (j >= 0) { usados.add(j); pares.set(i, j); }
  });

  const novos = ativos.map((a, i) => {
    const cpf = soDigitos(a.cpf).length === 11 ? mascaraCPF(soDigitos(a.cpf)) : '';
    if (pares.has(i)) {
      const c = cadastro[pares.get(i)];
      // CPF vazio no controle não apaga o que já estava no cadastro
      return { ...c, nome: a.nome, cpf: cpf || c.cpf || '' };
    }
    return { nome: a.nome, cpf, telefone: '', email: '', qualificacao: '' };
  });

  await Cliente.updateOne({ _id: cliente._id, empresa: cliente.empresa }, { $set: { socios: novos } });
  registrarLog({
    empresa: usuario.empresa._id,
    usuario: usuario._id,
    tipo: 'cliente_editado',
    descricao: `Atualizou os sócios de ${nomeDoCliente(cliente)} pelo controle de retiradas`,
    meta: { clienteId: cliente._id },
  });
};

// ── Rotas ──

// GET /api/contabil/retiradas/parametros — o frontend nunca fixa limite/alíquota na tela
router.get('/parametros', (req, res) => {
  res.json({ limiteMensal: PARAMETROS.limiteMensal, aliquota: PARAMETROS.aliquota });
});

// GET /api/contabil/retiradas?competencia=YYYY-MM — lista com o resumo do mês, tudo em lote (sem N+1)
router.get('/', async (req, res) => {
  try {
    const { competencia } = req.query;
    if (!competenciaValida(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });
    const empresa = req.usuario.empresa._id;

    const controles = await ControleRetiradas.find({ empresa }).lean();
    if (!controles.length) return res.json([]);
    const clienteIds = controles.map(c => c.cliente);
    const tri = trimestreDaCompetencia(competencia);

    const [clientes, retiradas, apuracoes] = await Promise.all([
      Cliente.find({ _id: { $in: clienteIds }, empresa })
        .select('razaoSocial nomeFantasia cnpj regime historicoRegime status').lean(),
      RetiradaMes.find({ empresa, cliente: { $in: clienteIds }, competencia: { $in: tri.meses } }).lean(),
      ApuracaoTrimestre.find({ empresa, cliente: { $in: clienteIds }, ano: tri.ano, trimestre: tri.trimestre }).lean(),
    ]);

    const clientePorId = new Map(clientes.map(c => [c._id.toString(), c]));
    const apuracaoPorCliente = new Map(apuracoes.map(a => [a.cliente.toString(), a]));
    const retiradasPorCliente = new Map();
    for (const r of retiradas) {
      const id = r.cliente.toString();
      if (!retiradasPorCliente.has(id)) retiradasPorCliente.set(id, []);
      retiradasPorCliente.get(id).push(r);
    }

    const resposta = [];
    for (const ctrl of controles) {
      const id = ctrl.cliente.toString();
      const cliente = clientePorId.get(id);
      if (!cliente) continue; // cadastro do cliente foi excluído — nada pra mostrar
      const doTrimestre = retiradasPorCliente.get(id) || [];
      const doMes = doTrimestre.filter(r => r.competencia === competencia);
      const mes = resumirMes(doMes);

      const apuracao = apuracaoPorCliente.get(id);
      const distribuidoTri = doTrimestre.reduce((s, r) => round2(s + totalDoSocioMes(r)), 0);
      const { excedente } = calcularTrimestre({
        lucroApurado: apuracao?.lucroApurado ?? null,
        saldoAnterior: apuracao?.saldoAnterior || 0,
        distribuido: distribuidoTri,
      });

      resposta.push({
        clienteId: id,
        nome: nomeDoCliente(cliente),
        cnpj: cliente.cnpj || '',
        regime: resolverPorVigencia(cliente.historicoRegime, competencia, cliente.regime),
        ativo: ctrl.ativo !== false,
        clienteAtivo: cliente.status !== 'inativo',
        qtdSocios: (ctrl.socios || []).filter(s => s.ativo !== false).length,
        totalMes: mes.distribuido,
        tributavelMes: mes.tributavel,
        irrfMes: mes.irrf,
        situacaoMes: !doMes.length ? 'sem_lancamento' : mes.algumTributavel ? 'acima_limite' : 'dentro_limite',
        acimaDoLucro: (excedente || 0) > 0,
      });
    }
    res.json(resposta);
  } catch (err) {
    console.error('Erro ao listar retiradas:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar as retiradas.' });
  }
});

// POST /api/contabil/retiradas — coloca uma empresa da carteira sob controle
router.post('/', validarECorrigir(retiradasControleCreateSchema), async (req, res) => {
  try {
    const { clienteId, socios, sincronizarCadastro: sincronizar } = req.body;
    const empresa = req.usuario.empresa._id;
    if (!mongoose.isValidObjectId(clienteId)) return res.status(404).json({ erro: 'Empresa não encontrada.' });
    if (!socios.length) return res.status(400).json({ erro: 'Informe pelo menos um sócio.' });

    const cliente = await Cliente.findOne({ _id: clienteId, empresa });
    if (!cliente) return res.status(404).json({ erro: 'Empresa não encontrada.' });
    if (cliente.status === 'inativo') return erroClienteInativo(res);
    if (cliente.tipoPessoa === 'fisica') return res.status(400).json({ erro: 'O controle de retiradas é só para pessoa jurídica.' });

    const existente = await ControleRetiradas.findOne({ empresa, cliente: clienteId }).select('ativo').lean();
    if (existente) {
      return res.status(409).json({
        erro: existente.ativo === false
          ? 'Esta empresa já tem controle de retiradas, mas está inativo. Reative-o na lista.'
          : 'Esta empresa já tem controle de retiradas.',
      });
    }

    const controle = await ControleRetiradas.create({
      empresa,
      cliente: clienteId,
      socios: socios.map(s => ({ nome: s.nome, cpf: s.cpf, percentual: s.percentual ?? null, ativo: true })),
      criadoPor: req.usuario._id,
    });

    if (sincronizar) await sincronizarCadastro(cliente, controle, req.usuario);

    registrarLog({
      empresa,
      usuario: req.usuario._id,
      tipo: 'retiradas_controle_criado',
      descricao: `Adicionou ${nomeDoCliente(cliente)} ao controle de retiradas`,
      meta: { clienteId },
    });

    res.status(201).json({ clienteId, socios: sociosParaResposta(controle.socios) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Esta empresa já tem controle de retiradas.' });
    console.error('Erro ao criar controle de retiradas:', err.message);
    res.status(500).json({ erro: 'Erro ao adicionar a empresa.' });
  }
});

// GET /api/contabil/retiradas/:clienteId — controle + todos os sócios (ativos e inativos)
// + sócios do cadastro, pro modal calcular o que mudaria numa sincronização
router.get('/:clienteId', async (req, res) => {
  try {
    const carregado = await carregarControle(req, res);
    if (!carregado) return;
    const { cliente, controle } = carregado;
    res.json({
      clienteId: cliente._id,
      nome: nomeDoCliente(cliente),
      cnpj: cliente.cnpj || '',
      ativo: controle.ativo !== false,
      inativadoEm: controle.inativadoEm,
      clienteAtivo: cliente.status !== 'inativo',
      socios: sociosParaResposta(controle.socios),
      sociosCadastro: (cliente.socios || []).map(s => ({ nome: s.nome || '', cpf: s.cpf || '' })),
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar o controle.' });
  }
});

// PATCH /api/contabil/retiradas/:clienteId/socios — item com _id = existente, sem _id = novo.
// Sócio existente que não veio na lista fica como está (nunca apaga por omissão).
router.patch('/:clienteId/socios', validarECorrigir(retiradasSociosUpdateSchema), async (req, res) => {
  try {
    const carregado = await carregarControle(req, res);
    if (!carregado) return;
    const { cliente, controle } = carregado;
    if (cliente.status === 'inativo') return erroClienteInativo(res);
    if (controle.ativo === false) return erroControleInativo(res);

    for (const item of req.body.socios) {
      if (item._id) {
        const socio = controle.socios.id(item._id);
        if (!socio) return res.status(400).json({ erro: `Sócio "${item.nome}" não encontrado neste controle.` });
        socio.nome = item.nome;
        socio.cpf = item.cpf;
        socio.percentual = item.percentual ?? null;
        if (typeof item.ativo === 'boolean' && item.ativo !== (socio.ativo !== false)) {
          socio.ativo = item.ativo;
          socio.inativadoEm = item.ativo ? null : new Date();
        }
      } else {
        const ativo = item.ativo !== false;
        controle.socios.push({ nome: item.nome, cpf: item.cpf, percentual: item.percentual ?? null, ativo, inativadoEm: ativo ? null : new Date() });
      }
    }

    // Revalida depois de mesclar: um CPF novo pode repetir o de um sócio ativo que não veio no payload
    if (cpfDuplicadoEntreAtivos(controle.socios)) return res.status(400).json({ erro: 'Há CPF repetido entre os sócios ativos.' });

    await controle.save();
    if (req.body.sincronizarCadastro) await sincronizarCadastro(cliente, controle, req.usuario);

    registrarLog({
      empresa: req.usuario.empresa._id,
      usuario: req.usuario._id,
      tipo: 'retiradas_socios_atualizados',
      descricao: `Atualizou os sócios de ${nomeDoCliente(cliente)} no controle de retiradas`,
      meta: { clienteId: cliente._id },
    });

    res.json({ socios: sociosParaResposta(controle.socios) });
  } catch (err) {
    console.error('Erro ao atualizar sócios do controle:', err.message);
    res.status(500).json({ erro: 'Erro ao salvar os sócios.' });
  }
});

// DELETE /api/contabil/retiradas/:clienteId/socios/:socioId — exclusão permanente, só titular e
// só de sócio já inativo. Leva junto as retiradas dele.
router.delete('/:clienteId/socios/:socioId', apenasAdmin, async (req, res) => {
  try {
    const carregado = await carregarControle(req, res);
    if (!carregado) return;
    const { cliente, controle } = carregado;
    if (cliente.status === 'inativo') return erroClienteInativo(res);

    const socio = mongoose.isValidObjectId(req.params.socioId) ? controle.socios.id(req.params.socioId) : null;
    if (!socio) return res.status(404).json({ erro: 'Sócio não encontrado.' });
    if (socio.ativo !== false) return res.status(400).json({ erro: 'Inative o sócio antes de excluir permanentemente.' });

    const nomeSocio = socio.nome;
    const { deletedCount } = await RetiradaMes.deleteMany({ empresa: req.usuario.empresa._id, cliente: cliente._id, socioId: socio._id });
    socio.deleteOne();
    await controle.save();

    registrarLog({
      empresa: req.usuario.empresa._id,
      usuario: req.usuario._id,
      tipo: 'retiradas_socios_atualizados',
      descricao: `Excluiu permanentemente o sócio ${nomeSocio} de ${nomeDoCliente(cliente)} (${deletedCount} ${deletedCount === 1 ? 'mês de retirada apagado' : 'meses de retirada apagados'})`,
      meta: { clienteId: cliente._id },
    });

    res.json({ ok: true, socios: sociosParaResposta(controle.socios) });
  } catch (err) {
    console.error('Erro ao excluir sócio do controle:', err.message);
    res.status(500).json({ erro: 'Erro ao excluir o sócio.' });
  }
});

// PATCH /api/contabil/retiradas/:clienteId/inativar | /reativar
const alterarAtivo = (ativo) => async (req, res) => {
  try {
    const carregado = await carregarControle(req, res);
    if (!carregado) return;
    const { cliente, controle } = carregado;
    if (cliente.status === 'inativo') return erroClienteInativo(res);

    controle.ativo = ativo;
    controle.inativadoEm = ativo ? null : new Date();
    await controle.save();

    registrarLog({
      empresa: req.usuario.empresa._id,
      usuario: req.usuario._id,
      tipo: ativo ? 'retiradas_controle_reativado' : 'retiradas_controle_inativado',
      descricao: `${ativo ? 'Reativou' : 'Inativou'} ${nomeDoCliente(cliente)} no controle de retiradas`,
      meta: { clienteId: cliente._id },
    });

    res.json({ ok: true, ativo });
  } catch (err) {
    res.status(500).json({ erro: `Erro ao ${ativo ? 'reativar' : 'inativar'} a empresa.` });
  }
};
router.patch('/:clienteId/inativar', alterarAtivo(false));
router.patch('/:clienteId/reativar', alterarAtivo(true));

// DELETE /api/contabil/retiradas/:clienteId — exclusão permanente do controle, só titular e só
// depois de inativo. Apaga junto as retiradas e apurações da empresa (o cadastro do cliente fica).
router.delete('/:clienteId', apenasAdmin, async (req, res) => {
  try {
    const carregado = await carregarControle(req, res);
    if (!carregado) return;
    const { cliente, controle } = carregado;
    if (cliente.status === 'inativo') return erroClienteInativo(res);
    if (controle.ativo !== false) return res.status(400).json({ erro: 'Inative a empresa antes de excluir permanentemente.' });

    const empresa = req.usuario.empresa._id;
    await Promise.all([
      RetiradaMes.deleteMany({ empresa, cliente: cliente._id }),
      ApuracaoTrimestre.deleteMany({ empresa, cliente: cliente._id }),
    ]);
    await ControleRetiradas.deleteOne({ _id: controle._id });

    registrarLog({
      empresa,
      usuario: req.usuario._id,
      tipo: 'retiradas_controle_excluido_permanente',
      descricao: `Excluiu permanentemente ${nomeDoCliente(cliente)} do controle de retiradas`,
      meta: { clienteId: cliente._id },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir controle de retiradas:', err.message);
    res.status(500).json({ erro: 'Erro ao excluir a empresa do controle.' });
  }
});

// GET /api/contabil/retiradas/:clienteId/mes/:competencia — detalhe do mês + painel do trimestre
router.get('/:clienteId/mes/:competencia', async (req, res) => {
  try {
    const { competencia } = req.params;
    if (!competenciaValida(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });
    const carregado = await carregarControle(req, res);
    if (!carregado) return;
    const { cliente, controle } = carregado;
    const empresa = req.usuario.empresa._id;
    const tri = trimestreDaCompetencia(competencia);

    const [retiradas, apuracao] = await Promise.all([
      RetiradaMes.find({ empresa, cliente: cliente._id, competencia: { $in: tri.meses } }).lean(),
      ApuracaoTrimestre.findOne({ empresa, cliente: cliente._id, ano: tri.ano, trimestre: tri.trimestre }).lean(),
    ]);

    const doMes = retiradas.filter(r => r.competencia === competencia);
    const docPorSocio = new Map(doMes.map(r => [r.socioId.toString(), r]));

    const socios = controle.socios.map(s => {
      const doc = docPorSocio.get(s._id.toString());
      const calc = calcularSocioMes(totalDoSocioMes(doc));
      return {
        socioId: s._id.toString(),
        nome: s.nome,
        cpf: s.cpf || '',
        percentual: s.percentual ?? null,
        ativo: s.ativo !== false,
        lancado: !!doc,
        modo: doc?.modo || 'total',
        valorTotal: doc?.modo === 'total' ? round2(doc.valorTotal) : 0,
        lancamentos: doc?.modo === 'detalhado' ? (doc.lancamentos || []) : [],
        ...calc,
      };
    });

    const mes = resumirMes(doMes);
    const distribuidoTri = retiradas.reduce((s, r) => round2(s + totalDoSocioMes(r)), 0);
    const lucroApurado = apuracao?.lucroApurado ?? null;
    const saldoAnterior = apuracao?.saldoAnterior || 0;
    const { saldo, excedente } = calcularTrimestre({ lucroApurado, saldoAnterior, distribuido: distribuidoTri });

    res.json({
      empresa: {
        clienteId: cliente._id,
        nome: nomeDoCliente(cliente),
        cnpj: cliente.cnpj || '',
        regime: resolverPorVigencia(cliente.historicoRegime, competencia, cliente.regime),
        ativo: controle.ativo !== false,
        clienteAtivo: cliente.status !== 'inativo',
      },
      socios,
      resumoMes: { distribuido: mes.distribuido, tributavel: mes.tributavel, irrf: mes.irrf },
      trimestre: {
        ano: tri.ano,
        trimestre: tri.trimestre,
        meses: tri.meses,
        lucroApurado,
        saldoAnterior,
        distribuido: distribuidoTri,
        saldo,
        excedente,
        tratamentoExcedente: apuracao?.tratamentoExcedente || '',
        obsExcedente: apuracao?.obsExcedente || '',
      },
    });
  } catch (err) {
    console.error('Erro ao buscar detalhe de retiradas:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar o mês.' });
  }
});

// Valida "YYYY-MM-DD" como data real (rejeita 2026-02-30) e dentro do mês da competência.
const dataDoMes = (data, competencia) => {
  if (!data.startsWith(`${competencia}-`)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
};

// PUT /api/contabil/retiradas/:clienteId/mes/:competencia/socios/:socioId — upsert da retirada
// do sócio no mês. Guarda só o modo enviado e limpa o outro (a confirmação é feita no frontend).
router.put('/:clienteId/mes/:competencia/socios/:socioId', validarECorrigir(retiradaMesSchema), async (req, res) => {
  try {
    const { competencia, socioId } = req.params;
    if (!competenciaValida(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });
    const carregado = await carregarControle(req, res);
    if (!carregado) return;
    const { cliente, controle } = carregado;
    if (cliente.status === 'inativo') return erroClienteInativo(res);
    if (controle.ativo === false) return erroControleInativo(res);

    const socio = mongoose.isValidObjectId(socioId) ? controle.socios.id(socioId) : null;
    if (!socio) return res.status(404).json({ erro: 'Sócio não encontrado.' });
    if (socio.ativo === false) return res.status(400).json({ erro: 'Sócio inativo — reative pra lançar retiradas.' });

    const { modo, valorTotal, lancamentos } = req.body;
    if (modo === 'detalhado') {
      const foraDoMes = lancamentos.find(l => !dataDoMes(l.data, competencia));
      if (foraDoMes) {
        return res.status(400).json({ erro: `A data ${foraDoMes.data.split('-').reverse().join('/')} não é de ${competenciaLegivel(competencia)}. Cada lançamento precisa ser do mês da competência.` });
      }
    }

    const dados = modo === 'total'
      ? { modo, valorTotal: round2(valorTotal), lancamentos: [] }
      : { modo, valorTotal: 0, lancamentos: lancamentos.map(l => ({ data: l.data, valor: round2(l.valor), obs: (l.obs || '').trim() })) };

    const doc = await RetiradaMes.findOneAndUpdate(
      { cliente: cliente._id, socioId: socio._id, competencia },
      {
        $set: { ...dados, atualizadoPor: req.usuario._id, atualizadoEm: new Date() },
        $setOnInsert: { empresa: req.usuario.empresa._id },
      },
      { upsert: true, new: true, lean: true }
    );

    const calc = calcularSocioMes(totalDoSocioMes(doc));
    registrarLog({
      empresa: req.usuario.empresa._id,
      usuario: req.usuario._id,
      tipo: 'retirada_lancada',
      descricao: `Lançou retirada de ${socio.nome} em ${nomeDoCliente(cliente)} (${competenciaLegivel(competencia)}): ${formatarReais(calc.total)}`,
      meta: { clienteId: cliente._id, competencia },
    });

    res.json({ socioId: socio._id.toString(), modo: doc.modo, valorTotal: doc.valorTotal, lancamentos: doc.lancamentos, ...calc });
  } catch (err) {
    console.error('Erro ao lançar retirada:', err.message);
    res.status(500).json({ erro: 'Erro ao salvar a retirada.' });
  }
});

// POST /api/contabil/retiradas/:clienteId/mes/:competencia/sem-retiradas — grava zero pra cada
// sócio ativo que ainda não tem registro no mês (quem já tem lançamento fica como está)
router.post('/:clienteId/mes/:competencia/sem-retiradas', async (req, res) => {
  try {
    const { competencia } = req.params;
    if (!competenciaValida(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });
    const carregado = await carregarControle(req, res);
    if (!carregado) return;
    const { cliente, controle } = carregado;
    if (cliente.status === 'inativo') return erroClienteInativo(res);
    if (controle.ativo === false) return erroControleInativo(res);

    const ativos = controle.socios.filter(s => s.ativo !== false);
    if (!ativos.length) return res.status(400).json({ erro: 'Nenhum sócio ativo nesta empresa.' });

    const agora = new Date();
    const resultado = await RetiradaMes.bulkWrite(ativos.map(s => ({
      updateOne: {
        filter: { cliente: cliente._id, socioId: s._id, competencia },
        update: {
          $setOnInsert: {
            empresa: req.usuario.empresa._id, modo: 'total', valorTotal: 0, lancamentos: [],
            atualizadoPor: req.usuario._id, atualizadoEm: agora,
          },
        },
        upsert: true,
      },
    })));
    const criados = resultado.upsertedCount || 0;

    if (criados) {
      registrarLog({
        empresa: req.usuario.empresa._id,
        usuario: req.usuario._id,
        tipo: 'retirada_lancada',
        descricao: `Marcou ${competenciaLegivel(competencia)} sem retiradas em ${nomeDoCliente(cliente)}`,
        meta: { clienteId: cliente._id, competencia },
      });
    }

    res.json({ ok: true, criados });
  } catch (err) {
    console.error('Erro ao marcar mês sem retiradas:', err.message);
    res.status(500).json({ erro: 'Erro ao marcar o mês sem retiradas.' });
  }
});

// PUT /api/contabil/retiradas/:clienteId/trimestre/:ano/:trimestre — upsert da apuração
router.put('/:clienteId/trimestre/:ano/:trimestre', validarECorrigir(apuracaoTrimestreSchema), async (req, res) => {
  try {
    const ano = Number(req.params.ano);
    const trimestre = Number(req.params.trimestre);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return res.status(400).json({ erro: 'Ano inválido.' });
    if (![1, 2, 3, 4].includes(trimestre)) return res.status(400).json({ erro: 'Trimestre inválido.' });

    const carregado = await carregarControle(req, res);
    if (!carregado) return;
    const { cliente, controle } = carregado;
    if (cliente.status === 'inativo') return erroClienteInativo(res);
    if (controle.ativo === false) return erroControleInativo(res);

    const { lucroApurado, saldoAnterior, tratamentoExcedente, obsExcedente } = req.body;
    await ApuracaoTrimestre.findOneAndUpdate(
      { cliente: cliente._id, ano, trimestre },
      {
        $set: {
          lucroApurado: lucroApurado === null ? null : round2(lucroApurado),
          saldoAnterior: round2(saldoAnterior),
          tratamentoExcedente,
          obsExcedente: obsExcedente.trim(),
          atualizadoPor: req.usuario._id,
          atualizadoEm: new Date(),
        },
        $setOnInsert: { empresa: req.usuario.empresa._id },
      },
      { upsert: true }
    );

    registrarLog({
      empresa: req.usuario.empresa._id,
      usuario: req.usuario._id,
      tipo: 'apuracao_trimestre_atualizada',
      descricao: `Atualizou a apuração do ${trimestre}º trimestre de ${ano} de ${nomeDoCliente(cliente)}`,
      meta: { clienteId: cliente._id, ano, trimestre },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar apuração do trimestre:', err.message);
    res.status(500).json({ erro: 'Erro ao salvar o trimestre.' });
  }
});

module.exports = router;
