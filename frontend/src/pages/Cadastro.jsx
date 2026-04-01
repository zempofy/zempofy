import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Cadastro() {
  const { cadastrar } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nomeEmpresa: '', cnpj: '', nomeAdmin: '', email: '', senha: '', confirmarSenha: '' })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [verSenha, setVerSenha] = useState(false)
  const [verConfirmar, setVerConfirmar] = useState(false)
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [modalTermos, setModalTermos] = useState(false)

  const mascaraCNPJ = (valor) => valor
    .replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    if (!aceitouTermos) return setErro('Você precisa aceitar os Termos de Uso para continuar.')
    if (form.senha !== form.confirmarSenha) return setErro('As senhas não coincidem.')
    if (form.senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    setCarregando(true)
    try {
      await cadastrar({ nomeEmpresa: form.nomeEmpresa, cnpj: form.cnpj, nomeAdmin: form.nomeAdmin, email: form.email, senha: form.senha })
      navigate('/admin')
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar conta.')
    } finally {
      setCarregando(false)
    }
  }

  const atualizar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  return (
    <div style={styles.pagina}>
      <div style={styles.fundoDecor}>
        <div style={styles.circulo1} />
        <div style={styles.circulo2} />
        <div style={styles.grade} />
      </div>

      <div style={styles.caixa} className="fade-in">
        <div style={styles.logo}>
          <div style={styles.logoIcone}>Z</div>
          <span style={styles.logoNome}>zempofy</span>
        </div>

        <h1 style={styles.titulo}>Criar sua empresa</h1>
        <p style={styles.subtitulo}>Configure o Zempofy para o seu time</p>

        {erro && <div style={styles.erro}>{erro}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.secao}>
            <p style={styles.secaoTitulo}>Dados da empresa</p>
            <div style={styles.campo}>
              <label style={styles.label}>Nome da empresa</label>
              <input
                type="text"
                placeholder="Ex: Escritório Contábil Silva"
                value={form.nomeEmpresa}
                onChange={e => atualizar('nomeEmpresa', e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>CNPJ</label>
              <input
                type="text"
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={e => atualizar('cnpj', mascaraCNPJ(e.target.value))}
                style={styles.input}
                maxLength={18}
                required
              />
            </div>
          </div>

          <div style={styles.secao}>
            <p style={styles.secaoTitulo}>Dados do administrador</p>
            <div style={styles.campo}>
              <label style={styles.label}>Seu nome</label>
              <input
                type="text"
                placeholder="Ex: João Silva"
                value={form.nomeAdmin}
                onChange={e => atualizar('nomeAdmin', e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={e => atualizar('email', e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.linha2}>
              <div style={styles.campo}>
                <label style={styles.label}>Senha</label>
                <div style={styles.inputWrapper}>
                  <input
                    type={verSenha ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.senha}
                    onChange={e => atualizar('senha', e.target.value)}
                    style={{ ...styles.input, paddingRight: '42px' }}
                    required
                  />
                  <button type="button" style={styles.btnOlho} onClick={() => setVerSenha(v => !v)} title={verSenha ? 'Ocultar senha' : 'Ver senha'}>
                    {verSenha
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div style={styles.campo}>
                <label style={styles.label}>Confirmar senha</label>
                <div style={styles.inputWrapper}>
                  <input
                    type={verConfirmar ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.confirmarSenha}
                    onChange={e => atualizar('confirmarSenha', e.target.value)}
                    style={{ ...styles.input, paddingRight: '42px' }}
                    required
                  />
                  <button type="button" style={styles.btnOlho} onClick={() => setVerConfirmar(v => !v)} title={verConfirmar ? 'Ocultar senha' : 'Ver senha'}>
                    {verConfirmar
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Termos de uso */}
          <label style={styles.termosLabel}>
            <input
              type="checkbox"
              checked={aceitouTermos}
              onChange={e => setAceitouTermos(e.target.checked)}
              style={{ marginTop: '2px', accentColor: '#00b141', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', lineHeight: '1.5' }}>
              Li e aceito os{' '}
              <button type="button" style={styles.linkTermos} onClick={() => setModalTermos(true)}>
                Termos de Uso
              </button>
              {' '}e a{' '}
              <button type="button" style={styles.linkTermos} onClick={() => setModalTermos(true)}>
                Política de Privacidade
              </button>
              {' '}do Zempofy.
            </span>
          </label>

          <button type="submit" style={styles.botao} disabled={carregando}>
            {carregando ? 'Criando conta...' : 'Criar empresa grátis'}
          </button>
        </form>

        <p style={styles.rodape}>
          Já tem conta?{' '}
          <Link to="/login" style={styles.link}>Fazer login</Link>
        </p>
      </div>

      {/* Modal Termos de Uso */}
      {modalTermos && (
        <div style={styles.termosOverlay} onClick={() => setModalTermos(false)}>
          <div style={styles.termosModal} onClick={e => e.stopPropagation()}>
            <div style={styles.termosTopo}>
              <span style={styles.termosTitulo}>Termos de Uso e Política de Privacidade</span>
              <button style={styles.termosFechar} onClick={() => setModalTermos(false)}>✕</button>
            </div>
            <div style={styles.termosCorpo}>
              <p style={styles.termosTexto}>Última atualização: Janeiro de 2025</p>

              <p style={styles.termosSecTitulo}>1. Aceitação dos Termos</p>
              <p style={styles.termosTexto}>Ao criar uma conta no Zempofy, você concorda com estes Termos de Uso. O Zempofy é uma plataforma de gestão de onboarding para escritórios contábeis. O uso do sistema implica na aceitação integral das condições aqui descritas.</p>

              <p style={styles.termosSecTitulo}>2. Uso do Sistema</p>
              <p style={styles.termosTexto}>O Zempofy é fornecido para uso exclusivo do escritório contábil cadastrado e sua equipe. É proibido compartilhar credenciais de acesso, utilizar o sistema para fins ilícitos, ou tentar comprometer a segurança da plataforma.</p>

              <p style={styles.termosSecTitulo}>3. Dados e Privacidade</p>
              <p style={styles.termosTexto}>Os dados cadastrados no sistema (informações de clientes, documentos, configurações) são de responsabilidade do escritório. O Zempofy não compartilha dados com terceiros e adota medidas de segurança para proteger as informações armazenadas.</p>

              <p style={styles.termosSecTitulo}>4. Disponibilidade</p>
              <p style={styles.termosTexto}>O Zempofy se esforça para manter o sistema disponível, mas não garante disponibilidade ininterrupta. Manutenções podem ser realizadas sem aviso prévio. Não nos responsabilizamos por perdas decorrentes de indisponibilidade temporária.</p>

              <p style={styles.termosSecTitulo}>5. Gratuidade</p>
              <p style={styles.termosTexto}>O plano atual é gratuito. O Zempofy se reserva o direito de introduzir planos pagos no futuro, comunicando os usuários com antecedência mínima de 30 dias.</p>

              <p style={styles.termosSecTitulo}>6. Cancelamento</p>
              <p style={styles.termosTexto}>Você pode cancelar sua conta a qualquer momento. Após o cancelamento, os dados poderão ser removidos permanentemente após 30 dias.</p>

              <p style={styles.termosSecTitulo}>7. Contato</p>
              <p style={styles.termosTexto}>Em caso de dúvidas sobre estes termos, entre em contato através do e-mail disponível na plataforma.</p>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #27272a' }}>
              <button
                style={{ ...styles.botao, marginTop: 0 }}
                onClick={() => { setAceitouTermos(true); setModalTermos(false) }}
              >
                Li e aceito os Termos de Uso
              </button>
            </div>
          </div>
        </div>
      )}
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
  fundoDecor: { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 },
  circulo1: {
    position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,177,65,0.07) 0%, transparent 70%)',
    top: '-100px', right: '-100px',
  },
  circulo2: {
    position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,143,52,0.08) 0%, transparent 70%)',
    bottom: '-80px', left: '-80px',
  },
  grade: {
    position: 'absolute', inset: 0,
    backgroundImage: 'linear-gradient(rgba(0,177,65,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,177,65,0.03) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
  },
  caixa: {
    background: 'rgba(17,17,19,0.97)',
    border: '1px solid #27272a',
    borderRadius: '20px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '480px',
    position: 'relative',
    zIndex: 1,
    backdropFilter: 'blur(20px)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  logo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' },
  logoIcone: {
    width: '36px', height: '36px',
    background: 'linear-gradient(135deg, #00b141, #008f34)',
    borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif', fontWeight: '800', fontSize: '18px', color: '#fff',
    boxShadow: '0 2px 8px rgba(0,177,65,0.35)',
  },
  logoNome: { fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '20px', color: '#fafafa', letterSpacing: '-0.5px' },
  titulo: { fontSize: '1.6rem', color: '#fafafa', marginBottom: '6px', letterSpacing: '-0.03em', fontWeight: '700' },
  subtitulo: { color: '#71717a', fontSize: '0.9rem', marginBottom: '24px' },
  erro: {
    background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: '10px', padding: '12px 16px', color: '#f87171',
    fontSize: '0.875rem', marginBottom: '16px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  secao: { display: 'flex', flexDirection: 'column', gap: '12px' },
  secaoTitulo: {
    fontSize: '0.68rem', fontWeight: '700', color: '#00b141',
    textTransform: 'uppercase', letterSpacing: '1.5px',
    borderBottom: '1px solid #27272a', paddingBottom: '8px',
  },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  linha2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { fontSize: '0.72rem', fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.8px' },
  input: {
    background: '#1c1c1f', border: '1px solid #27272a', borderRadius: '10px',
    padding: '12px 16px', color: '#fafafa', fontSize: '0.95rem',
    transition: 'border-color 0.2s, box-shadow 0.2s', width: '100%',
    fontFamily: 'Inter, sans-serif',
  },
  botao: {
    background: 'linear-gradient(135deg, #00b141, #008f34)',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '14px', fontFamily: 'Inter, sans-serif',
    fontWeight: '600', fontSize: '1rem', cursor: 'pointer',
    marginTop: '4px', letterSpacing: '0.3px', width: '100%',
    boxShadow: '0 2px 12px rgba(0,177,65,0.35)',
  },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  btnOlho: { position: 'absolute', right: '12px', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' },
  termosLabel: { display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginTop: '4px' },
  linkTermos: { background: 'none', border: 'none', color: '#00b141', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', padding: 0, fontFamily: 'Inter, sans-serif', textDecoration: 'underline' },
  termosOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' },
  termosModal: { background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' },
  termosTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #27272a' },
  termosTitulo: { fontWeight: '700', fontSize: '1rem', color: '#fafafa', fontFamily: 'Inter, sans-serif' },
  termosFechar: { background: 'none', border: '1px solid #27272a', borderRadius: '6px', color: '#71717a', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' },
  termosCorpo: { padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 },
  termosSecTitulo: { fontSize: '0.85rem', fontWeight: '700', color: '#00b141', marginBottom: '-8px' },
  termosTexto: { fontSize: '0.85rem', color: '#a1a1aa', lineHeight: '1.7' },
  rodape: { textAlign: 'center', marginTop: '20px', color: '#71717a', fontSize: '0.875rem' },
  link: { color: '#00b141', fontWeight: '600' },
}
