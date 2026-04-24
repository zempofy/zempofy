import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'
import ModalConfirmacao from './ModalConfirmacao'
import Icone from './Icones'
import Avatar from './Avatar'
import Modal from './Modal'

const REACOES = ['👍', '❤️', '😂', '😮', '👏', '🔥']

function labelCargo(cargo) {
  if (cargo === 'admin') return 'Titular'
  return 'Colaborador'
}

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ===== MODAL CRIAR/EDITAR AVISO =====
function ModalAviso({ aviso, onSalvar, onFechar }) {
  const [form, setForm] = useState({
    titulo: aviso?.titulo || '',
    texto: aviso?.texto || '',
    imagem: aviso?.imagem || '',
    fixado: aviso?.fixado || false,
  })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [previewImagem, setPreviewImagem] = useState(aviso?.imagem || '')
  const inputImagemRef = useRef(null)

  const handleImagem = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setErro('Imagem muito grande. Máximo 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setForm(f => ({ ...f, imagem: ev.target.result }))
      setPreviewImagem(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const salvar = async () => {
    if (!form.titulo.trim()) return setErro('Digite um título.')
    if (!form.texto.trim()) return setErro('Digite o texto do aviso.')
    setCarregando(true)
    try {
      await onSalvar(form, aviso?._id)
      onFechar()
    } catch {
      setErro('Erro ao salvar aviso.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Modal onFechar={onFechar} maxWidth="520px">
      <div style={s.modalTopo}>
        <span style={s.modalTitulo}>{aviso ? 'Editar aviso' : 'Novo aviso'}</span>
        <button style={s.btnX} onClick={onFechar}>✕</button>
      </div>
      <div style={s.modalCorpo}>
        {erro && <p style={s.erro}>{erro}</p>}
        <div style={s.campo}>
          <label style={s.label}>Título</label>
          <input style={s.input} placeholder="Ex: Reunião geral amanhã" value={form.titulo}
            onChange={e => setForm({ ...form, titulo: e.target.value })} autoFocus />
        </div>
        <div style={s.campo}>
          <label style={s.label}>Mensagem</label>
          <textarea style={s.textarea} placeholder="Escreva o aviso aqui..." value={form.texto}
            onChange={e => setForm({ ...form, texto: e.target.value })} rows={5} />
        </div>
        <div style={s.campo}>
          <label style={s.label}>Imagem (opcional)</label>
          <input ref={inputImagemRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagem} />
          {previewImagem ? (
            <div style={s.imagemPreviewWrapper}>
              <img src={previewImagem} alt="Preview" style={s.imagemPreview} />
              <button style={s.btnRemoverImagem} onClick={() => { setPreviewImagem(''); setForm(f => ({ ...f, imagem: '' })) }}>
                Remover imagem
              </button>
            </div>
          ) : (
            <button style={s.btnUpload} onClick={() => inputImagemRef.current?.click()}>
              <Icone.Plus size={14} /> Anexar imagem
            </button>
          )}
        </div>
        <label style={s.fixarLabel}>
          <div style={{ ...s.toggle, background: form.fixado ? 'var(--verde)' : 'var(--borda)' }}
            onClick={() => setForm({ ...form, fixado: !form.fixado })}>
            <div style={{ ...s.toggleBolinha, transform: form.fixado ? 'translateX(16px)' : 'translateX(2px)' }} />
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--texto)' }}>Fixar no topo do mural</span>
        </label>
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button style={s.btnCancelar} onClick={onFechar}>Cancelar</button>
          <button style={s.btnSalvar} onClick={salvar} disabled={carregando}>
            {carregando ? 'Publicando...' : aviso ? 'Salvar' : 'Publicar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ===== CARD DE AVISO =====
function CardAviso({ aviso, usuarioId, isGestor, onEditar, onExcluir, onReagir }) {
  const [mostrarReacoes, setMostrarReacoes] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const textoLongo = aviso.texto.length > 200

  // Agrupa reações por emoji
  const reacoesPorEmoji = REACOES.map(emoji => {
    const lista = aviso.reacoes.filter(r => r.emoji === emoji)
    const minhaReacao = lista.some(r => r.usuario === usuarioId || r.usuario?._id === usuarioId)
    return { emoji, count: lista.length, ativa: minhaReacao }
  }).filter(r => r.count > 0 || false)

  const totalReacoes = aviso.reacoes.length

  return (
    <div style={{ ...s.card, ...(aviso.fixado ? s.cardFixado : {}) }}>
      {/* Header */}
      <div style={s.cardHeader}>
        <div style={s.cardHeaderEsq}>
          {aviso.fixado && (
            <span style={s.badgeFixado}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Fixado
            </span>
          )}
          <h3 style={s.cardTitulo}>{aviso.titulo}</h3>
        </div>
        {isGestor && (
          <div style={s.cardAcoes}>
            <button style={s.btnIcone} onClick={() => onEditar(aviso)} title="Editar">
              <Icone.Edit size={14} />
            </button>
            <button style={{ ...s.btnIcone, color: '#FCA5A5' }} onClick={() => onExcluir(aviso._id)} title="Excluir">
              <Icone.Trash size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Texto */}
      <div style={s.cardTexto}>
        <p style={s.cardTextoP}>
          {textoLongo && !expandido ? aviso.texto.slice(0, 200) + '...' : aviso.texto}
        </p>
        {textoLongo && (
          <button style={s.btnVerMais} onClick={() => setExpandido(!expandido)}>
            {expandido ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>

      {/* Imagem */}
      {aviso.imagem && (
        <img src={aviso.imagem} alt="Anexo" style={s.cardImagem} />
      )}

      {/* Footer */}
      <div style={s.cardFooter}>
        <div style={s.cardAutor}>
          <Avatar nome={aviso.autor?.nome} foto={aviso.autor?.avatar} size={32} fontSize={13} />
          <div>
            <span style={s.autorNome}>{aviso.autor?.nome}</span>
            <span style={s.autorCargo}>{labelCargo(aviso.autor?.cargo)}</span>
          </div>
          <span style={s.cardData}>{formatarData(aviso.criadoEm)}</span>
        </div>

        {/* Reações */}
        <div style={s.reacoesArea}>
          {/* Reações existentes */}
          {reacoesPorEmoji.map(r => (
            <button
              key={r.emoji}
              style={{ ...s.reacaoBotao, ...(r.ativa ? s.reacaoAtiva : {}) }}
              onClick={() => onReagir(aviso._id, r.emoji)}
            >
              {r.emoji} {r.count}
            </button>
          ))}

          {/* Botão adicionar reação */}
          <div style={{ position: 'relative' }}>
            <button
              style={s.btnAdicionarReacao}
              onClick={() => setMostrarReacoes(!mostrarReacoes)}
              title="Reagir"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </button>
            {mostrarReacoes && (
              <div style={s.seletorReacao}>
                {REACOES.map(emoji => (
                  <button key={emoji} style={s.emojiReacaoBtn}
                    onClick={() => { onReagir(aviso._id, emoji); setMostrarReacoes(false) }}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== MURAL PRINCIPAL =====
export default function Mural() {
  const { usuario } = useAuth()
  const [avisos, setAvisos] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const { mostrar } = useToast()

  const { temPermissao } = useAuth()
  const isGestor = usuario?.cargo === 'admin' || temPermissao('publicarMural')

  const carregar = async () => {
    try {
      const res = await api.get('/mural')
      setAvisos(res.data)
    } catch (err) { console.error(err) }
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (form, id) => {
    if (id) {
      await api.put(`/mural/${id}`, form)
      mostrar('Aviso atualizado!')
    } else {
      await api.post('/mural', form)
      mostrar('Aviso publicado!')
    }
    carregar()
  }

  const excluir = async (id) => {
    await api.delete(`/mural/${id}`)
    setConfirmandoId(null)
    mostrar('Aviso excluído.', 'aviso')
    carregar()
  }

  const reagir = async (avisoId, emoji) => {
    try {
      await api.post(`/mural/${avisoId}/reagir`, { emoji })
      carregar()
    } catch (err) { console.error(err) }
  }

  const fixados = avisos.filter(a => a.fixado)
  const normais = avisos.filter(a => !a.fixado)

  return (
    <div>
      {/* Cabeçalho */}
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Mural de Avisos</h1>
          <p style={s.subtitulo}>{avisos.length} aviso(s) publicado(s)</p>
        </div>
        {isGestor && (
          <button style={s.btnNovo} onClick={() => { setEditando(null); setModalAberto(true) }}>
            + Novo aviso
          </button>
        )}
      </div>

      {/* Vazio */}
      {avisos.length === 0 && (
        <div style={s.vazio}>
          <Icone.Bell size={48} style={{ color: 'var(--borda)', marginBottom: '16px' }} />
          <p style={{ color: 'var(--texto-apagado)' }}>Nenhum aviso publicado ainda.</p>
          {isGestor && <p style={{ color: 'var(--borda)', fontSize: '0.85rem', marginTop: '4px' }}>Clique em "+ Novo aviso" para publicar.</p>}
        </div>
      )}

      {/* Avisos */}
      <div style={s.lista}>
        {fixados.map(a => (
          <CardAviso key={a._id} aviso={a} usuarioId={usuario?.id}
            isGestor={isGestor}
            onEditar={a => { setEditando(a); setModalAberto(true) }}
            onExcluir={setConfirmandoId}
            onReagir={reagir}
          />
        ))}
        {normais.map(a => (
          <CardAviso key={a._id} aviso={a} usuarioId={usuario?.id}
            isGestor={isGestor}
            onEditar={a => { setEditando(a); setModalAberto(true) }}
            onExcluir={setConfirmandoId}
            onReagir={reagir}
          />
        ))}
      </div>

      {/* Modais */}
      {modalAberto && (
        <ModalAviso aviso={editando} onSalvar={salvar} onFechar={() => { setModalAberto(false); setEditando(null) }} />
      )}
      {confirmandoId && (
        <ModalConfirmacao
          titulo="Excluir aviso"
          mensagem="Tem certeza que deseja excluir este aviso?"
          textoBotao="Excluir" perigo
          onConfirmar={() => excluir(confirmandoId)}
          onCancelar={() => setConfirmandoId(null)}
        />
      )}
    </div>
  )
}

const s = {
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' },
  titulo: { fontSize: '1.8rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif', fontWeight: '700', marginBottom: '4px' },
  subtitulo: { color: 'var(--texto-apagado)', fontSize: '0.9rem' },
  btnNovo: { background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  vazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' },
  lista: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px' },

  // Card
  card: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  cardFixado: { borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.03)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  cardHeaderEsq: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  badgeFixado: { display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(34,197,94,0.15)', color: 'var(--verde)', fontSize: '0.7rem', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', width: 'fit-content' },
  cardTitulo: { fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '1.1rem', color: 'var(--texto)', margin: 0 },
  cardAcoes: { display: 'flex', gap: '4px', flexShrink: 0 },
  btnIcone: { background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' },
  cardTexto: {},
  cardTextoP: { fontSize: '0.95rem', color: 'var(--texto-card)', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' },
  btnVerMais: { background: 'none', border: 'none', color: 'var(--verde)', fontSize: '0.8rem', cursor: 'pointer', padding: '4px 0', fontFamily: 'Inter, sans-serif', marginTop: '4px' },
  cardImagem: { width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--borda)' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--input)' },
  cardAutor: { display: 'flex', alignItems: 'center', gap: '10px' },
  autorAvatar: { width: '32px', height: '32px', minWidth: '32px', background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '13px', color: '#fff' },
  autorNome: { fontSize: '0.82rem', fontWeight: '600', color: 'var(--texto)', display: 'block' },
  autorCargo: { fontSize: '0.7rem', color: 'var(--texto-apagado)', display: 'block' },
  cardData: { fontSize: '0.75rem', color: 'var(--texto-apagado)', marginLeft: '8px' },

  // Reações
  reacoesArea: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  reacaoBotao: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '20px', padding: '4px 10px', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--texto)', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif' },
  reacaoAtiva: { background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)', color: 'var(--verde)' },
  btnAdicionarReacao: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '20px', padding: '5px 10px', cursor: 'pointer', color: 'var(--texto-apagado)', display: 'flex', alignItems: 'center', transition: 'color 0.15s' },
  seletorReacao: { position: 'absolute', bottom: '36px', right: 0, background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '8px', display: 'flex', gap: '4px', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
  emojiReacaoBtn: { background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: '4px', borderRadius: '6px' },

  // Modal
  fundo: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 },
  modal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', maxWidth: '520px', background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '20px', zIndex: 1001, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden' },
  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  modalTitulo: { fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '1rem', color: 'var(--texto)' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', width: '100%', fontFamily: 'Inter, sans-serif', outline: 'none' },
  textarea: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', width: '100%', fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical', lineHeight: '1.5' },
  btnUpload: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--input)', border: '1px dashed var(--borda)', borderRadius: '10px', padding: '12px 16px', color: 'var(--texto-apagado)', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s' },
  imagemPreviewWrapper: { display: 'flex', flexDirection: 'column', gap: '8px' },
  imagemPreview: { width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--borda)' },
  btnRemoverImagem: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '6px 12px', color: '#FCA5A5', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', alignSelf: 'flex-start' },
  fixarLabel: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  toggle: { width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  toggleBolinha: { position: 'absolute', top: '2px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', transition: 'transform 0.2s' },
  btnCancelar: { flex: 1, padding: '10px', borderRadius: '10px', background: 'none', border: '1px solid var(--borda)', color: 'var(--texto-apagado)', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  btnSalvar: { flex: 1, padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', border: 'none', color: '#fff', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px', margin: 0 },
}
