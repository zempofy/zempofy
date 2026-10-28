// Inspeção dos formatos do Office (sem antivírus: só procura sinais de macro, objeto embutido e
// pacote malformado). Duas famílias:
//  - DOCX/XLSX: pacote ZIP — lemos só o "diretório central" do ZIP e uns poucos XMLs de controle
//  - DOC/XLS: contêiner binário CFB (OLE2) — lemos só o diretório de streams
// Nada é executado nem extraído em disco; todas as leituras têm teto de tamanho.
const zlib = require('zlib');

// ── Limites (fáceis de ajustar) ──
const LIMITES_ZIP = {
  maxEntradas: 2000,
  maxDescompactadoTotal: 200 * 1024 * 1024, // soma dos tamanhos declarados das entradas
  maxTaxaPorEntrada: 100,                   // descompactado/compactado — só vale pra entradas grandes...
  minParaTaxa: 10 * 1024 * 1024,            // ...acima deste tamanho descompactado
  maxXmlControle: 4 * 1024 * 1024,          // teto ao ler um XML de controle ([Content_Types], .rels)
  maxXmlControleTotal: 16 * 1024 * 1024,
};

class ErroPacote extends Error {
  constructor(motivo, codigo) { super(motivo); this.motivo = motivo; this.codigo = codigo; }
}

// Programas dentro do pacote. Não inclui html/svg (o Word guarda imagens SVG em word/media) nem
// .bin genérico (printerSettings.bin é legítimo) — .bin perigoso é pego pelo caminho (vbaProject, activeX...)
const EXT_PROGRAMA_NO_PACOTE = new Set(['exe', 'dll', 'bat', 'cmd', 'com', 'scr', 'msi', 'js', 'jse', 'vbs', 'vbe', 'ps1', 'jar', 'lnk', 'hta', 'sh', 'apk', 'iso', 'wsf', 'pif', 'cpl']);

// ───────────────────────────── ZIP (DOCX / XLSX) ─────────────────────────────

const lerU16 = (b, o) => b.readUInt16LE(o);
const lerU32 = (b, o) => b.readUInt32LE(o);

function lerDiretorioZip(buf) {
  const invalido = (m) => new ErroPacote(m || 'o pacote do arquivo está malformado', 'pacote_invalido');
  if (buf.length < 22) throw invalido();

  // Fim do diretório central (EOCD): procura de trás pra frente a assinatura cujo comentário vá exatamente até o fim
  let eocd = -1;
  const inicioBusca = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= inicioBusca; i--) {
    if (lerU32(buf, i) === 0x06054b50 && i + 22 + lerU16(buf, i + 20) === buf.length) { eocd = i; break; }
  }
  if (eocd < 0) throw invalido('o pacote do arquivo está malformado ou tem dados estranhos no final');

  const disco = lerU16(buf, eocd + 4), discoCD = lerU16(buf, eocd + 6);
  const totalEntradas = lerU16(buf, eocd + 10), tamCD = lerU32(buf, eocd + 12), offCD = lerU32(buf, eocd + 16);
  if (disco !== 0 || discoCD !== 0) throw invalido();
  if (totalEntradas === 0xFFFF || tamCD === 0xFFFFFFFF || offCD === 0xFFFFFFFF) throw invalido('o pacote do arquivo usa um formato não suportado');
  if (totalEntradas > LIMITES_ZIP.maxEntradas) throw new ErroPacote('o arquivo tem itens demais dentro dele (possível bomba de compressão)', 'bomba');
  if (offCD + tamCD > eocd) throw invalido();

  const entradas = [];
  let pos = offCD;
  for (let n = 0; n < totalEntradas; n++) {
    if (pos + 46 > eocd || lerU32(buf, pos) !== 0x02014b50) throw invalido();
    const flags = lerU16(buf, pos + 8), metodo = lerU16(buf, pos + 10);
    const tamComp = lerU32(buf, pos + 20), tamDesc = lerU32(buf, pos + 24);
    const nomeLen = lerU16(buf, pos + 28), extraLen = lerU16(buf, pos + 30), comLen = lerU16(buf, pos + 32);
    const attrExterno = lerU32(buf, pos + 38), offLocal = lerU32(buf, pos + 42);
    const versaoHost = buf[pos + 5];
    if (pos + 46 + nomeLen + extraLen + comLen > eocd) throw invalido();
    if (tamComp === 0xFFFFFFFF || tamDesc === 0xFFFFFFFF || offLocal === 0xFFFFFFFF) throw invalido('o pacote do arquivo usa um formato não suportado');
    const nome = buf.toString('utf8', pos + 46, pos + 46 + nomeLen);
    entradas.push({ nome, flags, metodo, tamComp, tamDesc, offLocal, crc: lerU32(buf, pos + 16), ehLink: versaoHost === 3 && ((attrExterno >>> 16) & 0xF000) === 0xA000 });
    pos += 46 + nomeLen + extraLen + comLen;
  }

  // Cada entrada: cabeçalho local íntegro, mesmo nome do diretório central, dados dentro do arquivo e sem sobreposição
  const faixas = [];
  for (const e of entradas) {
    if (e.offLocal + 30 > offCD || lerU32(buf, e.offLocal) !== 0x04034b50) throw invalido();
    const nomeLocalLen = lerU16(buf, e.offLocal + 26), extraLocalLen = lerU16(buf, e.offLocal + 28);
    const nomeLocal = buf.toString('utf8', e.offLocal + 30, e.offLocal + 30 + nomeLocalLen);
    if (nomeLocal !== e.nome) throw new ErroPacote('o pacote do arquivo tem itens com nomes inconsistentes', 'estrutura_suspeita');
    e.inicioDados = e.offLocal + 30 + nomeLocalLen + extraLocalLen;
    e.fimDados = e.inicioDados + e.tamComp;
    if (e.fimDados > offCD) throw invalido();
    faixas.push([e.offLocal, e.fimDados]);
  }
  faixas.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < faixas.length; i++) {
    if (faixas[i][0] < faixas[i - 1][1]) throw new ErroPacote('o pacote do arquivo tem itens sobrepostos (possível bomba de compressão)', 'bomba');
  }
  return entradas;
}

// Lê o conteúdo (descompactado) de uma entrada, com teto. Confere o tamanho real contra o declarado.
function lerEntrada(buf, e, teto) {
  if (e.flags & 1) throw new ErroPacote('o pacote do arquivo tem itens criptografados', 'estrutura_suspeita');
  if (e.tamDesc > teto) throw new ErroPacote('o pacote do arquivo tem um item de controle exagerado (possível bomba de compressão)', 'bomba');
  const dados = buf.subarray(e.inicioDados, e.fimDados);
  let saida;
  if (e.metodo === 0) saida = dados;
  else if (e.metodo === 8) {
    try { saida = zlib.inflateRawSync(dados, { maxOutputLength: teto }); }
    catch { throw new ErroPacote('o pacote do arquivo está malformado ou é exagerado quando aberto (possível bomba de compressão)', 'bomba'); }
  } else throw new ErroPacote('o pacote do arquivo usa um formato de compressão não suportado', 'pacote_invalido');
  if (saida.length !== e.tamDesc) throw new ErroPacote('o pacote do arquivo declara tamanhos que não conferem (possível bomba de compressão)', 'bomba');
  return saida;
}

const ehCaminhoPerigoso = (nome) => {
  if (!nome || nome.length > 300) return true;
  if (/[\u0000-\u001F]/.test(nome)) return true;
  if (/^[\\/]/.test(nome) || /^[a-zA-Z]:/.test(nome)) return true; // absoluto ou com letra de unidade
  return nome.split(/[\\/]/).some(parte => parte === '..');
};

const relacaoRemota = (alvo) => /^(https?|ftps?|sftp):/i.test(alvo) || /^\\\\/.test(alvo) || /^\/\//.test(alvo) || /^file:\/\/(?!\/)/i.test(alvo);

// Retorna { motivo, codigo } se o pacote DOCX/XLSX deve ser bloqueado; null se passou.
function inspecionarPacoteOOXML(buf) {
  try {
    const entradas = lerDiretorioZip(buf);

    // Bomba de compressão: tamanho total e taxa por entrada, pelos valores declarados
    let totalDeclarado = 0;
    const nomesVistos = new Set();
    for (const e of entradas) {
      totalDeclarado += e.tamDesc;
      if (totalDeclarado > LIMITES_ZIP.maxDescompactadoTotal) throw new ErroPacote('o arquivo é exagerado quando aberto (possível bomba de compressão)', 'bomba');
      if (e.tamDesc > LIMITES_ZIP.minParaTaxa && e.tamComp > 0 && e.tamDesc / e.tamComp > LIMITES_ZIP.maxTaxaPorEntrada) throw new ErroPacote('o arquivo tem uma taxa de compressão absurda (possível bomba de compressão)', 'bomba');
      if (e.tamComp === 0 && e.tamDesc > 0) throw new ErroPacote('o pacote do arquivo está malformado', 'pacote_invalido');
      const chaveNome = e.nome.toLowerCase();
      if (nomesVistos.has(chaveNome)) throw new ErroPacote('o pacote do arquivo tem itens repetidos', 'estrutura_suspeita');
      nomesVistos.add(chaveNome);
    }

    for (const e of entradas) {
      if (ehCaminhoPerigoso(e.nome)) throw new ErroPacote('o pacote do arquivo tem caminhos suspeitos (tenta gravar fora da pasta)', 'caminho_suspeito');
      if (e.ehLink) throw new ErroPacote('o pacote do arquivo tem atalhos suspeitos', 'estrutura_suspeita');
      if (e.flags & 1) throw new ErroPacote('o pacote do arquivo tem itens criptografados', 'estrutura_suspeita');
    }

    // Macro, ActiveX e objetos embutidos: pelo caminho dentro do pacote
    for (const e of entradas) {
      const n = e.nome.toLowerCase().replace(/\\/g, '/');
      if (/(^|\/)vbaproject(\.bin)?$|(^|\/)vbadata\.xml$|(^|\/)macrosheets\/|(^|\/)vbaprojectsignature/.test(n)) return { motivo: 'o arquivo contém macros', codigo: 'macro' };
      if (/(^|\/)activex\//.test(n)) return { motivo: 'o arquivo contém controles ActiveX', codigo: 'activex' };
      if (/(^|\/)embeddings\//.test(n)) return { motivo: 'o arquivo tem objetos ou programas embutidos', codigo: 'embutido' };
      const ext = n.includes('.') ? n.slice(n.lastIndexOf('.') + 1) : '';
      if (EXT_PROGRAMA_NO_PACOTE.has(ext)) return { motivo: `o arquivo tem um programa dentro dele (.${ext})`, codigo: 'embutido' };
    }

    // XMLs de controle: tipos de conteúdo e relações (modelo externo da internet)
    const contentTypes = entradas.find(e => e.nome === '[Content_Types].xml');
    if (!contentTypes) throw new ErroPacote('o pacote do arquivo está malformado', 'pacote_invalido');
    const ct = lerEntrada(buf, contentTypes, LIMITES_ZIP.maxXmlControle).toString('utf8');
    // Só conta o que o pacote USA: "Override" de uma parte. Alguns geradores (o SheetJS, por exemplo) listam
    // "Default" de macroEnabled só pra poder escrever outros formatos, sem nenhuma macro no arquivo.
    const tipoDe = (tag) => (tag.match(/\bContentType\s*=\s*"([^"]*)"/i) || [])[1] || '';
    for (const tag of ct.match(/<Override\b[^>]*>/gi) || []) {
      const tipo = tipoDe(tag);
      if (/vnd\.ms-office\.activeX/i.test(tipo)) return { motivo: 'o arquivo contém controles ActiveX', codigo: 'activex' };
      if (/openxmlformats-officedocument\.oleObject/i.test(tipo)) return { motivo: 'o arquivo tem objetos ou programas embutidos', codigo: 'embutido' };
      if (/macroEnabled|vnd\.ms-office\.vbaProject|vnd\.ms-excel\.sheet\.binary/i.test(tipo)) return { motivo: 'o arquivo contém macros', codigo: 'macro' };
    }
    for (const tag of ct.match(/<Default\b[^>]*>/gi) || []) {
      const tipo = tipoDe(tag);
      if (/vnd\.ms-office\.(vbaProject|activeX)/i.test(tipo)) return { motivo: /activeX/i.test(tipo) ? 'o arquivo contém controles ActiveX' : 'o arquivo contém macros', codigo: /activeX/i.test(tipo) ? 'activex' : 'macro' };
    }

    let lidoTotal = 0;
    for (const e of entradas.filter(x => /\.rels$/i.test(x.nome))) {
      const xml = lerEntrada(buf, e, LIMITES_ZIP.maxXmlControle).toString('utf8');
      lidoTotal += xml.length;
      if (lidoTotal > LIMITES_ZIP.maxXmlControleTotal) throw new ErroPacote('o pacote do arquivo tem itens de controle exagerados (possível bomba de compressão)', 'bomba');
      for (const tag of xml.match(/<Relationship\b[^>]*>/gi) || []) {
        const tipo = (tag.match(/\bType\s*=\s*"([^"]*)"/i) || [])[1] || '';
        const alvo = (tag.match(/\bTarget\s*=\s*"([^"]*)"/i) || [])[1] || '';
        const externo = /\bTargetMode\s*=\s*"External"/i.test(tag);
        if (!externo) continue;
        // Modelo (ou objeto/moldura/subdocumento) buscado de um endereço remoto: técnica de "injeção de modelo".
        // Caminhos locais (file:///C:\...) são comuns em documentos legítimos e não entram.
        if (/\/(attachedTemplate|oleObject|frame|subDocument)$/i.test(tipo) && relacaoRemota(alvo)) {
          return { motivo: 'o documento aponta para um modelo ou objeto externo na internet', codigo: 'modelo_externo' };
        }
      }
    }
    return null;
  } catch (err) {
    if (err instanceof ErroPacote) return { motivo: err.motivo, codigo: err.codigo };
    return { motivo: 'o pacote do arquivo está malformado', codigo: 'pacote_invalido' };
  }
}

// ───────────────────────────── CFB (DOC / XLS) ─────────────────────────────

const FIM_CADEIA = 0xFFFFFFFE, LIVRE = 0xFFFFFFFF;

function lerCFB(buf) {
  const assinatura = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
  if (buf.length < 512 || !buf.subarray(0, 8).equals(assinatura)) throw new ErroPacote('o arquivo está malformado', 'pacote_invalido');
  const shift = buf.readUInt16LE(30), shiftMini = buf.readUInt16LE(32);
  if ((shift !== 9 && shift !== 12) || shiftMini !== 6) throw new ErroPacote('o arquivo está malformado', 'pacote_invalido');
  const tamSetor = 1 << shift;
  const inicioDir = buf.readUInt32LE(48), corteMini = buf.readUInt32LE(56), inicioMiniFat = buf.readUInt32LE(60), inicioDifat = buf.readUInt32LE(68), qtdDifat = buf.readUInt32LE(72);
  const offSetor = (id) => (id + 1) * tamSetor;
  const setorValido = (id) => id < 0xFFFFFFFA && offSetor(id) + tamSetor <= buf.length;

  // FAT: lista de setores da FAT vem do cabeçalho (109) + cadeia DIFAT
  const setoresFat = [];
  for (let i = 0; i < 109; i++) { const id = buf.readUInt32LE(76 + i * 4); if (id === LIVRE || id === FIM_CADEIA) continue; setoresFat.push(id); }
  let difat = inicioDifat;
  for (let n = 0; n < qtdDifat && difat !== FIM_CADEIA && difat !== LIVRE; n++) {
    if (!setorValido(difat)) throw new ErroPacote('o arquivo está malformado', 'pacote_invalido');
    const base = offSetor(difat);
    for (let i = 0; i < tamSetor / 4 - 1; i++) { const id = buf.readUInt32LE(base + i * 4); if (id !== LIVRE && id !== FIM_CADEIA) setoresFat.push(id); }
    difat = buf.readUInt32LE(base + tamSetor - 4);
  }
  const fat = [];
  for (const id of setoresFat) {
    if (!setorValido(id)) throw new ErroPacote('o arquivo está malformado', 'pacote_invalido');
    const base = offSetor(id);
    for (let i = 0; i < tamSetor / 4; i++) fat.push(buf.readUInt32LE(base + i * 4));
  }

  const lerCadeia = (inicio, tabela, lerSetor, tamUnidade, maxBytes) => {
    const partes = []; let atual = inicio, total = 0, passos = 0;
    while (atual !== FIM_CADEIA && atual !== LIVRE) {
      if (atual >= tabela.length || ++passos > tabela.length) throw new ErroPacote('o arquivo está malformado', 'pacote_invalido');
      const parte = lerSetor(atual);
      partes.push(parte); total += tamUnidade;
      if (total > maxBytes) throw new ErroPacote('o arquivo tem uma estrutura interna exagerada', 'estrutura_suspeita');
      atual = tabela[atual];
    }
    return Buffer.concat(partes);
  };
  const lerSetorFat = (id) => { if (!setorValido(id)) throw new ErroPacote('o arquivo está malformado', 'pacote_invalido'); return buf.subarray(offSetor(id), offSetor(id) + tamSetor); };

  const dir = lerCadeia(inicioDir, fat, lerSetorFat, tamSetor, 16 * 1024 * 1024);
  const entradas = [];
  for (let off = 0; off + 128 <= dir.length && entradas.length < 100000; off += 128) {
    const tipo = dir[off + 66];
    const nomeLen = Math.min(dir.readUInt16LE(off + 64), 64);
    const nome = nomeLen >= 2 ? dir.toString('utf16le', off, off + nomeLen - 2).replace(/^[\u0000-\u001F]+/, '') : '';
    entradas.push({
      id: entradas.length, nome, tipo,
      esq: dir.readUInt32LE(off + 68), dir: dir.readUInt32LE(off + 72), filho: dir.readUInt32LE(off + 76),
      inicio: dir.readUInt32LE(off + 116), tamanho: dir.readUInt32LE(off + 120),
    });
  }
  if (!entradas.length || entradas[0].tipo !== 5) throw new ErroPacote('o arquivo está malformado', 'pacote_invalido');

  // Filhos diretos da raiz (árvore de irmãos): é o que define o tipo do documento
  const filhosDaRaiz = [];
  const pilha = [entradas[0].filho], visto = new Set();
  while (pilha.length) {
    const id = pilha.pop();
    if (id === LIVRE || id >= entradas.length || visto.has(id)) continue;
    visto.add(id); filhosDaRaiz.push(entradas[id]);
    pilha.push(entradas[id].esq, entradas[id].dir);
  }

  // Leitura de um stream (regular ou do mini-stream), com teto
  let miniStream = null, miniFat = null;
  const lerStream = (e, max) => {
    if (e.tamanho > max) throw new ErroPacote('o arquivo tem uma estrutura interna exagerada', 'estrutura_suspeita');
    if (e.tamanho >= corteMini) return lerCadeia(e.inicio, fat, lerSetorFat, tamSetor, max).subarray(0, e.tamanho);
    if (!miniStream) {
      miniStream = lerCadeia(entradas[0].inicio, fat, lerSetorFat, tamSetor, 64 * 1024 * 1024);
      miniFat = []; const mf = lerCadeia(inicioMiniFat, fat, lerSetorFat, tamSetor, 16 * 1024 * 1024);
      for (let i = 0; i + 4 <= mf.length; i += 4) miniFat.push(mf.readUInt32LE(i));
    }
    return lerCadeia(e.inicio, miniFat, (id) => miniStream.subarray(id * 64, id * 64 + 64), 64, max).subarray(0, e.tamanho);
  };

  return { entradas, filhosDaRaiz, lerStream };
}

// Planilha antiga (BIFF): procura planilha de macro do Excel 4.0 (XLM) ou módulo VBA na lista de planilhas
function temPlanilhaDeMacroBIFF(stream) {
  let pos = 0;
  for (let n = 0; n < 200000 && pos + 4 <= stream.length; n++) {
    const id = stream.readUInt16LE(pos), tam = stream.readUInt16LE(pos + 2);
    if (id === 0x0085 && tam >= 6 && pos + 4 + 6 <= stream.length) {
      const tipoPlanilha = stream[pos + 4 + 5];
      if (tipoPlanilha === 1 || tipoPlanilha === 6) return true; // 1 = macro (XLM), 6 = módulo VBA
    }
    if (id === 0x000A && n > 0) break; // EOF das configurações globais (as planilhas em si vêm depois)
    pos += 4 + tam;
  }
  return false;
}

const NOMES_DE_MACRO = new Set(['_vba_project_cur', 'vba', '_vba_project', 'macros', 'projectwm']);

// { tipo: 'xls'|'doc'|'outro'|'protegido', macro: boolean } — ou lança ErroPacote se malformado
function inspecionarCFB(buf) {
  const cfb = lerCFB(buf);
  const nomesRaiz = new Set(cfb.filhosDaRaiz.map(e => e.nome.toLowerCase()));
  let tipo = 'outro';
  if (nomesRaiz.has('encryptedpackage')) tipo = 'protegido';
  else if (nomesRaiz.has('worddocument')) tipo = 'doc';
  else if (nomesRaiz.has('workbook') || nomesRaiz.has('book')) tipo = 'xls';

  // Macro VBA: storages/streams com os nomes típicos em qualquer ponto do contêiner
  let macro = cfb.entradas.some(e => e.tipo !== 0 && NOMES_DE_MACRO.has(e.nome.toLowerCase())) || (tipo === 'doc' && nomesRaiz.has('macros'));
  if (!macro && tipo === 'xls') {
    const wb = cfb.filhosDaRaiz.find(e => ['workbook', 'book'].includes(e.nome.toLowerCase()) && e.tipo === 2);
    if (wb) macro = temPlanilhaDeMacroBIFF(cfb.lerStream(wb, 64 * 1024 * 1024));
  }
  return { tipo, macro };
}

// Um ZIP que se apresenta como pacote do Office (tem [Content_Types].xml) mas o file-type não reconheceu como DOCX/XLSX
// (ex: tipo de conteúdo com macro) — pra dar o motivo certo em vez de só "tipo não permitido"
function pareceOOXML(buf) {
  try { return lerDiretorioZip(buf).some(e => e.nome === '[Content_Types].xml'); } catch { return false; }
}

module.exports = { pareceOOXML, inspecionarPacoteOOXML, inspecionarCFB, ErroPacote, LIMITES_ZIP };
