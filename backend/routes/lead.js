const express = require('express');
const mongoose = require('mongoose');
const { autenticar } = require('../middleware/auth');
const Lead = require('../models/Lead');
const { leadCreateSchema, leadUpdateSchema, validar } = require('../validacao');
const { ETAPAS_VALIDAS, historicoEfetivo, posicaoNoCorte, comPosicao, mesAtualBrasilia, limitesDoMes } = require('../services/crmEtapas');

const router = express.Router();

// Corte "sem limite": a posição é a última entrada do histórico (usado nas respostas de POST/PUT)
const SEM_CORTE = new Date(8.64e15);

const podeEditarLead = (usuario, lead) =>
  usuario.cargo === 'admin' || lead.criadoPor.toString() === usuario._id.toString();

// GET /api/leads — titular vê todos os leads da empresa; colaborador vê só os próprios
// ?colaborador=<id> — só o titular: filtra pelos leads criados por esse colaborador
// ?mes=YYYY-MM — devolve cada lead na etapa em que estava no fim daquele mês (etapaNoMes/movidoEm).
//   Sem mes, comportamento antigo (todos os leads com a etapa atual) — a tela Início depende disso
router.get('/', autenticar, async (req, res) => {
  try {
    const { mes, colaborador } = req.query;
    const filtro = { empresa: req.usuario.empresa._id };
    if (req.usuario.cargo !== 'admin') filtro.criadoPor = req.usuario._id;
    else if (colaborador) {
      if (!mongoose.isValidObjectId(colaborador)) return res.status(400).json({ erro: 'Colaborador inválido.' });
      filtro.criadoPor = colaborador;
    }

    if (!mes) {
      const leads = await Lead.find(filtro).populate('criadoPor', 'nome').sort({ criadoEm: -1 }).lean();
      return res.json(leads);
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return res.status(400).json({ erro: 'Mês inválido. Use o formato AAAA-MM.' });
    if (mes > mesAtualBrasilia()) return res.status(400).json({ erro: 'Não é possível consultar um mês futuro.' });

    const { inicioMes, fimExclusivo } = limitesDoMes(mes);
    const agora = new Date();
    const corte = agora < fimExclusivo ? agora : fimExclusivo; // no mês corrente, a posição é a de agora

    const leads = await Lead.find({ ...filtro, criadoEm: { $lt: corte } })
      .populate('criadoPor', 'nome').sort({ criadoEm: -1 }).lean();

    const resultado = [];
    for (const lead of leads) {
      const posicao = posicaoNoCorte(lead, corte);
      if (!posicao) continue; // não existia ainda nesse corte
      // Ganho/Perdido só aparecem no mês em que o lead entrou na coluna
      if (['ganho', 'perdido'].includes(posicao.etapa) && new Date(posicao.em) < inicioMes) continue;
      resultado.push(comPosicao(lead, posicao));
    }
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar leads.' });
  }
});

// POST /api/leads — criar lead (qualquer colaborador autenticado)
router.post('/', autenticar, validar(leadCreateSchema), async (req, res) => {
  const { nome, nomeEmpresa, telefone, email, valor, origem, tipoServico, obs, etapa } = req.body;
  try {
    const etapaInicial = ETAPAS_VALIDAS.includes(etapa) ? etapa : 'prospeccao';
    const agora = new Date();
    const lead = await Lead.create({
      nome: nome.trim(),
      nomeEmpresa: nomeEmpresa?.trim() || '',
      telefone: telefone || '',
      email: email || '',
      valor: valor || 0,
      origem: origem || '',
      tipoServico: tipoServico || '',
      obs: obs || '',
      etapa: etapaInicial,
      historicoEtapas: [{ etapa: etapaInicial, em: agora, por: req.usuario._id }],
      empresa: req.usuario.empresa._id,
      criadoPor: req.usuario._id,
      criadoEm: agora,
    });
    const populado = await Lead.findById(lead._id).populate('criadoPor', 'nome').lean();
    res.status(201).json(comPosicao(populado, posicaoNoCorte(populado, SEM_CORTE)));
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar lead.' });
  }
});

// PUT /api/leads/:id — editar campos e/ou mover de etapa (quem criou ou o titular)
router.put('/:id', autenticar, validar(leadUpdateSchema), async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' });
    if (!podeEditarLead(req.usuario, lead)) return res.status(403).json({ erro: 'Você só pode editar os próprios leads.' });

    // O histórico de etapas só é escrito pelo servidor; etapaNoMes/movidoEm são campos calculados
    const { empresa, criadoPor, _id, criadoEm, historicoEtapas, etapaNoMes, movidoEm, ...dados } = req.body;
    if (dados.etapa !== undefined && !ETAPAS_VALIDAS.includes(dados.etapa)) return res.status(400).json({ erro: 'Etapa inválida.' });

    const update = { $set: dados };
    if (dados.etapa !== undefined && dados.etapa !== lead.etapa) {
      const novaEntrada = { etapa: dados.etapa, em: new Date(), por: req.usuario._id };
      // Salvaguarda: lead sem histórico (criado pelo backend antigo durante o deploy) ganha a
      // entrada inicial antes da movimentação, pra não perder a posição dos meses anteriores
      const entradas = lead.historicoEtapas?.length ? [novaEntrada] : [...historicoEfetivo(lead), novaEntrada];
      update.$push = { historicoEtapas: { $each: entradas } };
    }

    const atualizado = await Lead.findByIdAndUpdate(lead._id, update, { new: true })
      .populate('criadoPor', 'nome').lean();
    res.json(comPosicao(atualizado, posicaoNoCorte(atualizado, SEM_CORTE)));
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar lead.' });
  }
});

// DELETE /api/leads/:id — excluir (quem criou ou o titular)
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' });
    if (!podeEditarLead(req.usuario, lead)) return res.status(403).json({ erro: 'Você só pode excluir os próprios leads.' });

    await Lead.findByIdAndDelete(lead._id);
    res.json({ mensagem: 'Lead removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover lead.' });
  }
});

module.exports = router;
