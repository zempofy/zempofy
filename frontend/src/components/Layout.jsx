import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import ModalConfiguracoes from './ModalConfiguracoes'
import Icone from './Icones'
import Avatar from './Avatar'
import Modal from './Modal'
import { useToast } from './Toast'

function InputSenha({ id, value, onChange, onKeyDown, placeholder, autoFocus }) {
  const [ver, setVer] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input id={id} style={{ background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'10px', padding:'10px 40px 10px 14px', color:'var(--texto)', fontSize:'0.875rem', fontFamily:'Inter,sans-serif', width:'100%', boxSizing:'border-box' }}
        type={ver ? 'text' : 'password'} placeholder={placeholder} value={value}
        onChange={onChange} onKeyDown={onKeyDown} autoFocus={autoFocus}
      />
      <button type="button" onClick={()=>setVer(v=>!v)} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--texto-apagado)', display:'flex', alignItems:'center', padding:'2px' }}>
        {ver ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  )
}

function ModalAcessoSenha({ usuario, fechar, onNomeAtualizado }) {
  const [aba, setAba] = useState(null)
  const [form, setForm] = useState({ novoNome: '', novoEmail: '', senhaAtual: '', novaSenha: '', confirmar: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  const resetar = () => {
    setErro(''); setSucesso('')
    setForm({ novoNome: '', novoEmail: '', senhaAtual: '', novaSenha: '', confirmar: '' })
  }
  const trocarAba = (novaAba) => { resetar(); setAba(novaAba) }

  const salvarNome = async () => {
    if (!form.novoNome.trim()) return setErro('Digite o novo nome.')
    setCarregando(true); setErro('')
    try {
      await api.put('/usuarios/meu-perfil', { nome: form.novoNome.trim() })
      setSucesso('Nome atualizado!'); setAba(null)
      if (onNomeAtualizado) onNomeAtualizado()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao atualizar nome.')
    } finally { setCarregando(false) }
  }

  const salvarEmail = async () => {
    if (!form.novoEmail) return setErro('Digite o novo e-mail.')
    setCarregando(true); setErro('')
    try {
      await api.put('/usuarios/meu-perfil', { email: form.novoEmail })
      setSucesso('E-mail atualizado!'); setAba(null)
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao atualizar e-mail.')
    } finally { setCarregando(false) }
  }

  const salvarSenha = async () => {
    if (!form.novaSenha) return setErro('Digite a nova senha.')
    if (form.novaSenha !== form.confirmar) return setErro('As senhas não coincidem.')
    if (form.novaSenha.length < 6) return setErro('Mínimo 6 caracteres.')
    setCarregando(true); setErro('')
    try {
      await api.put('/usuarios/minha-senha', { novaSenha: form.novaSenha })
      setSucesso('Senha atualizada!'); setAba(null)
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao atualizar senha.')
    } finally { setCarregando(false) }
  }

  const modal = (
    <Modal onFechar={fechar} maxWidth="440px">
      <div style={stylesModal.topo}>
        <span style={stylesModal.titulo}>Acesso e senha</span>
        <button style={stylesModal.btnX} onClick={fechar}>✕</button>
      </div>

      <div style={stylesModal.corpo}>
        <div style={stylesModal.infoBloco}>
          <Avatar nome={usuario?.nome} foto={usuario?.avatar} size={44} fontSize={18} />
          <div>
            <p style={stylesModal.infoNome}>{usuario?.nome}</p>
            <p style={stylesModal.infoCargo}>{usuario?.cargo === 'admin' ? 'Titular' : 'Colaborador'}</p>
          </div>
        </div>

        {/* Nome */}
        <div style={stylesModal.campo}>
          <label style={stylesModal.label}>Nome</label>
          <div style={stylesModal.valorComAcao}>
            <span>{usuario?.nome}</span>
            <button style={stylesModal.btnAlterar} onClick={() => trocarAba(aba === 'nome' ? null : 'nome')}>
              {aba === 'nome' ? 'Cancelar' : 'Alterar'}
            </button>
          </div>
        </div>
        {aba === 'nome' && (
          <div style={stylesModal.subForm}>
            {erro && <p style={stylesModal.erro}>{erro}</p>}
            {sucesso && <p style={stylesModal.sucesso}>{sucesso}</p>}
            <div style={stylesModal.campo}>
              <label style={stylesModal.label}>Novo nome</label>
              <input style={stylesModal.input} placeholder="Seu nome completo" value={form.novoNome}
                onChange={e => setForm({ ...form, novoNome: e.target.value })} autoFocus />
            </div>
            <button style={stylesModal.btnSalvar} onClick={salvarNome} disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar nome'}
            </button>
          </div>
        )}

        {/* E-mail */}
        <div style={stylesModal.campo}>
          <label style={stylesModal.label}>E-mail</label>
          <div style={stylesModal.valorComAcao}>
            <span>{usuario?.email}</span>
            <button style={stylesModal.btnAlterar} onClick={() => trocarAba(aba === 'email' ? null : 'email')}>
              {aba === 'email' ? 'Cancelar' : 'Alterar'}
            </button>
          </div>
        </div>

        {aba === 'email' && (
          <div style={stylesModal.subForm}>
            {erro && <p style={stylesModal.erro}>{erro}</p>}
            {sucesso && <p style={stylesModal.sucesso}>{sucesso}</p>}
            <div style={stylesModal.campo}>
              <label style={stylesModal.label}>Novo e-mail</label>
              <input
                style={stylesModal.input}
                type="email"
                placeholder="novo@email.com"
                value={form.novoEmail}
                onChange={e => setForm({ ...form, novoEmail: e.target.value })}
              />
            </div>
            <button style={stylesModal.btnSalvar} onClick={salvarEmail} disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar e-mail'}
            </button>
          </div>
        )}

        {/* Senha — campo cinza que expande ao clicar */}
        <div style={stylesModal.campo}>
          <label style={stylesModal.label}>Senha</label>
          {aba !== 'senha' ? (
            <button
              onClick={() => trocarAba('senha')}
              style={{
                width: '100%', padding: '10px 14px', background: 'var(--input)',
                border: '1px solid var(--borda)', borderRadius: '10px',
                color: 'var(--texto-apagado)', fontSize: '0.85rem', fontFamily: 'Inter,sans-serif',
                cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span style={{ letterSpacing: '3px' }}>••••••••</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)' }}>Alterar senha</span>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {erro && <p style={stylesModal.erro}>{erro}</p>}
              {sucesso && <p style={stylesModal.sucesso}>{sucesso}</p>}
              <InputSenha id="input-nova-senha" placeholder="Nova senha"
                value={form.novaSenha} autoFocus
                onChange={e => setForm({ ...form, novaSenha: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && document.getElementById('input-confirmar-senha')?.focus()}
              />
              <InputSenha id="input-confirmar-senha" placeholder="Confirmar nova senha"
                value={form.confirmar}
                onChange={e => setForm({ ...form, confirmar: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && salvarSenha()}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ ...stylesModal.btnSalvar, flex: 1 }} onClick={salvarSenha} disabled={carregando}>
                  {carregando ? 'Salvando...' : 'Salvar senha'}
                </button>
                <button style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto-apagado)', padding: '8px 14px', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'Inter,sans-serif' }}
                  onClick={() => trocarAba(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {sucesso && aba === null && <p style={stylesModal.sucesso}>{sucesso}</p>}
      </div>
    </Modal>
  )

  return modal
}

const stylesModal = {
  topo: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--borda)',
  },
  titulo: {
    fontFamily: 'Inter, sans-serif', fontWeight: '700',
    fontSize: '1rem', color: 'var(--texto)',
  },
  btnX: {
    background: 'none', border: '1px solid var(--borda)', borderRadius: '6px',
    color: 'var(--texto-apagado)', width: '28px', height: '28px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', cursor: 'pointer',
  },
  corpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  infoBloco: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' },
  infoNome: { fontSize: '1rem', fontWeight: '600', color: 'var(--texto)' },
  infoCargo: { fontSize: '0.8rem', color: 'var(--texto-apagado)', marginTop: '2px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px' },
  valorComAcao: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px',
    padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem',
  },
  btnAlterar: {
    background: 'none', border: 'none', color: 'var(--verde)',
    fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
    fontWeight: '500',
  },
  subForm: {
    background: 'var(--input-2)', border: '1px solid var(--borda)', borderRadius: '12px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  input: {
    background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px',
    padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem',
    width: '100%', fontFamily: 'Inter, sans-serif',
  },
  btnSalvar: {
    background: 'var(--gradiente-verde)',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '10px 20px', fontFamily: 'Inter, sans-serif',
    fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px' },
  sucesso: { color: 'var(--verde)', fontSize: '0.8rem', background: 'rgba(0,177,65,0.08)', padding: '8px 12px', borderRadius: '8px' },
}

const SIDEBAR_LARGURA = '224px'
const SIDEBAR_FECHADA = '56px'
const TOPBAR_ALTURA = '54px'

// ── Ícones inline ──
const IconeFeed = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const IconeChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconeRecolher = ({ aberta }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {aberta ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
  </svg>
)

// ── Painel de Perfil ──
function PainelPerfil({ usuario, sair, fechar, setPagina, setModalAcessoExterno, setModalConfigExterno }) {
  const id = usuario?.id?.slice(-8).toUpperCase() || '--------'

  const irPara = (pag) => { setPagina(pag); fechar() }

  return (
    <>
      <div onClick={fechar} style={styles.overlay} />
      <div style={styles.painel} className="fade-in">
        <div style={styles.painelTopo}>
          <span style={styles.painelTitulo}>Minha conta</span>
          <button style={styles.btnFechar} onClick={fechar}>✕</button>
        </div>

        <div style={styles.painelPerfil}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar nome={usuario?.nome} foto={usuario?.avatar} size={52} fontSize={20} />
            <button
              style={styles.btnEditarFoto}
              onClick={() => document.getElementById('upload-foto-perfil').click()}
              title="Alterar foto"
            >
              <Icone.Edit size={10} />
            </button>
            <input
              id="upload-foto-perfil"
              type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files[0]
                if (!file) return
                if (file.size > 2 * 1024 * 1024) return alert('Imagem muito grande. Máximo 2MB.')
                const reader = new FileReader()
                reader.onload = async (ev) => {
                  try {
                    await api.put('/usuarios/minha-foto', { foto: ev.target.result })
                    await recarregarUsuario()
                  } catch { alert('Erro ao salvar foto.') }
                }
                reader.readAsDataURL(file)
              }}
            />
          </div>
          <div>
            <p style={styles.painelNome}>{usuario?.nome}</p>
            <p style={styles.painelEmpresa}>{usuario?.empresa?.nome}</p>
            <p style={styles.painelId}>ID #{id}</p>
          </div>
        </div>

        <div style={styles.painelDivisor} />

        <p style={styles.painelSecaoTitulo}>Atalhos</p>
        <button style={styles.painelItem} onClick={() => { fechar(); setModalAcessoExterno(true) }}>
          <span><Icone.Lock size={15} /></span> Acesso e senha
        </button>
        <button style={styles.painelItem} onClick={() => { fechar(); setModalConfigExterno(true) }}>
          <span><Icone.Settings size={15} /></span> Preferências
        </button>

        <div style={{ flex: 1 }} />
        <div style={styles.painelDivisor} />
        <button style={styles.painelSair} onClick={sair}>
          <span><Icone.LogOut size={15} /></span> Sair da conta
        </button>
      </div>
    </>
  )
}

// ── Banner de verificação de e-mail ──
function BannerVerificacao() {
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const { mostrar } = useToast()

  const reenviar = async () => {
    setEnviando(true)
    try {
      await api.post('/auth/reenviar-verificacao')
      setEnviado(true)
      mostrar('E-mail de verificação reenviado!', 'sucesso')
    } catch {
      mostrar('Erro ao reenviar e-mail.', 'erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{
      background: 'rgba(245,158,11,0.08)',
      border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: '12px',
      padding: '12px 20px',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '15px' }}>⚠️</span>
        <span style={{ fontSize: '0.82rem', color: '#FCD34D', fontFamily: 'Inter, sans-serif' }}>
          Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada.
        </span>
      </div>
      {!enviado ? (
        <button
          onClick={reenviar}
          disabled={enviando}
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', color: '#FCD34D', padding: '5px 14px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', whiteSpace: 'nowrap' }}
        >
          {enviando ? 'Enviando...' : 'Reenviar e-mail'}
        </button>
      ) : (
        <span style={{ fontSize: '0.75rem', color: '#4ADE80' }}>✓ E-mail enviado!</span>
      )}
    </div>
  )
}

// ── Navegação ──
function NavItens({ menuItens, paginaAtual, setPagina, sidebarAberta, onItemClick }) {
  const [gruposAbertos, setGruposAbertos] = useState(() => {
    const inicial = {}
    menuItens.forEach(item => {
      if (item.subItens?.some(s => s.id === paginaAtual)) inicial[item.id] = true
    })
    return inicial
  })

  const toggleGrupo = (id) => setGruposAbertos(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <>
      {menuItens.map(item => {
        // Separador de seção (sem subItens, id começa com '__')
        if (item.separador) {
          return sidebarAberta ? (
            <div key={item.id} style={styles.navSeparador}>{item.label}</div>
          ) : (
            <div key={item.id} style={styles.navSeparadorFechado} />
          )
        }

        if (item.subItens) {
          const aberto = gruposAbertos[item.id]
          const subAtivo = item.subItens.some(s => s.id === paginaAtual)
          return (
            <div key={item.id}>
              <button
                className="nav-btn"
                style={{
                  ...styles.navBtn,
                  ...(subAtivo ? styles.navBtnGrupoAtivo : {}),
                  justifyContent: sidebarAberta ? 'space-between' : 'center',
                }}
                onClick={() => toggleGrupo(item.id)}
                title={!sidebarAberta ? item.label : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    ...styles.navIcone,
                    position: 'relative',
                    color: subAtivo ? 'var(--verde)' : 'inherit',
                    opacity: subAtivo ? 1 : 0.75,
                  }}>
                    {item.icone}
                    {item.badgeCount > 0 && <span style={styles.navIconeBadge}>{item.badgeCount > 9 ? '9+' : item.badgeCount}</span>}
                  </span>
                  {sidebarAberta && <span style={{
                    ...styles.navLabel,
                    color: subAtivo ? 'rgba(255,255,255,0.9)' : 'inherit',
                  }}>{item.label}</span>}
                </div>
                {sidebarAberta && (
                  <span style={{
                    fontSize: '9px',
                    color: subAtivo ? 'var(--verde)' : 'var(--texto-apagado)',
                    transition: 'transform 0.2s',
                    transform: aberto ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'flex', alignItems: 'center',
                  }}>▶</span>
                )}
              </button>

              {aberto && sidebarAberta && (
                <div style={styles.subMenu}>
                  {item.subItens.map(sub => (
                    <button
                      key={sub.id}
                      className="nav-btn"
                      style={{
                        ...styles.navBtn,
                        ...styles.navBtnSub,
                        ...(paginaAtual === sub.id ? styles.navBtnAtivo : {}),
                      }}
                      onClick={() => { setPagina(sub.id); if (onItemClick) onItemClick() }}
                    >
                      <span style={styles.navDot} />
                      <span style={styles.navLabel}>{sub.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        }

        return (
          <button
            key={item.id}
            className="nav-btn"
            style={{
              ...styles.navBtn,
              ...(paginaAtual === item.id ? styles.navBtnAtivo : {}),
              justifyContent: sidebarAberta ? 'flex-start' : 'center',
            }}
            onClick={() => { setPagina(item.id); if (onItemClick) onItemClick() }}
            title={!sidebarAberta ? item.label : ''}
          >
            <span style={{ ...styles.navIcone, position: 'relative' }}>
              {item.icone}
              {item.badgeCount > 0 && <span style={styles.navIconeBadge}>{item.badgeCount > 9 ? '9+' : item.badgeCount}</span>}
            </span>
            {sidebarAberta && <span style={styles.navLabel}>{item.label}</span>}
            {sidebarAberta && item.badge && (
              <span style={{ fontSize:'9px', fontWeight:'700', padding:'1px 6px', borderRadius:'4px', background:'rgba(99,102,241,0.12)', color:'#818cf8', letterSpacing:'0.5px', marginLeft:'auto', flexShrink:0 }}>{item.badge}</span>
            )}
          </button>
        )
      })}
    </>
  )
}

export default function Layout({ children, menuItens, paginaAtual, setPagina }) {
  const { usuario, sair, recarregarUsuario, temPermissao } = useAuth()
  const isTitular = usuario?.cargo === 'admin'
  const [sidebarAberta, setSidebarAberta] = useState(true)
  const [painelAberto, setPainelAberto] = useState(false)
  const avatarMenuRef = useRef(null)

  useEffect(() => {
    const fecharEsc = (e) => { if (e.key === 'Escape') { setPainelAberto(false); setPainelConfigAberto(false) } }
    document.addEventListener('keydown', fecharEsc)
    return () => document.removeEventListener('keydown', fecharEsc)
  }, [])

  useEffect(() => {
    if (!painelAberto) return
    const fecharFora = (e) => { if (!avatarMenuRef.current?.contains(e.target)) setPainelAberto(false) }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [painelAberto])
  const [buscaGlobal, setBuscaGlobal] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState([])
  const [buscandoGlobal, setBuscandoGlobal] = useState(false)
  const [paginaBuscaAberta, setPaginaBuscaAberta] = useState(false)
  const [modalAcesso, setModalAcesso] = useState(false)
  const [modalConfig, setModalConfig] = useState(false)
  const [naoLidasChat, setNaoLidasChat] = useState(0)
  const [painelConfigAberto, setPainelConfigAberto] = useState(false)
  const [paginaConfig, setPaginaConfig] = useState(null)
  const [novasNotifs, setNovasNotifs] = useState(0)

  // ── Busca global ──
  const buscarGlobal = async (termo) => {
    if (!termo || termo.length < 2) { setResultadosBusca([]); return }
    setBuscandoGlobal(true)
    try {
      const [rC, rI] = await Promise.all([
        api.get('/clientes').catch(() => ({ data: [] })),
        api.get('/implantacoes').catch(() => ({ data: [] })),
      ])
      const t = termo.toLowerCase()
      const clientes = rC.data
        .filter(c => (c.razaoSocial || c.nome || '').toLowerCase().includes(t) || (c.nomeFantasia || '').toLowerCase().includes(t) || (c.cnpj || '').includes(t))
        .slice(0, 4)
        .map(c => ({ tipo: 'cliente', label: c.razaoSocial || c.nome, sub: c.cnpj || 'Sem CNPJ', pagina: 'clientes' }))
      const imps = rI.data
        .filter(i => (i.nomeCliente || '').toLowerCase().includes(t) || (i.cnpj || '').includes(t))
        .slice(0, 3)
        .map(i => ({ tipo: 'onboarding', label: i.nomeCliente, sub: 'Onboarding', pagina: 'implantacao' }))
      setResultadosBusca([...clientes, ...imps])
    } catch (e) { console.error('Busca:', e) }
    setBuscandoGlobal(false)
  }
  const ultimaVezMuralKey = `zempofy_mural_visto_${usuario?.id}`

  useEffect(() => {
    const buscarNaoLidas = async () => {
      try {
        const res = await api.get('/chat/nao-lidas/total')
        setNaoLidasChat(res.data.total)
      } catch {}
    }
    buscarNaoLidas()
    const interval = setInterval(buscarNaoLidas, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={styles.app}>
      <style>{`
        .nav-btn:hover {
          background: rgba(255,255,255,0.05) !important;
          color: var(--texto) !important;
        }
        .nav-btn-ativo {
          border-left: 3px solid var(--verde) !important;
        }
        .topbar-btn:hover {
          background: rgba(255,255,255,0.08) !important;
        }
        .painel-item:hover {
          background: rgba(255,255,255,0.05) !important;
        }
      `}</style>

      {/* ===== TOPBAR ===== */}
      <header style={styles.topbar}>
        {/* Logo + toggle */}
        <div style={styles.topbarEsquerda}>
          <button
            className="topbar-btn"
            style={{ ...styles.btnTopbar, marginRight: '4px', flexShrink: 0 }}
            onClick={() => setSidebarAberta(!sidebarAberta)}
            title={sidebarAberta ? 'Recolher menu' : 'Expandir menu'}
          >
            <IconeRecolher aberta={sidebarAberta} />
          </button>
          <button style={styles.logoBtn} onClick={() => setPagina('inicio')} title="Ir para início">
            <img src="/logo-branca.png" alt="Zempofy" style={{ height: '36px', width: 'auto' }} />
          </button>
        </div>

        {/* Busca global */}
        <div style={{ position:'relative', flex:'0 0 240px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'6px 12px' }}>
            <Icone.Search size={13} style={{ color:'rgba(255,255,255,0.4)', flexShrink:0 }}/>
            <input
              style={{ background:'none', border:'none', outline:'none', color:'rgba(255,255,255,0.8)', fontSize:'0.82rem', fontFamily:'Inter,sans-serif', width:'100%' }}
              placeholder="Buscar clientes, onboardings..."
              value={buscaGlobal}
              onChange={e=>{ setBuscaGlobal(e.target.value); buscarGlobal(e.target.value) }}
              onKeyDown={e=>{ if(e.key==='Escape'){ setBuscaGlobal(''); setResultadosBusca([]) } }}
              onBlur={()=>setTimeout(()=>{ setBuscaGlobal(''); setResultadosBusca([]) }, 150)}
            />
          </div>
          {resultadosBusca.length > 0 && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'#18181b', border:'1px solid #27272a', borderRadius:'10px', boxShadow:'0 12px 32px rgba(0,0,0,0.5)', zIndex:200, overflow:'hidden' }}>
              {resultadosBusca.map((r,i) => (
                <button key={i} onMouseDown={()=>{ setPagina(r.pagina); setResultadosBusca([]); setBuscaGlobal('') }}
                  style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'9px 14px', background:'none', border:'none', borderBottom:'1px solid #27272a', cursor:'pointer', textAlign:'left' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#27272a'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}
                >
                  <span style={{ color:'rgba(255,255,255,0.4)', flexShrink:0 }}>
                    {r.tipo==='cliente' ? <Icone.Users size={13}/> : <Icone.ClipboardList size={13}/>}
                  </span>
                  <div>
                    <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'#fff', margin:0, fontFamily:'Inter,sans-serif' }}>{r.label}</p>
                    <p style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.4)', margin:0, fontFamily:'Inter,sans-serif' }}>{r.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ações + avatar */}
        <div style={styles.topbarDireita}>
          {/* Feed */}
          <button
            className="topbar-btn"
            style={{ ...styles.btnTopbar, ...(paginaAtual === 'mural' ? styles.btnTopbarAtivo : {}), position: 'relative' }}
            onClick={() => { setPagina('mural'); localStorage.setItem(ultimaVezMuralKey, new Date().toISOString()); setNovasNotifs(0) }}
            title="Feed de atividades"
          >
            <IconeFeed />
            {novasNotifs > 0 && (
              <span style={{ position:'absolute', top:'-2px', right:'-2px', background:'#f87171', color:'#fff', fontSize:'9px', fontWeight:'700', borderRadius:'99px', minWidth:'16px', height:'16px', display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', fontFamily:'Inter,sans-serif' }}>
                {novasNotifs > 9 ? '9+' : novasNotifs}
              </span>
            )}
          </button>

          {/* Chat */}
          <button
            className="topbar-btn"
            style={{ ...styles.btnTopbar, ...(paginaAtual === 'chat' ? styles.btnTopbarAtivo : {}), position: 'relative' }}
            onClick={() => setPagina('chat')}
            title="Chat"
          >
            <IconeChat />
            {naoLidasChat > 0 && (
              <span style={styles.chatBadge}>{naoLidasChat > 9 ? '9+' : naoLidasChat}</span>
            )}
          </button>

          <div style={styles.topbarSep} />

          {/* Avatar compacto com dropdown */}
          <div style={{ position: 'relative' }} ref={avatarMenuRef}>
            <button style={styles.avatarBtn} onClick={() => setPainelAberto(v => !v)} title="Minha conta">
              <Avatar nome={usuario?.nome} foto={usuario?.avatar} size={30} fontSize={13} />
              <div style={styles.avatarInfo}>
                <span style={styles.avatarNome}>{usuario?.nome}</span>
                <span style={styles.avatarCargo}>{usuario?.cargo === 'admin' ? 'Titular' : 'Colaborador'}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>

            {/* Dropdown simples — só nome e sair. Fecha via listener de clique fora (avatarMenuRef),
                não por overlay: um overlay portado pro body ficava acima da topbar inteira (zIndex 199 >
                zIndex:100 da topbar) e interceptava clique nos próprios botões do dropdown, inclusive o Sair. */}
            {painelAberto && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: '#18181b', border: '1px solid #27272a', borderRadius: '12px',
                  minWidth: '200px', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', zIndex: 200,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #27272a' }}>
                    {usuario?.empresa?.nome && (
                      <p style={{ fontSize: '0.65rem', fontWeight: '700', color: 'rgba(255,255,255,0.35)', margin: '0 0 6px', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{usuario.empresa.nome}</p>
                    )}
                    <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff', margin: 0, fontFamily: 'Inter, sans-serif' }}>{usuario?.nome}</p>
                    <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', fontFamily: 'Inter, sans-serif' }}>{usuario?.cargo === 'admin' ? 'Titular' : 'Colaborador'}</p>
                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', margin: '6px 0 0', fontFamily: 'Inter, sans-serif', letterSpacing: '0.3px' }}>ID #{usuario?.id?.slice(-8).toUpperCase() || '--------'}</p>
                  </div>
                  {usuario?.setores?.length > 0 && (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a' }}>
                      <p style={{ fontSize: '0.62rem', fontWeight: '700', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Meus setores</p>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {usuario.setores.map(setor => (
                          <span key={setor._id || setor} style={{ fontSize: '0.6rem', fontWeight: '600', padding: '1px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: setor.cor || 'var(--verde)', flexShrink: 0 }} />
                            {setor.nome || setor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => { setPainelAberto(false); sair() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                      padding: '11px 16px', background: 'none', border: 'none',
                      color: '#f87171', fontSize: '0.82rem', cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', fontWeight: '500',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Icone.LogOut size={15} /> Sair
                  </button>
                </div>
            )}
          </div>
        </div>
      </header>

      {/* ===== SIDEBAR ===== */}
      <aside style={{
        ...styles.sidebar,
        width: sidebarAberta ? SIDEBAR_LARGURA : SIDEBAR_FECHADA,
        top: TOPBAR_ALTURA,
      }}>

        <nav style={styles.nav}>
          <NavItens
            menuItens={menuItens}
            paginaAtual={paginaAtual}
            setPagina={setPagina}
            sidebarAberta={sidebarAberta}
            onItemClick={painelConfigAberto ? () => { setPainelConfigAberto(false); setSidebarAberta(true) } : null}
          />
        </nav>

        {/* Rodapé da sidebar */}
        <div style={{ padding: '8px 6px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            className="nav-btn"
            style={{
              ...styles.navBtn,
              ...(painelConfigAberto ? styles.navBtnAtivo : {}),
              justifyContent: sidebarAberta ? 'flex-start' : 'center',
            }}
            onClick={() => {
              if (!painelConfigAberto) {
                setSidebarAberta(false)
                setPainelConfigAberto(true)
              } else {
                setPainelConfigAberto(false)
                setSidebarAberta(true)
              }
            }}
            title="Configurações"
          >
            <span style={styles.navIcone}><Icone.Settings size={18} /></span>
            {sidebarAberta && <span style={styles.navLabel}>Configurações</span>}
          </button>
          {sidebarAberta && (
            <div style={styles.sidebarRodape}>
              <span style={styles.sidebarVersao}>Zempofy</span>
            </div>
          )}
        </div>
      </aside>

      {/* Painel de Configurações */}
      {painelConfigAberto && (
        <div style={{
          position: 'fixed',
          top: TOPBAR_ALTURA,
          left: SIDEBAR_FECHADA,
          bottom: 0,
          width: '240px',
          background: '#0d0d0f',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          zIndex: 48,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '16px 0',
        }}>
          <div style={{ padding: '0 12px 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '1.2px' }}>Configurações</p>
            <button
              onClick={() => setPainelConfigAberto(false)}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.4)', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
              title="Fechar configurações"
            >‹</button>
          </div>

          {/* Onboarding — só com permissão */}
          {(isTitular || temPermissao('gerenciarOnboarding')) && (
            <>
              <p style={styles.configSecao}>Onboarding</p>
              {[
                ...(isTitular || temPermissao('gerenciarModelos') ? [{ id: 'modelos', label: 'Modelos', icone: <Icone.ClipboardList size={16} /> }] : []),
                ...(isTitular || temPermissao('gerenciarBancoAtividades') ? [{ id: 'checklist', label: 'Banco de atividades', icone: <Icone.Edit size={16} /> }] : []),
                ...(isTitular ? [{ id: 'alertas-onboarding', label: 'Alertas', icone: <Icone.AlertTriangle size={16} /> }] : []),
              ].map(item => (
                <button key={item.id} style={{
                  ...styles.configItem,
                  ...(paginaConfig === item.id ? styles.configItemAtivo : {}),
                }} onClick={() => { setPaginaConfig(item.id); setPagina(item.id) }}>
                  <span style={{ opacity: 0.7, display: 'flex' }}>{item.icone}</span>
                  {item.label}
                </button>
              ))}
              <div style={styles.configDivisor} />
            </>
          )}

          {/* Equipe — só com permissão */}
          {(isTitular || temPermissao('gerenciarEquipe')) && (
            <>
              <p style={styles.configSecao}>Equipe</p>
              {[
                ...(isTitular || temPermissao('gerenciarEquipe') || temPermissao('gerenciarMembros') ? [{ id: 'equipe', label: 'Colaboradores', icone: <Icone.Users size={16} /> }] : []),
                ...(isTitular || temPermissao('gerenciarSetores') ? [{ id: 'setores', label: 'Setores', icone: <Icone.UsersThree size={16} /> }] : []),
              ].map(item => (
                <button key={item.id} style={{
                  ...styles.configItem,
                  ...(paginaConfig === item.id ? styles.configItemAtivo : {}),
                }} onClick={() => { setPaginaConfig(item.id); setPagina(item.id) }}>
                  <span style={{ opacity: 0.7, display: 'flex' }}>{item.icone}</span>
                  {item.label}
                </button>
              ))}
              <div style={styles.configDivisor} />
            </>
          )}

          {/* Conta — todos */}
          <p style={styles.configSecao}>Conta</p>
          <button style={{
            ...styles.configItem,
            ...(paginaConfig === 'acesso-senha' ? styles.configItemAtivo : {}),
          }} onClick={() => { setPaginaConfig('acesso-senha'); setModalAcesso(true) }}>
            <span style={{ opacity: 0.7, display: 'flex' }}><Icone.Lock size={16} /></span>
            Acesso e senha
          </button>
          {isTitular && (
            <button style={{
              ...styles.configItem,
              ...(paginaConfig === 'plano' ? styles.configItemAtivo : {}),
            }} onClick={() => { setPaginaConfig('plano'); setPagina('plano'); setPainelConfigAberto(false); setSidebarAberta(true) }}>
              <span style={{ opacity: 0.7, display: 'flex' }}><Icone.CreditCard size={16} /></span>
              Meu plano
            </button>
          )}
          <button style={{
            ...styles.configItem,
            ...(paginaConfig === 'preferencias' ? styles.configItemAtivo : {}),
          }} onClick={() => { setPaginaConfig('preferencias'); setModalConfig(true) }}>
            <span style={{ opacity: 0.7, display: 'flex' }}><Icone.Settings size={16} /></span>
            Preferências
          </button>
        </div>
      )}

      {modalAcesso && (
        <ModalAcessoSenha usuario={usuario} fechar={() => setModalAcesso(false)} onNomeAtualizado={recarregarUsuario} />
      )}

      {modalConfig && (
        <ModalConfiguracoes fechar={() => setModalConfig(false)} />
      )}

      {/* Conteúdo principal */}
      <main style={{
        ...styles.conteudo,
        marginLeft: painelConfigAberto
          ? `calc(${SIDEBAR_FECHADA} + 240px)`
          : sidebarAberta ? SIDEBAR_LARGURA : SIDEBAR_FECHADA,
        marginTop: TOPBAR_ALTURA,
      }}>
        <div style={styles.conteudoInner} className="fade-in">
          {usuario && !usuario.emailVerificado && <BannerVerificacao />}
          {children}
        </div>
      </main>
    </div>
  )
}

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    background: 'var(--fundo)',
    overflow: 'hidden',
    width: '100%',
  },

  // ── Topbar ──
  topbar: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: TOPBAR_ALTURA,
    background: 'rgba(9,9,11,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '0',
    paddingRight: '0',
    zIndex: 100,
  },
  topbarEsquerda: {
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '10px',
    gap: '4px',
    flexShrink: 0,
  },
  logoBtn: {
    display: 'flex', alignItems: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 0',
  },
  topbarDireita: {
    display: 'flex', alignItems: 'center', gap: '4px',
    paddingRight: '18px',
  },
  btnTopbar: {
    background: 'none', border: 'none', borderRadius: '8px',
    color: 'rgba(255,255,255,0.6)', width: '34px', height: '34px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  btnTopbarAtivo: {
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.95)',
  },
  chatBadge: {
    position: 'absolute', top: '4px', right: '4px',
    background: 'var(--verde)', color: '#fff',
    fontSize: '0.48rem', fontWeight: '800',
    borderRadius: '50%', width: '14px', height: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 6px rgba(0,177,65,0.6)',
  },
  navIconeBadge: {
    position: 'absolute', top: '-5px', right: '-7px',
    background: '#f87171', color: '#fff',
    fontSize: '0.55rem', fontWeight: '800',
    borderRadius: '99px', minWidth: '14px', height: '14px', padding: '0 3px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif', lineHeight: 1,
  },
  topbarSep: {
    width: '1px', height: '18px',
    background: 'rgba(255,255,255,0.1)',
    margin: '0 6px',
  },
  avatarBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    padding: '5px 10px 5px 6px',
    borderRadius: '10px',
    transition: 'all 0.15s',
  },
  avatarInfo: { display: 'flex', flexDirection: 'column', textAlign: 'left' },
  avatarNome: {
    fontSize: '0.78rem', fontWeight: '600',
    color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap',
    letterSpacing: '-0.01em', lineHeight: '1.2',
  },
  avatarCargo: {
    fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)',
    lineHeight: '1.2',
  },

  // ── Sidebar ──
  sidebar: {
    background: '#0d0d0f',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
    position: 'fixed',
    left: 0, bottom: 0,
    zIndex: 50,
    overflow: 'hidden',
  },
  sidebarToggleRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  btnToggle: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.3)',
    width: '26px', height: '26px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
    transition: 'all 0.15s',
  },
  nav: {
    flex: 1,
    padding: '8px 6px',
    display: 'flex', flexDirection: 'column', gap: '2px',
    overflowY: 'auto',
    overflowX: 'hidden',
  },

  // Separador de seção
  navSeparador: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    padding: '20px 10px 6px',
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
  },
  navSeparadorFechado: {
    height: '1px',
    background: 'rgba(255,255,255,0.05)',
    margin: '10px 10px',
  },

  // Item de navegação
  navBtn: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 12px',
    borderRadius: '8px',
    background: 'none',
    border: 'none',
    borderLeft: '3px solid transparent',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontFamily: 'Inter, sans-serif',
    transition: 'all 0.12s',
    width: '100%',
    whiteSpace: 'nowrap',
    fontWeight: '500',
    textAlign: 'left',
  },
  navBtnAtivo: {
    borderLeft: '3px solid var(--verde)',
    background: 'rgba(0,177,65,0.08)',
    color: '#fff',
    fontWeight: '600',
    borderRadius: '0 8px 8px 0',
  },
  navBtnGrupoAtivo: {
    borderLeft: '3px solid rgba(0,177,65,0.4)',
    background: 'rgba(0,177,65,0.04)',
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    borderRadius: '0 8px 8px 0',
  },
  navBtnSub: {
    padding: '7px 12px 7px 10px',
    fontSize: '0.85rem',
  },
  navIcone: {
    flexShrink: 0,
    width: '20px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: 0.75,
  },
  navLabel: {
    fontSize: 'inherit',
    fontWeight: 'inherit',
    letterSpacing: '-0.01em',
  },
  navDot: {
    width: '5px', height: '5px',
    borderRadius: '50%',
    background: 'currentColor',
    flexShrink: 0,
    marginLeft: '8px',
    opacity: 0.5,
  },
  subMenu: {
    marginLeft: '0',
    paddingLeft: '0',
    paddingTop: '2px',
    paddingBottom: '2px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },

  // Rodapé da sidebar
  sidebarRodape: {
    padding: '12px 14px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  sidebarVersao: {
    fontSize: '0.65rem',
    color: 'rgba(255,255,255,0.18)',
    fontFamily: 'Inter, sans-serif',
    letterSpacing: '0.3px',
  },

  // ── Conteúdo ──
  conteudo: {
    flex: 1,
    transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1), margin-top 0.22s',
    height: `calc(100vh - ${TOPBAR_ALTURA})`,
    overflowY: 'auto',
    overflowX: 'hidden',
    minWidth: 0,
  },
  conteudoInner: {
    padding: '40px 40px',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '100%',
    maxWidth: '1400px',
  },

  // ── Painel de Configurações ──
  configSecao: {
    fontSize: '0.6rem', fontWeight: '700',
    color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase', letterSpacing: '1.5px',
    padding: '10px 16px 5px',
    fontFamily: 'Inter, sans-serif',
  },
  configItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 16px',
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.85rem', cursor: 'pointer',
    width: '100%', textAlign: 'left',
    fontFamily: 'Inter, sans-serif',
    fontWeight: '500',
    transition: 'all 0.12s',
    borderLeft: '3px solid transparent',
  },
  configItemAtivo: {
    borderLeft: '3px solid var(--verde)',
    background: 'rgba(0,177,65,0.08)',
    color: '#fff',
    fontWeight: '600',
  },
  configDivisor: {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
    margin: '8px 16px',
  },

  // ── Painel de perfil ──
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 98,
    backdropFilter: 'blur(2px)',
  },
  painel: {
    position: 'fixed',
    top: TOPBAR_ALTURA, left: 0, bottom: 0,
    width: '260px',
    background: '#0d0d0f',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    zIndex: 99,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
  },
  painelTopo: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  painelTitulo: {
    fontFamily: 'Inter, sans-serif', fontWeight: '700',
    fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em',
  },
  btnFechar: {
    background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
    color: 'rgba(255,255,255,0.3)', width: '26px', height: '26px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '11px', cursor: 'pointer',
  },
  painelPerfil: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '20px',
  },
  btnEditarFoto: {
    position: 'absolute', bottom: 0, right: 0,
    width: '18px', height: '18px',
    background: 'var(--gradiente-verde)', border: '2px solid #0d0d0f',
    borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', padding: 0,
  },
  painelNome: {
    fontSize: '0.9rem', fontWeight: '600',
    color: 'rgba(255,255,255,0.9)', marginBottom: '2px', letterSpacing: '-0.01em',
  },
  painelEmpresa: { fontSize: '0.77rem', color: 'var(--verde)', marginBottom: '4px' },
  painelId: {
    fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)',
    fontFamily: 'monospace', letterSpacing: '1px',
  },
  painelDivisor: {
    height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 20px',
  },
  painelSecaoTitulo: {
    fontSize: '0.6rem', fontWeight: '700', color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase', letterSpacing: '1.5px',
    padding: '12px 20px 5px',
  },
  painelItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 20px', background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.6)', fontSize: '0.83rem', cursor: 'pointer',
    width: '100%', textAlign: 'left', fontFamily: 'Inter, sans-serif',
    transition: 'background 0.12s, color 0.12s',
  },
  painelSair: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '15px 20px', background: 'none', border: 'none',
    color: '#f87171', fontSize: '0.83rem', cursor: 'pointer',
    width: '100%', textAlign: 'left', fontFamily: 'Inter, sans-serif',
  },
}
