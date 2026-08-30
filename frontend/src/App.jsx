import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PreferenciasProvider } from './contexts/PreferenciasContext'
import { ToastProvider } from './components/Toast'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import DashboardAdmin from './pages/DashboardAdmin'
import DashboardFuncionario from './pages/DashboardFuncionario'
import VerificarEmail from './pages/VerificarEmail'
import RedefinirSenha from './pages/RedefinirSenha'
import Pagina404 from './pages/Pagina404'

// Gestor = admin ou administrador → vai pro painel admin
const isGestor = (cargo) => ['admin', 'administrador'].includes(cargo)

function TelaErroConexao({ onTentar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '14px', padding: '20px', textAlign: 'center', fontFamily: 'var(--fonte-corpo)' }}>
      <p style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>Não foi possível conectar ao servidor.</p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: 0, maxWidth: '360px' }}>Verifique sua internet e tente novamente. Sua sessão continua salva.</p>
      <button onClick={onTentar} style={{ background: 'linear-gradient(135deg,#00b141,#008f34)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', marginTop: '6px' }}>
        Tentar novamente
      </button>
    </div>
  )
}

function RotaProtegida({ children, apenasGestor, apenasColaborador }) {
  const { usuario, carregando, erroConexao, tentarNovamente } = useAuth()

  if (carregando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#22C55E', fontFamily: 'var(--fonte-corpo)', fontSize: '1.2rem' }}>
      Carregando...
    </div>
  )

  if (erroConexao) return <TelaErroConexao onTentar={tentarNovamente} />

  if (!usuario) return <Navigate to="/login" replace />

  if (apenasGestor && !isGestor(usuario.cargo)) {
    return <Navigate to="/dashboard" replace />
  }

  if (apenasColaborador && isGestor(usuario.cargo)) {
    return <Navigate to="/admin" replace />
  }

  return children
}

function RedirecionarLogado() {
  const { usuario, carregando, erroConexao, tentarNovamente } = useAuth()
  if (carregando) return null
  if (erroConexao) return <TelaErroConexao onTentar={tentarNovamente} />
  if (!usuario) return <Navigate to="/login" replace />
  return <Navigate to={isGestor(usuario.cargo) ? '/admin' : '/dashboard'} replace />
}

export default function App() {
  return (
    <PreferenciasProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RedirecionarLogado />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/admin/*" element={
                <RotaProtegida apenasGestor>
                  <DashboardAdmin />
                </RotaProtegida>
              } />
              <Route path="/verificar-email" element={<VerificarEmail />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />
              <Route path="/dashboard/*" element={
                <RotaProtegida apenasColaborador>
                  <DashboardFuncionario />
                </RotaProtegida>
              } />
              <Route path="*" element={<Pagina404 />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </PreferenciasProvider>
  )
}
