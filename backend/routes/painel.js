const express = require('express');
const router = express.Router();
const Empresa = require('../models/Empresa');
const Usuario = require('../models/Usuario');
const Implantacao = require('../models/Implantacao');
const Cliente = require('../models/Cliente');

const verificarChave = (req, res, next) => {
  const chave = req.headers['x-admin-key'];
  if (!chave || chave !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ erro: 'Acesso negado. Faça login.' });
  }
  next();
};

router.get('/', verificarChave, async (req, res) => {
  try {
    const empresas = await Empresa.find().sort({ criadaEm: -1 }).lean();

    const dados = await Promise.all(empresas.map(async (emp) => {
      const [usuarios, implantacoes, clientes] = await Promise.all([
        Usuario.find({ empresa: emp._id, ativo: true }).select('nome email cargo ultimoAcesso emailVerificado setores').lean(),
        Implantacao.find({ empresa: emp._id, status: { $ne: 'cancelada' } }).lean(),
        Cliente.countDocuments({ empresa: emp._id }),
      ]);

      const titular = usuarios.find(u => u.cargo === 'admin');
      const colaboradores = usuarios.filter(u => u.cargo !== 'admin');
      const implAtivas = implantacoes.filter(i => i.status !== 'concluida');
      const implConcluidas = implantacoes.filter(i => i.status === 'concluida');

      // Progresso médio dos onboardings ativos
      const progressoMedio = implAtivas.length ? Math.round(
        implAtivas.reduce((acc, imp) => {
          const total = imp.etapas?.length || 0;
          const conc = imp.etapas?.filter(e => e.status === 'concluida').length || 0;
          return acc + (total ? (conc / total) * 100 : 0);
        }, 0) / implAtivas.length
      ) : 0;

      const ultimoAcesso = usuarios
        .map(u => u.ultimoAcesso).filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0];

      // ID de suporte: 3 letras do nome + ID sequencial
      const sigla = (emp.nome || 'EMP').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
      const idSuporte = `${sigla}-${emp._id.toString().slice(-5).toUpperCase()}`;

      return {
        id: emp._id,
        idSuporte,
        nome: emp.nome,
        cnpj: emp.cnpj,
        plano: emp.plano || 'starter',
        ativa: emp.ativa !== false,
        criadaEm: emp.criadaEm,
        alertaOnboardingDias: emp.alertaOnboardingDias || 7,
        resumoFrequencia: emp.resumoFrequencia || 'semanal',
        titular: titular ? { nome: titular.nome, email: titular.email, emailVerificado: titular.emailVerificado } : null,
        colaboradores: colaboradores.map(c => ({ nome: c.nome, email: c.email })),
        totalUsuarios: usuarios.length,
        clientes,
        implantacoesAtivas: implAtivas.length,
        implantacoesConcluidas: implConcluidas.length,
        progressoMedio,
        ultimoAcesso: ultimoAcesso || null,
      };
    }));

    const mrr = dados.reduce((acc, e) => {
      if (!e.ativa) return acc;
      const valores = { starter: 39, pro: 79, escala: 129 };
      return acc + (valores[e.plano] || 0);
    }, 0);

    res.json({
      totalEmpresas: empresas.length,
      empresasAtivas: dados.filter(e => e.ativa).length,
      totalUsuarios: dados.reduce((a, e) => a + e.totalUsuarios, 0),
      totalOnboardingsAtivos: dados.reduce((a, e) => a + e.implantacoesAtivas, 0),
      mrr,
      geradoEm: new Date(),
      empresas: dados,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar dados do painel.' });
  }
});

module.exports = router;
