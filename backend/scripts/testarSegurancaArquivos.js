// Testes da camada básica de segurança de arquivos (services/validarArquivo.js + pacoteOffice.js).
// Roda com `node scripts/testarSegurancaArquivos.js` (dentro de backend/). Não toca no banco nem no R2:
// todos os arquivos de teste são INOFENSIVOS e montados em memória (nenhum vírus real) — imitam só a
// forma de cada caso (PDF com marca de JavaScript, pacote com vbaProject.bin, imagem com sobra no fim...).
const zlib = require('zlib');
const { validarArquivo, validarNome, nomeParaDownload, repararCodificacao } = require('../services/validarArquivo');

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { falhas++; console.log('  XX FALHOU:', msg); } };
const secao = (t) => console.log('\n' + t);

// ───────────── construtores de arquivos de teste ─────────────
const tabela = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = tabela[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const buf = (x) => Buffer.isBuffer(x) ? x : Buffer.from(x);

// ZIP: entradas { nome, dados, metodo?, tamDeclarado?, flags?, linkSimbolico? }
function zip(entradas, { lixoNoFim = null, sobrepor = false, comentario = '' } = {}) {
  const partes = [], central = []; let off = 0;
  entradas.forEach((e, i) => {
    const nome = Buffer.from(e.nome, 'utf8'), dados = buf(e.dados ?? '');
    const metodo = e.metodo ?? 8, comp = metodo === 8 ? zlib.deflateRawSync(dados) : dados;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(e.flags ?? 0, 6); local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc32(dados), 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(e.tamDeclarado ?? dados.length, 22); local.writeUInt16LE(nome.length, 26);
    const offLocal = sobrepor && i > 0 ? 0 : off; // "sobrepor": todas as entradas apontam pro mesmo trecho
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(e.linkSimbolico ? 0x031E : 20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(e.flags ?? 0, 8); c.writeUInt16LE(metodo, 10);
    c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc32(dados), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(e.tamDeclarado ?? dados.length, 24);
    c.writeUInt16LE(nome.length, 28); c.writeUInt32LE(e.linkSimbolico ? (0xA000 << 16) >>> 0 : 0, 38); c.writeUInt32LE(offLocal, 42);
    central.push(Buffer.concat([c, nome]));
    if (!(sobrepor && i > 0)) { partes.push(local, nome, comp); off += 30 + nome.length + comp.length; }
  });
  const cd = Buffer.concat(central), com = Buffer.from(comentario);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entradas.length, 8); eocd.writeUInt16LE(entradas.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16); eocd.writeUInt16LE(com.length, 20);
  return Buffer.concat([...partes, cd, eocd, com, lixoNoFim ? buf(lixoNoFim) : Buffer.alloc(0)]);
}

const CT_DOCX = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const CT_XLSX = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>';
const RELS = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
const relacao = (tipo, alvo, externo = true) => `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tipo}" Target="${alvo}"${externo ? ' TargetMode="External"' : ''}/></Relationships>`;

const docx = (extra = [], ct = CT_DOCX) => zip([
  { nome: '[Content_Types].xml', dados: ct }, { nome: '_rels/.rels', dados: RELS },
  { nome: 'word/document.xml', dados: '<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Contrato de teste</w:t></w:r></w:p></w:body></w:document>' }, ...extra,
]);
const xlsx = (extra = [], ct = CT_XLSX) => zip([
  { nome: '[Content_Types].xml', dados: ct }, { nome: '_rels/.rels', dados: RELS },
  { nome: 'xl/workbook.xml', dados: '<workbook xmlns="x"><sheets><sheet name="Plan1" sheetId="1" r:id="rId1"/></sheets></workbook>' }, ...extra,
]);

// PDF
const pdf = ({ extraObj = '', trailer = '', bodyExtra = '' } = {}) => Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R ' + extraObj + ' >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
  '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>\nendobj\n' +
  '4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 10 100 Td (Guia de teste) Tj ET\nendstream\nendobj\n' + bodyExtra +
  'trailer\n<< /Root 1 0 R ' + trailer + ' >>\n%%EOF\n', 'latin1');
const objStm = (conteudo, filtro = '/FlateDecode', comprimir = true) => {
  const dados = comprimir ? zlib.deflateSync(Buffer.from(conteudo)) : Buffer.from(conteudo);
  return Buffer.concat([Buffer.from(`5 0 obj\n<< /Type /ObjStm /N 1 /First 4 ${filtro ? '/Filter ' + filtro : ''} /Length ${dados.length} >>\nstream\n`), dados, Buffer.from('\nendstream\nendobj\n')]);
};
const pdfComObjStm = (conteudo, filtro, comprimir) => Buffer.concat([
  Buffer.from(pdf().toString('latin1').split('trailer')[0], 'latin1'), objStm(conteudo, filtro, comprimir), Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n')]);

// PNG
const chunk = (tipo, dados) => { const t = Buffer.from(tipo, 'latin1'); const len = Buffer.alloc(4); len.writeUInt32BE(dados.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados]))); return Buffer.concat([len, t, dados, crc]); };
const png = (w = 8, h = 8) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const linhas = []; for (let y = 0; y < h; y++) linhas.push(Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x80)]));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(linhas))), chunk('IEND', Buffer.alloc(0))]);
};

// JPEG (estrutura íntegra: SOI, APP0, DQT, SOF0, DHT, SOS + dados, EOI)
const seg = (marcador, dados) => { const l = Buffer.alloc(2); l.writeUInt16BE(dados.length + 2); return Buffer.concat([Buffer.from([0xFF, marcador]), l, dados]); };
const jpeg = ({ mpf = false, w = 8, h = 8 } = {}) => {
  const sof = Buffer.from([8, 0, h, 0, w, 1, 1, 0x11, 0]);
  const dht = Buffer.concat([Buffer.from([0x00]), Buffer.alloc(16, 0).fill(1, 0, 1), Buffer.from([0])]);
  const scan = Buffer.from([0x7F, 0xFF, 0x00, 0x55, 0xFF, 0xD0, 0x2A, 0x11]); // com byte-stuffing (FF00) e marcador RST
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), seg(0xE0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')), mpf ? seg(0xE2, Buffer.from('MPF\0abcdefgh')) : Buffer.alloc(0),
    seg(0xDB, Buffer.alloc(65, 1)), seg(0xC0, sof), seg(0xC4, dht), seg(0xDA, Buffer.from([1, 1, 0, 0, 0x3F, 0])), scan, Buffer.from([0xFF, 0xD9])]);
};

// CFB (DOC/XLS antigos): setor de 512 bytes; streams pequenos são "esticados" pra 4096 (sem mini-stream)
function cfb(entradas) { // entradas: [{ nome, tipo: 1|2, dados? }]
  const LIVRE = 0xFFFFFFFF, FIM = 0xFFFFFFFE, FATSECT = 0xFFFFFFFD;
  const streams = entradas.map(e => e.tipo === 2 ? Buffer.concat([buf(e.dados ?? ''), Buffer.alloc(Math.max(0, 4096 - buf(e.dados ?? '').length))]) : null);
  const nDir = Math.ceil((entradas.length + 1) / 4);
  const setoresStream = streams.map(s => s ? Math.ceil(s.length / 512) : 0);
  const totalSetores = 1 + nDir + setoresStream.reduce((a, b) => a + b, 0);
  const fat = new Array(128).fill(LIVRE); fat[0] = FATSECT;
  for (let i = 0; i < nDir; i++) fat[1 + i] = i === nDir - 1 ? FIM : 2 + i;
  let prox = 1 + nDir; const inicios = [];
  streams.forEach((s, i) => { if (!s) { inicios.push(FIM); return; } inicios.push(prox); for (let k = 0; k < setoresStream[i]; k++) fat[prox + k] = k === setoresStream[i] - 1 ? FIM : prox + k + 1; prox += setoresStream[i]; });
  if (totalSetores > 128) throw new Error('fixture grande demais pra 1 setor de FAT');
  const cab = Buffer.alloc(512, 0);
  Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]).copy(cab, 0);
  cab.writeUInt16LE(0x3E, 24); cab.writeUInt16LE(3, 26); cab.writeUInt16LE(0xFFFE, 28); cab.writeUInt16LE(9, 30); cab.writeUInt16LE(6, 32);
  cab.writeUInt32LE(1, 44); cab.writeUInt32LE(1, 48); cab.writeUInt32LE(4096, 56); cab.writeUInt32LE(FIM, 60); cab.writeUInt32LE(FIM, 68);
  cab.writeUInt32LE(0, 76); for (let i = 1; i < 109; i++) cab.writeUInt32LE(LIVRE, 76 + i * 4);
  const fatBuf = Buffer.alloc(512); fat.forEach((v, i) => fatBuf.writeUInt32LE(v, i * 4));
  const dir = Buffer.alloc(nDir * 512, 0);
  const escreve = (idx, nome, tipo, esq, dirId, filho, inicio, tam) => {
    const o = idx * 128, n = Buffer.from(nome, 'utf16le'); n.copy(dir, o); dir.writeUInt16LE(n.length + 2, o + 64); dir[o + 66] = tipo; dir[o + 67] = 1;
    dir.writeUInt32LE(esq, o + 68); dir.writeUInt32LE(dirId, o + 72); dir.writeUInt32LE(filho, o + 76); dir.writeUInt32LE(inicio, o + 116); dir.writeUInt32LE(tam, o + 120);
  };
  escreve(0, 'Root Entry', 5, LIVRE, LIVRE, entradas.length ? 1 : LIVRE, FIM, 0);
  entradas.forEach((e, i) => escreve(i + 1, e.nome, e.tipo, LIVRE, i + 1 < entradas.length ? i + 2 : LIVRE, LIVRE, inicios[i], streams[i] ? streams[i].length : 0));
  for (let i = entradas.length + 1; i < nDir * 4; i++) { const o = i * 128; dir.writeUInt32LE(LIVRE, o + 68); dir.writeUInt32LE(LIVRE, o + 72); dir.writeUInt32LE(LIVRE, o + 76); }
  return Buffer.concat([cab, fatBuf, dir, ...streams.filter(Boolean)]);
}
const biff = (tipoPlanilha = 0) => { // BOF + BOUNDSHEET + EOF
  const r = (id, dados) => { const h = Buffer.alloc(4); h.writeUInt16LE(id); h.writeUInt16LE(dados.length, 2); return Buffer.concat([h, dados]); };
  return Buffer.concat([r(0x0809, Buffer.alloc(16)), r(0x0085, Buffer.from([0, 0, 0, 0, 0, tipoPlanilha, 3, 0, 0x50, 0x6C, 0x31])), r(0x000A, Buffer.alloc(0))]);
};
const xlsAntigo = (extras = [], tipoPlanilha = 0) => cfb([{ nome: 'Workbook', tipo: 2, dados: biff(tipoPlanilha) }, { nome: '\u0005SummaryInformation', tipo: 2, dados: 'x' }, ...extras]);
const docAntigo = (extras = []) => cfb([{ nome: 'WordDocument', tipo: 2, dados: 'conteudo word' }, { nome: '1Table', tipo: 2, dados: 'tabela' }, ...extras]);

// ───────────── execução dos testes ─────────────
const v = (nome, buffer, mimetype) => validarArquivo({ nomeOriginal: nome, buffer, mimetype: mimetype || 'application/octet-stream' });
const passa = async (msg, nome, b, mt) => { const r = await v(nome, b, mt); ok(r.ok, `${msg} — deveria PASSAR mas foi barrado: ${r.motivo}`); return r; };
const barra = async (msg, nome, b, trecho, mt) => {
  const r = await v(nome, b, mt);
  ok(!r.ok, `${msg} — deveria ser BLOQUEADO mas passou`);
  if (!r.ok && trecho) ok(r.motivo.includes(trecho), `${msg} — motivo esperado "${trecho}", veio "${r.motivo}"`);
  return r;
};

(async () => {
  secao('1. Nome e extensão');
  await passa('PDF com acento no nome', 'Guia ISS março.pdf', pdf());
  await passa('nome com pontos e (1)', 'Guia ISS 10.2026 (1).pdf', pdf());
  await passa('domínio no nome (.com.br)', 'boleto www.empresa.com.br.pdf', pdf());
  await barra('relatorio.pdf.exe', 'relatorio.pdf.exe', pdf(), 'extensão de programa');
  await barra('programa no meio do nome', 'nota.exe.pdf', pdf(), 'extensão de programa');
  await barra('.com sem ser domínio', 'arquivo.com.pdf', pdf(), 'extensão de programa');
  await barra('PDF verdadeiro com nome .exe', 'arquivo.exe', pdf(), 'extensão de programa');
  await barra('extensão não bate (PDF chamado .txt)', 'nota.txt', pdf(), 'não corresponde');
  await barra('sem extensão', 'nota', pdf(), 'não corresponde');
  await barra('nome com caractere de controle', 'nota\u0007.pdf', pdf(), 'caracteres inválidos');
  await barra('inversão de texto no nome', 'nota\u202Efdp.pdf', pdf(), 'caracteres inválidos');
  await barra('nome longo demais', 'a'.repeat(151) + '.pdf', pdf(), 'longo demais');
  await passa('nome com exatamente 150', 'a'.repeat(146) + '.pdf', pdf());
  await barra('nome vazio depois de limpo', '. . .', pdf(), 'vazio');
  await barra('termina em ponto (truque do Windows)', 'nota.exe.', pdf(), 'extensão de programa');
  for (const e of ['docm', 'xlsm', 'xlsb', 'pptm']) await barra(`extensão .${e}`, `planilha.${e}`, xlsx(), 'macros');
  await passa('caminho no nome vira só o nome', '..\\..\\pasta\\guia.pdf', pdf());

  secao('2. PDF');
  await passa('PDF comum', 'guia.pdf', pdf());
  await passa('PDF com "/JS" só como texto', 'guia.pdf', pdf({ bodyExtra: '6 0 obj\n<< /Title (Manual do /JS e do /JavaScript) >>\nendobj\n' }));
  await passa('PDF com nomes parecidos (/JSON, /Launcher)', 'guia.pdf', pdf({ extraObj: '/JSON 1 /Launcher 2' }));
  await passa('PDF criptografado (comum em extrato de banco)', 'extrato.pdf', pdf({ trailer: '/Encrypt 9 0 R' }));
  await passa('PDF com object stream comum', 'guia.pdf', pdfComObjStm('6 0 << /Type /Font /BaseFont /Helvetica >>'));
  await passa('PDF com formulário simples', 'form.pdf', pdf({ extraObj: '/AcroForm << /Fields [] >>' }));
  await barra('PDF com JavaScript (ação)', 'guia.pdf', pdf({ extraObj: '/OpenAction << /S /JavaScript /JS (app.alert\\(1\\)) >>' }), 'JavaScript');
  await barra('PDF com /JS', 'guia.pdf', pdf({ extraObj: '/AA << /O << /S /JavaScript /JS 5 0 R >> >>' }), 'JavaScript');
  await barra('PDF com nome disfarçado (/J#61vaScript)', 'guia.pdf', pdf({ extraObj: '/OpenAction << /S /J#61vaScript >>' }), 'JavaScript');
  await barra('PDF com /Launch', 'guia.pdf', pdf({ extraObj: '/OpenAction << /S /Launch /F (cmd.exe) >>' }), 'programas externos');
  await barra('PDF com arquivo anexado', 'guia.pdf', pdf({ bodyExtra: '6 0 obj\n<< /Type /EmbeddedFile /Length 3 >>\nstream\nabc\nendstream\nendobj\n' }), 'anexados');
  await barra('PDF com anexo (FileAttachment)', 'guia.pdf', pdf({ bodyExtra: '6 0 obj\n<< /Type /Annot /Subtype /FileAttachment >>\nendobj\n' }), 'anexados');
  await barra('PDF com mídia rica', 'guia.pdf', pdf({ bodyExtra: '6 0 obj\n<< /Type /Annot /Subtype /RichMedia >>\nendobj\n' }), 'multimídia');
  await barra('JavaScript escondido em object stream (zlib)', 'guia.pdf', pdfComObjStm('6 0 << /S /JavaScript /JS (app.alert\\(1\\)) >>'), 'JavaScript');
  const hex = (s) => Buffer.from(s).toString('hex') + '>';
  await barra('JavaScript em object stream com ASCIIHex+Flate', 'guia.pdf', pdfComObjStm(hex(zlib.deflateSync(Buffer.from('6 0 << /S /JavaScript >>'))), '[/ASCIIHexDecode /FlateDecode]', false), 'JavaScript');
  await barra('object stream com filtro que não dá pra ler', 'guia.pdf', pdfComObjStm('xxxx', '/LZWDecode', false), 'não conseguimos verificar');

  secao('3. Imagens');
  await passa('PNG legítimo', 'foto.png', png());
  await passa('JPEG legítimo', 'foto.jpg', jpeg());
  await passa('JPEG com extensão .jpeg', 'foto.jpeg', jpeg());
  await barra('PNG com dados depois do fim', 'foto.png', Buffer.concat([png(), Buffer.from('MZ'.repeat(200))]), 'estranhos');
  await barra('JPEG com dados depois do fim', 'foto.jpg', Buffer.concat([jpeg(), Buffer.from('MZ'.repeat(200))]), 'estranhos');
  await barra('JPEG com outro JPEG colado (sem MPF)', 'foto.jpg', Buffer.concat([jpeg(), jpeg()]), 'estranhos');
  await passa('JPEG de celular com imagens extras (MPF)', 'foto.jpg', Buffer.concat([jpeg({ mpf: true }), jpeg()]));
  await barra('JPEG MPF com lixo no lugar da imagem extra', 'foto.jpg', Buffer.concat([jpeg({ mpf: true }), Buffer.from('MZ'.repeat(50))]), 'estranhos');
  await passa('PNG com poucos zeros no fim', 'foto.png', Buffer.concat([png(), Buffer.alloc(8)]));
  const pngRuim = png(); pngRuim[pngRuim.length - 30] ^= 0xFF;
  await barra('PNG corrompido (CRC errado)', 'foto.png', pngRuim, 'corrompida');
  await barra('PNG cortado no meio', 'foto.png', png().subarray(0, 60), 'corrompida');
  await barra('JPEG cortado no meio', 'foto.jpg', jpeg().subarray(0, 40), 'corrompida');
  await barra('JPEG sem EOI', 'foto.jpg', jpeg().subarray(0, -2), 'corrompida');
  await barra('PNG com dimensões exageradas', 'foto.png', (() => { const p = png(); p.writeUInt32BE(100000, 16); p.writeUInt32BE(100000, 20); p.writeUInt32BE(crc32(p.subarray(12, 29)), 29); return p; })(), 'dimensões');

  secao('4. DOCX e XLSX');
  await passa('DOCX legítimo', 'contrato.docx', docx());
  await passa('XLSX legítimo', 'planilha.xlsx', xlsx());
  await passa('DOCX com imagem SVG, configuração de impressora e modelo local', 'contrato.docx', docx([
    { nome: 'word/media/image1.svg', dados: '<svg/>' }, { nome: 'word/printerSettings/printerSettings1.bin', dados: 'abc' },
    { nome: 'word/_rels/document.xml.rels', dados: relacao('attachedTemplate', 'file:///C:\\Users\\x\\Modelo.dotm') }]));
  await passa('DOCX com links (hyperlink externo)', 'contrato.docx', docx([{ nome: 'word/_rels/document.xml.rels', dados: relacao('hyperlink', 'https://www.gov.br') }]));
  await barra('DOCX com projeto de macro', 'contrato.docx', docx([{ nome: 'word/vbaProject.bin', dados: 'x' }]), 'macros');
  await barra('XLSX com projeto de macro', 'planilha.xlsx', xlsx([{ nome: 'xl/vbaProject.bin', dados: 'x' }]), 'macros');
  await barra('XLSX com planilha de macro (XLM)', 'planilha.xlsx', xlsx([{ nome: 'xl/macrosheets/sheet1.xml', dados: '<x/>' }]), 'macros');
  await barra('tipo de conteúdo "macroEnabled"', 'planilha.xlsx', xlsx([], CT_XLSX.replace('sheet.main+xml', 'sheet.macroEnabled.main+xml')), 'macros');
  await barra('controle ActiveX', 'contrato.docx', docx([{ nome: 'word/activeX/activeX1.xml', dados: '<x/>' }]), 'ActiveX');
  await barra('objeto embutido', 'contrato.docx', docx([{ nome: 'word/embeddings/oleObject1.bin', dados: 'x' }]), 'embutidos');
  await barra('programa dentro do pacote', 'contrato.docx', docx([{ nome: 'word/media/instalar.exe', dados: 'x' }]), 'programa');
  await barra('caminho com ../', 'contrato.docx', docx([{ nome: '../../evil.txt', dados: 'x' }]), 'caminhos suspeitos');
  await barra('caminho absoluto', 'contrato.docx', docx([{ nome: '/etc/evil.txt', dados: 'x' }]), 'caminhos suspeitos');
  await barra('caminho com letra de unidade', 'contrato.docx', docx([{ nome: 'C:\\evil.txt', dados: 'x' }]), 'caminhos suspeitos');
  await barra('modelo externo na internet', 'contrato.docx', docx([{ nome: 'word/_rels/document.xml.rels', dados: relacao('attachedTemplate', 'https://evil.example/modelo.dotm') }]), 'externo na internet');
  await barra('modelo em compartilhamento de rede', 'contrato.docx', docx([{ nome: 'word/_rels/document.xml.rels', dados: relacao('attachedTemplate', '\\\\servidor\\pasta\\modelo.dotm') }]), 'externo na internet');
  await barra('muitos itens (2.500)', 'contrato.docx', docx(Array.from({ length: 2500 }, (_, i) => ({ nome: `word/x/${i}.xml`, dados: 'a' }))), 'itens demais');
  await barra('tamanho total declarado absurdo', 'contrato.docx', docx([{ nome: 'word/x.xml', dados: 'a', tamDeclarado: 250 * 1024 * 1024 }]), 'exagerado');
  await barra('bomba de compressão (150 MB de zeros)', 'contrato.docx', docx([{ nome: 'word/bomba.xml', dados: Buffer.alloc(150 * 1024 * 1024) }]), 'compressão');
  await barra('tamanho declarado diferente do real', 'contrato.docx', zip([
    { nome: '[Content_Types].xml', dados: CT_DOCX, tamDeclarado: 10 }, { nome: 'word/document.xml', dados: 'x' }]), 'tamanhos que não conferem');
  await barra('itens sobrepostos', 'contrato.docx', zip([
    { nome: '[Content_Types].xml', dados: CT_DOCX }, { nome: 'word/document.xml', dados: 'x' }, { nome: 'word/a.xml', dados: 'x' }], { sobrepor: true }), null);
  await barra('nomes repetidos', 'contrato.docx', docx([{ nome: 'word/document.xml', dados: 'outro' }]), 'repetidos');
  await barra('dados colados depois do pacote', 'contrato.docx', Buffer.concat([docx(), Buffer.from('MZ'.repeat(100))]), 'final');
  await barra('atalho simbólico dentro do pacote', 'contrato.docx', docx([{ nome: 'word/link', dados: '/etc/passwd', linkSimbolico: true }]), 'atalhos');
  await barra('item criptografado', 'contrato.docx', docx([{ nome: 'word/x.xml', dados: 'a', flags: 1 }]), null);
  await barra('DOCX com extensão trocada (.xlsx)', 'contrato.xlsx', docx(), 'não corresponde');

  secao('5. DOC e XLS antigos');
  await passa('XLS antigo legítimo', 'planilha.xls', xlsAntigo());
  await passa('DOC antigo legítimo', 'contrato.doc', docAntigo());
  await barra('XLS com projeto VBA', 'planilha.xls', xlsAntigo([{ nome: '_VBA_PROJECT_CUR', tipo: 1 }]), 'macros');
  await barra('XLS com storage VBA', 'planilha.xls', xlsAntigo([{ nome: 'VBA', tipo: 1 }]), 'macros');
  await barra('XLS com planilha de macro Excel 4.0', 'planilha.xls', xlsAntigo([], 1), 'macros');
  await barra('DOC com macros', 'contrato.doc', docAntigo([{ nome: 'Macros', tipo: 1 }]), 'macros');
  await barra('DOC com projeto VBA', 'contrato.doc', docAntigo([{ nome: '_VBA_PROJECT', tipo: 2, dados: 'x' }]), 'macros');
  await barra('XLS com extensão .doc', 'planilha.doc', xlsAntigo(), 'não corresponde');
  await barra('contêiner qualquer (nem Word nem Excel)', 'coisa.xls', cfb([{ nome: 'Outra', tipo: 2, dados: 'x' }]), 'Tipo de arquivo não permitido');
  await barra('arquivo protegido por senha', 'planilha.xlsx', cfb([{ nome: 'EncryptedPackage', tipo: 2, dados: 'x' }, { nome: 'EncryptionInfo', tipo: 2, dados: 'x' }]), 'senha');
  try { // arquivos reais gerados pelo SheetJS (se o frontend estiver instalado)
    const XLSX = require('../../frontend/node_modules/xlsx');
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Razão Social', 'CNPJ'], ['Empresa Teste', '00.000.000/0001-00']]), 'Clientes');
    await passa('XLS real (SheetJS)', 'clientes.xls', Buffer.from(XLSX.write(wb, { bookType: 'biff8', type: 'buffer' })));
    await passa('XLSX real (SheetJS)', 'clientes.xlsx', Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })));
    await barra('XLSX real renomeado pra .csv', 'clientes.csv', Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })), 'CSV', 'text/csv');
  } catch { console.log('  (SheetJS do frontend não encontrado — testes com XLS/XLSX reais pulados)'); }

  secao('6. CSV');
  await passa('CSV UTF-8', 'dados.csv', Buffer.from('nome;valor\nJoão;10,50\nMaria;20,00\n'), 'text/csv');
  await passa('CSV Windows-1252 (acentos do Excel)', 'dados.csv', Buffer.from('nome;valor\nJo\xE3o;10,50\n', 'latin1'), 'application/vnd.ms-excel');
  await passa('CSV UTF-16 com BOM', 'dados.csv', Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('nome;valor\r\nJoão;10\r\n', 'utf16le')]), 'text/csv');
  await passa('CSV com Ctrl-Z no fim (DOS)', 'dados.csv', Buffer.concat([Buffer.from('a;b\n1;2\n'), Buffer.from([0x1A])]), 'text/csv');
  await barra('executável renomeado pra .csv', 'dados.csv', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(50, 0), Buffer.from('This program')]), 'binário', 'text/csv');
  await barra('PDF renomeado pra .csv', 'dados.csv', Buffer.concat([pdf(), Buffer.from([0x00, 0x01])]), 'binário', 'text/csv');
  await barra('arquivo com bytes nulos', 'dados.csv', Buffer.from('a;b\0c\n'), 'binário', 'text/csv');
  await barra('.csv declarado como outra coisa (octet-stream)', 'dados.csv', Buffer.from('a;b\n1;2\n'), 'Tipo de arquivo não permitido', 'application/octet-stream');

  secao('7. Tipo real e arquivo vazio');
  await barra('executável com nome .pdf', 'nota.pdf', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 1)]), 'Tipo de arquivo não permitido');
  await barra('ZIP qualquer', 'tudo.zip', zip([{ nome: 'a.txt', dados: 'x' }]), 'Tipo de arquivo não permitido');
  await barra('arquivo vazio', 'vazio.pdf', Buffer.alloc(0), 'vazio');

  secao('8. Nome no download');
  const d = (n, m) => nomeParaDownload(n, m || 'application/pdf');
  ok(d('Relatório março.pdf').nome === 'Relatório março.pdf', 'download: mantém nome com acento');
  ok(d('Relatório março.pdf').cabecalho.includes('filename*=UTF-8\'\'Relat%C3%B3rio%20mar%C3%A7o.pdf'), 'download: filename* em UTF-8');
  ok(d('Relatório março.pdf').cabecalho.includes('filename="Relatorio marco.pdf"'), 'download: fallback ASCII sem acento');
  ok(d('Relat\u00C3\u00B3rio.pdf').nome === 'Relatório.pdf', 'download: conserta acento quebrado de documento antigo');
  ok(!/["\r\n]/.test(d('a"b\r\nSet-Cookie: x.pdf').cabecalho.replace(/^attachment; filename="|"; filename\*=.*$/g, '')), 'download: sem aspas/quebra de linha que injetem cabeçalho');
  ok(d('nota').nome === 'nota.pdf', 'download: acrescenta a extensão do tipo real');
  ok(d('nota.exe').nome === 'nota.pdf', 'download: troca extensão de programa pela real');
  ok(d('Guia 10.2026').nome === 'Guia 10.2026.pdf', 'download: não confunde "2026" com extensão');
  ok(d('foto.JPG', 'image/jpeg').nome === 'foto.JPG', 'download: extensão maiúscula do tipo certo é mantida');
  ok(d('dados', 'text/csv').nome === 'dados.csv', 'download: CSV');
  ok(d('../../etc/passwd').nome === 'passwd.pdf', 'download: sem caminho');
  ok(d('').nome === 'documento.pdf', 'download: nome vazio');
  ok(repararCodificacao('Relat\u00C3\u00B3rio mar\u00C3\u00A7o \u00E2\u0080\u0093 ok') === 'Relatório março – ok', 'acentos: conserta nome que o multer decodificou como latin1');
  ok(repararCodificacao('Relat\u00F3rio') === 'Relat\u00F3rio', 'acentos: não mexe em nome que já está certo');

  console.log(falhas ? `\n${falhas} FALHA(S) em ${total} verificações` : `\nTudo certo: ${total} verificações.`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
