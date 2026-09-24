// Helpers de setor usados fora do Clientes.jsx.
// TODO consolidar depois: normalizarNome duplica o que já existe (sem export) em Clientes.jsx e
// em backend/routes/cliente.js. Duplicado de propósito pra não mexer no Clientes.jsx agora.
export const normalizarNome = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

// usuarioTemSetor(usuario, 'contabil') — compara pelo nome normalizado ("Contábil" === "contabil").
// usuario.setores vem de /auth/me já populado com { _id, nome, cor }.
export const usuarioTemSetor = (usuario, nomeSetor) => {
  const alvo = normalizarNome(nomeSetor)
  return !!usuario?.setores?.some(s => normalizarNome(s?.nome || '') === alvo)
}

// Acesso ao grupo Contábil do sidebar: titular ou membro do setor Contábil (mesma regra do
// middleware apenasContabil no backend)
export const podeVerContabil = (usuario) => usuario?.cargo === 'admin' || usuarioTemSetor(usuario, 'contabil')
