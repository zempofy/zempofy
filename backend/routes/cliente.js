const express = require('express');
const registrarLog = require('../services/log');
const { autenticar, temPermissao } = require('../middleware/auth');
const Cliente = require('../models/Cliente');
const Implantacao = require('../models/Implantacao');

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
      .populate('criadoPor', 'nome').populate('setores', 'nome cor');
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
