const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const autenticar = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Acesso negado. Faça login.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).populate('empresa').populate('setores', 'nome cor');
    if (!usuario || !usuario.ativo) return res.status(401).json({ erro: 'Usuário não encontrado ou inativo.' });
    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido.' });
  }
};

// Só o titular
const apenasAdmin = (req, res, next) => {
  if (req.usuario.cargo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso permitido apenas para o titular da conta.' });
  }
  next();
};

// Titular ou colaborador com permissão específica
const temPermissao = (permissao) => (req, res, next) => {
  if (req.usuario.cargo === 'admin') return next();
  if (req.usuario.permissoes?.[permissao]) return next();
  return res.status(403).json({ erro: 'Sem permissão para esta ação.' });
};

const isTitular = (usuario) => usuario.cargo === 'admin';

module.exports = { autenticar, apenasAdmin, temPermissao, isTitular };
