import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from './Toast'
import ModalConfirmacao from './ModalConfirmacao'
import Icone from './Icones'
import Modal from './Modal'

const CORES = [
  { nome: 'Escuro',    valor: 'var(--input)' },
  { nome: 'Verde',     valor: '#14532D' },
  { nome: 'Azul',      valor: '#1e3a5f' },
  { nome: 'Roxo',      valor: '#3b1f5e' },
  { nome: 'Vermelho',  valor: '#5e1f1f' },
  { nome: 'Amarelo',   valor: '#4a3800' },
]

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ===== MODAL CRIAR/EDITAR =====
function ModalAnotacao({ anotacao, onSalvar, onFechar }) {
  const [form, setForm] = useState({
    titulo: anotacao?.titulo || '',
    texto: anotacao?.texto || '',
    cor: anotacao?.cor || 'var(--input)',
    fixada: anotacao?.fixada || false,
  })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const salvar = async () => {
    if (!form.titulo.trim()) return setErro('Digite um título.')
    setCarregando(true)
    try {
      await onSalvar(form, anotacao?._id)
      onFechar()
    } catch {
      setErro('Erro ao salvar.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Modal onFechar={onFechar} maxWidth="480px">
      <div style={s.modalTopo}>
        <span style={s.modalTituloTexto}>{anotacao ? 'Editar anotação' : 'Nova anotação'}</span>
        <button style={s.btnX} onClick={onFechar}>✕</button>
      </div>
      <div style={s.modalCorpo}>
        {erro && <p style={s.erro}>{erro}</p>}
        <div style={s.campo}>
          <label style={s.label}>Título</label>
          <input style={s.input} placeholder="Título da anotação" value={form.titulo}
            onChange={e => setForm({ ...form, titulo: e.target.value })} autoFocus />
        </div>
        <div style={s.campo}>
          <label style={s.label}>Conteúdo</label>
          <textarea style={s.textarea} placeholder="Escreva sua anotação aqui..."
            value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} rows={6} />
        </div>
        <div style={s.campo}>
          <label style={s.label}>Cor</label>
          <div style={s.coresWrapper}>
            {CORES.map(c => (
              <button key={c.valor} title={c.nome}
                style={{ ...s.corBtn, background: c.valor,
                  outline: form.cor === c.valor ? '2px solid #22C55E' : '2px solid transparent',
                  outlineOffset: '2px', transform: form.cor === c.valor ? 'scale(1.15)' : 'scale(1)' }}
                onClick={() => setForm({ ...form, cor: c.valor })} />
            ))}
          </div>
        </div>
        <label style={s.fixarLabel}>
          <div style={{ ...s.toggle, background: form.fixada ? 'var(--verde)' : 'var(--borda)' }}
            onClick={() => setForm({ ...form, fixada: !form.fixada })}>
            <div style={{ ...s.toggleBolinha, transform: form.fixada ? 'translateX(16px)' : 'translateX(2px)' }} />
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--texto)' }}>Fixar no topo</span>
        </label>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button style={s.btnCancelar} onClick={onFechar}>Cancelar</button>
          <button style={s.btnSalvar} onClick={salvar} disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ===== CARD DE ANOTAÇÃO =====
function CardAnotacao({ anotacao, onEditar, onExcluir, onToggleFixar }) {
  const [expandida, setExpandida] = useState(false)
  const textoLongo = anotacao.texto.length > 120

  return (
    <div style={{
      ...s.card,
      background: anotacao.cor,
      borderTop: `3px solid ${anotacao.cor === 'var(--input)' ? 'var(--borda)' : anotacao.cor}`,
      filter: anotacao.cor !== 'var(--input)' ? 'brightness(1.3)' : 'none',
    }}>
      {/* Topo do card */}
      <div style={s.cardTopo}>
        <h3 style={s.cardTitulo}>{anotacao.titulo}</h3>
        <div style={s.cardAcoes}>
          <button
            style={{ ...s.btnIcone, color: anotacao.fixada ? 'var(--verde)' : 'var(--texto-apagado)' }}
            onClick={() => onToggleFixar(anotacao)}
            title={anotacao.fixada ? 'Desafixar' : 'Fixar'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={anotacao.fixada ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <button style={s.btnIcone} onClick={() => onEditar(anotacao)} title="Editar">
            <Icone.Edit size={13} />
          </button>
          <button style={{ ...s.btnIcone, color: '#FCA5A5' }} onClick={() => onExcluir(anotacao._id)} title="Excluir">
            <Icone.Trash size={13} />
          </button>
        </div>
      </div>

      {/* Texto */}
      {anotacao.texto && (
        <div style={s.cardTexto}>
          <p style={s.cardTextoP}>
            {textoLongo && !expandida
              ? anotacao.texto.slice(0, 120) + '...'
              : anotacao.texto
            }
          </p>
          {textoLongo && (
            <button style={s.btnVerMais} onClick={() => setExpandida(!expandida)}>
              {expandida ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </div>
      )}

      {/* Rodapé */}
      <p style={s.cardData}>{formatarData(anotacao.criadaEm)}</p>
    </div>
  )
}

// ===== PÁGINA PRINCIPAL =====
export default function Anotacoes() {
  const [anotacoes, setAnotacoes] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [busca, setBusca] = useState('')
  const { mostrar } = useToast()

  const carregar = async () => {
    try {
      const res = await api.get('/anotacoes')
      setAnotacoes(res.data)
    } catch (err) { console.error(err) }
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (form, id) => {
    if (id) {
      await api.put(`/anotacoes/${id}`, form)
      mostrar('Anotação atualizada!')
    } else {
      await api.post('/anotacoes', form)
      mostrar('Anotação criada!')
    }
    carregar()
  }

  const excluir = async (id) => {
    await api.delete(`/anotacoes/${id}`)
    setConfirmandoId(null)
    mostrar('Anotação excluída.', 'aviso')
    carregar()
  }

  const toggleFixar = async (anotacao) => {
    await api.put(`/anotacoes/${anotacao._id}`, { ...anotacao, fixada: !anotacao.fixada })
    carregar()
  }

  const anotacoesFiltradas = anotacoes.filter(a =>
    a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    a.texto.toLowerCase().includes(busca.toLowerCase())
  )

  const fixadas = anotacoesFiltradas.filter(a => a.fixada)
  const normais = anotacoesFiltradas.filter(a => !a.fixada)

  return (
    <div>
      {/* Cabeçalho */}
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Anotações</h1>
          <p style={s.subtitulo}>{anotacoes.length} anotação(ões) salva(s)</p>
        </div>
        <button style={s.btnNova} onClick={() => { setEditando(null); setModalAberto(true) }}>
          + Nova anotação
        </button>
      </div>

      {/* Busca */}
      {anotacoes.length > 0 && (
        <div style={s.buscaWrapper}>
          <Icone.Edit size={15} style={{ color: 'var(--texto-apagado)' }} />
          <input
            style={s.inputBusca}
            placeholder="Buscar anotações..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      )}

      {/* Vazio */}
      {anotacoes.length === 0 && (
        <div style={s.vazio}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--borda)" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p style={{ color: 'var(--texto-apagado)', marginTop: '12px' }}>Nenhuma anotação ainda.</p>
          <p style={{ color: 'var(--borda)', fontSize: '0.85rem' }}>Clique em "+ Nova anotação" para começar.</p>
        </div>
      )}

      {/* Fixadas */}
      {fixadas.length > 0 && (
        <div style={s.secao}>
          <p style={s.secaoLabel}>⭐ Fixadas</p>
          <div style={s.grade}>
            {fixadas.map(a => (
              <CardAnotacao
                key={a._id} anotacao={a}
                onEditar={(a) => { setEditando(a); setModalAberto(true) }}
                onExcluir={setConfirmandoId}
                onToggleFixar={toggleFixar}
              />
            ))}
          </div>
        </div>
      )}

      {/* Normais */}
      {normais.length > 0 && (
        <div style={s.secao}>
          {fixadas.length > 0 && <p style={s.secaoLabel}>Outras</p>}
          <div style={s.grade}>
            {normais.map(a => (
              <CardAnotacao
                key={a._id} anotacao={a}
                onEditar={(a) => { setEditando(a); setModalAberto(true) }}
                onExcluir={setConfirmandoId}
                onToggleFixar={toggleFixar}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modais */}
      {modalAberto && (
        <ModalAnotacao
          anotacao={editando}
          onSalvar={salvar}
          onFechar={() => { setModalAberto(false); setEditando(null) }}
        />
      )}
      {confirmandoId && (
        <ModalConfirmacao
          titulo="Excluir anotação"
          mensagem="Tem certeza que deseja excluir esta anotação?"
          textoBotao="Excluir" perigo
          onConfirmar={() => excluir(confirmandoId)}
          onCancelar={() => setConfirmandoId(null)}
        />
      )}
    </div>
  )
}

const s = {
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
  titulo: { fontSize: '1.8rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif', fontWeight: '700', marginBottom: '4px' },
  subtitulo: { color: 'var(--texto-apagado)', fontSize: '0.9rem' },
  btnNova: { background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  buscaWrapper: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', marginBottom: '24px' },
  inputBusca: { flex: 1, background: 'none', border: 'none', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none' },
  vazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '4px' },
  secao: { marginBottom: '32px' },
  secaoLabel: { fontSize: '0.75rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--borda)' },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' },

  // Card
  card: { borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--borda)', transition: 'transform 0.15s', cursor: 'default', overflow: 'hidden', minWidth: 0 },
  cardTopo: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' },
  cardTitulo: { fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '0.95rem', color: 'var(--texto)', margin: 0, flex: 1, lineHeight: '1.3', wordBreak: 'break-word', overflowWrap: 'break-word' },
  cardAcoes: { display: 'flex', gap: '2px', flexShrink: 0 },
  btnIcone: { background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' },
  cardTexto: { flex: 1, minWidth: 0, overflow: 'hidden' },
  cardTextoP: { fontSize: '0.85rem', color: 'var(--texto-card)', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' },
  btnVerMais: { background: 'none', border: 'none', color: 'var(--verde)', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 0', fontFamily: 'Inter, sans-serif' },
  cardData: { fontSize: '0.7rem', color: 'var(--texto-apagado)', margin: 0 },

  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  modalTituloTexto: { fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '1rem', color: 'var(--texto)' },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  // Modal
  fundo: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 },
  modal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', maxWidth: '480px', background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '16px', zIndex: 1001, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden' },
  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  modalTitulo: { fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '1rem', color: 'var(--texto)' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', width: '100%', fontFamily: 'Inter, sans-serif', outline: 'none' },
  textarea: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', width: '100%', fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical', lineHeight: '1.5' },
  coresWrapper: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  corBtn: { width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--borda)', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 },
  fixarLabel: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  toggle: { width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  toggleBolinha: { position: 'absolute', top: '2px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', transition: 'transform 0.2s' },
  btnCancelar: { flex: 1, padding: '10px', borderRadius: '10px', background: 'none', border: '1px solid var(--borda)', color: 'var(--texto-apagado)', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  btnSalvar: { flex: 1, padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', border: 'none', color: '#fff', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px', margin: 0 },
}
