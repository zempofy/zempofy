// Limite de ARQUIVOS enviados por usuário numa janela de tempo (mais rígido que o limite geral da API,
// que conta requisições por IP). Janela deslizante em memória: o backend roda em uma instância só, e
// reiniciar (Render hiberna) apenas zera a contagem — nunca bloqueia ninguém por engano.
//
// Ajuste: variável de ambiente UPLOAD_MAX_ARQUIVOS_POR_MINUTO (padrão 30). Sem precisar mexer no código.
const JANELA_MS = 60 * 1000;
const maximo = () => Number(process.env.UPLOAD_MAX_ARQUIVOS_POR_MINUTO) > 0 ? Number(process.env.UPLOAD_MAX_ARQUIVOS_POR_MINUTO) : 30;

const usos = new Map(); // usuarioId -> [{ t, n }]

function podar(lista, agora) {
  while (lista.length && agora - lista[0].t >= JANELA_MS) lista.shift();
  return lista;
}

const usado = (usuarioId, agora = Date.now()) => {
  const lista = podar(usos.get(String(usuarioId)) || [], agora);
  return lista.reduce((soma, u) => soma + u.n, 0);
};

// Quantos segundos até liberar espaço pra `qtd` arquivos
function segundosParaLiberar(usuarioId, qtd, agora = Date.now()) {
  const lista = podar(usos.get(String(usuarioId)) || [], agora);
  let total = lista.reduce((soma, u) => soma + u.n, 0);
  for (const u of lista) { total -= u.n; if (total + qtd <= maximo()) return Math.max(1, Math.ceil((u.t + JANELA_MS - agora) / 1000)); }
  return Math.ceil(JANELA_MS / 1000);
}

// Tenta reservar `qtd` envios. { permitido: true } ou { permitido: false, esperarSeg }
function consumir(usuarioId, qtd = 1, agora = Date.now()) {
  const id = String(usuarioId);
  const lista = podar(usos.get(id) || [], agora);
  const total = lista.reduce((soma, u) => soma + u.n, 0);
  if (total + qtd > maximo()) { usos.set(id, lista); return { permitido: false, esperarSeg: segundosParaLiberar(id, qtd, agora) }; }
  lista.push({ t: agora, n: qtd });
  usos.set(id, lista);
  return { permitido: true };
}

// Limpeza periódica pra o mapa não crescer com usuários que sumiram
const faxina = setInterval(() => { const agora = Date.now(); for (const [id, lista] of usos) { if (!podar(lista, agora).length) usos.delete(id); } }, 5 * 60 * 1000);
faxina.unref();

const MENSAGEM = 'Muitos envios em pouco tempo. Aguarde alguns instantes e tente de novo.';

module.exports = { consumir, usado, maximo, MENSAGEM };
