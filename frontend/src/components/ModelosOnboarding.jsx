import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useToast } from './Toast'

// ── Drag and drop pra ordenar setores ──
function ListaOrdenavel({ itens, onChange }) {
  const [arrastando, setArrastando] = useState(null)
  const sobreRef = useRef(null)

  const onDragStart = (e, idx) => { setArrastando(idx); e.dataTransfer.effectAllowed = 'move' }
  const onDragOver = (e, idx) => { e.preventDefault(); sobreRef.current = idx }
  const onDrop = () => {
    if (arrastando === null || sobreRef.current === null) return
    const lista = [...itens]
    const [item] = lista.splice(arrastando, 1)
    lista.splice(sobreRef.current, 0, item)
    onChange(lista)
    setArrastando(null); sobreRef.current = null
  }

  return (
    <div>
      <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', marginBottom: '8px' }}>
        ↕ Arraste para reordenar as etapas do fluxo
      </p>
      {itens.map((item, idx) => (
        <div key={item._id} draggable
          onDragStart={e => onDragStart(e, idx)}
          onDragOver={e => onDragOver(e, idx)}
          onDrop={onDrop}
          style={{ ...s.ordemItem, opacity: arrastando === idx ? 0.4 : 1 }}
        >
          <span style={s.ordemNum}>{idx + 1}</span>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: item.cor }} />
          <span style={s.ordemNome}>{item.nome}</span>
          <span style={{ color: 'var(--texto-apagado)', fontSize: '16px', letterSpacing: '2px' }}>⠿</span>
        </div>
      ))}
    </div>
  )
}

// ── Modal criar novo modelo (só nome + setores) ──
function ModalNovoModelo({ fechar, onSalvo }) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [setoresDisponiveis, setSetoresDisponiveis] = useState([])
  const [setoresSelecionados, setSetoresSelecionados] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const { mostrar: toast } = useToast()

  useEffect(() => {
    api.get('/setores').then(r => setSetoresDisponiveis(r.data)).catch(() => {})
  }, [])

  const toggleSetor = (setor) => {
    setSetoresSelecionados(prev => {
      const jaEsta = prev.find(s => s._id === setor._id)
      return jaEsta ? prev.filter(s => s._id !== setor._id) : [...prev, setor]
    })
  }

  const salvar = async () => {
    if (!nome.trim()) return setErro('Nome do modelo é obrigatório.')
    if (setoresSelecionados.length === 0) return setErro('Selecione pelo menos um setor.')
    setCarregando(true); setErro('')
    try {
      const setores = setoresSelecionados.map((s, idx) => ({
        setor: s._id, ordem: idx + 1, tarefas: []
      }))
      const res = await api.post('/modelos-onboarding', { nome, descricao, setores })
      toast('Modelo criado!', 'sucesso')
      onSalvo(res.data)
      fechar()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar modelo.')
    } finally { setCarregando(false) }
  }

  return (
    <div style={s.overlay} onClick={fechar}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalTopo}>
          <span style={s.modalTitulo}>Novo modelo</span>
          <button style={s.btnX} onClick={fechar}>✕</button>
        </div>
        <div style={s.modalCorpo}>
          {erro && <p style={s.erro}>{erro}</p>}
          <div style={s.campo}>
            <label style={s.label}>Nome do modelo</label>
            <input style={s.input} value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Simples Nacional + Comércio" autoFocus
              onKeyDown={e => e.key === 'Enter' && salvar()} />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Descrição <span style={{ fontWeight: 400, color: 'var(--texto-apagado)' }}>(opcional)</span></label>
            <input style={s.input} value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Breve descrição do modelo" />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Setores participantes</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {setoresDisponiveis.map(setor => {
                const ativo = setoresSelecionados.find(s => s._id === setor._id)
                return (
                  <button key={setor._id} onClick={() => toggleSetor(setor)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: '99px', cursor: 'pointer',
                    fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', fontWeight: '500',
                    border: ativo ? `2px solid ${setor.cor}` : '1px solid var(--borda)',
                    background: ativo ? `${setor.cor}22` : 'transparent',
                    color: ativo ? setor.cor : 'var(--texto-apagado)',
                    transition: 'all 0.15s'
                  }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: setor.cor }} />
                    {setor.nome}
                  </button>
                )
              })}
            </div>
          </div>
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
            {carregando ? 'Criando...' : 'Criar modelo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Painel lateral direito — Adicionar atividade ──
function PainelAdicionarAtividade({ setor, todasAtividades, tarefasDoModelo, onAdicionar, fechar, funcionarios, setoresComMembros }) {
  // Buscar membros do setor atual a partir do model Setor (que tem a lista de membros)
  const setorComMembros = setoresComMembros?.find(s => s._id === setor._id)
  const idsMembroSetor = setorComMembros?.membros?.map(m => m._id || m) || []
  const funcionariosDoSetor = funcionarios.filter(f => idsMembroSetor.includes(f._id))
  const [aba, setAba] = useState('banco') // 'banco' | 'nova'
  const [busca, setBusca] = useState('')
  const [novaDesc, setNovaDesc] = useState('')
  const [novaResp, setNovaResp] = useState('')
  const [novaObs, setNovaObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const { mostrar: toast } = useToast()

  const atividadesDoBanco = todasAtividades.filter(a => {
    const setorId = a.setor?._id || a.setor
    const matchSetor = setorId === setor._id
    const matchBusca = !busca || a.descricao.toLowerCase().includes(busca.toLowerCase())
    return matchSetor && matchBusca
  })

  const jaAdicionada = (id) => tarefasDoModelo.some(t => t._id === id)

  const criarENova = async () => {
    if (!novaDesc.trim()) return toast('Digite a descrição da atividade.', 'aviso')
    setSalvando(true)
    try {
      const res = await api.post('/checklist', {
        descricao: novaDesc.trim(),
        observacoes: novaObs.trim(),
        setor: setor._id,
        responsavelId: novaResp || null,
      })
      toast('Atividade criada e adicionada!', 'sucesso')
      onAdicionar(res.data)
      setNovaDesc(''); setNovaResp(''); setNovaObs('')
      setAba('banco')
    } catch (err) {
      toast(err.response?.data?.erro || 'Erro ao criar atividade.', 'erro')
    } finally { setSalvando(false) }
  }

  return (
    <div style={s.painel}>
      <div style={s.painelTopo}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: setor.cor, flexShrink: 0 }} />
            <span style={s.painelTitulo}>Adicionar atividade</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--texto-apagado)', marginTop: '2px', marginLeft: '17px' }}>{setor.nome}</p>
        </div>
        <button style={s.btnX} onClick={fechar}>✕</button>
      </div>

      {/* Abas */}
      <div style={s.abas}>
        <button style={{ ...s.aba, ...(aba === 'banco' ? s.abaAtiva : {}) }} onClick={() => setAba('banco')}>
          Banco de atividades
        </button>
        <button style={{ ...s.aba, ...(aba === 'nova' ? s.abaAtiva : {}) }} onClick={() => setAba('nova')}>
          Criar nova
        </button>
      </div>

      {aba === 'banco' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borda)' }}>
            <input
              style={{ ...s.input, fontSize: '0.82rem' }}
              placeholder="Buscar atividade..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {atividadesDoBanco.length === 0 ? (
              <div style={s.vazioPanel}>
                <p style={{ color: 'var(--texto-apagado)', fontSize: '0.82rem', textAlign: 'center' }}>
                  {busca ? 'Nenhuma atividade encontrada.' : 'Nenhuma atividade neste setor ainda.'}
                </p>
                <button style={{ ...s.btnLink, marginTop: '8px' }} onClick={() => setAba('nova')}>
                  Criar nova atividade →
                </button>
              </div>
            ) : atividadesDoBanco.map(at => {
              const adicionada = jaAdicionada(at._id)
              return (
                <div key={at._id} style={s.bancoItem}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--texto)', margin: 0, lineHeight: '1.3' }}>{at.descricao}</p>
                    {at.responsavel?.nome && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--verde)', margin: '3px 0 0' }}>{at.responsavel.nome}</p>
                    )}
                  </div>
                  {adicionada ? (
                    <span style={s.badgeAdicionada}>✓ Adicionada</span>
                  ) : (
                    <button style={s.btnUsar} onClick={() => onAdicionar(at)}>+ usar</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', background: 'var(--input)', borderRadius: '8px', padding: '10px 12px', lineHeight: '1.5' }}>
            A atividade criada aqui será salva no <strong style={{ color: 'var(--verde)' }}>banco de atividades</strong> e poderá ser reutilizada em outros modelos.
          </p>
          <div style={s.campo}>
            <label style={s.label}>Descrição</label>
            <input style={s.input} value={novaDesc} onChange={e => setNovaDesc(e.target.value)}
              placeholder="O que precisa ser feito?" autoFocus
              onKeyDown={e => e.key === 'Enter' && criarENova()} />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Responsável <span style={{ fontWeight: 400 }}>(opcional)</span></label>
            {funcionariosDoSetor.length === 0 && (
              <p style={{ fontSize: '0.72rem', color: '#fbbf24', margin: '0 0 4px', lineHeight: '1.4' }}>Nenhum colaborador cadastrado neste setor ainda.</p>
            )}
            <select style={s.input} value={novaResp} onChange={e => setNovaResp(e.target.value)}>
              <option value="">Em aberto</option>
              {funcionariosDoSetor.length > 0
                ? funcionariosDoSetor.map(f => <option key={f._id} value={f._id}>{f.nome}</option>)
                : funcionarios.map(f => <option key={f._id} value={f._id}>{f.nome}</option>)
              }
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Observações <span style={{ fontWeight: 400 }}>(opcional)</span></label>
            <textarea style={{ ...s.input, minHeight: '70px', resize: 'vertical' }}
              value={novaObs} onChange={e => setNovaObs(e.target.value)}
              placeholder="Instruções, documentos..." />
          </div>
          <button style={s.btnSalvar} onClick={criarENova} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Criar e adicionar ao modelo'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tela de detalhe do modelo ──
function TelaDetalhe({ modelo: modeloInicial, voltar, onAtualizado }) {
  const [modelo, setModelo] = useState(modeloInicial)
  const [todasAtividades, setTodasAtividades] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [setoresComMembros, setSetoresComMembros] = useState([]) // setores com membros populados
  const [painelSetor, setPainelSetor] = useState(null) // setor que está com painel aberto
  const [tarefasPorSetor, setTarefasPorSetor] = useState({})
  const [salvando, setSalvando] = useState(false)
  const { mostrar: toast } = useToast()

  useEffect(() => {
    const carregar = async () => {
      try {
        const [resChecklist, resFunc, resModelo, resSetores] = await Promise.all([
          api.get('/checklist'),
          api.get('/usuarios'),
          api.get(`/modelos-onboarding/${modelo._id}`),
          api.get('/setores'),
        ])
        setTodasAtividades(resChecklist.data)
        setFuncionarios(resFunc.data)
        setSetoresComMembros(resSetores.data)

        // Montar mapa de tarefas por setor
        const mapa = {}
        const m = resModelo.data
        setModelo(m)
        m.setores.sort((a, b) => a.ordem - b.ordem).forEach(s => {
          // tarefas podem ser objetos populados ou strings de ID
          const tarefas = (s.tarefas || []).filter(t => t && (t._id || typeof t === 'string'))
          mapa[s.setor._id] = tarefas.map(t => typeof t === 'string' ? { _id: t, descricao: t } : t)
        })
        setTarefasPorSetor(mapa)
      } catch { toast('Erro ao carregar modelo.', 'erro') }
    }
    carregar()
  }, [])

  const adicionarAtividade = async (setor, atividade) => {
    const lista = tarefasPorSetor[setor._id] || []
    if (lista.find(t => t._id === atividade._id)) {
      toast('Atividade já adicionada.', 'aviso'); return
    }
    const novaLista = [...lista, atividade]
    const novoMapa = { ...tarefasPorSetor, [setor._id]: novaLista }
    setTarefasPorSetor(novoMapa)
    await salvarModelo(novoMapa)
  }

  const removerAtividade = async (setorId, atividadeId) => {
    const novaLista = (tarefasPorSetor[setorId] || []).filter(t => t._id !== atividadeId)
    const novoMapa = { ...tarefasPorSetor, [setorId]: novaLista }
    setTarefasPorSetor(novoMapa)
    await salvarModelo(novoMapa)
  }

  const salvarModelo = async (mapa) => {
    setSalvando(true)
    try {
      const setores = modelo.setores.sort((a, b) => a.ordem - b.ordem).map((s, idx) => ({
        setor: s.setor._id,
        ordem: idx + 1,
        tarefas: ((mapa || tarefasPorSetor)[s.setor._id] || []).map(t => t._id)
      }))
      await api.put(`/modelos-onboarding/${modelo._id}`, {
        nome: modelo.nome, descricao: modelo.descricao, setores
      })
      onAtualizado()
    } catch { toast('Erro ao salvar.', 'erro') }
    finally { setSalvando(false) }
  }

  const setoresOrdenados = [...(modelo.setores || [])].sort((a, b) => a.ordem - b.ordem)
  const totalAtividades = Object.values(tarefasPorSetor).reduce((acc, l) => acc + l.length, 0)

  return (
    <div style={{ display: 'flex', gap: '0', minHeight: '100%' }}>
      {/* Conteúdo principal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Cabeçalho */}
        <div style={{ marginBottom: '28px' }}>
          <button style={s.btnVoltar} onClick={voltar}>← Voltar para modelos</button>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: '12px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={s.titulo}>{modelo.nome}</h1>
              <p style={s.subtitulo}>
                {totalAtividades} atividade{totalAtividades !== 1 ? 's' : ''} · {setoresOrdenados.length} setor{setoresOrdenados.length !== 1 ? 'es' : ''}
                {salvando && <span style={{ marginLeft: '8px', color: 'var(--verde)', fontSize: '0.75rem' }}>Salvando...</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Blocos por setor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: painelSetor ? '320px' : '0', transition: 'padding-right 0.2s' }}>
          {setoresOrdenados.map((setorModelo, idx) => {
            const setor = setorModelo.setor
            const tarefas = tarefasPorSetor[setor._id] || []
            const aberto = painelSetor?._id === setor._id

            return (
              <div key={setor._id} style={{ ...s.setorBloco, borderColor: aberto ? `${setor.cor}44` : 'var(--borda)' }}>
                {/* Header do setor */}
                <div style={s.setorHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--texto-apagado)', width: '16px', textAlign: 'center' }}>{idx + 1}</span>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: setor.cor, flexShrink: 0 }} />
                    <span style={s.setorNome}>{setor.nome}</span>
                    <span style={s.countBadge}>{tarefas.length}</span>
                  </div>
                  <button
                    style={{ ...s.btnAddSetor, ...(aberto ? { background: 'var(--verde-glow)', color: 'var(--verde)', borderColor: 'rgba(0,177,65,0.3)', borderStyle: 'solid' } : {}) }}
                    onClick={() => setPainelSetor(aberto ? null : setor)}
                  >
                    {aberto ? '✕ Fechar' : '+ atividade'}
                  </button>
                </div>

                {/* Lista de atividades */}
                {tarefas.length === 0 ? (
                  <div style={s.setorVazio} onClick={() => setPainelSetor(setor)}>
                    <span>Nenhuma atividade — clique em <strong>+ atividade</strong> para adicionar</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {tarefas.map((at, i) => (
                      <div key={at._id} style={s.atividadeLinha} className="mod-ativ">
                        <span style={{ fontSize: '0.65rem', color: 'var(--texto-apagado)', width: '16px', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                        <span style={s.atividadeDesc}>{at.descricao}</span>
                        {at.responsavel?.nome && (
                          <span style={s.respBadge}>{at.responsavel.nome}</span>
                        )}
                        <button
                          style={s.btnRemov}
                          className="mod-remov"
                          onClick={() => removerAtividade(setor._id, at._id)}
                          title="Remover do modelo"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Painel lateral direito */}
      {painelSetor && (
        <div style={s.painelWrapper}>
          <PainelAdicionarAtividade
            setor={painelSetor}
            todasAtividades={todasAtividades}
            tarefasDoModelo={tarefasPorSetor[painelSetor._id] || []}
            onAdicionar={(at) => adicionarAtividade(painelSetor, at)}
            fechar={() => setPainelSetor(null)}
            funcionarios={funcionarios}
            setoresComMembros={setoresComMembros}
          />
        </div>
      )}
    </div>
  )
}

// ── Tela principal — lista de modelos ──
export default function ModelosOnboarding() {
  const [modelos, setModelos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)
  const [modeloDetalhe, setModeloDetalhe] = useState(null)
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
    } catch { toast('Erro ao remover.', 'erro') }
  }

  // Se estiver vendo detalhe de um modelo
  if (modeloDetalhe) {
    return (
      <TelaDetalhe
        modelo={modeloDetalhe}
        voltar={() => { setModeloDetalhe(null); buscar() }}
        onAtualizado={buscar}
      />
    )
  }

  return (
    <div>
      <style>{`.mod-ativ:hover .mod-remov { opacity: 1 !important; }`}</style>

      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Modelos de onboarding</h1>
          <p style={s.subtitulo}>Templates reutilizáveis para cada tipo de cliente</p>
        </div>
        <button style={s.btnNovo} onClick={() => setModalNovo(true)}>+ Novo modelo</button>
      </div>

      {carregando ? (
        <p style={{ color: 'var(--texto-apagado)', textAlign: 'center', marginTop: '40px' }}>Carregando...</p>
      ) : modelos.length === 0 ? (
        <div style={s.vazioBox}>
          <p style={{ color: 'var(--texto-apagado)', marginBottom: '16px', fontSize: '0.9rem' }}>
            Nenhum modelo criado ainda.
          </p>
          <p style={{ color: 'var(--texto-apagado)', fontSize: '0.82rem', marginBottom: '20px', maxWidth: '380px', lineHeight: '1.5' }}>
            Crie um modelo para cada tipo de empresa (ex: "Simples + Comércio") e configure as atividades de cada setor.
          </p>
          <button style={s.btnNovo} onClick={() => setModalNovo(true)}>Criar primeiro modelo</button>
        </div>
      ) : (
        <div style={s.grid}>
          {modelos.map(m => {
            const setoresOrdenados = [...m.setores].sort((a, b) => a.ordem - b.ordem)
            const totalAtividades = setoresOrdenados.reduce((acc, s) => acc + (s.tarefas?.length || 0), 0)
            return (
              <div key={m._id} style={s.card} onClick={() => setModeloDetalhe(m)} className="mod-card">
                <div style={{ flex: 1 }}>
                  <p style={s.cardNome}>{m.nome}</p>
                  {m.descricao && <p style={s.cardDesc}>{m.descricao}</p>}
                  <p style={s.cardMeta}>{totalAtividades} atividade{totalAtividades !== 1 ? 's' : ''} · {setoresOrdenados.length} setor{setoresOrdenados.length !== 1 ? 'es' : ''}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                    {setoresOrdenados.map((s2, idx) => (
                      <span key={idx} style={{
                        fontSize: '0.7rem', padding: '2px 9px', borderRadius: '99px',
                        background: `${s2.setor?.cor || '#00b141'}18`,
                        color: s2.setor?.cor || '#00b141', fontWeight: '500',
                        border: `1px solid ${s2.setor?.cor || '#00b141'}33`
                      }}>
                        {s2.ordem}. {s2.setor?.nome}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }} onClick={e => e.stopPropagation()}>
                  <button style={s.btnAcao} onClick={() => setModeloDetalhe(m)}>Editar</button>
                  <button style={{ ...s.btnAcao, color: '#FCA5A5' }} onClick={() => excluir(m._id)}>Remover</button>
                </div>
              </div>
            )
          })}

          {/* Card de adicionar */}
          <div style={{ ...s.card, ...s.cardNovo }} onClick={() => setModalNovo(true)}>
            <span style={{ fontSize: '24px', color: 'var(--texto-apagado)', marginBottom: '6px' }}>+</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--texto-apagado)' }}>Novo modelo</span>
          </div>
        </div>
      )}

      {modalNovo && (
        <ModalNovoModelo
          fechar={() => setModalNovo(false)}
          onSalvo={async (novoModelo) => { 
          await buscar()
          // Buscar modelo completo antes de abrir detalhe
          try {
            const res = await api.get('/modelos-onboarding/' + novoModelo._id)
            setModeloDetalhe(res.data)
          } catch { setModeloDetalhe(novoModelo) }
        }}
        />
      )}
    </div>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' },
  titulo: { fontSize: '1.5rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif', letterSpacing: '-0.03em' },
  subtitulo: { fontSize: '0.82rem', color: 'var(--texto-apagado)', marginTop: '5px', fontFamily: 'Inter, sans-serif' },
  btnNovo: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,177,65,0.25)', whiteSpace: 'nowrap' },
  btnVoltar: { background: 'none', border: 'none', color: 'var(--texto-apagado)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' },
  card: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'border-color 0.15s' },
  cardNovo: { alignItems: 'center', justifyContent: 'center', minHeight: '120px', border: '1px dashed var(--borda)' },
  cardNome: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' },
  cardDesc: { fontSize: '0.8rem', color: 'var(--texto-apagado)', marginTop: '4px', fontFamily: 'Inter, sans-serif' },
  cardMeta: { fontSize: '0.72rem', color: 'var(--texto-apagado)', marginTop: '6px', fontFamily: 'Inter, sans-serif' },
  btnAcao: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto-apagado)', fontSize: '0.78rem', cursor: 'pointer', padding: '6px 12px', fontFamily: 'Inter, sans-serif' },
  vazioBox: { textAlign: 'center', marginTop: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  // Detalhe do modelo
  setorBloco: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '16px 18px', transition: 'border-color 0.2s' },
  setorHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  setorNome: { fontSize: '0.88rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  countBadge: { fontSize: '0.68rem', color: 'var(--texto-apagado)', background: 'var(--input)', border: '1px solid var(--borda)', padding: '1px 7px', borderRadius: '99px' },
  btnAddSetor: { fontSize: '0.75rem', color: 'var(--texto-apagado)', background: 'none', border: '1px dashed var(--borda)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' },
  setorVazio: { fontSize: '0.78rem', color: 'var(--texto-apagado)', padding: '10px 0 4px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  atividadeLinha: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderBottom: '1px solid var(--borda)', position: 'relative' },
  atividadeDesc: { fontSize: '0.85rem', color: 'var(--texto)', flex: 1, fontFamily: 'Inter, sans-serif' },
  respBadge: { fontSize: '0.7rem', color: 'var(--verde)', background: 'rgba(0,177,65,0.08)', border: '1px solid rgba(0,177,65,0.18)', padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap' },
  btnRemov: { background: 'none', border: 'none', color: 'var(--texto-apagado)', fontSize: '11px', cursor: 'pointer', padding: '2px 4px', opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 },
  // Painel lateral
  painelWrapper: { width: '300px', flexShrink: 0, position: 'fixed', right: '0', top: '54px', bottom: '0', borderLeft: '1px solid var(--borda)', background: 'var(--card)', display: 'flex', flexDirection: 'column', zIndex: 10, overflowY: 'auto' },
  painel: { display: 'flex', flexDirection: 'column', height: '100%' },
  painelTopo: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 16px', borderBottom: '1px solid var(--borda)', flexShrink: 0 },
  painelTitulo: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  abas: { display: 'flex', borderBottom: '1px solid var(--borda)', flexShrink: 0 },
  aba: { flex: 1, padding: '10px 8px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'all 0.15s' },
  abaAtiva: { color: 'var(--verde)', borderBottomColor: 'var(--verde)', fontWeight: '600' },
  bancoItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid var(--borda)' },
  btnUsar: { fontSize: '0.72rem', color: 'var(--verde)', background: 'rgba(0,177,65,0.08)', border: '1px solid rgba(0,177,65,0.2)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  badgeAdicionada: { fontSize: '0.7rem', color: 'var(--texto-apagado)', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap' },
  btnLink: { background: 'none', border: 'none', color: 'var(--verde)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' },
  vazioPanel: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' },
  // Compartilhados
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' },
  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  modalTitulo: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer', flexShrink: 0 },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' },
  modalRodape: { display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--borda)' },
  campo: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Inter, sans-serif' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' },
  btnCancelar: { background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnSalvar: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px' },
  ordemItem: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px', userSelect: 'none', cursor: 'grab' },
  ordemNum: { width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,177,65,0.12)', color: 'var(--verde)', fontSize: '0.72rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ordemNome: { fontSize: '0.85rem', color: 'var(--texto)', flex: 1, fontFamily: 'Inter, sans-serif' },
}
