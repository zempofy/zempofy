const express = require('express');
const { autenticar } = require('../middleware/auth');
const Mensagem = require('../models/Mensagem');
const Usuario = require('../models/Usuario');
const { chatMensagemSchema, validar } = require('../validacao');

const router = express.Router();

// GET /api/chat/contatos - Lista pessoas da empresa para conversar
router.get('/contatos', autenticar, async (req, res) => {
  try {
    const contatos = await Usuario.find({
      empresa: req.usuario.empresa._id,
      _id: { $ne: req.usuario._id },
      ativo: true
    }).select('nome cargo').lean();

    // Para cada contato, pega o número de mensagens não lidas
    const contatosComInfo = await Promise.all(contatos.map(async (c) => {
      const naoLidas = await Mensagem.countDocuments({
        de: c._id,
        para: req.usuario._id,
        lida: false,
        apagada: false
      });

      const ultima = await Mensagem.findOne({
        empresa: req.usuario.empresa._id,
        apagada: false,
        $or: [
          { de: req.usuario._id, para: c._id },
          { de: c._id, para: req.usuario._id }
        ]
      }).sort({ criadaEm: -1 }).lean();

      return {
        _id: c._id,
        nome: c.nome,
        cargo: c.cargo,
        naoLidas,
        ultimaMensagem: ultima ? {
          texto: ultima.texto,
          criadaEm: ultima.criadaEm,
          minha: ultima.de.toString() === req.usuario._id.toString()
        } : null
      };
    }));

    // Ordena: quem tem mensagem não lida vem primeiro, depois por última mensagem
    contatosComInfo.sort((a, b) => {
      if (b.naoLidas !== a.naoLidas) return b.naoLidas - a.naoLidas;
      if (a.ultimaMensagem && b.ultimaMensagem) {
        return new Date(b.ultimaMensagem.criadaEm) - new Date(a.ultimaMensagem.criadaEm);
      }
      return a.nome.localeCompare(b.nome);
    });

    res.json(contatosComInfo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar contatos.' });
  }
});

// GET /api/chat/:usuarioId - Busca conversa com um usuário
router.get('/:usuarioId', autenticar, async (req, res) => {
  try {
    const outroId = req.params.usuarioId;

    // Verifica se o outro usuário é da mesma empresa
    const outro = await Usuario.findOne({
      _id: outroId,
      empresa: req.usuario.empresa._id,
      ativo: true
    }).lean();
    if (!outro) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    // Busca mensagens entre os dois (só eles podem ver)
    const mensagens = await Mensagem.find({
      empresa: req.usuario.empresa._id,
      apagada: false,
      $or: [
        { de: req.usuario._id, para: outroId },
        { de: outroId, para: req.usuario._id }
      ]
    })
    .populate('de', 'nome')
    .sort({ criadaEm: 1 })
    .limit(100)
    .lean();

    // Marca como lidas as mensagens recebidas
    await Mensagem.updateMany(
      { de: outroId, para: req.usuario._id, lida: false },
      { lida: true }
    );

    res.json({ mensagens, outro: { _id: outro._id, nome: outro.nome, cargo: outro.cargo } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar mensagens.' });
  }
});

// POST /api/chat/:usuarioId - Envia mensagem
router.post('/:usuarioId', autenticar, validar(chatMensagemSchema), async (req, res) => {
  const { texto } = req.body;
  try {
    const outroId = req.params.usuarioId;

    const outro = await Usuario.findOne({
      _id: outroId,
      empresa: req.usuario.empresa._id,
      ativo: true
    }).lean();
    if (!outro) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const mensagem = await Mensagem.create({
      de: req.usuario._id,
      para: outroId,
      empresa: req.usuario.empresa._id,
      texto: texto.trim()
    });

    const populada = await mensagem.populate('de', 'nome');
    res.status(201).json(populada);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao enviar mensagem.' });
  }
});

// DELETE /api/chat/mensagem/:id - Apagar própria mensagem
router.delete('/mensagem/:id', autenticar, async (req, res) => {
  try {
    const mensagem = await Mensagem.findOne({
      _id: req.params.id,
      de: req.usuario._id // só quem enviou pode apagar
    });

    if (!mensagem) return res.status(404).json({ erro: 'Mensagem não encontrada.' });

    mensagem.apagada = true;
    await mensagem.save();

    res.json({ mensagem: 'Mensagem apagada.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao apagar mensagem.' });
  }
});

// GET /api/chat/nao-lidas/total - Total de mensagens não lidas (para badge na topbar)
router.get('/nao-lidas/total', autenticar, async (req, res) => {
  try {
    const total = await Mensagem.countDocuments({
      para: req.usuario._id,
      lida: false,
      apagada: false
    });
    res.json({ total });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao contar mensagens.' });
  }
});

module.exports = router;
