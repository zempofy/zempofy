const express = require('express');
const registrarLog = require('../services/log');
const { enviarConvite, enviarRedefinicaoSenha } = require('../services/email');
const { autenticar, apenasAdmin, temPermissao } = require('../middleware/auth');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const { usuarioSchema, validar } = require('../validacao');

const TOKEN_EXPIRA_MS = 3600000; // 1 hora — mesmo prazo usado em esqueci-senha
// Convite tem prazo maior: diferente do reset de senha (ação pontual, geralmente feita na hora),
// quem está sendo convidado pode só ver o e-mail bem depois — 1h era curto demais na prática.
const CONVITE_EXPIRA_MS = 24 * 3600000; // 24 horas

const router = express.Router();

// PUT /api/usuarios/meu-perfil
router.put('/meu-perfil', autenticar, async (req, res) => {
  const { email, nome } = req.body;
  try {
    const atualizacao = {}
    if (nome?.trim()) atualizacao.nome = nome.trim()
    if (email) {
      const emailExiste = await Usuario.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.usuario._id } }).lean();
      if (emailExiste) return res.status(400).json({ erro: 'E-mail já está em uso.' });
      atualizacao.email = email
    }
    const usuario = await Usuario.findByIdAndUpdate(req.usuario._id, atualizacao, { new: true }).select('-senha');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
  }
});

// PUT /api/usuarios/minha-foto
router.put('/minha-foto', autenticar, async (req, res) => {
  const { foto } = req.body;
  try {
    const usuario = await Usuario.findByIdAndUpdate(req.usuario._id, { avatar: foto || '' }, { new: true }).select('-senha');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar foto.' });
  }
});

// PUT /api/usuarios/minha-senha
router.put('/minha-senha', autenticar, async (req, res) => {
  const { novaSenha } = req.body;
  try {
    if (!novaSenha || novaSenha.length < 6) return res.status(400).json({ erro: 'Senha deve ter ao menos 6 caracteres.' });
    const usuario = await Usuario.findById(req.usuario._id);
    usuario.senha = novaSenha;
    await usuario.save();
    res.json({ mensagem: 'Senha atualizada com sucesso.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar senha.' });
  }
});

// GET /api/usuarios
// ?incluirInativos=true — só a tela de Equipe usa isso, pra montar as seções Ativos/Inativos/
// Convites pendentes. Todo o resto do sistema (seletor de responsável, membros de setor etc.)
// continua recebendo só ativos, sem mudança de comportamento.
router.get('/', autenticar, async (req, res) => {
  try {
    const filtro = { empresa: req.usuario.empresa._id };
    if (req.query.incluirInativos !== 'true') filtro.ativo = true;
    const usuarios = await Usuario.find(filtro).select('-senha').populate('setores', 'nome cor').lean();
    // Nunca manda o token de reset pro cliente — só um booleano dizendo se o convite
    // ainda está pendente (a pessoa nunca definiu a própria senha).
    const resultado = usuarios.map(({ tokenResetSenha, tokenResetExpira, ...resto }) => ({
      ...resto,
      convitePendente: !!tokenResetSenha,
    }));
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar usuários.' });
  }
});

// POST /api/usuarios — titular ou colaborador com permissão gerenciarMembros. Convida por link
// (sem senha) em vez de criar a conta já pronta — reaproveita o mesmo token de "esqueci a senha".
router.post('/', autenticar, validar(usuarioSchema), async (req, res) => {
  const isAdmin = req.usuario.cargo === 'admin'
  const podeGerenciar = req.usuario.permissoes?.gerenciarMembros
  if (!isAdmin && !podeGerenciar) return res.status(403).json({ erro: 'Sem permissão para adicionar membros.' });
  const { nome, email, permissoes, setores } = req.body;
  if (!nome || !email) return res.status(400).json({ erro: 'Preencha todos os campos.' });
  if (!setores || setores.length === 0) return res.status(400).json({ erro: 'Selecione pelo menos um setor.' });
  try {
    const emailExiste = await Usuario.findOne({ email: email.toLowerCase().trim() }).lean();
    if (emailExiste) return res.status(400).json({ erro: 'E-mail já em uso.' });
    const tokenResetSenha = crypto.randomBytes(32).toString('hex');
    const tokenResetExpira = new Date(Date.now() + CONVITE_EXPIRA_MS);
    const usuario = await Usuario.create({
      nome, email,
      cargo: 'colaborador',
      permissoes: permissoes || {},
      setores: setores || [],
      empresa: req.usuario.empresa._id,
      tokenResetSenha,
      tokenResetExpira,
    });
    setImmediate(async () => {
      try {
        const Empresa = require('../models/Empresa');
        const empresa = await Empresa.findById(req.usuario.empresa._id).select('nome').lean();
        await enviarConvite({
          destinatario: email,
          nome,
          nomeEmpresa: empresa?.nome || 'seu escritório',
          nomeConvidadoPor: req.usuario.nome,
          token: tokenResetSenha,
        });
      } catch(e) {}
    });
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'membro_adicionado', categoria: 'equipe', descricao: 'Adicionou ' + nome + ' à equipe', meta: { nome, email } });
    res.status(201).json({ id: usuario._id, nome: usuario.nome, email: usuario.email, cargo: usuario.cargo, permissoes: usuario.permissoes });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ erro: 'E-mail já em uso.' });
    res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
});

// PUT /api/usuarios/:id — titular edita nome/email e permissões
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  const { nome, email, permissoes, setores } = req.body;
  try {
    if (req.params.id === req.usuario._id.toString()) {
      return res.status(403).json({ erro: 'Você não pode editar as próprias permissões.' });
    }
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (alvo.cargo === 'admin') return res.status(403).json({ erro: 'Não é possível editar o titular.' });
    const atualizacao = {};
    if (nome?.trim()) atualizacao.nome = nome.trim();
    if (email) atualizacao.email = email;
    if (permissoes) atualizacao.permissoes = permissoes;
    if (setores !== undefined) atualizacao.setores = setores;
    const usuario = await Usuario.findByIdAndUpdate(req.params.id, atualizacao, { new: true }).select('-senha').populate('setores', 'nome cor');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar usuário.' });
  }
});

// PUT /api/usuarios/:id/reativar — mesma permissão de quem pode desativar (gerenciarMembros)
router.put('/:id/reativar', autenticar, temPermissao('gerenciarMembros'), async (req, res) => {
  try {
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const usuario = await Usuario.findByIdAndUpdate(req.params.id, { ativo: true }, { new: true }).select('-senha').populate('setores', 'nome cor');
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'membro_reativado', categoria: 'equipe', descricao: 'Reativou ' + alvo.nome, meta: { nome: alvo.nome } });
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao reativar usuário.' });
  }
});

// DELETE /api/usuarios/:id — titular ou colaborador com permissão gerenciarMembros (desativa, não apaga)
router.delete('/:id', autenticar, temPermissao('gerenciarMembros'), async (req, res) => {
  try {
    if (req.params.id === req.usuario._id.toString()) {
      return res.status(403).json({ erro: 'Você não pode remover a si mesmo.' });
    }
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (alvo.cargo === 'admin') return res.status(403).json({ erro: 'Não é possível remover o titular.' });
    await Usuario.findByIdAndUpdate(req.params.id, { ativo: false });
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'membro_removido', categoria: 'equipe', descricao: 'Desativou ' + alvo.nome, meta: { nome: alvo.nome } });
    res.json({ mensagem: 'Usuário removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover usuário.' });
  }
});

// POST /api/usuarios/:id/resetar-senha — só o titular, mesmo que quem opera tenha gerenciarMembros
router.post('/:id/resetar-senha', autenticar, apenasAdmin, async (req, res) => {
  try {
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (alvo.cargo === 'admin') return res.status(403).json({ erro: 'Não é possível resetar a senha do titular.' });

    const token = crypto.randomBytes(32).toString('hex');
    alvo.tokenResetSenha = token;
    alvo.tokenResetExpira = new Date(Date.now() + TOKEN_EXPIRA_MS);
    await alvo.save();

    await enviarRedefinicaoSenha({ destinatario: alvo.email, nome: alvo.nome, token, solicitadoPor: req.usuario.nome });
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'membro_senha_resetada', categoria: 'equipe', descricao: 'Resetou a senha de ' + alvo.nome, meta: { nome: alvo.nome } });
    res.json({ mensagem: 'E-mail de redefinição enviado.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao resetar senha.' });
  }
});

// POST /api/usuarios/:id/reenviar-convite — gera um novo token e manda o e-mail de convite de novo
router.post('/:id/reenviar-convite', autenticar, temPermissao('gerenciarMembros'), async (req, res) => {
  try {
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (alvo.senha) return res.status(400).json({ erro: 'Este colaborador já definiu uma senha.' });

    const token = crypto.randomBytes(32).toString('hex');
    alvo.tokenResetSenha = token;
    alvo.tokenResetExpira = new Date(Date.now() + CONVITE_EXPIRA_MS);
    await alvo.save();

    const Empresa = require('../models/Empresa');
    const empresa = await Empresa.findById(req.usuario.empresa._id).select('nome').lean();
    await enviarConvite({
      destinatario: alvo.email,
      nome: alvo.nome,
      nomeEmpresa: empresa?.nome || 'seu escritório',
      nomeConvidadoPor: req.usuario.nome,
      token,
    });
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'membro_convite_reenviado', categoria: 'equipe', descricao: 'Reenviou o convite de ' + alvo.nome, meta: { nome: alvo.nome } });
    res.json({ mensagem: 'Convite reenviado.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao reenviar convite.' });
  }
});

// DELETE /api/usuarios/:id/permanente — exclusão de verdade, só titular, só se já estiver inativo
router.delete('/:id/permanente', autenticar, apenasAdmin, async (req, res) => {
  try {
    const alvo = await Usuario.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (alvo.cargo === 'admin') return res.status(403).json({ erro: 'Não é possível excluir o titular.' });
    if (alvo.ativo) return res.status(403).json({ erro: 'Só é possível excluir permanentemente um usuário já desativado.' });

    await Usuario.deleteOne({ _id: alvo._id });
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'membro_excluido_permanente', categoria: 'equipe', descricao: 'Excluiu permanentemente ' + alvo.nome, meta: { nome: alvo.nome } });
    res.json({ mensagem: 'Usuário excluído permanentemente.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir usuário.' });
  }
});

module.exports = router;
