import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [telaEsqueci, setTelaEsqueci] = useState(false)
  const [emailEsqueci, setEmailEsqueci] = useState('')
  const [esqueciEnviado, setEsqueciEnviado] = useState(false)
  const [esqueciCarregando, setEsqueciCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const enviarEsqueci = async () => {
    if (!emailEsqueci) return
    setEsqueciCarregando(true)
    try {
      await api.post('/auth/esqueci-senha', { email: emailEsqueci })
    } catch (err) {
      // Endpoint sempre retorna sucesso mesmo se o e-mail não existir; erro aqui é só de rede
    } finally {
      setEsqueciCarregando(false)
      setEsqueciEnviado(true)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const usuario = await login(form.email, form.senha)
      navigate(usuario.cargo === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao fazer login.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={styles.pagina}>
      {/* Fundo decorativo */}
      <div style={styles.fundoDecor}>
        <div style={styles.circulo1} />
        <div style={styles.circulo2} />
        <div style={styles.grade} />
      </div>

      <div style={styles.caixa} className="fade-in">
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcone}>Z</div>
          <span style={styles.logoNome}>zempofy</span>
        </div>

        <h1 style={styles.titulo}>Bem-vindo de volta</h1>
        <p style={styles.subtitulo}>Entre na sua conta para continuar</p>

        {erro && <div style={styles.erro}>{erro}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.campo}>
            <label style={styles.label}>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('input-senha-login')?.focus()}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.campo}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              id="input-senha-login"
              value={form.senha}
              onChange={e => setForm({ ...form, senha: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && document.querySelector('[type="submit"]')?.click()}
              style={styles.input}
              required
            />
          </div>

          <button type="submit" style={styles.botao} disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
          <button type="button" onClick={()=>setTelaEsqueci(true)} style={{ background:'none', border:'none', color:'var(--verde)', fontSize:'0.8rem', cursor:'pointer', marginTop:'4px', fontFamily:'Inter,sans-serif', textDecoration:'underline' }}>
            Esqueci minha senha
          </button>
        </form>

        {/* Modal esqueci senha */}
        {telaEsqueci && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
            <div style={{ background:'#18181b', border:'1px solid #27272a', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'380px' }}>
              {!esqueciEnviado ? (<>
                <h2 style={{ fontSize:'1.1rem', fontWeight:'700', color:'#fff', margin:'0 0 8px', fontFamily:'Inter,sans-serif' }}>Esqueci minha senha</h2>
                <p style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.5)', margin:'0 0 20px', fontFamily:'Inter,sans-serif' }}>Digite seu e-mail e enviaremos as instruções para redefinir sua senha.</p>
                <input
                  style={{ width:'100%', padding:'10px 14px', background:'#1c1c1f', border:'1px solid #27272a', borderRadius:'8px', color:'#fff', fontSize:'0.875rem', fontFamily:'Inter,sans-serif', boxSizing:'border-box', marginBottom:'12px' }}
                  type="email" placeholder="seu@email.com"
                  value={emailEsqueci} onChange={e=>setEmailEsqueci(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&enviarEsqueci()}
                  autoFocus
                />
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={enviarEsqueci} disabled={esqueciCarregando} style={{ flex:1, background:'linear-gradient(135deg,#00b141,#008f34)', color:'#fff', border:'none', borderRadius:'8px', padding:'10px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.875rem', cursor:'pointer' }}>
                    {esqueciCarregando ? 'Enviando...' : 'Enviar instruções'}
                  </button>
                  <button onClick={()=>{setTelaEsqueci(false);setEmailEsqueci('');setEsqueciEnviado(false)}} style={{ background:'none', border:'1px solid #27272a', borderRadius:'8px', color:'rgba(255,255,255,0.5)', padding:'10px 14px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.875rem' }}>
                    Cancelar
                  </button>
                </div>
              </>) : (<>
                <div style={{ textAlign:'center', padding:'10px 0' }}>
                  <p style={{ fontSize:'2rem', marginBottom:'12px' }}>📧</p>
                  <h2 style={{ fontSize:'1.1rem', fontWeight:'700', color:'#fff', margin:'0 0 8px', fontFamily:'Inter,sans-serif' }}>E-mail enviado!</h2>
                  <p style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.5)', margin:'0 0 20px', fontFamily:'Inter,sans-serif', lineHeight:'1.5' }}>Se o e-mail estiver cadastrado, você receberá as instruções em breve. Verifique também sua caixa de spam.</p>
                  <button onClick={()=>{setTelaEsqueci(false);setEmailEsqueci('');setEsqueciEnviado(false)}} style={{ background:'linear-gradient(135deg,#00b141,#008f34)', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.875rem', cursor:'pointer' }}>
                    Voltar para o login
                  </button>
                </div>
              </>)}
            </div>
          </div>
        )}

        <p style={styles.rodape}>
          Não tem conta?{' '}
          <Link to="/cadastro" style={styles.link}>
            Cadastre sua empresa
          </Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  pagina: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    background: '#09090b',
    position: 'relative',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '40px 20px',
  },
  fundoDecor: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
  },
  circulo1: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)',
    top: '-100px',
    right: '-100px',
  },
  circulo2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,143,52,0.08) 0%, transparent 70%)',
    bottom: '-80px',
    left: '-80px',
  },
  grade: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(0,177,65,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,177,65,0.03) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
  },
  caixa: {
    background: 'rgba(17,17,19,0.97)',
    border: '1px solid #27272a',
    borderRadius: '20px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '420px',
    position: 'relative',
    zIndex: 1,
    backdropFilter: 'blur(20px)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '32px',
  },
  logoIcone: {
    width: '36px',
    height: '36px',
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Inter, sans-serif',
    fontWeight: '800',
    fontSize: '18px',
    color: '#fff',
  },
  logoNome: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: '700',
    fontSize: '20px',
    color: '#E8F5EE',
    letterSpacing: '-0.5px',
  },
  titulo: {
    fontSize: '1.75rem',
    color: '#E8F5EE',
    marginBottom: '6px',
  },
  subtitulo: {
    color: '#6B8F78',
    fontSize: '0.9rem',
    marginBottom: '28px',
  },
  erro: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  campo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: '#6B8F78',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },
  input: {
    background: '#1E2820',
    border: '1px solid #2A3830',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#E8F5EE',
    fontSize: '0.95rem',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  botao: {
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: '600',
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'opacity 0.2s, transform 0.1s',
    letterSpacing: '0.3px',
  },
  rodape: {
    textAlign: 'center',
    marginTop: '24px',
    color: '#6B8F78',
    fontSize: '0.875rem',
  },
  link: {
    color: '#22C55E',
    fontWeight: '500',
  }
}
