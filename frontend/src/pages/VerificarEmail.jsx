import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function VerificarEmail() {
  const [status, setStatus] = useState('carregando') // carregando | sucesso | erro
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (!token) {
      setStatus('erro')
      return
    }

    api.get(`/auth/verificar-email?token=${token}`)
      .then(() => setStatus('sucesso'))
      .catch(() => setStatus('erro'))
  }, [])

  return (
    <div data-tema="escuro" style={{
      minHeight: '100vh', background: 'var(--fundo)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--fonte-corpo)', padding: '20px'
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--borda)',
        borderRadius: '20px', padding: '48px 40px',
        maxWidth: '420px', width: '100%', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        {status === 'carregando' && (
          <>
            <div style={{ width: '48px', height: '48px', border: '3px solid var(--borda)', borderTopColor: '#00b141', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 24px' }} />
            <p style={{ color: 'var(--texto-secundario)', fontSize: '0.95rem' }}>Verificando seu e-mail...</p>
          </>
        )}

        {status === 'sucesso' && (
          <>
            <div style={{ width: '60px', height: '60px', background: 'rgba(0,177,65,0.12)', border: '1px solid rgba(0,177,65,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '1.8rem' }}>
              ✓
            </div>
            <h1 style={{ color: 'var(--texto)', fontSize: '1.3rem', fontWeight: '700', marginBottom: '12px', letterSpacing: '-0.02em' }}>
              E-mail verificado!
            </h1>
            <p style={{ color: 'var(--texto-secundario)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '28px' }}>
              Sua conta está confirmada. Agora você tem acesso completo ao sistema.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{ background: 'linear-gradient(135deg, #00b141, #008f34)', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 28px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,177,65,0.3)' }}
            >
              Ir para o sistema
            </button>
          </>
        )}

        {status === 'erro' && (
          <>
            <div style={{ width: '60px', height: '60px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '1.8rem' }}>
              ✕
            </div>
            <h1 style={{ color: 'var(--texto)', fontSize: '1.3rem', fontWeight: '700', marginBottom: '12px' }}>
              Link inválido ou expirado
            </h1>
            <p style={{ color: 'var(--texto-secundario)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '28px' }}>
              Este link de verificação não é válido ou já expirou. Faça login e solicite um novo e-mail de verificação.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', padding: '12px 28px', color: 'var(--texto-secundario)', fontFamily: 'var(--fonte-corpo)', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer' }}
            >
              Ir para o login
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
