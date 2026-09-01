import React, { useState, useEffect } from 'react'

import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

function InputSenhaVer({ style, placeholder, value, onChange, onKeyDown, id, autoFocus }) {
  const [ver, setVer] = React.useState(false)
  return (
    <div style={{ position:'relative' }}>
      <input id={id} style={{ ...style, paddingRight:'40px' }} type={ver?'text':'password'} placeholder={placeholder}
        value={value} onChange={onChange} onKeyDown={onKeyDown} autoFocus={autoFocus} />
      <button type="button" onClick={()=>setVer(v=>!v)} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(var(--sobreposicao-rgb),0.4)', display:'flex', alignItems:'center' }}>
        {ver ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
      </button>
    </div>
  )
}

export default function RedefinirSenha() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const ehConvite = params.get('novo') === '1'

  const [form, setForm] = useState({ novaSenha: '', confirmar: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token])

  const salvar = async () => {
    if (!form.novaSenha) return setErro('Digite a nova senha.')
    if (form.novaSenha.length < 6) return setErro('Mínimo 6 caracteres.')
    if (form.novaSenha !== form.confirmar) return setErro('As senhas não coincidem.')
    setCarregando(true); setErro('')
    try {
      await api.post('/auth/redefinir-senha', { token, novaSenha: form.novaSenha })
      setSucesso(true)
    } catch (e) {
      setErro(e.response?.data?.erro || 'Link inválido ou expirado.')
    } finally { setCarregando(false) }
  }

  const s = {
    wrap: { minHeight: '100vh', background: 'var(--fundo)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    card: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '380px' },
    logo: { fontSize: '1.4rem', fontWeight: '800', color: '#00b141', letterSpacing: '-0.03em', marginBottom: '24px', fontFamily: 'var(--fonte-corpo)', textAlign: 'center' },
    titulo: { fontSize: '1.1rem', fontWeight: '700', color: 'var(--texto)', margin: '0 0 8px', fontFamily: 'var(--fonte-corpo)' },
    sub: { fontSize: '0.82rem', color: 'rgba(var(--sobreposicao-rgb),0.5)', margin: '0 0 24px', fontFamily: 'var(--fonte-corpo)', lineHeight: '1.5' },
    label: { fontSize: '0.7rem', fontWeight: '600', color: 'rgba(var(--sobreposicao-rgb),0.5)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px', fontFamily: 'var(--fonte-corpo)' },
    inp: { width: '100%', padding: '10px 14px', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto)', fontSize: '0.875rem', fontFamily: 'var(--fonte-corpo)', boxSizing: 'border-box', marginBottom: '14px' },
    btn: { width: '100%', background: 'linear-gradient(135deg,#00b141,#008f34)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', marginTop: '4px' },
    erro: { color: '#f87171', fontSize: '0.8rem', background: 'rgba(248,113,113,0.08)', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px', fontFamily: 'var(--fonte-corpo)' },
  }

  return (
    <div style={s.wrap} data-tema="escuro">
      <div style={s.card}>
        <p style={s.logo}>Zempofy</p>
        {sucesso ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: '12px' }}>✅</p>
            <p style={s.titulo}>{ehConvite ? 'Senha criada!' : 'Senha redefinida!'}</p>
            <p style={s.sub}>{ehConvite ? 'Sua senha foi criada com sucesso.' : 'Sua senha foi atualizada com sucesso.'} Agora você pode fazer login com a nova senha.</p>
            <button style={s.btn} onClick={() => navigate('/login')}>Ir para o login</button>
          </div>
        ) : (
          <>
            <p style={s.titulo}>{ehConvite ? 'Criar senha' : 'Redefinir senha'}</p>
            <p style={s.sub}>{ehConvite ? 'Defina sua senha de acesso abaixo.' : 'Digite sua nova senha abaixo.'}</p>
            {erro && <p style={s.erro}>{erro}</p>}
            <label style={s.label}>Nova senha</label>
            <InputSenhaVer style={s.inp} placeholder="••••••••" autoFocus
              value={form.novaSenha} onChange={e => setForm({ ...form, novaSenha: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('confirmar-red')?.focus()}
            />
            <label style={s.label}>Confirmar nova senha</label>
            <InputSenhaVer id="confirmar-red" style={s.inp} placeholder="••••••••"
              value={form.confirmar} onChange={e => setForm({ ...form, confirmar: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && salvar()}
            />
            <button style={s.btn} onClick={salvar} disabled={carregando}>
              {carregando ? 'Salvando...' : (ehConvite ? 'Salvar senha' : 'Salvar nova senha')}
            </button>
            <button onClick={() => navigate('/login')} style={{ width:'100%', background:'none', border:'none', color:'rgba(var(--sobreposicao-rgb),0.4)', fontSize:'0.8rem', cursor:'pointer', marginTop:'12px', fontFamily:'var(--fonte-corpo)' }}>
              ← Voltar para o login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
