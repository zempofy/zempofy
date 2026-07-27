const express = require('express');
const registrarLog = require('../services/log');
const { autenticar, temPermissao } = require('../middleware/auth');
const Cliente = require('../models/Cliente');
const Implantacao = require('../models/Implantacao');
const LancamentoSetor = require('../models/LancamentoSetor');

const router = express.Router();

// GET /api/clientes
router.get('/', autenticar, async (req, res) => {
  try {
    const clientes = await Cliente.find({ empresa: req.usuario.empresa._id })
      .populate('criadoPor', 'nome')
      .populate('setores', 'nome cor').sort({ criadoEm: -1 });
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
      .populate('particularidadesSetor.atualizadoPor', 'nome');
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    // Buscar onboardings vinculados ao CNPJ do cliente
    const cnpjLimpo = cliente.cnpj?.replace(/\D/g, '');
    const onboardings = cnpjLimpo
      ? await Implantacao.find({ empresa: req.usuario.empresa._id, cnpj: { $regex: cnpjLimpo } })
          .select('nomeCliente status criadoEm etapas')
          .populate('modelo', 'nome')
          .sort({ criadoEm: -1 })
      : [];

    res.json({ ...cliente.toObject(), onboardings });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar cliente.' });
  }
});

// POST /api/clientes
router.post('/', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  const { razaoSocial, cnpj, regime, porte, servicosContratados } = req.body;
  if (!razaoSocial?.trim()) return res.status(400).json({ erro: 'Razão social é obrigatória.' });
  // Clientes criados via onboarding (origem: 'onboarding') não exigem todos os campos
  const viaOnboarding = req.body.origem === 'onboarding';
  if (!viaOnboarding) {
    if (!porte) return res.status(400).json({ erro: 'Porte é obrigatório.' });
    if (!regime) return res.status(400).json({ erro: 'Regime tributário é obrigatório.' });
  }
  try {
    if (cnpj) {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const existe = await Cliente.findOne({ empresa: req.usuario.empresa._id, cnpj: { $regex: cnpjLimpo } });
      if (existe) return res.status(400).json({ erro: 'Já existe um cliente com esse CNPJ.' });
    }
    const cliente = await Cliente.create({
      ...req.body,
      razaoSocial: razaoSocial.trim(),
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
router.put('/:id', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  try {
    const { empresa, criadoPor, _id, criadoEm, ...dados } = req.body;
    const cliente = await Cliente.findOneAndUpdate(
      { _id: req.params.id, empresa: req.usuario.empresa._id },
      { $set: dados },
      { new: true }
    );
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
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
const competenciaAtual = () => new Date().toISOString().slice(0, 7); // "YYYY-MM"

// Cliente inativo: ninguém edita, nem titular. Mês corrente: quem tem o setor (ou admin) edita. Mês fechado (passado): só o titular edita.
const podeEditarCompetencia = (usuario, setorId, competencia, clienteAtivo) => {
  if (!clienteAtivo) return false;
  if (usuario.cargo === 'admin') return true;
  if (competencia !== competenciaAtual()) return false;
  return usuario.setores?.some(s => s.toString() === setorId);
};

const temAcessoAoSetor = (usuario, setorId) =>
  usuario.cargo === 'admin' || usuario.setores?.some(s => s.toString() === setorId);

// GET /api/clientes/:id/lancamentos/:setorId — lista os lançamentos já salvos (pra montar as pastas de ano/mês)
router.get('/:id/lancamentos/:setorId', autenticar, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const lancamentos = await LancamentoSetor.find({
      cliente: req.params.id,
      setor: req.params.setorId,
      empresa: req.usuario.empresa._id,
    }).sort({ competencia: -1 }).populate('preenchidoPor', 'nome');

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

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const lancamento = await LancamentoSetor.findOne({
      cliente: req.params.id, setor: req.params.setorId, competencia, empresa: req.usuario.empresa._id,
    }).populate('preenchidoPor', 'nome');

    const base = lancamento ? lancamento.toObject() : { cliente: req.params.id, setor: req.params.setorId, competencia, dados: {}, preenchidoPor: null, preenchidoEm: null };
    res.json({ ...base, preenchido: !!lancamento, podeEditar: podeEditarCompetencia(req.usuario, req.params.setorId, competencia, cliente.status !== 'inativo') });
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

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    if (!podeEditarCompetencia(req.usuario, req.params.setorId, competencia, cliente.status !== 'inativo')) {
      const motivo = cliente.status === 'inativo'
        ? 'Cliente inativo — reative pra poder editar.'
        : (competencia === competenciaAtual() ? 'Você não tem acesso a este setor.' : 'Esta competência já está fechada — só o titular pode editar.');
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

    const cliente = await Cliente.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    if (cliente.status === 'inativo') return res.status(403).json({ erro: 'Cliente inativo — reative pra poder editar.' });

    const slug = label.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'campo';
    const existentesSetor = cliente.camposExtrasDemanda.filter(c => c.setor.toString() === req.params.setorId);
    let id = slug;
    let n = 1;
    while (existentesSetor.some(c => c.id === id)) { n++; id = `${slug}_${n}`; }

    cliente.camposExtrasDemanda.push({
      setor: req.params.setorId,
      id,
      label: label.trim(),
      tipo: tipo === 'texto' ? 'texto' : 'moeda',
    });
    await cliente.save();

    res.status(201).json(cliente.camposExtrasDemanda);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar campo.' });
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

    const populado = await Cliente.findById(cliente._id).populate('particularidadesSetor.atualizadoPor', 'nome');
    const lista = populado.particularidadesSetor
      .filter(p => p.setor.toString() === req.params.setorId)
      .sort((a, b) => b.atualizadoEm - a.atualizadoEm);
    res.status(201).json(lista);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao salvar particularidades.' });
  }
});

module.exports = router;

// POST /api/clientes/importar — importar lista de clientes
router.post('/importar', autenticar, temPermissao('gerenciarClientes'), async (req, res) => {
  try {
    const { clientes } = req.body;
    if (!clientes?.length) return res.status(400).json({ erro: 'Nenhum cliente para importar.' });

    const resultados = { importados: 0, ignorados: 0, erros: [] };

    for (const c of clientes) {
      try {
        if (!c.razaoSocial?.trim()) { resultados.ignorados++; continue; }
        // Verificar duplicata por CNPJ
        if (c.cnpj) {
          const cnpjLimpo = c.cnpj.replace(/\D/g, '');
          const existe = await Cliente.findOne({ empresa: req.usuario.empresa._id, cnpj: { $regex: cnpjLimpo } });
          if (existe) { resultados.ignorados++; resultados.erros.push(`${c.razaoSocial}: CNPJ já cadastrado`); continue; }
        }
        await Cliente.create({
          ...c,
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
    if (resultados.importados > 0) {
      const registrarLog = require('../services/log');
      registrarLog({
        empresa: req.usuario.empresa._id,
        usuario: req.usuario._id,
        tipo: 'clientes_importados',
        categoria: 'cliente',
        descricao: `Importou ${resultados.importados} cliente(s) via planilha Excel`,
        meta: { total: resultados.importados }
      });
    }
    res.json(resultados);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao importar clientes.' });
  }
});
