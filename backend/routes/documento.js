const express = require('express');
const multer = require('multer');
const registrarLog = require('../services/log');
const { autenticar, temPermissao } = require('../middleware/auth');
const { temAcessoAoSetor, podeMudarConfigSetor } = require('./cliente');
const Documento = require('../models/Documento');
const Cliente = require('../models/Cliente');
const { subirArquivo, buscarArquivo, apagarArquivo } = require('../services/storage');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

// ── Tipos aceitos ──
// CSV não tem magic bytes confiáveis (é texto puro) — validado por extensão + mimetype declarado.
const TIPOS_ACEITOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
];
const MIME_CSV = ['text/csv', 'application/vnd.ms-excel'];

// Sanitiza o nome original pra usar na chave do bucket — sem acento, espaço vira _, só [a-zA-Z0-9._-]
const sanitizarNome = (nome) => nome
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, '_')
  .replace(/[^a-zA-Z0-9._-]/g, '');

const montarChave = (empresaId, clienteId, doc) => doc.tipo === 'geral'
  ? `${empresaId}/${clienteId}/geral/${Date.now()}-${sanitizarNome(doc.nomeOriginal)}`
  : `${empresaId}/${clienteId}/demanda/${doc.setor}/${doc.competencia}/${Date.now()}-${sanitizarNome(doc.nomeOriginal)}`;

// Confere permissão de acordo com a tabela do spec — retorna true/false, sem responder o request
const podeVerOuEnviar = async (usuario, documentoOuDados) => {
  const { tipo, setor } = documentoOuDados;
  if (tipo === 'geral') return true; // qualquer usuário autenticado da empresa
  return temAcessoAoSetor(usuario, (setor?._id || setor)?.toString());
};

const podeGerenciar = async (usuario, documentoOuDados) => {
  const { tipo, setor } = documentoOuDados;
  if (tipo === 'geral') return usuario.cargo === 'admin' || !!usuario.permissoes?.gerenciarClientes;
  return temAcessoAoSetor(usuario, (setor?._id || setor)?.toString());
};

const podeExcluirDefinitivo = async (usuario, documento) => {
  if (documento.tipo === 'geral') return usuario.cargo === 'admin' || !!usuario.permissoes?.gerenciarClientes;
  return podeMudarConfigSetor(usuario, documento.setor?.toString());
};

// POST /api/documentos
router.post('/', autenticar, upload.single('arquivo'), async (req, res) => {
  try {
    const { clienteId, tipo, setorId, competencia } = req.body;
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
    if (!['geral', 'demanda'].includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido.' });
    if (tipo === 'demanda') {
      if (!setorId) return res.status(400).json({ erro: 'Setor é obrigatório.' });
      if (!/^\d{4}-\d{2}$/.test(competencia || '')) return res.status(400).json({ erro: 'Competência inválida.' });
    }

    const cliente = await Cliente.findOne({ _id: clienteId, empresa: req.usuario.empresa._id }).select('_id').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    if (!(await podeGerenciar(req.usuario, { tipo, setor: setorId }))) {
      return res.status(403).json({ erro: 'Sem permissão para enviar documentos aqui.' });
    }

    // Validação por tipo real do arquivo (magic bytes) — nunca confiar só na extensão/mimetype declarado
    const nomeMin = req.file.originalname.toLowerCase();
    const ehCsvDeclarado = nomeMin.endsWith('.csv') && MIME_CSV.includes(req.file.mimetype);
    let tipoConteudoReal = req.file.mimetype;

    if (!ehCsvDeclarado) {
      const { fileTypeFromBuffer } = await import('file-type');
      const detectado = await fileTypeFromBuffer(req.file.buffer);
      if (!detectado || !TIPOS_ACEITOS.includes(detectado.mime)) {
        return res.status(400).json({ erro: 'Tipo de arquivo não permitido. Aceitos: PDF, imagem (JPG/PNG), planilha (XLS/XLSX/CSV) e Word (DOC/DOCX).' });
      }
      tipoConteudoReal = detectado.mime;
    } else {
      tipoConteudoReal = 'text/csv';
    }

    const dadosDoc = { tipo, setor: tipo === 'demanda' ? setorId : null, competencia: tipo === 'demanda' ? competencia : null, nomeOriginal: req.file.originalname };
    const chave = montarChave(req.usuario.empresa._id, clienteId, dadosDoc);
    await subirArquivo(chave, req.file.buffer, tipoConteudoReal);

    const documento = await Documento.create({
      empresa: req.usuario.empresa._id,
      cliente: clienteId,
      tipo,
      setor: dadosDoc.setor,
      competencia: dadosDoc.competencia,
      nomeOriginal: req.file.originalname,
      chave,
      tipoConteudo: tipoConteudoReal,
      tamanho: req.file.size,
      enviadoPor: req.usuario._id,
    });

    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'documento_enviado', descricao: `Enviou o documento ${req.file.originalname}`, meta: { nomeOriginal: req.file.originalname } });

    const populado = await Documento.findById(documento._id).populate('enviadoPor', 'nome').lean();
    res.status(201).json(populado);
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erro: 'Arquivo maior que 16MB.' });
    res.status(500).json({ erro: 'Erro ao enviar documento.' });
  }
});

// GET /api/documentos/cliente/:clienteId
router.get('/cliente/:clienteId', autenticar, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.clienteId, empresa: req.usuario.empresa._id }).select('_id').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const filtro = { empresa: req.usuario.empresa._id, cliente: req.params.clienteId, tipo: 'geral' };
    if (req.query.incluirInativos !== '1') filtro.ativo = true;

    const documentos = await Documento.find(filtro).populate('enviadoPor', 'nome').sort({ enviadoEm: -1 }).lean();
    res.json(documentos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar documentos.' });
  }
});

// GET /api/documentos/demanda/:clienteId/:setorId/:competencia
router.get('/demanda/:clienteId/:setorId/:competencia', autenticar, async (req, res) => {
  try {
    const { clienteId, setorId, competencia } = req.params;
    if (!/^\d{4}-\d{2}$/.test(competencia)) return res.status(400).json({ erro: 'Competência inválida.' });
    if (!temAcessoAoSetor(req.usuario, setorId)) return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });

    const cliente = await Cliente.findOne({ _id: clienteId, empresa: req.usuario.empresa._id }).select('_id').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const filtro = { empresa: req.usuario.empresa._id, cliente: clienteId, tipo: 'demanda', setor: setorId, competencia };
    if (req.query.incluirInativos !== '1') filtro.ativo = true;

    const documentos = await Documento.find(filtro).populate('enviadoPor', 'nome').sort({ enviadoEm: -1 }).lean();
    res.json(documentos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar documentos.' });
  }
});

// GET /api/documentos/mapa/:clienteId/:setorId — contagem de documentos ativos por competência
router.get('/mapa/:clienteId/:setorId', autenticar, async (req, res) => {
  try {
    const { clienteId, setorId } = req.params;
    if (!temAcessoAoSetor(req.usuario, setorId)) return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });

    const cliente = await Cliente.findOne({ _id: clienteId, empresa: req.usuario.empresa._id }).select('_id').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const mongoose = require('mongoose');
    const agregado = await Documento.aggregate([
      { $match: { cliente: new mongoose.Types.ObjectId(clienteId), setor: new mongoose.Types.ObjectId(setorId), tipo: 'demanda', ativo: true } },
      { $group: { _id: '$competencia', total: { $sum: 1 } } },
    ]);
    const mapa = {};
    agregado.forEach(a => { mapa[a._id] = a.total; });
    res.json(mapa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar mapa de documentos.' });
  }
});

// GET /api/documentos/:id/download
router.get('/:id/download', autenticar, async (req, res) => {
  try {
    const documento = await Documento.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id }).lean();
    if (!documento) return res.status(404).json({ erro: 'Documento não encontrado.' });
    if (!(await podeVerOuEnviar(req.usuario, documento))) return res.status(403).json({ erro: 'Sem permissão para ver este documento.' });

    const buffer = await buscarArquivo(documento.chave);
    res.setHeader('Content-Type', documento.tipoConteudo);
    res.setHeader('Content-Disposition', `attachment; filename="${documento.nomeOriginal.replace(/"/g, '')}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao baixar documento.' });
  }
});

// PATCH /api/documentos/:id/inativar
router.patch('/:id/inativar', autenticar, async (req, res) => {
  try {
    const documento = await Documento.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!documento) return res.status(404).json({ erro: 'Documento não encontrado.' });
    if (!(await podeGerenciar(req.usuario, documento))) return res.status(403).json({ erro: 'Sem permissão para inativar este documento.' });

    documento.ativo = false;
    await documento.save();
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'documento_inativado', descricao: `Inativou o documento ${documento.nomeOriginal}` });
    res.json(documento);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao inativar documento.' });
  }
});

// PATCH /api/documentos/:id/reativar
router.patch('/:id/reativar', autenticar, async (req, res) => {
  try {
    const documento = await Documento.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!documento) return res.status(404).json({ erro: 'Documento não encontrado.' });
    if (!(await podeGerenciar(req.usuario, documento))) return res.status(403).json({ erro: 'Sem permissão para reativar este documento.' });

    documento.ativo = true;
    await documento.save();
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'documento_reativado', descricao: `Reativou o documento ${documento.nomeOriginal}` });
    res.json(documento);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao reativar documento.' });
  }
});

// DELETE /api/documentos/:id — só se já inativo
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const documento = await Documento.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!documento) return res.status(404).json({ erro: 'Documento não encontrado.' });
    if (documento.ativo) return res.status(400).json({ erro: 'Inative o documento antes de excluir definitivamente.' });
    if (!(await podeExcluirDefinitivo(req.usuario, documento))) return res.status(403).json({ erro: 'Sem permissão para excluir este documento definitivamente.' });

    await apagarArquivo(documento.chave);
    await documento.deleteOne();
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'documento_excluido_permanente', descricao: `Excluiu permanentemente o documento ${documento.nomeOriginal}` });
    res.json({ mensagem: 'Documento excluído permanentemente.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir documento.' });
  }
});

module.exports = router;
