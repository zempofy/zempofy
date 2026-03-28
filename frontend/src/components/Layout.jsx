import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import ModalConfiguracoes from './ModalConfiguracoes'
import Icone from './Icones'
import Avatar from './Avatar'
import Modal from './Modal'

function ModalAcessoSenha({ usuario, fechar, onNomeAtualizado }) {
  const [aba, setAba] = useState(null) // null | 'nome' | 'email' | 'senha'
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
    if (!form.senhaAtual || !form.novaSenha) return setErro('Preencha todos os campos.')
    if (form.novaSenha !== form.confirmar) return setErro('As senhas não coincidem.')
    if (form.novaSenha.length < 6) return setErro('Mínimo 6 caracteres.')
    setCarregando(true); setErro('')
    try {
      await api.put('/usuarios/minha-senha', { senhaAtual: form.senhaAtual, novaSenha: form.novaSenha })
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
            <p style={stylesModal.infoCargo}>{usuario?.cargo === 'admin' ? 'Dono' : usuario?.cargo === 'administrador' ? 'Administrador' : 'Colaborador'}</p>
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

          <div style={stylesModal.campo}>
            <label style={stylesModal.label}>Senha</label>
            <div style={stylesModal.valorComAcao}>
              <span style={{ letterSpacing: '3px', color: 'var(--texto-apagado)' }}>••••••••</span>
              <button style={stylesModal.btnAlterar} onClick={() => trocarAba(aba === 'senha' ? null : 'senha')}>
                {aba === 'senha' ? 'Cancelar' : 'Alterar'}
              </button>
            </div>
          </div>

          {aba === 'senha' && (
            <div style={stylesModal.subForm}>
              {erro && <p style={stylesModal.erro}>{erro}</p>}
              {sucesso && <p style={stylesModal.sucesso}>{sucesso}</p>}
              <div style={stylesModal.campo}>
                <label style={stylesModal.label}>Senha atual</label>
                <input style={stylesModal.input} type="password" placeholder="••••••••" value={form.senhaAtual} onChange={e => setForm({ ...form, senhaAtual: e.target.value })} />
              </div>
              <div style={stylesModal.campo}>
                <label style={stylesModal.label}>Nova senha</label>
                <input style={stylesModal.input} type="password" placeholder="••••••••" value={form.novaSenha} onChange={e => setForm({ ...form, novaSenha: e.target.value })} />
              </div>
              <div style={stylesModal.campo}>
                <label style={stylesModal.label}>Confirmar nova senha</label>
                <input style={stylesModal.input} type="password" placeholder="••••••••" value={form.confirmar} onChange={e => setForm({ ...form, confirmar: e.target.value })} />
              </div>
              <button style={stylesModal.btnSalvar} onClick={salvarSenha} disabled={carregando}>
                {carregando ? 'Salvando...' : 'Salvar senha'}
              </button>
            </div>
          )}

          {sucesso && aba === null && <p style={stylesModal.sucesso}>{sucesso}</p>}
        </div>
    </Modal>
  )

  return modal
}

const stylesModal = {
  fundo: {
    position: 'fixed', inset: 0,
    left: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 200,
  },
  janela: {
    position: 'fixed',
    top: '50vh',
    left: '50vw',
    transform: 'translate(-50%, -50%)',
    width: '100%', maxWidth: '440px',
    background: 'var(--sidebar)',
    border: '1px solid #2A3830',
    borderRadius: '20px',
    zIndex: 201,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  topo: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #2A3830',
  },
  titulo: {
    fontFamily: 'Inter, sans-serif', fontWeight: '700',
    fontSize: '1rem', color: 'var(--texto)',
  },
  btnX: {
    background: 'none', border: '1px solid #2A3830', borderRadius: '6px',
    color: 'var(--texto-apagado)', width: '28px', height: '28px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', cursor: 'pointer',
  },
  corpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  infoBloco: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' },
  avatar: {
    width: '48px', height: '48px', minWidth: '48px',
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif', fontWeight: '800', fontSize: '20px', color: '#fff',
  },
  infoNome: { fontSize: '1rem', fontWeight: '600', color: 'var(--texto)' },
  infoCargo: { fontSize: '0.8rem', color: 'var(--texto-apagado)', marginTop: '2px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px' },
  valorFixo: {
    background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '10px',
    padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem',
  },
  valorComAcao: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '10px',
    padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem',
  },
  btnAlterar: {
    background: 'none', border: 'none', color: 'var(--verde)',
    fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
    fontWeight: '500',
  },
  subForm: {
    background: 'var(--input-2)', border: '1px solid #2A3830', borderRadius: '12px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  input: {
    background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '10px',
    padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem',
    width: '100%', fontFamily: 'Inter, sans-serif',
  },
  btnSalvar: {
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '10px 20px', fontFamily: 'Inter, sans-serif',
    fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px' },
  sucesso: { color: 'var(--verde)', fontSize: '0.8rem', background: 'rgba(34,197,94,0.1)', padding: '8px 12px', borderRadius: '8px' },
}

const SIDEBAR_ABERTA = '240px'
const SIDEBAR_FECHADA = '64px'

function PainelPerfil({ usuario, sair, fechar, setPagina, setModalAcessoExterno, setModalConfigExterno }) {
  const id = usuario?.id?.slice(-8).toUpperCase() || '--------'

  const irPara = (pag) => {
    setPagina(pag)
    fechar()
  }

  return (
    <>
      {/* Overlay escuro */}
      <div onClick={fechar} style={styles.overlay} />

      {/* Painel */}
      <div style={styles.painel} className="fade-in">
        {/* Topo com X */}
        <div style={styles.painelTopo}>
          <span style={styles.painelTitulo}>Minha conta</span>
          <button style={styles.btnFechar} onClick={fechar}>✕</button>
        </div>

        {/* Avatar + info + upload foto */}
        <div style={styles.painelPerfil}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar nome={usuario?.nome} foto={usuario?.avatar} size={56} fontSize={22} />
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
            <p style={styles.painelId}>ID: #{id}</p>
          </div>
        </div>

        <div style={styles.painelDivisor} />

        {/* Seção Empresa — só admin */}
        {usuario?.cargo === 'admin' && (
          <>
            <p style={styles.painelSecaoTitulo}>Empresa</p>
            <button style={styles.painelItem} onClick={() => irPara('plano')}>
              <span><Icone.CreditCard size={15} /></span> Meu plano
            </button>
            <button style={styles.painelItem} onClick={() => irPara('equipe')}>
              <span><Icone.Users size={15} /></span> Minha equipe
            </button>
            <div style={styles.painelDivisor} />
          </>
        )}

        {/* Seção Conta */}
        <p style={styles.painelSecaoTitulo}>Conta</p>
        <button style={styles.painelItem} onClick={() => { fechar(); setModalAcessoExterno(true) }}>
          <span><Icone.Lock size={15} /></span> Acesso e senha
        </button>
        <button style={styles.painelItem} onClick={() => { fechar(); setModalConfigExterno(true) }}>
          <span><Icone.Settings size={15} /></span> Configurações
        </button>

        <div style={{ flex: 1 }} />
        <div style={styles.painelDivisor} />

        {/* Sair */}
        <button style={styles.painelSair} onClick={sair}>
          <span><Icone.LogOut size={15} /></span> Sair da conta
        </button>
      </div>
    </>
  )
}

// Ícones SVG
const IconeAgenda = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IconeChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconeRecolher = ({ aberta }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {aberta ? <><polyline points="15 18 9 12 15 6"/></> : <><polyline points="9 18 15 12 9 6"/></>}
  </svg>
)

// ── Navegação com suporte a grupos e submenus ──
function NavItens({ menuItens, paginaAtual, setPagina, sidebarAberta }) {
  const [gruposAbertos, setGruposAbertos] = useState(() => {
    // Abre o grupo cujo subitem está ativo
    const inicial = {}
    menuItens.forEach(item => {
      if (item.subItens?.some(s => s.id === paginaAtual)) {
        inicial[item.id] = true
      }
    })
    return inicial
  })

  const toggleGrupo = (id) => {
    setGruposAbertos(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      {menuItens.map(item => {
        if (item.subItens) {
          const aberto = gruposAbertos[item.id]
          const subAtivo = item.subItens.some(s => s.id === paginaAtual)
          return (
            <div key={item.id}>
              {/* Botão do grupo */}
              <button
                className="nav-btn"
                style={{
                  ...styles.navBtn,
                  ...(subAtivo && !aberto ? styles.navBtnAtivo : {}),
                  justifyContent: sidebarAberta ? 'space-between' : 'center',
                }}
                onClick={() => sidebarAberta ? toggleGrupo(item.id) : toggleGrupo(item.id)}
                title={!sidebarAberta ? item.label : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={styles.navIcone}>{item.icone}</span>
                  {sidebarAberta && <span style={styles.navLabel}>{item.label}</span>}
                </div>
                {sidebarAberta && (
                  <span style={{ fontSize: '10px', color: 'var(--texto-apagado)', transition: 'transform 0.2s', transform: aberto ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    ▶
                  </span>
                )}
              </button>

              {/* Submenus */}
              {aberto && sidebarAberta && (
                <div style={{ marginLeft: '12px', borderLeft: '1px solid #2A3830', paddingLeft: '8px', marginTop: '2px', marginBottom: '2px' }}>
                  {item.subItens.map(sub => (
                    <button
                      key={sub.id}
                      className="nav-btn"
                      style={{
                        ...styles.navBtn,
                        ...(paginaAtual === sub.id ? styles.navBtnAtivo : {}),
                        fontSize: '0.82rem',
                        padding: '8px 12px',
                      }}
                      onClick={() => setPagina(sub.id)}
                    >
                      <span style={styles.navLabel}>{sub.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        }

        // Item normal sem submenus
        return (
          <button
            key={item.id}
            className="nav-btn"
            style={{
              ...styles.navBtn,
              ...(paginaAtual === item.id ? styles.navBtnAtivo : {}),
              justifyContent: sidebarAberta ? 'flex-start' : 'center',
            }}
            onClick={() => setPagina(item.id)}
            title={!sidebarAberta ? item.label : ''}
          >
            <span style={styles.navIcone}>{item.icone}</span>
            {sidebarAberta && <span style={styles.navLabel}>{item.label}</span>}
          </button>
        )
      })}
    </>
  )
}

export default function Layout({ children, menuItens, paginaAtual, setPagina }) {
  const { usuario, sair, recarregarUsuario } = useAuth()
  const [sidebarAberta, setSidebarAberta] = useState(true)
  const [painelAberto, setPainelAberto] = useState(false)
  const [modalAcesso, setModalAcesso] = useState(false)
  const [modalConfig, setModalConfig] = useState(false)
  const [naoLidasChat, setNaoLidasChat] = useState(0)

  const TOPO = '52px'

  // Polling badge de mensagens não lidas
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
          background: rgba(255,255,255,0.06) !important;
          color: #fff !important;
        }
        .nav-btn:hover .nav-icone {
          opacity: 1;
        }
      `}</style>

      {/* ===== BARRA SUPERIOR ===== */}
      <header style={styles.topbar}>
        {/* Esquerda: logo clicável */}
        <button style={styles.logoBtn} onClick={() => setPagina('inicio')} title="Ir para início">
          <img src="/logo-branca.png" alt="Zempofy" style={{ height: '32px', width: 'auto' }} />
        </button>

        {/* Direita: ações rápidas + avatar */}
        <div style={styles.topbarDireita}>
          <button
            style={{ ...styles.btnTopbar, ...(paginaAtual === 'agenda' ? styles.btnTopbarAtivo : {}) }}
            onClick={() => setPagina('agenda')}
            title="Agenda"
          >
            <IconeAgenda />
          </button>
          <button
            style={{ ...styles.btnTopbar, ...(paginaAtual === 'chat' ? styles.btnTopbarAtivo : {}), position: 'relative' }}
            onClick={() => setPagina('chat')}
            title="Chat"
          >
            <IconeChat />
            {naoLidasChat > 0 && (
              <span style={styles.chatBadge}>{naoLidasChat > 9 ? '9+' : naoLidasChat}</span>
            )}
          </button>

          <div style={styles.topbarDivisor} />

          {/* Avatar */}
          <button style={styles.avatarBtn} onClick={() => setPainelAberto(true)} title="Minha conta">
            <Avatar nome={usuario?.nome} foto={usuario?.avatar} size={30} fontSize={13} />
            <div style={styles.avatarInfo}>
              <span style={styles.avatarNome}>{usuario?.nome}</span>
              <span style={styles.avatarCargo}>
                {usuario?.cargo === 'admin' ? 'Dono' : usuario?.cargo === 'administrador' ? 'Administrador' : 'Colaborador'}
              </span>
            </div>
          </button>
        </div>
      </header>

      {/* ===== SIDEBAR ===== */}
      <aside style={{ ...styles.sidebar, width: sidebarAberta ? SIDEBAR_ABERTA : SIDEBAR_FECHADA, top: TOPO }}>
        {/* Botão de recolher no topo da sidebar */}
        <div style={{ ...styles.sidebarTopoBtn, justifyContent: sidebarAberta ? 'flex-end' : 'center' }}>
          <button style={styles.btnToggle} onClick={() => setSidebarAberta(!sidebarAberta)} title={sidebarAberta ? 'Recolher menu' : 'Expandir menu'}>
            <IconeRecolher aberta={sidebarAberta} />
          </button>
        </div>

        <nav style={styles.nav}>
          <NavItens
            menuItens={menuItens}
            paginaAtual={paginaAtual}
            setPagina={setPagina}
            sidebarAberta={sidebarAberta}
          />
        </nav>
      </aside>

      {/* Painel de perfil */}
      {painelAberto && (
        <PainelPerfil
          usuario={usuario}
          sair={sair}
          fechar={() => setPainelAberto(false)}
          setPagina={setPagina}
          setModalAcessoExterno={setModalAcesso}
          setModalConfigExterno={setModalConfig}
        />
      )}

      {/* Modal Acesso e Senha */}
      {modalAcesso && (
        <ModalAcessoSenha usuario={usuario} fechar={() => setModalAcesso(false)} onNomeAtualizado={recarregarUsuario} />
      )}

      {/* Modal Configurações */}
      {modalConfig && (
        <ModalConfiguracoes fechar={() => setModalConfig(false)} />
      )}

      {/* Conteúdo */}
      <main style={{ ...styles.conteudo, marginLeft: sidebarAberta ? SIDEBAR_ABERTA : SIDEBAR_FECHADA, marginTop: TOPO }}>
        <div style={styles.conteudoInner} className="fade-in">
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

  // Topbar
  topbar: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: '52px',
    background: 'var(--topbar-bg)',
    borderBottom: '1px solid var(--borda)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '20px',
    zIndex: 100,
  },
  logoBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 8px', borderRadius: '8px',
    transition: 'background 0.15s',
  },
  logoIcone: {
    width: '28px', height: '28px', minWidth: '28px',
    background: 'var(--gradiente-verde)',
    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif', fontWeight: '800', fontSize: '14px', color: '#fff',
    boxShadow: '0 2px 8px rgba(0,177,65,0.35)',
  },
  logoNome: {
    fontFamily: 'Inter, sans-serif', fontWeight: '700',
    fontSize: '16px', color: 'var(--texto)', whiteSpace: 'nowrap',
    letterSpacing: '-0.02em',
  },
  topbarDireita: {
    display: 'flex', alignItems: 'center', gap: '4px',
    paddingRight: '16px',
  },
  btnTopbar: {
    background: 'none', border: 'none', borderRadius: '8px',
    color: 'var(--texto-apagado)', width: '36px', height: '36px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  btnTopbarAtivo: {
    background: 'var(--verde-glow)',
    color: 'var(--verde)',
  },
  chatBadge: {
    position: 'absolute', top: '4px', right: '4px',
    background: 'var(--gradiente-verde)', color: '#fff',
    fontSize: '0.5rem', fontWeight: '700',
    borderRadius: '50%', width: '13px', height: '13px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 6px rgba(0,177,65,0.5)',
  },
  topbarDivisor: {
    width: '1px', height: '20px', background: 'var(--borda)', margin: '0 8px',
  },
  avatarBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 8px', borderRadius: '8px',
    transition: 'background 0.15s',
  },
  avatarInfo: { display: 'flex', flexDirection: 'column', textAlign: 'left' },
  avatarNome: { fontSize: '0.8rem', fontWeight: '600', color: 'var(--texto)', whiteSpace: 'nowrap', letterSpacing: '-0.01em' },
  avatarCargo: { fontSize: '0.65rem', color: 'var(--texto-apagado)' },

  // Sidebar
  sidebar: {
    background: 'var(--sidebar)',
    borderRight: '1px solid var(--borda)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.25s ease',
    position: 'fixed',
    left: 0, bottom: 0,
    zIndex: 50,
    overflow: 'hidden',
  },
  sidebarTopoBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 8px',
    borderBottom: '1px solid var(--borda)',
    flexShrink: 0,
  },
  btnToggle: {
    background: 'none', border: '1px solid var(--borda)', borderRadius: '6px',
    color: 'var(--texto-apagado)', width: '26px', height: '26px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    transition: 'all 0.15s',
  },
  nav: {
    flex: 1, padding: '10px 8px',
    display: 'flex', flexDirection: 'column', gap: '2px',
    overflowY: 'auto',
  },
  navBtn: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 10px', borderRadius: '8px',
    background: 'none', border: 'none', color: 'var(--texto)',
    cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
    transition: 'all 0.15s', width: '100%', whiteSpace: 'nowrap',
    fontWeight: '500',
  },
  navBtnAtivo: {
    background: 'var(--verde-glow)',
    color: 'var(--verde)',
    fontWeight: '600',
  },
  navIcone: { fontSize: '16px', flexShrink: 0, width: '20px', textAlign: 'center' },
  navLabel: { fontSize: '0.875rem', fontWeight: 'inherit' },

  // Conteúdo
  conteudo: {
    flex: 1,
    transition: 'margin-left 0.25s ease, margin-top 0.25s ease',
    height: 'calc(100vh - 52px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    minWidth: 0,
  },
  conteudoInner: {
    padding: '32px',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '100%',
  },

  // Painel de perfil
  overlay: {
    position: 'fixed', inset: 0,
    background: 'var(--overlay)',
    zIndex: 98,
    backdropFilter: 'blur(2px)',
  },
  painel: {
    position: 'fixed',
    top: '52px', left: 0, bottom: 0,
    width: '260px',
    background: 'var(--card)',
    borderRight: '1px solid var(--borda)',
    zIndex: 99,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--sombra-elevada)',
  },
  painelTopo: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 20px 16px',
    borderBottom: '1px solid var(--borda)',
  },
  painelTitulo: {
    fontFamily: 'Inter, sans-serif', fontWeight: '700',
    fontSize: '1rem', color: 'var(--texto)', letterSpacing: '-0.02em',
  },
  btnFechar: {
    background: 'none', border: '1px solid var(--borda)', borderRadius: '6px',
    color: 'var(--texto-apagado)', width: '28px', height: '28px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', cursor: 'pointer',
  },
  painelPerfil: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '20px',
  },
  btnEditarFoto: {
    position: 'absolute', bottom: 0, right: 0,
    width: '18px', height: '18px',
    background: 'var(--gradiente-verde)', border: '2px solid var(--card)',
    borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', padding: 0,
  },
  painelNome: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--texto)', marginBottom: '2px', letterSpacing: '-0.01em' },
  painelEmpresa: { fontSize: '0.8rem', color: 'var(--verde)', marginBottom: '4px' },
  painelId: { fontSize: '0.7rem', color: 'var(--texto-apagado)', fontFamily: 'monospace', letterSpacing: '1px' },
  painelDivisor: { height: '1px', background: 'var(--borda)', margin: '4px 20px' },
  painelSecaoTitulo: {
    fontSize: '0.65rem', fontWeight: '700', color: 'var(--texto-apagado)',
    textTransform: 'uppercase', letterSpacing: '1.5px',
    padding: '12px 20px 6px',
  },
  painelItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 20px', background: 'none', border: 'none',
    color: 'var(--texto)', fontSize: '0.875rem', cursor: 'pointer',
    width: '100%', textAlign: 'left', fontFamily: 'Inter, sans-serif',
    transition: 'background 0.15s', borderRadius: '0',
  },
  painelSair: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '16px 20px', background: 'none', border: 'none',
    color: '#f87171', fontSize: '0.875rem', cursor: 'pointer',
    width: '100%', textAlign: 'left', fontFamily: 'Inter, sans-serif',
  },
}
