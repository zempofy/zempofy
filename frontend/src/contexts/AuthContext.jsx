import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroConexao, setErroConexao] = useState(false)

  // Só derruba a sessão quando o servidor de fato rejeita o token (401/403).
  // Falha de rede/servidor fora do ar (sem response, ou 5xx) não significa "sessão inválida" —
  // manter o token e deixar a pessoa tentar de novo, em vez de forçar login de novo à toa.
  const verificarSessao = () => {
    const token = localStorage.getItem('zempofy_token')
    if (!token) { setCarregando(false); return }
    setCarregando(true)
    setErroConexao(false)
    api.defaults.headers.Authorization = `Bearer ${token}`
    api.get('/auth/me')
      .then(res => setUsuario(res.data))
      .catch(err => {
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('zempofy_token')
          delete api.defaults.headers.Authorization
        } else {
          setErroConexao(true)
        }
      })
      .finally(() => setCarregando(false))
  }

  useEffect(() => { verificarSessao() }, [])

  const login = async (email, senha, lembrar = false) => {
    const res = await api.post('/auth/login', { email, senha, lembrar })
    const { token, usuario } = res.data
    localStorage.setItem('zempofy_token', token)
    api.defaults.headers.Authorization = `Bearer ${token}`
    setUsuario(usuario)
    return usuario
  }

  const cadastrar = async (dados) => {
    const res = await api.post('/auth/cadastro', dados)
    const { token, usuario } = res.data
    localStorage.setItem('zempofy_token', token)
    api.defaults.headers.Authorization = `Bearer ${token}`
    setUsuario(usuario)
    return usuario
  }

  const recarregarUsuario = async () => {
    try {
      const res = await api.get('/auth/me')
      setUsuario(res.data)
    } catch (err) { console.error(err) }
  }

  const sair = () => {
    localStorage.removeItem('zempofy_token')
    delete api.defaults.headers.Authorization
    setUsuario(null)
  }

  // Verifica se o usuário logado tem uma permissão específica
  const temPermissao = (permissao) => {
    if (!usuario) return false
    if (usuario.cargo === 'admin') return true
    return !!usuario.permissoes?.[permissao]
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, erroConexao, tentarNovamente: verificarSessao, login, cadastrar, sair, recarregarUsuario, temPermissao }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
