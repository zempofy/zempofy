import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import Turnstile from '../components/Turnstile'
import Icone from '../components/Icones'

const turnstileObrigatorio = !!import.meta.env.VITE_TURNSTILE_SITE_KEY

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [lembrar, setLembrar] = useState(false)
  const [telaEsqueci, setTelaEsqueci] = useState(false)
  const [emailEsqueci, setEmailEsqueci] = useState('')
  const [esqueciEnviado, setEsqueciEnviado] = useState(false)
  const [esqueciCarregando, setEsqueciCarregando] = useState(false)
  const [erroEsqueci, setErroEsqueci] = useState('')
  const [tokenTurnstileEsqueci, setTokenTurnstileEsqueci] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const canvasRef = useRef(null)
  const paginaRef = useRef(null)
  const turnstileEsqueciRef = useRef(null)

  // Grade de pontos reagindo ao mouse — canvas puro, sem dependência externa
  useEffect(() => {
    const canvas = canvasRef.current
    const pagina = paginaRef.current
    const ctx = canvas.getContext('2d')

    let w, h, dots = []
    const espacamento = 34
    const raioBase = 1.3
    const raioMax = 2.6
    const raioInfluencia = 150
    const mouse = { x: -9999, y: -9999 }
    let frameId

    const montarGrade = () => {
      w = pagina.clientWidth
      h = pagina.clientHeight
      canvas.width = w * devicePixelRatio
      canvas.height = h * devicePixelRatio
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)

      dots = []
      for (let y = espacamento / 2; y < h; y += espacamento) {
        for (let x = espacamento / 2; x < w; x += espacamento) {
          dots.push({ x, y, alphaAtual: 0.12, raioAtual: raioBase })
        }
      }
    }

    const onMouseMove = (e) => {
      const rect = pagina.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    const onMouseLeave = () => { mouse.x = -9999; mouse.y = -9999 }

    const desenhar = () => {
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        const dist = Math.hypot(d.x - mouse.x, d.y - mouse.y)
        const influencia = Math.max(0, 1 - dist / raioInfluencia)
        const alphaAlvo = 0.12 + influencia * 0.75
        const raioAlvo = raioBase + influencia * (raioMax - raioBase)
        d.alphaAtual += (alphaAlvo - d.alphaAtual) * 0.15
        d.raioAtual += (raioAlvo - d.raioAtual) * 0.15

        ctx.beginPath()
        ctx.arc(d.x, d.y, d.raioAtual, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,177,65,${d.alphaAtual})`
        ctx.fill()
      }
      frameId = requestAnimationFrame(desenhar)
    }

    montarGrade()
    desenhar()
    window.addEventListener('resize', montarGrade)
    pagina.addEventListener('mousemove', onMouseMove)
    pagina.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', montarGrade)
      pagina.removeEventListener('mousemove', onMouseMove)
      pagina.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  const enviarEsqueci = async () => {
    if (!emailEsqueci) return
    if (turnstileObrigatorio && !tokenTurnstileEsqueci) return
    setErroEsqueci('')
    setEsqueciCarregando(true)
    try {
      await api.post('/auth/esqueci-senha', { email: emailEsqueci, tokenTurnstile: tokenTurnstileEsqueci })
      setEsqueciEnviado(true)
    } catch (err) {
      turnstileEsqueciRef.current?.reset()
      setTokenTurnstileEsqueci('')
      if (err.response?.status === 400) {
        // Falha real (ex: token Turnstile expirado) — mostra o erro e deixa tentar de novo
        setErroEsqueci(err.response?.data?.erro || 'Verificação de segurança falhou. Tente novamente.')
      } else {
        // Endpoint sempre retorna sucesso quando processa normalmente (não revela se o
        // e-mail existe); só cai aqui em erro de rede — mostra sucesso mesmo assim
        setEsqueciEnviado(true)
      }
    } finally {
      setEsqueciCarregando(false)
    }
  }

  const fecharEsqueci = () => {
    setTelaEsqueci(false)
    setEmailEsqueci('')
    setEsqueciEnviado(false)
    setErroEsqueci('')
    setTokenTurnstileEsqueci('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const usuario = await login(form.email, form.senha, lembrar)
      navigate(usuario.cargo === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao fazer login.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={styles.pagina} ref={paginaRef} className="fade-in" data-tema="escuro">
      <canvas ref={canvasRef} style={styles.canvas} />

      <img src="/logo.svg" alt="Zempofy" style={styles.logoCanto} />

      <div style={styles.centro}>
        <div style={styles.formConteudo}>
          <h1 style={styles.titulo}>Bem-vindo de volta</h1>
          <p style={styles.subtitulo}>Entre na sua conta pra continuar</p>

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
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  id="input-senha-login"
                  value={form.senha}
                  onChange={e => setForm({ ...form, senha: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && document.querySelector('[type="submit"]')?.click()}
                  style={{ ...styles.input, paddingRight: '42px' }}
                  required
                />
                <button
                  type="button"
                  className="btn-olho-senha"
                  onClick={() => setMostrarSenha(v => !v)}
                  tabIndex={-1}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  style={styles.botaoOlho}
                >
                  {mostrarSenha ? <Icone.EyeOff size={17} /> : <Icone.Eye size={17} />}
                </button>
              </div>
            </div>

            <div style={styles.linhaOpcoes}>
              <label style={styles.lembrar}>
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={e => setLembrar(e.target.checked)}
                  className="cb-oculto"
                />
                <span className="cb-caixa">
                  <svg viewBox="0 0 24 24"><polyline points="4 12 9 18 20 6" /></svg>
                </span>
                Lembrar por 30 dias
              </label>
              <button type="button" onClick={() => setTelaEsqueci(true)} style={styles.linkEsqueci}>
                Esqueci a senha
              </button>
            </div>

            <button type="submit" style={styles.botao} disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p style={styles.rodape}>
            Não tem conta?{' '}
            <Link to="/cadastro" style={styles.link}>
              Cadastre sua empresa
            </Link>
          </p>
        </div>
      </div>

      {/* Modal esqueci senha */}
      {telaEsqueci && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px' }}>
            {!esqueciEnviado ? (<>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--texto)', margin: '0 0 8px', fontFamily: 'var(--fonte-corpo)' }}>Esqueci minha senha</h2>
              <p style={{ fontSize: '0.82rem', color: 'rgba(var(--sobreposicao-rgb),0.5)', margin: '0 0 20px', fontFamily: 'var(--fonte-corpo)' }}>Digite seu e-mail e enviaremos as instruções para redefinir sua senha.</p>
              {erroEsqueci && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#FCA5A5', fontSize: '0.8rem', marginBottom: '12px', fontFamily: 'var(--fonte-corpo)' }}>{erroEsqueci}</div>}
              <input
                style={{ width: '100%', padding: '10px 14px', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto)', fontSize: '0.875rem', fontFamily: 'var(--fonte-corpo)', boxSizing: 'border-box', marginBottom: '12px' }}
                type="email" placeholder="seu@email.com"
                value={emailEsqueci} onChange={e => setEmailEsqueci(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enviarEsqueci()}
                autoFocus
              />
              <Turnstile ref={turnstileEsqueciRef} onVerify={setTokenTurnstileEsqueci} onExpire={() => setTokenTurnstileEsqueci('')} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={enviarEsqueci} disabled={esqueciCarregando || (turnstileObrigatorio && !tokenTurnstileEsqueci)} style={{ flex: 1, background: 'linear-gradient(135deg,#00b141,#008f34)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }}>
                  {esqueciCarregando ? 'Enviando...' : 'Enviar instruções'}
                </button>
                <button onClick={fecharEsqueci} style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'rgba(var(--sobreposicao-rgb),0.5)', padding: '10px 14px', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', fontSize: '0.875rem' }}>
                  Cancelar
                </button>
              </div>
            </>) : (<>
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <p style={{ fontSize: '2rem', marginBottom: '12px' }}>📧</p>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--texto)', margin: '0 0 8px', fontFamily: 'var(--fonte-corpo)' }}>E-mail enviado!</h2>
                <p style={{ fontSize: '0.82rem', color: 'rgba(var(--sobreposicao-rgb),0.5)', margin: '0 0 20px', fontFamily: 'var(--fonte-corpo)', lineHeight: '1.5' }}>Se o e-mail estiver cadastrado, você receberá as instruções em breve. Verifique também sua caixa de spam.</p>
                <button onClick={fecharEsqueci} style={{ background: 'linear-gradient(135deg,#00b141,#008f34)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }}>
                  Voltar para o login
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}

      <style>{`
        .cb-oculto { position: absolute; opacity: 0; width: 0; height: 0; }
        .cb-caixa {
          width: 18px; height: 18px; flex-shrink: 0;
          border: 1.5px solid var(--borda); border-radius: 5px;
          background: var(--input);
          display: flex; align-items: center; justify-content: center;
          transition: background .2s ease, border-color .2s ease, transform .15s ease;
        }
        .cb-caixa svg {
          width: 12px; height: 12px;
          stroke: #fff; stroke-width: 3; fill: none;
          stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 26;
          stroke-dashoffset: 26;
          transition: stroke-dashoffset .25s ease .05s;
        }
        .cb-oculto:checked + .cb-caixa {
          background: #00b141;
          border-color: #00b141;
          transform: scale(1.08);
        }
        .cb-oculto:checked + .cb-caixa svg { stroke-dashoffset: 0; }
        .cb-oculto:active + .cb-caixa { transform: scale(0.9); }
        .btn-olho-senha:hover { color: var(--texto); }
      `}</style>
    </div>
  )
}

const styles = {
  pagina: {
    position: 'relative',
    minHeight: '100vh',
    background: 'var(--fundo)',
    overflow: 'hidden',
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  logoCanto: {
    position: 'absolute',
    top: '32px',
    left: '40px',
    zIndex: 2,
    height: '34px',
    width: 'auto',
  },
  centro: {
    position: 'relative',
    zIndex: 2,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  formConteudo: {
    width: '100%',
    maxWidth: '360px',
  },
  titulo: {
    fontSize: '1.65rem',
    color: 'var(--texto)',
    marginBottom: '6px',
    textAlign: 'center',
  },
  subtitulo: {
    color: 'var(--texto)',
    opacity: 0.65,
    fontSize: '0.9rem',
    marginBottom: '28px',
    textAlign: 'center',
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
  },
  campo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '24px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: 'var(--texto)',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },
  input: {
    background: 'var(--input)',
    border: '1px solid var(--borda)',
    borderRadius: '10px',
    padding: '12px 16px',
    color: 'var(--texto)',
    fontSize: '0.95rem',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  botaoOlho: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--texto-apagado)',
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
  linhaOpcoes: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '4px 0 22px',
    fontSize: '0.82rem',
  },
  lembrar: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    color: 'var(--texto)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  linkEsqueci: {
    background: 'none',
    border: 'none',
    color: 'var(--verde)',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'var(--fonte-corpo)',
    padding: 0,
  },
  botao: {
    background: 'linear-gradient(135deg, #00b141, #008f34)',
    color: '#fff',
    border: 'none',
    borderRadius: '9px',
    padding: '10px',
    fontFamily: 'var(--fonte-corpo)',
    fontWeight: '600',
    fontSize: '0.88rem',
    cursor: 'pointer',
    letterSpacing: '0.3px',
  },
  rodape: {
    textAlign: 'center',
    marginTop: '24px',
    color: 'var(--texto)',
    fontSize: '0.875rem',
  },
  link: {
    color: 'var(--verde)',
    fontWeight: '500',
  }
}
