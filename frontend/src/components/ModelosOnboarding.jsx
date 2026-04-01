import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useToast } from './Toast'

// ── Componente de lista drag-and-drop para ordenar setores ──
function ListaOrdenavel({ itens, onChange }) {
  const [arrastando, setArrastando] = useState(null)
  const sobreRef = useRef(null)

  const onDragStart = (e, idx) => {
    setArrastando(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e, idx) => {
    e.preventDefault()
    sobreRef.current = idx
  }
  const onDrop = () => {
    if (arrastando === null || sobreRef.current === null) return
    const novaLista = [...itens]
    const [item] = novaLista.splice(arrastando, 1)
    novaLista.splice(sobreRef.current, 0, item)
    onChange(novaLista)
    setArrastando(null)
    sobreRef.current = null
  }

  return (
    <div>
      <p style={{ fontSize: '0.75rem', color: 'var(--texto-apagado)', marginBottom: '8px' }}>
        ↕ Arraste para reordenar as etapas do fluxo
      </p>
      {itens.map((item, idx) => (
        <div
          key={item._id}
          draggable
          onDragStart={e => onDragStart(e, idx)}
          onDragOver={e => onDragOver(e, idx)}
          onDrop={onDrop}
          style={{
            ...s.setorOrdem,
            opacity: arrastando === idx ? 0.4 : 1,
            cursor: 'grab'
          }}
        >
          <span style={s.ordemNumero}>{idx + 1}</span>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.cor, flexShrink: 0 }} />
          <span style={s.ordemNome}>{item.nome}</span>
          <span style={s.dragHandle}>⠿</span>
        </div>
      ))}
    </div>
  )
}

// ── Formulário de criação/edição de modelo ──
function FormModelo({ modelo, fechar, onSalvo }) {
  const [nome, setNome] = useState(modelo?.nome || '')
  const [descricao, setDescricao] = useState(modelo?.descricao || '')
  const [setoresDisponiveis, setSetoresDisponiveis] = useState([])
  const [setoresSelecionados, setSetoresSelecionados] = useState([])
  const [tarefasPorSetor, setTarefasPorSetor] = useState({}) // { setorId: [tarefa] }
  const [todasTarefas, setTodasTarefas] = useState([])
  const [buscaTarefa, setBuscaTarefa] = useState({}) // { setorId: texto }
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const { mostrar: toast } = useToast()

  useEffect(() => {
    const carregar = async () => {
      try {
        const [resSetores, resChecklist] = await Promise.all([
          api.get('/setores'),
          api.get('/checklist')
        ])
        setSetoresDisponiveis(resSetores.data)
        setTodasTarefas(resChecklist.data)

        // Se editando, pré-preenche
        if (modelo) {
          const setoresOrdenados = [...modelo.setores].sort((a, b) => a.ordem - b.ordem)
          setSetoresSelecionados(setoresOrdenados.map(s => s.setor))
          const mapa = {}
          setoresOrdenados.forEach(s => {
            mapa[s.setor._id] = s.tarefas || []
          })
          setTarefasPorSetor(mapa)
        }
      } catch { toast('Erro ao carregar dados.', 'erro') }
    }
    carregar()
  }, [])

  const toggleSetor = (setor) => {
    setSetoresSelecionados(prev => {
      const jaEsta = prev.find(s => s._id === setor._id)
      if (jaEsta) {
        // Remove setor e suas tarefas
        const novo = prev.filter(s => s._id !== setor._id)
        setTarefasPorSetor(t => { const n = { ...t }; delete n[setor._id]; return n })
        return novo
      }
      return [...prev, setor]
    })
  }

  const adicionarTarefa = (setorId, tarefa) => {
    setTarefasPorSetor(prev => {
      const lista = prev[setorId] || []
      if (lista.find(t => t._id === tarefa._id)) return prev
      return { ...prev, [setorId]: [...lista, tarefa] }
    })
    setBuscaTarefa(prev => ({ ...prev, [setorId]: '' }))
  }

  const removerTarefa = (setorId, tarefaId) => {
    setTarefasPorSetor(prev => ({
      ...prev,
      [setorId]: (prev[setorId] || []).filter(t => t._id !== tarefaId)
    }))
  }

  const salvar = async () => {
    if (!nome.trim()) return setErro('Nome do modelo é obrigatório.')
    if (setoresSelecionados.length === 0) return setErro('Selecione pelo menos um setor.')
    setCarregando(true); setErro('')
    try {
      const setores = setoresSelecionados.map((s, idx) => ({
        setor: s._id,
        ordem: idx + 1,
        tarefas: (tarefasPorSetor[s._id] || []).map(t => t._id)
      }))
      if (modelo?._id) {
        await api.put(`/modelos-onboarding/${modelo._id}`, { nome, descricao, setores })
        toast('Modelo atualizado!', 'sucesso')
      } else {
        await api.post('/modelos-onboarding', { nome, descricao, setores })
        toast('Modelo criado!', 'sucesso')
      }
      onSalvo(); fechar()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar modelo.')
    } finally { setCarregando(false) }
  }

  return (
    <div style={s.overlay} onClick={fechar}>
      <div style={{ ...s.modal, maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={s.modalTopo}>
          <span style={s.modalTitulo}>{modelo ? 'Editar modelo' : 'Novo modelo'}</span>
          <button style={s.btnX} onClick={fechar}>✕</button>
        </div>

        <div style={s.modalCorpo}>
          {erro && <p style={s.erro}>{erro}</p>}

          {/* Nome e descrição */}
          <div style={s.campo}>
            <label style={s.label}>Nome do modelo</label>
            <input style={s.input} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Simples Nacional + Comércio" autoFocus />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Descrição (opcional)</label>
            <input style={s.input} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Breve descrição do modelo" />
          </div>

          {/* Seleção de setores */}
          <div style={s.campo}>
            <label style={s.label}>Setores participantes</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {setoresDisponiveis.map(setor => {
                const ativo = setoresSelecionados.find(s => s._id === setor._id)
                return (
                  <button
                    key={setor._id}
                    onClick={() => toggleSetor(setor)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '99px', cursor: 'pointer',
                      fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', fontWeight: '500',
                      border: ativo ? `2px solid ${setor.cor}` : '1px solid #2A3830',
                      background: ativo ? `${setor.cor}22` : 'transparent',
                      color: ativo ? setor.cor : 'var(--texto-apagado)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: setor.cor }} />
                    {setor.nome}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tarefas por setor */}
          {setoresSelecionados.map(setor => {
            const tarefasDoSetor = todasTarefas.filter(t => t.setor?._id === setor._id || t.setor === setor._id)
            const selecionadas = tarefasPorSetor[setor._id] || []
            const busca = buscaTarefa[setor._id] || ''
            const filtradas = tarefasDoSetor.filter(t =>
              t.descricao.toLowerCase().includes(busca.toLowerCase()) &&
              !selecionadas.find(s => s._id === t._id)
            )

            return (
              <div key={setor._id} style={s.setorBloco}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: setor.cor }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' }}>{setor.nome}</span>
                </div>

                {/* Tarefas selecionadas */}
                {selecionadas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    {selecionadas.map(t => (
                      <div key={t._id} style={s.tarefaSelecionada}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--texto)', flex: 1 }}>{t.descricao}</span>
                        <button onClick={() => removerTarefa(setor._id, t._id)} style={s.btnRemoverTarefa}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Busca de tarefa */}
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...s.input, fontSize: '0.82rem' }}
                    placeholder="Buscar e adicionar tarefa..."
                    value={busca}
                    onChange={e => setBuscaTarefa(prev => ({ ...prev, [setor._id]: e.target.value }))}
                  />
                  {busca && filtradas.length > 0 && (
                    <div style={s.dropdown}>
                      {filtradas.slice(0, 5).map(t => (
                        <button key={t._id} style={s.dropdownItem} onClick={() => adicionarTarefa(setor._id, t)}>
                          {t.descricao}
                        </button>
                      ))}
                    </div>
                  )}
                  {busca && filtradas.length === 0 && (
                    <div style={s.dropdown}>
                      <p style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--texto-apagado)', margin: 0 }}>
                        Nenhuma tarefa encontrada. Crie primeiro na aba Tarefas.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Ordenação dos setores */}
          {setoresSelecionados.length > 1 && (
            <div style={s.campo}>
              <label style={s.label}>Ordem do fluxo</label>
              <ListaOrdenavel itens={setoresSelecionados} onChange={setSetoresSelecionados} />
            </div>
          )}
        </div>

        <div style={s.modalRodape}>
          <button style={s.btnCancelar} onClick={fechar}>Cancelar</button>
          <button style={s.btnSalvar} onClick={salvar} disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar modelo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tela principal de Modelos ──
export default function ModelosOnboarding() {
  const [modelos, setModelos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [modeloEditando, setModeloEditando] = useState(null)
  const { mostrar: toast } = useToast()

  const buscar = async () => {
    setCarregando(true)
    try {
      const res = await api.get('/modelos-onboarding')
      setModelos(res.data)
    } catch { toast('Erro ao carregar modelos.', 'erro') }
    finally { setCarregando(false) }
  }

  useEffect(() => { buscar() }, [])

  const excluir = async (id) => {
    if (!confirm('Remover este modelo?')) return
    try {
      await api.delete(`/modelos-onboarding/${id}`)
      toast('Modelo removido.', 'sucesso')
      buscar()
    } catch { toast('Erro ao remover modelo.', 'erro') }
  }

  const abrir = (modelo = null) => { setModeloEditando(modelo); setFormAberto(true) }

  return (
    <div>
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Modelos de onboarding</h1>
          <p style={s.subtitulo}>Crie templates para agilizar a entrada de novos clientes</p>
        </div>
        <button style={s.btnNovo} onClick={() => abrir()}>+ Novo modelo</button>
      </div>

      {carregando ? (
        <p style={s.vazio}>Carregando...</p>
      ) : modelos.length === 0 ? (
        <div style={s.vazioBox}>
          <p style={{ color: 'var(--texto-apagado)', marginBottom: '12px' }}>Nenhum modelo criado ainda.</p>
          <button style={s.btnNovo} onClick={() => abrir()}>Criar primeiro modelo</button>
        </div>
      ) : (
        <div style={s.grid}>
          {modelos.map(m => (
            <div key={m._id} style={s.card}>
              <div style={{ flex: 1 }}>
                <p style={s.cardNome}>{m.nome}</p>
                {m.descricao && <p style={s.cardDesc}>{m.descricao}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                  {[...m.setores].sort((a, b) => a.ordem - b.ordem).map((s2, idx) => (
                    <span key={idx} style={{
                      fontSize: '0.72rem', padding: '3px 10px', borderRadius: '99px',
                      background: `${s2.setor?.cor || '#2DAA59'}22`,
                      color: s2.setor?.cor || '#2DAA59', fontWeight: '500'
                    }}>
                      {s2.ordem}. {s2.setor?.nome}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <button style={s.btnAcao} onClick={() => abrir(m)}>Editar</button>
                <button style={{ ...s.btnAcao, color: '#FCA5A5' }} onClick={() => excluir(m._id)}>Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formAberto && (
        <FormModelo
          modelo={modeloEditando}
          fechar={() => { setFormAberto(false); setModeloEditando(null) }}
          onSalvo={buscar}
        />
      )}
    </div>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  titulo: { fontSize: '1.4rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif' },
  subtitulo: { fontSize: '0.85rem', color: 'var(--texto-apagado)', marginTop: '4px', fontFamily: 'Inter, sans-serif' },
  btnNovo: {
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '10px 20px', fontFamily: 'Inter, sans-serif',
    fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer'
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' },
  card: {
    background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '14px',
    padding: '18px', display: 'flex', flexDirection: 'column'
  },
  cardNome: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif' },
  cardDesc: { fontSize: '0.8rem', color: 'var(--texto-apagado)', marginTop: '4px', fontFamily: 'Inter, sans-serif' },
  btnAcao: {
    background: 'none', border: '1px solid #2A3830', borderRadius: '8px',
    color: 'var(--texto-apagado)', fontSize: '0.8rem', cursor: 'pointer',
    padding: '6px 12px', fontFamily: 'Inter, sans-serif'
  },
  vazio: { color: 'var(--texto-apagado)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' },
  vazioBox: { textAlign: 'center', marginTop: '60px' },
  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
  },
  modal: {
    background: 'var(--sidebar)', border: '1px solid #2A3830',
    borderRadius: '20px', width: '100%',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
  },
  modalTopo: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px', borderBottom: '1px solid #2A3830'
  },
  modalTitulo: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  btnX: {
    background: 'none', border: '1px solid #2A3830', borderRadius: '6px',
    color: 'var(--texto-apagado)', width: '28px', height: '28px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', cursor: 'pointer'
  },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' },
  modalRodape: {
    display: 'flex', gap: '12px', justifyContent: 'flex-end',
    padding: '16px 24px', borderTop: '1px solid #2A3830'
  },
  campo: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Inter, sans-serif' },
  input: {
    background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '10px',
    padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem',
    fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box'
  },
  btnCancelar: {
    background: 'none', border: '1px solid #2A3830', borderRadius: '10px',
    color: 'var(--texto-apagado)', padding: '10px 20px',
    fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer'
  },
  btnSalvar: {
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '10px 20px', fontFamily: 'Inter, sans-serif',
    fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer'
  },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px' },
  setorBloco: {
    background: 'var(--input-2)', border: '1px solid #2A3830', borderRadius: '12px', padding: '16px'
  },
  tarefaSelecionada: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: '8px', padding: '7px 12px'
  },
  btnRemoverTarefa: {
    background: 'none', border: 'none', color: 'var(--texto-apagado)',
    cursor: 'pointer', fontSize: '11px', padding: '0 2px', lineHeight: 1
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
    background: 'var(--sidebar)', border: '1px solid #2A3830', borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: '4px', overflow: 'hidden'
  },
  dropdownItem: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '10px 14px', background: 'none', border: 'none',
    color: 'var(--texto)', fontSize: '0.82rem', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', borderBottom: '1px solid #2A3830'
  },
  setorOrdem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '8px',
    padding: '10px 14px', marginBottom: '6px', userSelect: 'none'
  },
  ordemNumero: {
    width: '20px', height: '20px', borderRadius: '50%',
    background: 'rgba(34,197,94,0.15)', color: 'var(--verde)',
    fontSize: '0.75rem', fontWeight: '700', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  ordemNome: { fontSize: '0.85rem', color: 'var(--texto)', flex: 1, fontFamily: 'Inter, sans-serif' },
  dragHandle: { color: 'var(--texto-apagado)', fontSize: '16px', letterSpacing: '2px' }
}
