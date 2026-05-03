import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from './Toast'
import ModalConfirmacao from './ModalConfirmacao'

const REGIMES = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'mei', label: 'MEI' },
  { value: 'outro', label: 'Outro' },
]

const TIPOS = [
  { value: 'servico', label: 'Serviço' },
  { value: 'comercio', label: 'Comércio' },
  { value: 'ambos', label: 'Serviço + Comércio' },
]

function mascaraCNPJ(valor) {
  return valor
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function labelRegime(value) {
  return REGIMES.find(r => r.value === value)?.label || '—'
}

function labelTipo(value) {
  return TIPOS.find(t => t.value === value)?.label || '—'
}

function ModalCliente({ cliente, onFechar, onSalvo }) {
  const [form, setForm] = useState({
    nome: cliente?.nome || '',
    cnpj: cliente?.cnpj || '',
    regime: cliente?.regime || '',
    tipo: cliente?.tipo || '',
    observacoes: cliente?.observacoes || '',
    inicioServicos: cliente?.inicioServicos ? new Date(cliente.inicioServicos).toISOString().split('T')[0] : '',
  })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const { mostrar } = useToast()

  const salvar = async () => {
    if (!form.nome.trim()) return setErro('Nome é obrigatório.')
    setCarregando(true); setErro('')
    try {
      if (cliente?._id) {
        await api.put(`/clientes/${cliente._id}`, form)
        mostrar('Cliente atualizado!')
      } else {
        await api.post('/clientes', form)
        mostrar('Cliente adicionado!')
      }
      onSalvo()
      onFechar()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar cliente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={s.overlay} onClick={onFechar}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalTopo}>
          <span style={s.modalTitulo}>{cliente ? 'Editar cliente' : 'Novo cliente'}</span>
          <button style={s.btnX} onClick={onFechar}>✕</button>
        </div>
        <div style={s.modalCorpo}>
          {erro && <p style={s.erro}>{erro}</p>}

          <div style={s.campo}>
            <label style={s.label}>Nome da empresa</label>
            <input style={s.input} placeholder="Ex: Padaria do João LTDA"
              value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} autoFocus />
          </div>

          <div style={s.campo}>
            <label style={s.label}>CNPJ</label>
            <input style={s.input} placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={e => setForm({ ...form, cnpj: mascaraCNPJ(e.target.value) })}
              maxLength={18} />
          </div>

          <div style={s.grid2}>
            <div style={s.campo}>
              <label style={s.label}>Regime tributário</label>
              <select style={s.input} value={form.regime} onChange={e => setForm({ ...form, regime: e.target.value })}>
                <option value="">Selecionar...</option>
                {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={s.campo}>
              <label style={s.label}>Tipo de atividade</label>
              <select style={s.input} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="">Selecionar...</option>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div style={s.campo}>
            <label style={s.label}>Data de início dos serviços <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
            <input style={s.input} type="date" value={form.inicioServicos} onChange={e => setForm({ ...form, inicioServicos: e.target.value })} />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Observações <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
            <textarea style={{ ...s.input, resize: 'vertical', minHeight: '80px', lineHeight: '1.5' }}
              placeholder="Informações adicionais..."
              value={form.observacoes}
              onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <div style={s.modalRodape}>
          <button style={s.btnCancelar} onClick={onFechar}>Cancelar</button>
          <button style={s.btnSalvar} onClick={salvar} disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroRegime, setFiltroRegime] = useState('')
  const { mostrar } = useToast()

  const carregar = async () => {
    setCarregando(true)
    try {
      const res = await api.get('/clientes')
      setClientes(res.data)
    } catch {
      mostrar('Erro ao carregar clientes.', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const excluir = async (id) => {
    try {
      await api.delete(`/clientes/${id}`)
      mostrar('Cliente removido.', 'aviso')
      setConfirmandoId(null)
      carregar()
    } catch {
      mostrar('Erro ao remover cliente.', 'erro')
    }
  }

  const abrir = (cliente = null) => {
    setEditando(cliente)
    setModalAberto(true)
  }

  const clientesFiltrados = clientes.filter(c => {
    const matchBusca = !busca ||
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.cnpj.includes(busca)
    const matchRegime = !filtroRegime || c.regime === filtroRegime
    return matchBusca && matchRegime
  })

  return (
    <div>
      {/* Cabeçalho */}
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Clientes</h1>
          <p style={s.subtitulo}>{clientes.length} cliente(s) na carteira</p>
        </div>
        <button style={s.btnNovo} onClick={() => abrir()}>+ Novo cliente</button>
      </div>

      {/* Filtros */}
      {clientes.length > 0 && (
        <div style={s.filtros}>
          <div style={s.buscaWrapper}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--texto-apagado)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={s.inputBusca} placeholder="Buscar por nome ou CNPJ..."
              value={busca} onChange={e => setBusca(e.target.value)} />
            {busca && <button style={s.btnLimpar} onClick={() => setBusca('')}>✕</button>}
          </div>
          <select style={s.selectFiltro} value={filtroRegime} onChange={e => setFiltroRegime(e.target.value)}>
            <option value="">Todos os regimes</option>
            {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {(busca || filtroRegime) && (
            <button style={s.btnLimparFiltros} onClick={() => { setBusca(''); setFiltroRegime('') }}>
              Limpar
            </button>
          )}
        </div>
      )}

      {/* Estado vazio */}
      {!carregando && clientes.length === 0 && (
        <div style={s.vazio}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--borda)" strokeWidth="1.2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p style={{ color: 'var(--texto-apagado)', marginTop: '16px', fontSize: '0.95rem' }}>Nenhum cliente cadastrado ainda.</p>
          <p style={{ color: 'var(--texto-apagado)', fontSize: '0.82rem', marginTop: '4px' }}>Clique em "+ Novo cliente" para começar.</p>
        </div>
      )}

      {/* Tabela */}
      {clientesFiltrados.length > 0 && (
        <div style={s.tabelaWrapper}>
          {/* Header */}
          <div style={s.tabelaHeader}>
            <span style={{ flex: 2 }}>Cliente</span>
            <span style={{ flex: 1.5 }}>CNPJ</span>
            <span style={{ flex: 1 }}>Regime</span>
            <span style={{ flex: 1 }}>Atividade</span>
            <span style={{ width: '80px' }}></span>
          </div>

          {/* Linhas */}
          {clientesFiltrados.map((c, i) => (
            <div key={c._id} style={{ ...s.tabelaLinha, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
              <div style={{ flex: 2, minWidth: 0 }}>
                <p style={s.clienteNome}>{c.nome}</p>
              </div>
              <div style={{ flex: 1.5 }}>
                <p style={s.clienteCnpj}>{c.cnpj || <span style={{ color: 'var(--borda)' }}>—</span>}</p>
              </div>
              <div style={{ flex: 1 }}>
                {c.regime
                  ? <span style={s.badge}>{labelRegime(c.regime)}</span>
                  : <span style={{ color: 'var(--borda)', fontSize: '0.82rem' }}>—</span>
                }
              </div>
              <div style={{ flex: 1 }}>
                {c.tipo
                  ? <span style={{ ...s.badge, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.2)' }}>{labelTipo(c.tipo)}</span>
                  : <span style={{ color: 'var(--borda)', fontSize: '0.82rem' }}>—</span>
                }
              </div>
              <div style={{ width: '80px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button style={s.btnAcao} onClick={() => abrir(c)}>Editar</button>
                <button style={{ ...s.btnAcao, color: '#f87171', borderColor: 'rgba(248,113,113,0.2)' }} onClick={() => setConfirmandoId(c._id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sem resultados */}
      {clientesFiltrados.length === 0 && clientes.length > 0 && (
        <div style={s.vazio}>
          <p style={{ color: 'var(--texto-apagado)' }}>Nenhum cliente encontrado com esses filtros.</p>
        </div>
      )}

      {modalAberto && (
        <ModalCliente
          cliente={editando}
          onFechar={() => { setModalAberto(false); setEditando(null) }}
          onSalvo={carregar}
        />
      )}
      {confirmandoId && (
        <ModalConfirmacao
          titulo="Remover cliente"
          mensagem="Tem certeza que deseja remover este cliente da carteira?"
          textoBotao="Remover" perigo
          onConfirmar={() => excluir(confirmandoId)}
          onCancelar={() => setConfirmandoId(null)}
        />
      )}
    </div>
  )
}

const s = {
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' },
  titulo: { fontSize: '1.75rem', fontWeight: '700', color: 'var(--texto)', letterSpacing: '-0.03em', marginBottom: '4px' },
  subtitulo: { fontSize: '0.875rem', color: 'var(--texto-apagado)' },
  btnNovo: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,177,65,0.3)' },
  filtros: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' },
  buscaWrapper: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '9px 14px', flex: 1, minWidth: '200px' },
  inputBusca: { flex: 1, background: 'none', border: 'none', color: 'var(--texto)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', outline: 'none' },
  btnLimpar: { background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontSize: '12px', padding: '0 2px' },
  selectFiltro: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '9px 12px', color: 'var(--texto)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', cursor: 'pointer' },
  btnLimparFiltros: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', padding: '9px 14px', color: 'var(--texto-apagado)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  vazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: '4px' },
  tabelaWrapper: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--sombra-card)' },
  tabelaHeader: { display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--borda)', background: 'rgba(255,255,255,0.02)', fontSize: '0.68rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  tabelaLinha: { display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px', borderBottom: '1px solid var(--borda)', transition: 'background 0.15s' },
  clienteNome: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--texto)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  clienteCnpj: { fontSize: '0.82rem', color: 'var(--texto-apagado)', margin: 0, fontFamily: 'monospace', letterSpacing: '0.5px' },
  badge: { display: 'inline-block', fontSize: '0.72rem', fontWeight: '600', padding: '3px 9px', borderRadius: '6px', background: 'var(--verde-glow)', color: 'var(--verde)', border: '1px solid rgba(0,177,65,0.2)' },
  btnAcao: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', fontSize: '0.78rem', cursor: 'pointer', padding: '4px 10px', fontFamily: 'Inter, sans-serif' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' },
  modal: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '20px', width: '100%', maxWidth: '500px', boxShadow: 'var(--sombra-elevada)', maxHeight: '90vh', overflowY: 'auto' },
  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  modalTitulo: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalRodape: { display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--borda)' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { fontSize: '0.68rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'Inter, sans-serif' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' },
  btnCancelar: { background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnSalvar: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  erro: { color: '#f87171', fontSize: '0.8rem', background: 'rgba(248,113,113,0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)' },
}
