import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Icone from './Icones'
import Avatar from './Avatar'

// Seletor de emojis simples
const EMOJIS = ['😀','😂','😊','😍','🤔','😅','👍','👏','🙌','❤️','🔥','✅','⚡','🎉','😎','🙏','💪','😢','😆','🤝']

function SeletorEmoji({ onSelecionar, fechar }) {
  return (
    <div style={s.emojiPicker}>
      {EMOJIS.map(e => (
        <button key={e} style={s.emojiBtn} onClick={() => { onSelecionar(e); fechar() }}>
          {e}
        </button>
      ))}
    </div>
  )
}

function labelCargo(cargo) {
  if (cargo === 'admin') return 'Titular'
  return 'Colaborador'
}

function formatarHora(data) {
  const d = new Date(data)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatarData(data) {
  const d = new Date(data)
  const hoje = new Date()
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === hoje.toDateString()) return 'Hoje'
  if (d.toDateString() === ontem.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export default function Chat({ setPagina }) {
  const { usuario } = useAuth()
  const [contatos, setContatos] = useState([])
  const [contatoAtivo, setContatoAtivo] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [emojiAberto, setEmojiAberto] = useState(false)
  const [confirmandoApagar, setConfirmandoApagar] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const mensagensRef = useRef(null)
  const inputRef = useRef(null)
  const pollingRef = useRef(null)

  // Carrega lista de contatos
  const carregarContatos = useCallback(async () => {
    try {
      const res = await api.get('/chat/contatos')
      setContatos(res.data)
    } catch (err) { console.error(err) }
  }, [])

  // Carrega mensagens da conversa ativa
  const carregarMensagens = useCallback(async (contatoId) => {
    try {
      const res = await api.get(`/chat/${contatoId}`)
      setMensagens(res.data.mensagens)
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    carregarContatos()
  }, [])

  // Polling: atualiza mensagens a cada 3 segundos
  useEffect(() => {
    if (contatoAtivo) {
      carregarMensagens(contatoAtivo._id)
      pollingRef.current = setInterval(() => {
        carregarMensagens(contatoAtivo._id)
        carregarContatos()
      }, 3000)
    }
    return () => clearInterval(pollingRef.current)
  }, [contatoAtivo])

  // Scroll automático para última mensagem
  useEffect(() => {
    if (mensagensRef.current) {
      mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight
    }
  }, [mensagens])

  const abrirConversa = async (contato) => {
    setContatoAtivo(contato)
    setMensagens([])
    inputRef.current?.focus()
  }

  const enviar = async () => {
    if (!texto.trim() || !contatoAtivo) return
    const textoEnviar = texto.trim()
    setTexto('')
    try {
      await api.post(`/chat/${contatoAtivo._id}`, { texto: textoEnviar })
      carregarMensagens(contatoAtivo._id)
      carregarContatos()
    } catch (err) { console.error(err) }
  }

  const apagar = async (id) => {
    try {
      await api.delete(`/chat/mensagem/${id}`)
      carregarMensagens(contatoAtivo._id)
      setConfirmandoApagar(null)
    } catch (err) { console.error(err) }
  }

  // Agrupa mensagens por data
  const mensagensAgrupadas = mensagens.reduce((acc, msg) => {
    const data = formatarData(msg.criadaEm)
    if (!acc[data]) acc[data] = []
    acc[data].push(msg)
    return acc
  }, {})

  const totalNaoLidas = contatos.reduce((acc, c) => acc + (c.naoLidas || 0), 0)

  return (
    <div style={s.container}>
      {/* Lista de contatos */}
      <div style={s.sidebar}>
        <div style={s.sidebarTopo}>
          <h2 style={s.sidebarTitulo}>Mensagens</h2>
          {totalNaoLidas > 0 && (
            <span style={s.badge}>{totalNaoLidas}</span>
          )}
        </div>

        <div style={s.contatoLista}>
          {contatos.length === 0 && (
            <p style={s.vazio}>Nenhum colega cadastrado ainda.</p>
          )}
          {contatos.map(c => (
            <button
              key={c._id}
              style={{ ...s.contatoItem, ...(contatoAtivo?._id === c._id ? s.contatoAtivo : {}) }}
              onClick={() => abrirConversa(c)}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar nome={c.nome} foto={c.avatar} size={40} fontSize={16} />
                {c.naoLidas > 0 && <span style={s.avatarBadge}>{c.naoLidas}</span>}
              </div>
              <div style={s.contatoInfo}>
                <div style={s.contatoLinha1}>
                  <span style={s.contatoNome}>{c.nome}</span>
                  {c.ultimaMensagem && (
                    <span style={s.contatoHora}>{formatarHora(c.ultimaMensagem.criadaEm)}</span>
                  )}
                </div>
                <p style={{ ...s.contatoUltima, fontWeight: c.naoLidas > 0 ? '600' : '400', color: c.naoLidas > 0 ? 'var(--texto)' : 'var(--texto-apagado)' }}>
                  {c.ultimaMensagem
                    ? `${c.ultimaMensagem.minha ? 'Você: ' : ''}${c.ultimaMensagem.texto.slice(0, 35)}${c.ultimaMensagem.texto.length > 35 ? '...' : ''}`
                    : labelCargo(c.cargo)
                  }
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Área de conversa */}
      <div style={s.conversa}>
        {!contatoAtivo ? (
          <div style={s.semConversa}>
            <Icone.MessageSquare size={48} style={{ color: 'var(--borda)', marginBottom: '16px' }} />
            <p style={{ color: 'var(--texto-apagado)', fontSize: '1rem' }}>Selecione uma conversa</p>
            <p style={{ color: 'var(--borda)', fontSize: '0.85rem', marginTop: '4px' }}>Suas mensagens são privadas</p>
          </div>
        ) : (
          <>
            {/* Cabeçalho da conversa */}
            <div style={s.conversaTopo}>
              <Avatar nome={contatoAtivo.nome} foto={contatoAtivo.avatar} size={36} fontSize={14} />
              <div>
                <p style={s.conversaNome}>{contatoAtivo.nome}</p>
                <p style={s.conversaCargo}>{labelCargo(contatoAtivo.cargo)}</p>
              </div>
            </div>

            {/* Mensagens */}
            <div style={s.mensagensArea} ref={mensagensRef}>
              {Object.entries(mensagensAgrupadas).map(([data, msgs]) => (
                <div key={data}>
                  <div style={s.separadorData}><span style={s.separadorTexto}>{data}</span></div>
                  {msgs.map(msg => {
                    const minha = msg.de._id === usuario.id || msg.de === usuario.id
                    return (
                      <div
                        key={msg._id}
                        style={{ ...s.msgWrapper, justifyContent: minha ? 'flex-end' : 'flex-start' }}
                        onMouseEnter={e => { if (minha) e.currentTarget.querySelector('.msg-acoes')?.style && (e.currentTarget.querySelector('.msg-acoes').style.opacity = '1') }}
                        onMouseLeave={e => { if (minha) e.currentTarget.querySelector('.msg-acoes')?.style && (e.currentTarget.querySelector('.msg-acoes').style.opacity = '0') }}
                      >
                        {minha && (
                          <div className="msg-acoes" style={s.msgAcoes}>
                            {confirmandoApagar === msg._id ? (
                              <div style={s.confirmarApagar}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--texto-apagado)' }}>Apagar?</span>
                                <button style={s.btnApagarSim} onClick={() => apagar(msg._id)}>Sim</button>
                                <button style={s.btnApagarNao} onClick={() => setConfirmandoApagar(null)}>Não</button>
                              </div>
                            ) : (
                              <button style={s.btnApagar} onClick={() => setConfirmandoApagar(msg._id)} title="Apagar mensagem">
                                <Icone.Trash size={12} />
                              </button>
                            )}
                          </div>
                        )}
                        <div style={{ ...s.bolha, ...(minha ? s.bolhaMinha : s.bolhaOutro) }}>
                          <p style={s.msgTexto}>{msg.texto}</p>
                          <span style={s.msgHora}>{formatarHora(msg.criadaEm)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              {mensagens.length === 0 && (
                <div style={s.semMensagens}>
                  <p>Nenhuma mensagem ainda.</p>
                  <p>Diga olá para {contatoAtivo.nome}! 👋</p>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={s.inputArea}>
              {emojiAberto && (
                <SeletorEmoji
                  onSelecionar={e => setTexto(t => t + e)}
                  fechar={() => setEmojiAberto(false)}
                />
              )}
              <button
                style={s.btnEmoji}
                onClick={() => setEmojiAberto(!emojiAberto)}
                title="Emojis"
              >
                😊
              </button>
              <input
                ref={inputRef}
                style={s.input}
                placeholder={`Mensagem para ${contatoAtivo.nome}...`}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
              />
              <button
                style={{ ...s.btnEnviar, opacity: texto.trim() ? 1 : 0.4 }}
                onClick={enviar}
                disabled={!texto.trim()}
                title="Enviar"
              >
                <Icone.ChevronRight size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  container: {
    display: 'flex',
    height: 'calc(100vh - 52px - 64px)',
    minHeight: '500px',
    background: 'var(--sidebar)',
    border: '1px solid var(--borda)',
    borderRadius: '16px',
    overflow: 'hidden',
  },

  // Sidebar contatos
  sidebar: {
    width: '280px',
    flexShrink: 0,
    borderRight: '1px solid var(--borda)',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarTopo: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '20px 16px 12px',
    borderBottom: '1px solid var(--borda)',
  },
  sidebarTitulo: {
    fontFamily: 'var(--fonte-corpo)', fontWeight: '700',
    fontSize: '1rem', color: 'var(--texto)', margin: 0,
  },
  badge: {
    background: 'var(--verde)', color: '#fff',
    fontSize: '0.7rem', fontWeight: '700',
    borderRadius: '10px', padding: '2px 6px',
    minWidth: '18px', textAlign: 'center',
  },
  contatoLista: { flex: 1, overflowY: 'auto', padding: '8px' },
  vazio: { color: 'var(--texto-apagado)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' },
  contatoItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', borderRadius: '10px', width: '100%',
    background: 'none', border: 'none', cursor: 'pointer',
    transition: 'background 0.15s', textAlign: 'left',
  },
  contatoAtivo: { background: 'rgba(34,197,94,0.1)' },
  contatoAvatar: {
    width: '40px', height: '40px', minWidth: '40px',
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--fonte-corpo)', fontWeight: '700', fontSize: '16px', color: '#fff',
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute', top: '-3px', right: '-3px',
    background: 'var(--verde)', color: '#fff',
    fontSize: '0.6rem', fontWeight: '700',
    borderRadius: '50%', width: '16px', height: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  contatoInfo: { flex: 1, minWidth: 0 },
  contatoLinha1: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  contatoNome: { fontSize: '0.875rem', fontWeight: '600', color: 'var(--texto)' },
  contatoHora: { fontSize: '0.7rem', color: 'var(--texto-apagado)' },
  contatoUltima: { fontSize: '0.78rem', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  // Área de conversa
  conversa: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  semConversa: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
  },
  conversaTopo: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '16px 20px', borderBottom: '1px solid var(--borda)',
    flexShrink: 0,
  },
  conversaAvatar: {
    width: '36px', height: '36px', minWidth: '36px',
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--fonte-corpo)', fontWeight: '700', fontSize: '14px', color: '#fff',
  },
  conversaNome: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--texto)', margin: 0 },
  conversaCargo: { fontSize: '0.75rem', color: 'var(--texto-apagado)', margin: 0 },

  // Mensagens
  mensagensArea: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px' },
  separadorData: { display: 'flex', alignItems: 'center', margin: '12px 0', gap: '12px' },
  separadorTexto: {
    fontSize: '0.7rem', color: 'var(--texto-apagado)', background: 'var(--sidebar)',
    padding: '2px 10px', borderRadius: '10px',
    border: '1px solid var(--borda)', margin: '0 auto',
  },
  msgWrapper: { display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '2px' },
  msgAcoes: { opacity: 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center' },
  confirmarApagar: { display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--input)', borderRadius: '8px', padding: '4px 8px' },
  btnApagarSim: { background: 'rgba(239,68,68,0.2)', border: 'none', color: '#FCA5A5', fontSize: '0.7rem', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' },
  btnApagarNao: { background: 'var(--borda)', border: 'none', color: 'var(--texto)', fontSize: '0.7rem', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' },
  btnApagar: { background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex' },
  bolha: {
    maxWidth: '65%', padding: '8px 12px', borderRadius: '14px',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  bolhaMinha: {
    background: 'rgba(34,197,94,0.15)',
    borderBottomRightRadius: '4px',
  },
  bolhaOutro: {
    background: 'var(--input)',
    borderBottomLeftRadius: '4px',
  },
  msgTexto: { fontSize: '0.9rem', color: 'var(--texto)', margin: 0, lineHeight: '1.4', wordBreak: 'break-word' },
  msgHora: { fontSize: '0.65rem', color: 'var(--texto-apagado)', alignSelf: 'flex-end' },
  semMensagens: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--texto-apagado)', fontSize: '0.875rem', gap: '4px' },

  // Input
  inputArea: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 16px', borderTop: '1px solid var(--borda)',
    flexShrink: 0, position: 'relative',
  },
  emojiPicker: {
    position: 'absolute', bottom: '60px', left: '12px',
    background: 'var(--input)', border: '1px solid var(--borda)',
    borderRadius: '12px', padding: '8px',
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '4px', zIndex: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  emojiBtn: {
    background: 'none', border: 'none', fontSize: '1.2rem',
    cursor: 'pointer', padding: '4px', borderRadius: '6px',
    transition: 'background 0.1s',
  },
  btnEmoji: {
    background: 'none', border: 'none', fontSize: '1.2rem',
    cursor: 'pointer', padding: '4px', flexShrink: 0,
  },
  input: {
    flex: 1, background: 'var(--input)', border: '1px solid var(--borda)',
    borderRadius: '12px', padding: '10px 14px',
    color: 'var(--texto)', fontSize: '0.9rem',
    fontFamily: 'var(--fonte-corpo)',
    outline: 'none',
  },
  btnEnviar: {
    width: '38px', height: '38px', flexShrink: 0,
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    border: 'none', borderRadius: '10px',
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.2s',
  },
}
