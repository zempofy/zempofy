const express = require('express');
const multer = require('multer');
const registrarLog = require('../services/log');
const { autenticar, temPermissao } = require('../middleware/auth');
const { temAcessoAoSetor, podeMudarConfigSetor } = require('./cliente');
const Documento = require('../models/Documento');
const Cliente = require('../models/Cliente');
const Setor = require('../models/Setor');
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

// Mover pra lixeira é o "remover" do dia a dia — qualquer usuário autenticado da empresa pode,
// pros dois tipos (igual `podeVerOuEnviar`). A exclusão definitiva (`podeExcluirDefinitivo`,
// logo abaixo) continua restrita.
const podeGerenciar = async (usuario, documentoOuDados) => true;

const podeExcluirDefinitivo = async (usuario, documento) => {
  if (documento.tipo === 'geral') return usuario.cargo === 'admin' || !!usuario.permissoes?.gerenciarClientes;
  return podeMudarConfigSetor(usuario, documento.setor?.toString());
};

// ── Lixeira ──
const DIAS_LIXEIRA = 30;
const MS_LIXEIRA = DIAS_LIXEIRA * 24 * 60 * 60 * 1000;

// Documentos existentes antes da lixeira não têm o campo `excluido` — `{ excluido: false }` não
// casaria com eles no Mongo (campo ausente ≠ false), então some tudo da tela. `$ne: true` cobre
// os três casos (false, ausente e o legado `ativo`), independente da migração do server.js.
const NAO_EXCLUIDO = { excluido: { $ne: true } };

const diasRestantes = (excluidoEm) => {
  if (!excluidoEm) return DIAS_LIXEIRA;
  const restante = new Date(excluidoEm).getTime() + MS_LIXEIRA - Date.now();
  return Math.max(0, Math.ceil(restante / (24 * 60 * 60 * 1000)));
};

// Purge lazy: apaga de vez (R2 + banco) o que passou dos 30 dias na lixeira. Roda no GET /lixeira
// em vez de cron job porque o backend hiberna no Render por inatividade — um agendamento só
// dispararia se o processo estivesse de pé na hora exata, atrasando a exclusão real sem aviso.
async function purgarExpirados(empresaId) {
  const limite = new Date(Date.now() - MS_LIXEIRA);
  const expirados = await Documento.find({ empresa: empresaId, excluido: true, excluidoEm: { $lte: limite } });
  for (const doc of expirados) {
    try {
      // Falha no R2 (arquivo já removido, credencial fora do ar) não pode prender o documento na
      // lixeira pra sempre nem derrubar a listagem — registra e segue apagando o registro.
      await apagarArquivo(doc.chave);
    } catch (err) {
      console.error(`⚠️ Purge da lixeira: falha ao apagar ${doc.chave} no R2:`, err.message);
    }
    await doc.deleteOne();
  }
  return expirados.length;
}

// POST /api/documentos — aceita de 1 a 10 arquivos por requisição (campo 'arquivos'), processados
// em sequência; um arquivo inválido não derruba os demais, retorna um array de resultados por arquivo.
router.post('/', autenticar, upload.array('arquivos', 10), async (req, res) => {
  try {
    const { clienteId, tipo, setorId, competencia } = req.body;
    if (!req.files || req.files.length === 0) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
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

    const resultados = [];
    for (const arquivo of req.files) {
      try {
        // Validação por tipo real do arquivo (magic bytes) — nunca confiar só na extensão/mimetype declarado
        const nomeMin = arquivo.originalname.toLowerCase();
        const ehCsvDeclarado = nomeMin.endsWith('.csv') && MIME_CSV.includes(arquivo.mimetype);
        let tipoConteudoReal = arquivo.mimetype;

        if (!ehCsvDeclarado) {
          const { fileTypeFromBuffer } = await import('file-type');
          const detectado = await fileTypeFromBuffer(arquivo.buffer);
          if (!detectado || !TIPOS_ACEITOS.includes(detectado.mime)) {
            resultados.push({ nomeOriginal: arquivo.originalname, sucesso: false, erro: 'Tipo de arquivo não permitido. Aceitos: PDF, imagem (JPG/PNG), planilha (XLS/XLSX/CSV) e Word (DOC/DOCX).' });
            continue;
          }
          tipoConteudoReal = detectado.mime;
        } else {
          tipoConteudoReal = 'text/csv';
        }

        const dadosDoc = { tipo, setor: tipo === 'demanda' ? setorId : null, competencia: tipo === 'demanda' ? competencia : null, nomeOriginal: arquivo.originalname };
        const chave = montarChave(req.usuario.empresa._id, clienteId, dadosDoc);
        await subirArquivo(chave, arquivo.buffer, tipoConteudoReal);

        const documento = await Documento.create({
          empresa: req.usuario.empresa._id,
          cliente: clienteId,
          tipo,
          setor: dadosDoc.setor,
          competencia: dadosDoc.competencia,
          nomeOriginal: arquivo.originalname,
          chave,
          tipoConteudo: tipoConteudoReal,
          tamanho: arquivo.size,
          enviadoPor: req.usuario._id,
        });

        registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'documento_enviado', descricao: `Enviou o documento ${arquivo.originalname}`, meta: { nomeOriginal: arquivo.originalname } });

        const populado = await Documento.findById(documento._id).populate('enviadoPor', 'nome').lean();
        resultados.push({ nomeOriginal: arquivo.originalname, sucesso: true, documento: populado });
      } catch (erroArquivo) {
        resultados.push({ nomeOriginal: arquivo.originalname, sucesso: false, erro: 'Erro ao enviar documento.' });
      }
    }

    const algumSucesso = resultados.some(r => r.sucesso);
    res.status(algumSucesso ? 201 : 400).json(resultados);
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

    const filtro = { empresa: req.usuario.empresa._id, cliente: req.params.clienteId, tipo: 'geral', ...NAO_EXCLUIDO };

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

    const filtro = { empresa: req.usuario.empresa._id, cliente: clienteId, tipo: 'demanda', setor: setorId, competencia, ...NAO_EXCLUIDO };

    const documentos = await Documento.find(filtro).populate('enviadoPor', 'nome').sort({ enviadoEm: -1 }).lean();
    res.json(documentos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar documentos.' });
  }
});

// GET /api/documentos/mapa/:clienteId/:setorId — contagem de documentos por competência (sem os da lixeira)
router.get('/mapa/:clienteId/:setorId', autenticar, async (req, res) => {
  try {
    const { clienteId, setorId } = req.params;
    if (!temAcessoAoSetor(req.usuario, setorId)) return res.status(403).json({ erro: 'Você não tem acesso a este setor.' });

    const cliente = await Cliente.findOne({ _id: clienteId, empresa: req.usuario.empresa._id }).select('_id').lean();
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const mongoose = require('mongoose');
    const agregado = await Documento.aggregate([
      { $match: { cliente: new mongoose.Types.ObjectId(clienteId), setor: new mongoose.Types.ObjectId(setorId), tipo: 'demanda', ...NAO_EXCLUIDO } },
      { $group: { _id: '$competencia', total: { $sum: 1 } } },
    ]);
    const mapa = {};
    agregado.forEach(a => { mapa[a._id] = a.total; });
    res.json(mapa);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar mapa de documentos.' });
  }
});

// GET /api/documentos/lixeira — precisa vir antes das rotas '/:id/...' pra não ser capturada por elas.
// Titular vê a lixeira da empresa inteira; colaborador vê só o que ele mesmo excluiu.
router.get('/lixeira', autenticar, async (req, res) => {
  try {
    await purgarExpirados(req.usuario.empresa._id);

    const filtro = { empresa: req.usuario.empresa._id, excluido: true };
    if (req.usuario.cargo !== 'admin') {
      // Além do que o próprio usuário excluiu, o responsável de um setor também vê o que
      // qualquer colaborador do setor dele excluiu.
      const setoresQueRespondePor = await Setor.find({ empresa: req.usuario.empresa._id, responsavel: req.usuario._id }).select('_id').lean();
      const setorIds = setoresQueRespondePor.map(s => s._id);
      filtro.$or = [{ excluidoPor: req.usuario._id }, { setor: { $in: setorIds } }];
    }

    const documentos = await Documento.find(filtro)
      .populate('excluidoPor', 'nome')
      .populate('enviadoPor', 'nome')
      .sort({ excluidoEm: -1 })
      .lean();

    res.json(documentos.map(d => ({ ...d, diasRestantes: diasRestantes(d.excluidoEm) })));
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar a lixeira.' });
  }
});

// GET /api/documentos/armazenamento?busca=termo
// Lista o que ocupa espaço (fora da lixeira): titular vê tudo da empresa, colaborador só o que enviou.
// O total em bytes é sempre da empresa inteira — é métrica de conta/plano, não do usuário.
router.get('/armazenamento', autenticar, async (req, res) => {
  try {
    const filtro = { empresa: req.usuario.empresa._id, ...NAO_EXCLUIDO };
    if (req.usuario.cargo !== 'admin') filtro.enviadoPor = req.usuario._id;

    const busca = (req.query.busca || '').trim();
    if (busca) {
      // Escapa o termo — sem isso, um "(" digitado na busca quebra a regex e derruba a rota
      filtro.nomeOriginal = { $regex: busca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const documentos = await Documento.find(filtro)
      .populate('enviadoPor', 'nome')
      .sort({ enviadoEm: -1 })
      .lean();

    const mongoose = require('mongoose');
    const agregado = await Documento.aggregate([
      { $match: { empresa: new mongoose.Types.ObjectId(req.usuario.empresa._id), ...NAO_EXCLUIDO } },
      { $group: { _id: null, total: { $sum: '$tamanho' } } },
    ]);

    res.json({ documentos, totalBytesEmpresa: agregado[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar o armazenamento.' });
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

// PATCH /api/documentos/:id/excluir — manda pra lixeira (some da listagem de origem na hora)
router.patch('/:id/excluir', autenticar, async (req, res) => {
  try {
    const documento = await Documento.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!documento) return res.status(404).json({ erro: 'Documento não encontrado.' });
    if (documento.excluido) return res.status(400).json({ erro: 'Este documento já está na lixeira.' });
    if (!(await podeGerenciar(req.usuario, documento))) return res.status(403).json({ erro: 'Sem permissão para excluir este documento.' });

    documento.excluido = true;
    documento.excluidoPor = req.usuario._id;
    documento.excluidoEm = new Date();
    await documento.save();
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'documento_excluido', descricao: `Moveu o documento ${documento.nomeOriginal} para a lixeira` });
    res.json(documento);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir documento.' });
  }
});

// PATCH /api/documentos/:id/restaurar — só quem excluiu ou o titular; volta a aparecer no lugar de origem
router.patch('/:id/restaurar', autenticar, async (req, res) => {
  try {
    const documento = await Documento.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id, excluido: true });
    if (!documento) return res.status(404).json({ erro: 'Documento não encontrado na lixeira.' });

    const souDono = documento.excluidoPor?.toString() === req.usuario._id.toString();
    if (req.usuario.cargo !== 'admin' && !souDono) {
      return res.status(403).json({ erro: 'Só quem excluiu o documento (ou o titular) pode restaurá-lo.' });
    }

    // Segurança extra: o purge lazy já deveria ter apagado, mas se a lixeira não foi aberta
    // desde o vencimento o registro ainda existe — tratar como se não existisse mais.
    if (diasRestantes(documento.excluidoEm) <= 0) {
      return res.status(404).json({ erro: 'Documento não encontrado na lixeira.' });
    }

    documento.excluido = false;
    documento.excluidoPor = null;
    documento.excluidoEm = null;
    await documento.save();
    registrarLog({ empresa: req.usuario.empresa._id, usuario: req.usuario._id, tipo: 'documento_restaurado', descricao: `Restaurou o documento ${documento.nomeOriginal} da lixeira` });
    res.json(documento);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao restaurar documento.' });
  }
});

// DELETE /api/documentos/:id — exclusão permanente imediata (banco + R2), fora do fluxo da lixeira
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const documento = await Documento.findOne({ _id: req.params.id, empresa: req.usuario.empresa._id });
    if (!documento) return res.status(404).json({ erro: 'Documento não encontrado.' });
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
