// Camada BÁSICA de segurança dos arquivos enviados (Spec C). Não é antivírus: não detecta vírus por
// assinatura nem ameaças sofisticadas — só barra o que é perigoso por construção (nome enganoso,
// conteúdo ativo em PDF, macro/objeto embutido no Office, imagem com dados escondidos, CSV binário).
// Tudo roda em memória sobre o Buffer recebido; nada é gravado nem executado.
const zlib = require('zlib');
const { inspecionarPacoteOOXML, inspecionarCFB, pareceOOXML } = require('./pacoteOffice');

// ── Tipos reais aceitos ──
// O tipo é definido pelo CONTEÚDO (magic bytes / estrutura), nunca pelo nome ou pelo mimetype declarado.
const TIPOS = {
  'application/pdf':                                                            { rotulo: 'PDF', exts: ['pdf'] },
  'image/jpeg':                                                                 { rotulo: 'imagem JPG', exts: ['jpg', 'jpeg', 'jpe', 'jfif'] },
  'image/png':                                                                  { rotulo: 'imagem PNG', exts: ['png'] },
  'application/vnd.ms-excel':                                                   { rotulo: 'planilha Excel (XLS)', exts: ['xls'] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':          { rotulo: 'planilha Excel (XLSX)', exts: ['xlsx'] },
  'application/msword':                                                         { rotulo: 'documento Word (DOC)', exts: ['doc'] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':    { rotulo: 'documento Word (DOCX)', exts: ['docx'] },
  'text/csv':                                                                   { rotulo: 'CSV', exts: ['csv'] },
};
const MIME_CSV = ['text/csv', 'application/vnd.ms-excel']; // o que os navegadores declaram pra .csv

const MSG_TIPO_NAO_PERMITIDO = 'Tipo de arquivo não permitido. Aceitos: PDF, imagem (JPG/PNG), planilha (XLS/XLSX/CSV) e Word (DOC/DOCX).';

// ── Nome e extensão ──
const MAX_NOME = 150;
// Extensões de programa/script. Vale pra QUALQUER parte do nome (pega "relatorio.pdf.exe" e "nota.exe.pdf").
const EXT_PERIGOSAS = new Set(['exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'js', 'vbs', 'ps1', 'jar', 'lnk', 'hta', 'dll', 'sh', 'html', 'htm', 'svg', 'iso', 'img', 'apk',
  'vbe', 'jse', 'wsf', 'wsh', 'pif', 'reg', 'cpl', 'msc', 'msp']);
// Formatos do Office que carregam macro: barrados pela extensão, mesmo que o conteúdo pareça aceito
const EXT_COM_MACRO = new Set(['docm', 'xlsm', 'xlsb', 'pptm', 'dotm', 'xltm', 'xlam', 'potm', 'ppam', 'ppsm', 'sldm']);
// Caracteres de controle e de formatação invisível (inclui os de inversão de texto, usados pra disfarçar ".exe")
const CHARS_INVALIDOS_NOME = new RegExp('[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]');

// O multer decodifica o nome do arquivo como latin1, então "Relatório" chega como "RelatÃ³rio". Se a string
// toda cabe em latin1 e re-lida como UTF-8 fica válida, era isso — conserta. Senão devolve como veio.
function repararCodificacao(nome) {
  if (typeof nome !== 'string' || !/[\u0080-\u00FF]/.test(nome) || /[^\u0000-\u00FF]/.test(nome)) return nome;
  const reparado = Buffer.from(nome, 'latin1').toString('utf8');
  return reparado.includes('�') ? nome : reparado;
}

const extensaoFinal = (nome) => { const i = nome.lastIndexOf('.'); return i > 0 ? nome.slice(i + 1).trim().toLowerCase() : ''; };

// Confere e limpa o nome. Retorna { nome } (limpo) ou { motivo, codigo }
function validarNome(nomeBruto) {
  let nome = repararCodificacao(String(nomeBruto ?? ''));
  nome = nome.split(/[\\/]/).pop();                        // só o nome do arquivo, nunca um caminho
  if (CHARS_INVALIDOS_NOME.test(nome)) return { motivo: 'o nome do arquivo tem caracteres inválidos', codigo: 'nome_invalido' };
  nome = nome.normalize('NFC').trim().replace(/[. ]+$/, ''); // ponto/espaço no fim são ignorados pelo Windows ("nota.exe.")
  if (!nome) return { motivo: 'o nome do arquivo está vazio ou é inválido', codigo: 'nome_invalido' };
  if (nome.length > MAX_NOME) return { motivo: `o nome do arquivo é longo demais (máximo de ${MAX_NOME} caracteres)`, codigo: 'nome_longo' };

  const partes = nome.split('.').map(p => p.trim().toLowerCase());
  for (let i = 1; i < partes.length; i++) { // a 1ª parte é o nome-base, não uma extensão
    const p = partes[i];
    // "empresa.com.br": ".com" seguido de código de país é domínio, não executável
    if (p === 'com' && /^[a-z]{2}(?![a-z])/.test(partes[i + 1] || '')) continue;
    if (EXT_PERIGOSAS.has(p)) return { motivo: `o nome do arquivo tem extensão de programa (.${p})`, codigo: 'extensao_perigosa' };
  }
  const ext = extensaoFinal(nome);
  if (EXT_COM_MACRO.has(ext)) return { motivo: `arquivos .${ext} podem conter macros`, codigo: 'extensao_macro' };
  return { nome };
}

// ── CSV ──
// Texto de verdade: sem bytes nulos nem caracteres de controle (aceita qualquer codificação de texto, inclusive
// o Windows-1252 que o Excel usa; UTF-16 só com marca BOM).
function csvEhTexto(buf) {
  const ctrlRuim = (c) => (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D && c !== 0x0C) || c === 0x7F;
  const bomLE = buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE;
  const bomBE = buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF;
  if (bomLE || bomBE) { // UTF-16 com BOM: os bytes nulos são normais, então confere os caracteres
    const dados = Buffer.from(buf.subarray(2, buf.length - (buf.length % 2)));
    if (bomBE) dados.swap16();
    const texto = dados.toString('utf16le').replace(/+$/, '');
    for (let i = 0; i < texto.length; i++) if (ctrlRuim(texto.charCodeAt(i))) return false;
    return true;
  }
  let fim = buf.length;
  while (fim > 0 && buf[fim - 1] === 0x1A) fim--; // Ctrl-Z de arquivos antigos do DOS
  for (let i = 0; i < fim; i++) if (ctrlRuim(buf[i])) return false; // inclui o byte nulo
  return true;
}

// ── PDF ──
// Conteúdo ativo: nomes de chave que o PDF não pode ter. Comparação exata do token (/JS não casa com /JSON).
const CHAVES_PDF_PERIGOSAS = {
  JavaScript:       ['o PDF contém scripts (JavaScript)', 'pdf_javascript'],
  JS:               ['o PDF contém scripts (JavaScript)', 'pdf_javascript'],
  Launch:           ['o PDF abre ou executa programas externos', 'pdf_launch'],
  EmbeddedFile:     ['o PDF tem arquivos anexados dentro dele', 'pdf_anexo'],
  EmbeddedFiles:    ['o PDF tem arquivos anexados dentro dele', 'pdf_anexo'],
  FileAttachment:   ['o PDF tem arquivos anexados dentro dele', 'pdf_anexo'],
  RichMedia:        ['o PDF tem conteúdo multimídia interativo (como Flash)', 'pdf_midia'],
  RichMediaContent: ['o PDF tem conteúdo multimídia interativo (como Flash)', 'pdf_midia'],
  Movie:            ['o PDF tem conteúdo multimídia interativo (como Flash)', 'pdf_midia'],
  '3D':             ['o PDF tem conteúdo multimídia interativo (como Flash)', 'pdf_midia'],
};
const MAX_FLATE_PDF = 32 * 1024 * 1024;      // teto de descompressão de cada object stream
const MAX_FLATE_PDF_TOTAL = 96 * 1024 * 1024;

const decodificarNomePDF = (token) => token.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// Procura chaves perigosas num trecho de texto do PDF. Tira antes as strings entre parênteses (conteúdo de
// texto, onde "/JS" não é uma chave) e decodifica os "#xx" dos nomes ("/J#61vaScript").
function achaChavePerigosa(texto) {
  const semStrings = texto.replace(/\((?:\\[\s\S]|[^\\()])*\)/g, '()');
  const re = /\/([^\s\/\[\]<>(){}%]+)/g;
  let m;
  while ((m = re.exec(semStrings))) {
    const nome = decodificarNomePDF(m[1]);
    if (Object.prototype.hasOwnProperty.call(CHAVES_PDF_PERIGOSAS, nome)) { const [motivo, codigo] = CHAVES_PDF_PERIGOSAS[nome]; return { motivo, codigo, chave: nome }; }
  }
  return null;
}

function decodificarASCII85(buf) {
  const txt = buf.toString('latin1').replace(/\s+/g, '').replace(/^<~/, '').replace(/~>.*$/s, '');
  const saida = []; let grupo = [];
  for (const ch of txt) {
    if (ch === 'z' && !grupo.length) { saida.push(0, 0, 0, 0); continue; }
    const v = ch.charCodeAt(0) - 33;
    if (v < 0 || v > 84) throw new Error('ascii85');
    grupo.push(v);
    if (grupo.length === 5) { let n = 0; for (const g of grupo) n = n * 85 + g; saida.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255); grupo = []; }
  }
  if (grupo.length > 1) { const falta = 5 - grupo.length; while (grupo.length < 5) grupo.push(84); let n = 0; for (const g of grupo) n = n * 85 + g; const b = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; saida.push(...b.slice(0, 4 - falta)); }
  return Buffer.from(saida);
}

// Descompacta o corpo de um stream conforme /Filter. Só os filtros de texto/zlib; outro filtro → null (não verificável)
function decodificarStreamPDF(corpo, dict) {
  const filtro = (dict.match(/\/Filter\s*(\[[^\]]*\]|\/[^\s\/\[\]<>(){}%]+)/) || [])[1];
  if (!filtro) return corpo;
  const nomes = (filtro.match(/\/[^\s\/\[\]<>(){}%]+/g) || []).map(n => n.slice(1));
  let dados = corpo;
  for (const nome of nomes) {
    if (nome === 'FlateDecode' || nome === 'Fl') dados = zlib.inflateSync(dados, { maxOutputLength: MAX_FLATE_PDF });
    else if (nome === 'ASCIIHexDecode' || nome === 'AHx') { let h = dados.toString('latin1').replace(/[^0-9a-fA-F]/g, ''); if (h.length % 2) h += '0'; dados = Buffer.from(h, 'hex'); }
    else if (nome === 'ASCII85Decode' || nome === 'A85') dados = decodificarASCII85(dados);
    else return null;
  }
  return dados;
}

function inspecionarPDF(buf) {
  const t = buf.toString('latin1');
  const pedacosForaDeStream = [];
  const objStreams = [];
  let marcador = 0, objInicio = 0;
  const re = /\bobj\b|\bstream(?:\r\n|\n|\r)/g;
  let m;
  while ((m = re.exec(t))) {
    if (m[0] === 'obj') { pedacosForaDeStream.push(t.slice(marcador, m.index)); marcador = m.index; objInicio = m.index; continue; }
    // "stream": o dicionário é o que vem desde o "obj" anterior; o corpo vai até "endstream"
    const dict = decodificarNomePDF(t.slice(objInicio, m.index));
    const inicioCorpo = m.index + m[0].length;
    let fimCorpo = t.indexOf('endstream', inicioCorpo);
    if (fimCorpo < 0) fimCorpo = t.length;
    pedacosForaDeStream.push(t.slice(marcador, inicioCorpo));
    if (/\/Type\s*\/ObjStm\b/.test(dict)) objStreams.push({ dict, inicio: inicioCorpo, fim: fimCorpo });
    marcador = fimCorpo;
    re.lastIndex = fimCorpo;
  }
  pedacosForaDeStream.push(t.slice(marcador));

  // 1) Estrutura do PDF fora dos corpos dos streams (dicionários, ações, anexos)
  const achado = achaChavePerigosa(pedacosForaDeStream.join('\n'));
  if (achado) return achado;

  // 2) Object streams (PDF 1.5+) escondem dicionários dentro de blocos compactados: descompacta e olha lá também.
  //    PDF criptografado (comum em extratos de banco) não dá pra olhar por dentro — é uma limitação conhecida.
  const criptografado = /\/Encrypt\b/.test(pedacosForaDeStream.join('\n'));
  let totalInflado = 0;
  for (const os of objStreams) {
    let dados;
    try { dados = decodificarStreamPDF(buf.subarray(os.inicio, os.fim), os.dict); }
    catch (err) {
      if (err && err.code === 'ERR_BUFFER_TOO_LARGE') return { motivo: 'o PDF tem uma estrutura interna exagerada', codigo: 'pdf_exagerado' };
      continue; // criptografado ou corrompido: nenhum leitor consegue executar o que não consegue ler
    }
    if (dados === null) { if (criptografado) continue; return { motivo: 'o PDF tem uma estrutura interna que não conseguimos verificar', codigo: 'pdf_nao_verificavel' }; }
    totalInflado += dados.length;
    if (totalInflado > MAX_FLATE_PDF_TOTAL) return { motivo: 'o PDF tem uma estrutura interna exagerada', codigo: 'pdf_exagerado' };
    const dentro = achaChavePerigosa(dados.toString('latin1'));
    if (dentro) return dentro;
  }
  return null;
}

// ── Imagens ──
const MAX_PIXELS = 250 * 1024 * 1024;
const PREENCHIMENTO_OK = (buf, de) => { // depois do fim da imagem só pode ter zeros/espaços, e pouco
  if (buf.length - de > 64) return false;
  for (let i = de; i < buf.length; i++) if (![0x00, 0x0A, 0x0D, 0x20].includes(buf[i])) return false;
  return true;
};

const tabelaCRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf, ini, fim) => { let c = 0xFFFFFFFF; for (let i = ini; i < fim; i++) c = tabelaCRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

const IMG_CORROMPIDA = { motivo: 'a imagem está corrompida ou incompleta', codigo: 'imagem_corrompida' };
const IMG_SOBRA = { motivo: 'a imagem tem dados estranhos escondidos no final do arquivo', codigo: 'imagem_dados_extras' };
const IMG_GRANDE = { motivo: 'a imagem tem dimensões exageradas', codigo: 'imagem_exagerada' };

function inspecionarPNG(buf) {
  if (buf.length < 8 + 25 + 12) return IMG_CORROMPIDA;
  let pos = 8, viuIHDR = false, viuIDAT = false;
  while (pos + 12 <= buf.length) {
    const tam = buf.readUInt32BE(pos);
    const tipo = buf.toString('latin1', pos + 4, pos + 8);
    if (!/^[A-Za-z]{4}$/.test(tipo) || pos + 12 + tam > buf.length) return IMG_CORROMPIDA;
    if (buf.readUInt32BE(pos + 8 + tam) !== crc32(buf, pos + 4, pos + 8 + tam)) return IMG_CORROMPIDA;
    if (!viuIHDR) {
      if (tipo !== 'IHDR' || tam !== 13) return IMG_CORROMPIDA;
      const largura = buf.readUInt32BE(pos + 8), altura = buf.readUInt32BE(pos + 12);
      if (!largura || !altura || largura > 0x7FFFFFFF || altura > 0x7FFFFFFF) return IMG_CORROMPIDA;
      if (largura * altura > MAX_PIXELS) return IMG_GRANDE;
      viuIHDR = true;
    } else if (tipo === 'IDAT') viuIDAT = true;
    pos += 12 + tam;
    if (tipo === 'IEND') {
      if (!viuIDAT) return IMG_CORROMPIDA;
      return PREENCHIMENTO_OK(buf, pos) ? null : IMG_SOBRA;
    }
  }
  return IMG_CORROMPIDA; // acabou sem IEND
}

// Percorre os segmentos do JPEG até o EOI. Retorna { fim, mpf } ou { erro }
function percorrerJPEG(buf, inicio) {
  if (buf[inicio] !== 0xFF || buf[inicio + 1] !== 0xD8) return { erro: IMG_CORROMPIDA };
  let pos = inicio + 2, achouSOF = false, achouSOS = false, mpf = false;
  while (pos < buf.length) {
    if (buf[pos] !== 0xFF) return { erro: IMG_CORROMPIDA };
    while (buf[pos] === 0xFF) pos++; // bytes de preenchimento
    const marcador = buf[pos++];
    if (marcador === undefined) break;
    if (marcador === 0xD9) return achouSOF && achouSOS ? { fim: pos, mpf } : { erro: IMG_CORROMPIDA };
    if (marcador === 0x00 || marcador === 0x01 || (marcador >= 0xD0 && marcador <= 0xD8)) continue; // sem corpo
    if (pos + 2 > buf.length) return { erro: IMG_CORROMPIDA };
    const tam = buf.readUInt16BE(pos);
    if (tam < 2 || pos + tam > buf.length) return { erro: IMG_CORROMPIDA };
    if (marcador >= 0xC0 && marcador <= 0xCF && marcador !== 0xC4 && marcador !== 0xC8 && marcador !== 0xCC) {
      if (tam < 8) return { erro: IMG_CORROMPIDA };
      const altura = buf.readUInt16BE(pos + 3), largura = buf.readUInt16BE(pos + 5);
      if (!altura || !largura) return { erro: IMG_CORROMPIDA };
      if (largura * altura > MAX_PIXELS) return { erro: IMG_GRANDE };
      achouSOF = true;
    }
    if (marcador === 0xE2 && buf.toString('latin1', pos + 2, pos + 6) === 'MPF\0') mpf = true;
    pos += tam;
    if (marcador === 0xDA) { // dados da imagem: segue até o próximo marcador de verdade
      achouSOS = true;
      for (;;) {
        const i = buf.indexOf(0xFF, pos);
        if (i < 0 || i + 1 >= buf.length) return { erro: IMG_CORROMPIDA };
        const prox = buf[i + 1];
        if (prox === 0x00 || (prox >= 0xD0 && prox <= 0xD7) || prox === 0xFF) { pos = i + 1; continue; }
        pos = i; break;
      }
    }
  }
  return { erro: IMG_CORROMPIDA };
}

function inspecionarJPEG(buf) {
  let r = percorrerJPEG(buf, 0);
  if (r.erro) return r.erro;
  let fim = r.fim;
  // Fotos de celular novas (HDR) trazem imagens extras coladas depois do fim (formato MPF, declarado no
  // cabeçalho). Aceita só se cada trecho extra também for um JPEG íntegro.
  if (r.mpf) {
    for (let n = 0; n < 4; n++) {
      while (fim < buf.length && buf[fim] === 0x00) fim++;
      if (fim + 2 >= buf.length || buf[fim] !== 0xFF || buf[fim + 1] !== 0xD8) break;
      const extra = percorrerJPEG(buf, fim);
      if (extra.erro) return extra.erro;
      fim = extra.fim;
    }
  }
  return PREENCHIMENTO_OK(buf, fim) ? null : IMG_SOBRA;
}

// ── Orquestração ──

const bloqueado = (motivo, codigo) => ({ ok: false, motivo: `Arquivo bloqueado por segurança: ${motivo}.`, motivoCurto: motivo, codigo });

// Valida um arquivo recebido. Retorna:
//   { ok: true, nome, mime }                    — liberado (nome já limpo)
//   { ok: false, motivo, motivoCurto, codigo }  — barrado (motivo = mensagem pro usuário)
async function validarArquivo({ nomeOriginal, buffer, mimetype }) {
  const nome = validarNome(nomeOriginal);
  if (!nome.nome) return bloqueado(nome.motivo, nome.codigo);
  if (!buffer || buffer.length === 0) return bloqueado('o arquivo está vazio', 'arquivo_vazio');
  const ext = extensaoFinal(nome.nome);

  // 1) Tipo real pelo conteúdo. CSV não tem marca: vale se o nome for .csv e o navegador declarou CSV
  let mime;
  if (ext === 'csv' && MIME_CSV.includes(mimetype)) mime = 'text/csv';
  else {
    const { fileTypeFromBuffer } = await import('file-type');
    const detectado = await fileTypeFromBuffer(buffer);
    mime = detectado?.mime;
    if (mime === 'application/x-cfb') { // XLS e DOC antigos: o file-type só diz "contêiner", a gente olha dentro
      try {
        const cfb = inspecionarCFB(buffer);
        if (cfb.tipo === 'protegido') return bloqueado('arquivos protegidos por senha não podem ser enviados', 'protegido');
        mime = cfb.tipo === 'xls' ? 'application/vnd.ms-excel' : cfb.tipo === 'doc' ? 'application/msword' : undefined;
        if (mime && cfb.macro) return bloqueado('o arquivo contém macros', 'macro');
      } catch { return bloqueado('o arquivo está malformado', 'pacote_invalido'); }
    }
    if (mime === 'application/zip' && pareceOOXML(buffer)) { const p = inspecionarPacoteOOXML(buffer); if (p) return bloqueado(p.motivo, p.codigo); }
    if (!mime || !TIPOS[mime] || mime === 'text/csv') return { ok: false, motivo: MSG_TIPO_NAO_PERMITIDO, motivoCurto: 'tipo de arquivo não permitido', codigo: 'tipo_nao_permitido' };
  }

  // 2) A extensão final precisa ser a do tipo real
  if (!TIPOS[mime].exts.includes(ext)) {
    return bloqueado(`a extensão do nome (${ext ? '.' + ext : 'nenhuma'}) não corresponde ao conteúdo do arquivo (${TIPOS[mime].rotulo})`, 'extensao_diferente');
  }

  // 3) Conteúdo, por tipo
  let problema = null;
  if (mime === 'application/pdf') problema = inspecionarPDF(buffer);
  else if (mime === 'image/png') problema = inspecionarPNG(buffer);
  else if (mime === 'image/jpeg') problema = inspecionarJPEG(buffer);
  else if (mime === 'text/csv') problema = csvEhTexto(buffer) ? null : { motivo: 'o arquivo CSV não é um texto válido (tem conteúdo binário)', codigo: 'csv_binario' };
  else if (mime.includes('openxmlformats')) problema = inspecionarPacoteOOXML(buffer);
  if (problema) return bloqueado(problema.motivo, problema.codigo);

  return { ok: true, nome: nome.nome, mime };
}

// ── Download ──

const ehExtPerigosa = (ext) => EXT_PERIGOSAS.has(ext) || EXT_COM_MACRO.has(ext);

// Nome seguro pro cabeçalho Content-Disposition: sem aspas/caracteres que quebrem o cabeçalho, com acentos
// corretos (filename* em UTF-8) e com a extensão do tipo real. Serve também pra documentos antigos
// (nome com acento quebrado, extensão trocada).
function nomeParaDownload(nomeOriginal, mime) {
  let nome = repararCodificacao(String(nomeOriginal ?? '')).split(/[\\/]/).pop()
    .replace(CHARS_INVALIDOS_NOME, '').replace(/["<>:|?*]/g, '').normalize('NFC').trim().replace(/[. ]+$/, '');
  if (!nome) nome = 'documento';
  const tipo = TIPOS[mime];
  if (tipo) {
    const ext = extensaoFinal(nome);
    if (!tipo.exts.includes(ext)) {
      if (ext && ehExtPerigosa(ext)) nome = nome.slice(0, nome.lastIndexOf('.'));
      nome = `${nome || 'documento'}.${tipo.exts[0]}`;
    }
  }
  const ascii = nome.normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[^A-Za-z0-9._ ()\-]/g, '_');
  const utf8 = encodeURIComponent(nome).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return { nome, cabecalho: `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}` };
}

module.exports = { validarArquivo, validarNome, nomeParaDownload, repararCodificacao, inspecionarPDF, inspecionarPNG, inspecionarJPEG, csvEhTexto, TIPOS, MSG_TIPO_NAO_PERMITIDO };
