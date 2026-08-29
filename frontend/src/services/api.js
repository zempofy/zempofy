import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('zempofy_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Sessão derrubada pelo servidor (token expirado, usuário desativado ou empresa inativada pelo
// Painel Admin) cai aqui. Sem isso, a pessoa continuava numa tela quebrada mostrando "verifique
// sua conexão" — mensagem enganosa — até recarregar a página na mão.
// Só age quando havia sessão: 401 nas telas públicas (login, cadastro, redefinir senha) é erro
// de credencial e continua sendo tratado pela própria tela.
const ROTAS_PUBLICAS = ['/auth/login', '/auth/cadastro', '/auth/esqueci-senha', '/auth/redefinir-senha']

api.interceptors.response.use(
  resposta => resposta,
  erro => {
    const url = erro.config?.url || ''
    const ehPublica = ROTAS_PUBLICAS.some(r => url.includes(r))
    const tinhaSessao = !!localStorage.getItem('zempofy_token')

    if (erro.response?.status === 401 && tinhaSessao && !ehPublica) {
      localStorage.removeItem('zempofy_token')
      delete api.defaults.headers.Authorization
      // Recarrega em vez de só limpar o estado: garante que nenhuma tela continue montada com
      // dados de uma sessão que não vale mais. O AuthContext, sem token, mostra o login.
      if (!window.location.pathname.startsWith('/login')) window.location.replace('/login')
    }
    return Promise.reject(erro)
  }
)

export default api
