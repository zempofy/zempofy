import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useToast } from './Toast'

// ── Mapa mental horizontal da implantação ──
function DetalheImplantacao({ implantacao: inicial, voltar, onAtualizado }) {
  const [implantacao, setImplantacao] = useState(inicial)
  const [etapaSelecionada, setEtapaSelecionada] = useState(
    () => inicial.etapas.find(e => e.status === 'em_andamento') || inicial.etapas[0]
  )
  const mapaRef = useRef(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const { mostrar: toast } = useToast()
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)

  const excluir = async () => {
    try {
      await api.delete(`/implantacoes/${implantacao._id}`)
      toast('Onboarding excluído.', 'aviso')
      voltar()
    } catch {
      toast('Erro ao excluir onboarding.', 'erro')
    }
  }

  const recarregar = async () => {
    try {
      const res = await api.get(`/implantacoes/${implantacao._id}`)
      setImplantacao(res.data)
      const atual = res.data.etapas.find(e => e._id === etapaSelecionada._id)
      if (atual) setEtapaSelecionada(atual)
      onAtualizado()
    } catch { toast('Erro ao atualizar.', 'erro') }
  }

  useEffect(() => { recarregar() }, [])

  // Drag to scroll
  const onMouseDown = (e) => {
    isDragging.current = true
    startX.current = e.pageX - mapaRef.current.offsetLeft
    scrollLeft.current = mapaRef.current.scrollLeft
    mapaRef.current.style.cursor = 'grabbing'
  }
  const onMouseUp = () => {
    isDragging.current = false
    if (mapaRef.current) mapaRef.current.style.cursor = 'grab'
  }
  const onMouseMove = (e) => {
    if (!isDragging.current) return
    e.preventDefault()
    const x = e.pageX - mapaRef.current.offsetLeft
    mapaRef.current.scrollLeft = scrollLeft.current - (x - startX.current)
  }

  const progresso = () => {
    const total = implantacao.etapas.length
    const conc = implantacao.etapas.filter(e => e.status === 'concluida').length
    return total > 0 ? Math.round((conc / total) * 100) : 0
  }

  const etapaExibida = implantacao.etapas.find(e => e._id === etapaSelecionada._id) || etapaSelecionada
  const concEtapas = implantacao.etapas.filter(e => e.status === 'concluida').length

  return (
    <div>
      {/* Modal confirmação exclusão */}
      {confirmandoExcluir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmandoExcluir(false)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '18px', width: '100%', maxWidth: '400px', margin: '0 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px' }}>
              <p style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', marginBottom: '10px', fontFamily: 'Inter, sans-serif' }}>Excluir onboarding</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--texto-apagado)', lineHeight: '1.6', margin: 0 }}>
                Tem certeza que deseja excluir o onboarding de <strong style={{ color: 'var(--texto)' }}>{implantacao.nomeCliente}</strong>? Todas as tarefas geradas também serão removidas. Essa ação não pode ser desfeita.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '14px 24px', borderTop: '1px solid var(--borda)' }}>
              <button style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto-apagado)', padding: '9px 18px', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', cursor: 'pointer' }}
                onClick={() => setConfirmandoExcluir(false)}>Cancelar</button>
              <button style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', color: '#f87171', padding: '9px 18px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }}
                onClick={excluir}>Sim, excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Voltar */}
      <button style={s.btnVoltar} onClick={voltar}>← Onboarding</button>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={s.titulo}>{implantacao.nomeCliente}</h1>
          <p style={s.subtitulo}>
            {implantacao.cnpj && `${implantacao.cnpj} · `}
            {implantacao.modelo?.nome && `${implantacao.modelo.nome} · `}
            Iniciado em {new Date(implantacao.criadoEm).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <button
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '10px', color: '#f87171', padding: '9px 18px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
          onClick={() => setConfirmandoExcluir(true)}
        >
          Excluir onboarding
        </button>
      </div>

      {/* Card do mapa */}
      <div style={s.mapaCard}>
        {/* Topo do card: progresso */}
        <div style={s.mapaCardTopo}>
          <span style={s.mapaProgLabel}>{concEtapas} de {implantacao.etapas.length} etapas concluídas</span>
          <div style={s.mapaBaraBg}>
            <div style={{ ...s.mapaBaraFill, width: `${progresso()}%` }} />
          </div>
          <span style={s.mapaProgPct}>{progresso()}%</span>
        </div>

        {/* Mapa horizontal arrastável */}
        <div
          ref={mapaRef}
          style={s.mapaScroll}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseMove={onMouseMove}
        >
          <div style={s.mapaFlex}>
            {implantacao.etapas.map((etapa, idx) => {
              const cor = etapa.setor?.cor || '#2DAA59'
              const ativa = etapa._id === etapaExibida._id
              const concluida = etapa.status === 'concluida'
              const bloqueada = etapa.status === 'bloqueada'
              const concTarefas = etapa.tarefas.filter(t => t.status === 'concluida').length
              const totalTarefas = etapa.tarefas.length

              return (
                <div key={etapa._id} style={{ display: 'flex', alignItems: 'center' }}>
                  {/* Box do setor */}
                  <div
                    style={{
                      ...s.setorBox,
                      borderColor: ativa ? cor : concluida ? '#2DAA59' : 'rgba(255,255,255,0.08)',
                      background: ativa ? `${cor}12` : concluida ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
                      opacity: bloqueada ? 0.35 : 1,
                      cursor: bloqueada ? 'default' : 'pointer',
                      outline: ativa ? `2px solid ${cor}` : 'none',
                      outlineOffset: '3px',
                    }}
                    onClick={() => !bloqueada && setEtapaSelecionada(etapa)}
                  >
                    {/* Ícone de status */}
                    <div style={{
                      ...s.setorIcone,
                      background: concluida ? '#2DAA59' : ativa ? `${cor}22` : 'rgba(255,255,255,0.06)',
                      border: concluida ? '2px solid #2DAA59' : ativa ? `1.5px solid ${cor}` : '1px solid rgba(255,255,255,0.1)',
                      color: concluida ? '#fff' : ativa ? cor : 'rgba(255,255,255,0.3)',
                    }}>
                      {concluida
                        ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1.5 6 4.5 9 10.5 3"/></svg>
                        : <span style={{ fontSize: '11px', fontWeight: '700', fontFamily: 'Inter, sans-serif' }}>{idx + 1}</span>
                      }
                    </div>

                    {/* Nome */}
                    <span style={{
                      ...s.setorNome,
                      color: ativa ? cor : concluida ? '#2DAA59' : 'var(--texto-apagado)',
                      fontWeight: ativa ? '600' : '400',
                    }}>
                      {etapa.setor?.nome}
                    </span>

                    {/* Contagem de tarefas */}
                    {totalTarefas > 0 && (
                      <span style={{
                        ...s.setorCount,
                        color: concluida ? '#2DAA59' : ativa ? cor : 'var(--texto-apagado)',
                        background: concluida ? 'rgba(34,197,94,0.12)' : ativa ? `${cor}18` : 'rgba(255,255,255,0.05)',
                      }}>
                        {concTarefas}/{totalTarefas}
                      </span>
                    )}
                  </div>

                  {/* Conector */}
                  {idx < implantacao.etapas.length - 1 && (
                    <div style={{
                      ...s.conector,
                      background: concluida ? '#2DAA59' : 'rgba(255,255,255,0.08)',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
          <p style={s.mapaHint}>← arraste para navegar →</p>
        </div>

        {/* Painel de tarefas */}
        {etapaExibida && (
          <div style={s.painel}>
            <div style={s.painelHeader}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: etapaExibida.setor?.cor || '#2DAA59', flexShrink: 0 }} />
              <span style={s.painelTitulo}>{etapaExibida.setor?.nome}</span>
              {etapaExibida.status === 'bloqueada' && (
                <span style={s.badgeBloqueado}>Bloqueada</span>
              )}
              {etapaExibida.status === 'concluida' && (
                <span style={{ ...s.badgeBloqueado, background: 'rgba(34,197,94,0.12)', color: '#2DAA59', border: '1px solid rgba(34,197,94,0.2)' }}>Concluída</span>
              )}
              {etapaExibida.status === 'em_andamento' && (
                <span style={{ ...s.badgeBloqueado, background: 'rgba(55,138,221,0.12)', color: '#5BAAFF', border: '1px solid rgba(55,138,221,0.2)' }}>Em andamento</span>
              )}
            </div>

            {etapaExibida.status === 'bloqueada' ? (
              <p style={{ color: 'var(--texto-apagado)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>
                Esta etapa será liberada quando a anterior for concluída.
              </p>
            ) : etapaExibida.tarefas.length === 0 ? (
              <p style={{ color: 'var(--texto-apagado)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>Nenhuma atividade nesta etapa.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {etapaExibida.tarefas.map(tarefaEtapa => {
                  const feita = tarefaEtapa.status === 'concluida'
                  return (
                    <div key={tarefaEtapa._id} style={{ ...s.tarefaItem, opacity: feita ? 0.65 : 1 }}>
                      <div style={{
                        ...s.tarefaCheck,
                        background: feita ? '#2DAA59' : 'transparent',
                        borderColor: feita ? '#2DAA59' : 'rgba(255,255,255,0.15)',
                      }}>
                        {feita && (
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="1.5 5 4 7.5 8.5 2.5"/>
                          </svg>
                        )}
                      </div>
                      <span style={{
                        ...s.tarefaTexto,
                        textDecoration: feita ? 'line-through' : 'none',
                        color: feita ? 'var(--texto-apagado)' : 'var(--texto)',
                      }}>
                        {tarefaEtapa.tarefa?.descricao || 'Atividade'}
                      </span>
                      {tarefaEtapa.tarefa?.responsavel?.nome && (
                        <span style={s.tarefaResp}>{tarefaEtapa.tarefa.responsavel.nome}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal para nova implantação ──
function ModalNovaImplantacao({ fechar, onCriado }) {
  const [nomeCliente, setNomeCliente] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [modeloId, setModeloId] = useState('')
  const [modelos, setModelos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const { mostrar: toast } = useToast()
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)

  useEffect(() => {
    api.get('/modelos-onboarding').then(r => setModelos(r.data)).catch(() => {})
  }, [])

  const criar = async () => {
    if (!nomeCliente.trim()) return setErro('Nome do cliente é obrigatório.')
    setCarregando(true); setErro('')
    try {
      await api.post('/implantacoes', { nomeCliente, cnpj, modeloId: modeloId || undefined })
      toast('Implantação criada!', 'sucesso')
      onCriado(); fechar()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar implantação.')
    } finally { setCarregando(false) }
  }

  return (
    <div style={s.overlay} onClick={fechar}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalTopo}>
          <span style={s.modalTitulo}>Nova implantação</span>
          <button style={s.btnX} onClick={fechar}>✕</button>
        </div>
        <div style={s.modalCorpo}>
          {erro && <p style={s.erro}>{erro}</p>}
          <div style={s.campo}>
            <label style={s.label}>Nome do cliente</label>
            <input style={s.input} value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} placeholder="Razão social ou nome fantasia" autoFocus />
          </div>
          <div style={s.campo}>
            <label style={s.label}>CNPJ (opcional)</label>
            <input style={s.input} value={cnpj}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 14)
                  .replace(/^(\d{2})(\d)/, '$1.$2')
                  .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                  .replace(/\.(\d{3})(\d)/, '.$1/$2')
                  .replace(/(\d{4})(\d)/, '$1-$2')
                setCnpj(v)
              }}
              placeholder="00.000.000/0000-00" maxLength={18} />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Modelo de onboarding</label>
            <select style={s.input} value={modeloId} onChange={e => setModeloId(e.target.value)}>
              <option value="">Sem modelo (criar manualmente)</option>
              {modelos.map(m => <option key={m._id} value={m._id}>{m.nome}</option>)}
            </select>
          </div>
        </div>
        <div style={s.modalRodape}>
          <button style={s.btnCancelar} onClick={fechar}>Cancelar</button>
          <button style={s.btnSalvar} onClick={criar} disabled={carregando}>
            {carregando ? 'Criando...' : 'Criar implantação'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tela principal ──
export default function Implantacao() {
  const [implantacoes, setImplantacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [detalheSelecionado, setDetalheSelecionado] = useState(null)
  const { mostrar: toast } = useToast()
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)

  const buscar = async () => {
    setCarregando(true)
    try {
      const res = await api.get('/implantacoes')
      setImplantacoes(res.data)
    } catch { toast('Erro ao carregar implantações.', 'erro') }
    finally { setCarregando(false) }
  }

  useEffect(() => { buscar() }, [])

  if (detalheSelecionado) {
    return (
      <DetalheImplantacao
        implantacao={detalheSelecionado}
        voltar={() => { setDetalheSelecionado(null); buscar() }}
        onAtualizado={buscar}
      />
    )
  }

  const filtradas = implantacoes.filter(i =>
    i.nomeCliente.toLowerCase().includes(busca.toLowerCase()) ||
    (i.cnpj || '').includes(busca)
  )

  const progresso = (imp) => {
    const total = imp.etapas.length
    const concluidas = imp.etapas.filter(e => e.status === 'concluida').length
    return total > 0 ? Math.round((concluidas / total) * 100) : 0
  }

  const etapaAtual = (imp) => imp.etapas.find(e => e.status === 'em_andamento')

  const iniciais = (nome) => nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.titulo}>Onboarding</h1>
        <button style={s.btnNovo} onClick={() => setModalAberto(true)}>+ Nova empresa</button>
      </div>

      <input
        style={{ ...s.input, marginBottom: '20px' }}
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Pesquisar empresa..."
      />

      {carregando ? (
        <p style={s.vazio}>Carregando...</p>
      ) : filtradas.length === 0 ? (
        <div style={s.vazioBox}>
          <p style={{ color: 'var(--texto-apagado)', marginBottom: '12px' }}>
            {busca ? 'Nenhuma empresa encontrada.' : 'Nenhuma implantação em andamento.'}
          </p>
          {!busca && <button style={s.btnNovo} onClick={() => setModalAberto(true)}>Adicionar primeira empresa</button>}
        </div>
      ) : (
        <div style={s.grid}>
          {filtradas.map(imp => {
            const etapa = etapaAtual(imp)
            const pct = progresso(imp)
            return (
              <div key={imp._id} style={s.card} onClick={() => setDetalheSelecionado(imp)}>
                <div style={s.cardTopo}>
                  <div style={s.avatar}>{iniciais(imp.nomeCliente)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.cardNome}>{imp.nomeCliente}</p>
                    {imp.cnpj && <p style={s.cardCnpj}>{imp.cnpj}</p>}
                  </div>
                </div>
                <hr style={s.divisor} />
                <p style={s.labelMini}>Etapa atual</p>
                {etapa ? (
                  <span style={{ ...s.etapaBadge, background: `${etapa.setor?.cor || '#2DAA59'}22`, color: etapa.setor?.cor || '#2DAA59' }}>
                    {etapa.setor?.nome || 'Em andamento'}
                  </span>
                ) : (
                  <span style={{ ...s.etapaBadge, background: 'rgba(34,197,94,0.1)', color: '#2DAA59' }}>Concluído ✓</span>
                )}
                <p style={{ ...s.labelMini, marginTop: '10px' }}>Progresso</p>
                <div style={s.baraBg}>
                  <div style={{ ...s.baraFill, width: `${pct}%` }} />
                </div>
              </div>
            )
          })}

          {/* Card de adicionar */}
          <div style={{ ...s.card, ...s.cardAdd }} onClick={() => setModalAberto(true)}>
            <div style={s.addIcone}>+</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--texto-apagado)', margin: 0 }}>Nova empresa</p>
          </div>
        </div>
      )}

      {modalAberto && (
        <ModalNovaImplantacao fechar={() => setModalAberto(false)} onCriado={buscar} />
      )}
    </div>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  titulo: { fontSize: '1.4rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif' },
  subtitulo: { fontSize: '0.82rem', color: 'var(--texto-apagado)', marginTop: '4px', fontFamily: 'Inter, sans-serif' },
  btnNovo: {
    background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '10px 20px', fontFamily: 'Inter, sans-serif',
    fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer'
  },
  input: {
    background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '10px',
    padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem',
    fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box'
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },
  card: {
    background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '14px',
    padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.15s'
  },
  cardAdd: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '130px', border: '1.5px dashed #2A3830'
  },
  addIcone: {
    width: '32px', height: '32px', borderRadius: '50%', border: '1.5px dashed #2A3830',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--texto-apagado)', fontSize: '20px', marginBottom: '8px'
  },
  cardTopo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  avatar: {
    width: '36px', height: '36px', borderRadius: '50%',
    background: 'rgba(34,197,94,0.15)', color: 'var(--verde)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: '700', flexShrink: 0, fontFamily: 'Inter, sans-serif'
  },
  cardNome: { fontSize: '0.875rem', fontWeight: '600', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif' },
  cardCnpj: { fontSize: '0.75rem', color: 'var(--texto-apagado)', margin: '2px 0 0', fontFamily: 'Inter, sans-serif' },
  divisor: { border: 'none', borderTop: '1px solid #2A3830', margin: '10px 0' },
  labelMini: { fontSize: '0.7rem', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 5px', fontFamily: 'Inter, sans-serif' },
  etapaBadge: { display: 'inline-block', fontSize: '0.78rem', fontWeight: '500', padding: '3px 10px', borderRadius: '99px', fontFamily: 'Inter, sans-serif' },
  baraBg: { height: '5px', background: '#2A3830', borderRadius: '99px', overflow: 'hidden' },
  baraFill: { height: '100%', background: '#2DAA59', borderRadius: '99px', transition: 'width 0.3s' },
  // Detalhe — mapa mental
  btnVoltar: {
    background: 'none', border: 'none', color: 'var(--texto-apagado)',
    cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
    marginBottom: '20px', padding: 0
  },
  mapaCard: {
    background: 'var(--sidebar)', border: '1px solid #2A3830',
    borderRadius: '16px', overflow: 'hidden'
  },
  mapaCardTopo: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 20px', borderBottom: '1px solid #2A3830'
  },
  mapaProgLabel: { fontSize: '0.78rem', color: 'var(--texto-apagado)', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  mapaBaraBg: { flex: 1, height: '4px', background: '#2A3830', borderRadius: '99px', overflow: 'hidden' },
  mapaBaraFill: { height: '100%', background: '#2DAA59', borderRadius: '99px', transition: 'width 0.4s' },
  mapaProgPct: { fontSize: '0.78rem', color: 'var(--verde)', fontFamily: 'Inter, sans-serif', fontWeight: '600', whiteSpace: 'nowrap' },
  mapaScroll: {
    overflowX: 'auto', cursor: 'grab',
    padding: '28px 32px 8px',
    userSelect: 'none',
  },
  mapaFlex: { display: 'flex', alignItems: 'center', minWidth: 'max-content' },
  setorBox: {
    width: '120px', padding: '16px 12px',
    borderRadius: '14px', border: '1.5px solid',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    transition: 'all 0.2s', flexShrink: 0,
  },
  setorIcone: {
    width: '28px', height: '28px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s', flexShrink: 0,
  },
  setorNome: {
    fontSize: '0.78rem', textAlign: 'center', lineHeight: '1.3',
    fontFamily: 'Inter, sans-serif', transition: 'color 0.2s'
  },
  setorCount: {
    fontSize: '0.65rem', padding: '2px 8px', borderRadius: '99px',
    fontFamily: 'Inter, sans-serif', fontWeight: '500'
  },
  conector: { width: '48px', height: '2px', flexShrink: 0, transition: 'background 0.3s' },
  mapaHint: {
    fontSize: '0.7rem', color: 'var(--texto-apagado)',
    textAlign: 'center', padding: '8px 0 16px',
    fontFamily: 'Inter, sans-serif'
  },
  painel: {
    borderTop: '1px solid #2A3830',
    padding: '20px 24px',
  },
  painelHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' },
  painelTitulo: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  badgeBloqueado: { fontSize: '0.72rem', color: 'var(--texto-apagado)', background: 'var(--input)', padding: '3px 10px', borderRadius: '99px', border: '1px solid #2A3830', marginLeft: 'auto', fontFamily: 'Inter, sans-serif' },
  tarefaItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'var(--input)', border: '1px solid #2A3830',
    borderRadius: '10px', padding: '11px 14px',
  },
  tarefaCheck: {
    width: '17px', height: '17px', borderRadius: '50%',
    border: '1.5px solid', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s'
  },
  tarefaTexto: { fontSize: '0.875rem', flex: 1, fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' },
  tarefaResp: { fontSize: '0.72rem', color: 'var(--texto-apagado)', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  vazio: { color: 'var(--texto-apagado)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' },
  vazioBox: { textAlign: 'center', marginTop: '60px' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'var(--sidebar)', border: '1px solid #2A3830', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' },
  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #2A3830' },
  modalTitulo: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  btnX: { background: 'none', border: '1px solid #2A3830', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalRodape: { display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #2A3830' },
  campo: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Inter, sans-serif' },
  btnCancelar: { background: 'none', border: '1px solid #2A3830', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnSalvar: { background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px' },
}
