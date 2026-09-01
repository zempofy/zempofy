import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import { useToast } from './Toast'
import ModalConfirmacao from './ModalConfirmacao'
import Modal from './Modal'
import Icone from './Icones'

// ── Drag and drop pra ordenar setores (usado na criação do modelo) ──
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
      await onSalvo(res.data)
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
                    fontSize: '0.8rem', fontFamily: 'var(--fonte-corpo)', fontWeight: '500',
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
  const setorComMembros = setoresComMembros?.find(s => s._id === setor._id)
  const idsMembroSetor = setorComMembros?.membros?.map(m => m._id || m) || []
  const funcionariosDoSetor = funcionarios.filter(f => idsMembroSetor.includes(f._id))
  const outrosFuncionariosMod = funcionarios.filter(f => !idsMembroSetor.includes(f._id))
  const opcoesFuncionarios = funcionariosDoSetor.length > 0
    ? [...funcionariosDoSetor, ...outrosFuncionariosMod]
    : funcionarios
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
              {opcoesFuncionarios.map(f => <option key={f._id} value={f._id}>{f.nome}</option>)}
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

// ── Confirmação de exclusão permanente (com checkbox "estou ciente") ──
function ModalExcluirPermanente({ nome, onConfirmar, onCancelar }) {
  const [ciente, setCiente] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const confirmar = async () => {
    setExcluindo(true)
    try { await onConfirmar() } finally { setExcluindo(false) }
  }

  return (
    <Modal onFechar={onCancelar} maxWidth="420px">
      <div style={s.modalTopo}>
        <span style={s.modalTitulo}>Excluir modelo permanentemente</span>
        <button style={s.btnX} onClick={onCancelar}>✕</button>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--texto)', margin: '0 0 12px', fontFamily: 'var(--fonte-corpo)' }}>
          Tem certeza que deseja excluir <strong>{nome}</strong> permanentemente?
        </p>
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
          <p style={{ fontSize: '0.8rem', color: '#f87171', margin: 0, fontFamily: 'var(--fonte-corpo)', lineHeight: '1.4' }}>Essa ação é permanente e não pode ser desfeita.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-apagado)', fontFamily: 'var(--fonte-corpo)' }}>
          <input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)} style={{ marginTop: '2px', accentColor: '#f87171', width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer' }} />
          Estou ciente de que essa exclusão é permanente e não pode ser desfeita.
        </label>
      </div>
      <div style={s.modalRodape}>
        <button style={s.btnCancelar} onClick={onCancelar}>Cancelar</button>
        <button style={{ ...s.btnSalvar, background: 'linear-gradient(135deg, #EF4444, #991B1B)', opacity: ciente ? 1 : 0.5 }} onClick={confirmar} disabled={excluindo || !ciente}>
          {excluindo ? 'Excluindo...' : 'Excluir permanentemente'}
        </button>
      </div>
    </Modal>
  )
}

// ── Hook central: lista de modelos + modelo aberto + setor aberto (nível 1/2/3) ──
function useModelosOnboarding() {
  const { mostrar: toast } = useToast()
  const [modelos, setModelos] = useState([])
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [modeloId, setModeloId] = useState(null)
  const [modelo, setModelo] = useState(null)
  const [carregandoModelo, setCarregandoModelo] = useState(false)
  const [setorAberto, setSetorAberto] = useState(null)
  const [todasAtividades, setTodasAtividades] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [setoresComMembros, setSetoresComMembros] = useState([])
  const [tarefasPorSetor, setTarefasPorSetor] = useState({})
  const [salvando, setSalvando] = useState(false)

  const mapaDoModelo = (m) => {
    const mapa = {}
    ;[...m.setores].sort((a, b) => a.ordem - b.ordem).forEach(sm => {
      const tarefas = (sm.tarefas || []).filter(t => t && (t._id || typeof t === 'string'))
      mapa[sm.setor._id] = tarefas.map(t => typeof t === 'string' ? { _id: t, descricao: t } : t)
    })
    return mapa
  }

  const buscarLista = async () => {
    setCarregandoLista(true)
    try {
      const res = await api.get('/modelos-onboarding?incluirInativos=true')
      setModelos(res.data)
    } catch { toast('Erro ao carregar modelos.', 'erro') }
    finally { setCarregandoLista(false) }
  }

  useEffect(() => { buscarLista() }, [])

  const abrirModelo = async (id) => {
    setModeloId(id)
    setSetorAberto(null)
    setCarregandoModelo(true)
    try {
      const [resModelo, resChecklist, resFunc, resSetores] = await Promise.all([
        api.get(`/modelos-onboarding/${id}`),
        api.get('/checklist'),
        api.get('/usuarios'),
        api.get('/setores'),
      ])
      setModelo(resModelo.data)
      setTodasAtividades(resChecklist.data)
      setFuncionarios(resFunc.data)
      setSetoresComMembros(resSetores.data)
      setTarefasPorSetor(mapaDoModelo(resModelo.data))
    } catch { toast('Erro ao carregar modelo.', 'erro') }
    finally { setCarregandoModelo(false) }
  }

  const voltarParaLista = () => { setModeloId(null); setModelo(null); setSetorAberto(null) }

  const salvarSetores = async (setoresOrdenados, mapa) => {
    setSalvando(true)
    try {
      const setores = setoresOrdenados.map((sm, idx) => ({
        setor: sm.setor._id,
        ordem: idx + 1,
        tarefas: (mapa[sm.setor._id] || []).map(t => t._id)
      }))
      const res = await api.put(`/modelos-onboarding/${modelo._id}`, {
        nome: modelo.nome, descricao: modelo.descricao, setores
      })
      setModelo(res.data)
      setTarefasPorSetor(mapaDoModelo(res.data))
    } catch { toast('Erro ao salvar.', 'erro') }
    finally { setSalvando(false) }
  }

  const reordenarSetores = (novaOrdem) => {
    salvarSetores(novaOrdem, tarefasPorSetor)
  }

  const adicionarAtividade = async (setor, atividade) => {
    const lista = tarefasPorSetor[setor._id] || []
    if (lista.find(t => t._id === atividade._id)) { toast('Atividade já adicionada.', 'aviso'); return }
    const novoMapa = { ...tarefasPorSetor, [setor._id]: [...lista, atividade] }
    const setoresOrdenados = [...modelo.setores].sort((a, b) => a.ordem - b.ordem)
    await salvarSetores(setoresOrdenados, novoMapa)
  }

  const removerAtividade = async (setorId, atividadeId) => {
    const novoMapa = { ...tarefasPorSetor, [setorId]: (tarefasPorSetor[setorId] || []).filter(t => t._id !== atividadeId) }
    const setoresOrdenados = [...modelo.setores].sort((a, b) => a.ordem - b.ordem)
    await salvarSetores(setoresOrdenados, novoMapa)
  }

  const criarModelo = async (novoModelo) => {
    await buscarLista()
    await abrirModelo(novoModelo._id)
  }

  const inativar = async (id) => {
    await api.delete(`/modelos-onboarding/${id}`)
    await buscarLista()
    if (modeloId === id) voltarParaLista()
  }

  const reativar = async (id) => {
    await api.patch(`/modelos-onboarding/${id}/reativar`)
    await buscarLista()
    if (modeloId === id) await abrirModelo(id)
  }

  const excluirPermanente = async (id) => {
    await api.delete(`/modelos-onboarding/${id}/permanente`)
    await buscarLista()
    if (modeloId === id) voltarParaLista()
  }

  return {
    modelos, carregandoLista, modeloId, modelo, carregandoModelo, setorAberto, setSetorAberto,
    todasAtividades, funcionarios, setoresComMembros, tarefasPorSetor, salvando,
    buscarLista, abrirModelo, voltarParaLista, reordenarSetores, adicionarAtividade, removerAtividade,
    criarModelo, inativar, reativar, excluirPermanente,
  }
}

// ── Nível 1 — card de um modelo na grade (mesmo padrão visual do CardSetor) ──
function CardModelo({ modelo, onClick }) {
  const n = modelo.setores.length
  const cor = 'var(--verde)'
  return (
    <div style={{ ...s.cardModelo, opacity: modelo.ativo ? 1 : 0.55 }} onClick={onClick}>
      <div style={{ ...s.cardBarra, background: cor }} />
      <div style={s.cardCorpo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ ...s.selo, background: cor }}>{modelo.nome.slice(0, 1).toUpperCase()}</div>
          <span style={s.cardNome}>{modelo.nome}</span>
        </div>
        <p style={s.cardMeta}>{n} setor{n !== 1 ? 'es' : ''}</p>
      </div>
    </div>
  )
}

// ── Nível 1 — grade de modelos (mesmo padrão da categoria Setores: fica na área de conteúdo) ──
export default function ModelosOnboarding() {
  const ctl = useModelosOnboarding()
  const [modalNovo, setModalNovo] = useState(false)

  if (ctl.modeloId) {
    return <ModelosConteudo ctl={ctl} />
  }

  const ordenados = [...ctl.modelos].sort((a, b) => {
    const iA = a.ativo ? 0 : 1, iB = b.ativo ? 0 : 1
    if (iA !== iB) return iA - iB
    return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })
  })

  return (
    <div>
      <div style={s.categoriaHeader}>
        <h2 style={s.categoriaTitulo}>Modelos</h2>
        <button style={s.btnNovo} onClick={() => setModalNovo(true)}>+ Novo modelo</button>
      </div>

      {ctl.carregandoLista ? (
        <p style={{ color: 'var(--texto-apagado)' }}>Carregando...</p>
      ) : ordenados.length === 0 ? (
        <p style={{ color: 'var(--texto-apagado)', fontSize: '0.85rem' }}>Nenhum modelo criado ainda.</p>
      ) : (
        <div style={s.gridModelos}>
          {ordenados.map(m => (
            <CardModelo key={m._id} modelo={m} onClick={() => ctl.abrirModelo(m._id)} />
          ))}
        </div>
      )}

      {modalNovo && (
        <ModalNovoModelo
          fechar={() => setModalNovo(false)}
          onSalvo={ctl.criarModelo}
        />
      )}
    </div>
  )
}

// ── Nível 2 (setores do modelo) e Nível 3 (atividades do setor) — área de conteúdo ──
function ModelosConteudo({ ctl }) {
  const { mostrar: toast } = useToast()
  const [confirmInativar, setConfirmInativar] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [confirmRemoverAtividade, setConfirmRemoverAtividade] = useState(null)
  const [painelAberto, setPainelAberto] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [arrastando, setArrastando] = useState(null)
  const sobreRef = useRef(null)

  if (ctl.carregandoModelo || !ctl.modelo) {
    return <p style={{ color: 'var(--texto-apagado)' }}>Carregando...</p>
  }

  const modelo = ctl.modelo
  const setoresOrdenados = [...modelo.setores].sort((a, b) => a.ordem - b.ordem)

  // ── Nível 3: atividades do setor selecionado ──
  if (ctl.setorAberto) {
    const setor = ctl.setorAberto
    const tarefas = ctl.tarefasPorSetor[setor._id] || []
    return (
      <div>
        <style>{`.mod-ativ:hover .mod-remov { opacity: 1 !important; }`}</style>
        <button style={s.btnVoltar} onClick={() => ctl.setSetorAberto(null)}>
          <Icone.ChevronLeft size={14} /> Voltar para {modelo.nome}
        </button>

        <div style={s.detalheHeader}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: setor.cor, flexShrink: 0 }} />
          <h2 style={s.detalheTitulo}>{setor.nome}</h2>
        </div>

        <div style={s.listaAtividades}>
          {tarefas.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--texto-apagado)', padding: '6px 4px 12px', fontFamily: 'var(--fonte-corpo)' }}>Nenhuma atividade ainda.</p>
          )}
          {tarefas.map((at, i) => (
            <div key={at._id} style={s.atividadeLinha} className="mod-ativ">
              <span style={s.atividadeNum}>{i + 1}</span>
              <span style={s.atividadeDesc}>{at.descricao}</span>
              {at.responsavel?.nome && <span style={s.respBadge}>{at.responsavel.nome}</span>}
              <button style={s.btnRemov} className="mod-remov" onClick={() => setConfirmRemoverAtividade(at)} title="Remover do modelo">✕</button>
            </div>
          ))}
          <button style={s.linhaAdicionar} onClick={() => setPainelAberto(true)}>+ Adicionar</button>
        </div>

        {painelAberto && (
          <div style={s.painelWrapper}>
            <PainelAdicionarAtividade
              setor={setor}
              todasAtividades={ctl.todasAtividades}
              tarefasDoModelo={tarefas}
              onAdicionar={(at) => ctl.adicionarAtividade(setor, at)}
              fechar={() => setPainelAberto(false)}
              funcionarios={ctl.funcionarios}
              setoresComMembros={ctl.setoresComMembros}
            />
          </div>
        )}

        {confirmRemoverAtividade && createPortal(
          <ModalConfirmacao
            titulo="Remover atividade do modelo"
            mensagem={`Tem certeza que deseja remover "${confirmRemoverAtividade.descricao}" deste modelo? Onboardings já em andamento não serão afetados.`}
            textoBotao="Remover" perigo
            onConfirmar={async () => { const at = confirmRemoverAtividade; setConfirmRemoverAtividade(null); await ctl.removerAtividade(setor._id, at._id) }}
            onCancelar={() => setConfirmRemoverAtividade(null)}
          />, document.body
        )}
      </div>
    )
  }

  // ── Nível 2: setores do modelo, em sequência ──
  const onDragStart = (idx) => setArrastando(idx)
  const onDragOver = (e, idx) => { e.preventDefault(); sobreRef.current = idx }
  const onDrop = () => {
    if (arrastando === null || sobreRef.current === null || arrastando === sobreRef.current) {
      setArrastando(null); sobreRef.current = null; return
    }
    const lista = [...setoresOrdenados]
    const [item] = lista.splice(arrastando, 1)
    lista.splice(sobreRef.current, 0, item)
    ctl.reordenarSetores(lista)
    setArrastando(null); sobreRef.current = null
  }

  return (
    <div>
      <button style={s.btnVoltar} onClick={ctl.voltarParaLista}>
        <Icone.ChevronLeft size={14} /> Voltar
      </button>

      <div style={s.cabecalhoModelo}>
        <div style={{ minWidth: 0 }}>
          <h2 style={s.detalheTitulo}>{modelo.nome}</h2>
          <p style={s.subtituloFixo}>Usado automaticamente ao cadastrar clientes desse perfil{ctl.salvando && <span style={{ color: 'var(--verde)' }}> · Salvando...</span>}</p>
        </div>
        {modelo.ativo ? (
          <button style={s.btnInativar} onClick={() => setConfirmInativar(true)}>Inativar</button>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              style={s.btnReativar}
              disabled={processando}
              onClick={async () => {
                setProcessando(true)
                try { await ctl.reativar(modelo._id); toast('Modelo reativado!', 'sucesso') }
                catch { toast('Erro ao reativar.', 'erro') }
                finally { setProcessando(false) }
              }}
            >Reativar</button>
            <button style={s.btnExcluirPerm} onClick={() => setConfirmExcluir(true)}>Excluir permanentemente</button>
          </div>
        )}
      </div>

      <div style={s.fluxoSetores}>
        {setoresOrdenados.map((sm, idx) => {
          const setor = sm.setor
          const count = (ctl.tarefasPorSetor[setor._id] || []).length
          return (
            <div key={setor._id} style={{ ...s.linhaFluxo, opacity: arrastando === idx ? 0.4 : 1 }}
              onDragOver={e => onDragOver(e, idx)} onDrop={onDrop}>
              <div style={s.colNumero}>
                <span style={s.numeroCirculo}>{idx + 1}</span>
                {idx < setoresOrdenados.length - 1 && <div style={s.linhaConectora} />}
              </div>
              <div style={s.linhaConteudo} onClick={() => ctl.setSetorAberto(setor)}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: setor.cor, flexShrink: 0 }} />
                <span style={s.setorNome}>{setor.nome}</span>
                <span style={s.countBadge}>{count} atividade{count !== 1 ? 's' : ''}</span>
              </div>
              <span
                style={s.handleArrastar}
                draggable
                onDragStart={e => { e.stopPropagation(); onDragStart(idx) }}
                onClick={e => e.stopPropagation()}
                title="Arrastar para reordenar"
              >⠿</span>
            </div>
          )
        })}
      </div>

      {confirmInativar && createPortal(
        <ModalConfirmacao
          titulo="Inativar modelo"
          mensagem={`Tem certeza que deseja inativar "${modelo.nome}"? Onboardings já em andamento não serão afetados — a alteração vale só para os próximos.`}
          textoBotao="Inativar" perigo
          onConfirmar={async () => {
            setProcessando(true)
            try { await ctl.inativar(modelo._id); toast('Modelo inativado.', 'sucesso') }
            catch { toast('Erro ao inativar.', 'erro') }
            finally { setProcessando(false); setConfirmInativar(false) }
          }}
          onCancelar={() => setConfirmInativar(false)}
        />, document.body
      )}

      {confirmExcluir && (
        <ModalExcluirPermanente
          nome={modelo.nome}
          onConfirmar={async () => {
            try { await ctl.excluirPermanente(modelo._id); toast('Modelo excluído permanentemente.', 'sucesso'); setConfirmExcluir(false) }
            catch { toast('Erro ao excluir modelo.', 'erro') }
          }}
          onCancelar={() => setConfirmExcluir(false)}
        />
      )}
    </div>
  )
}

const s = {
  // ── Nível 1: cabeçalho + grade de cards (mesmo padrão visual da categoria Setores) ──
  categoriaHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' },
  categoriaTitulo: { fontSize: '0.95rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'var(--fonte-corpo)', letterSpacing: '-0.01em' },
  btnNovo: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '9px', padding: '7px 14px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' },
  gridModelos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '10px' },
  cardModelo: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.1s, opacity 0.15s' },
  cardBarra: { height: '4px', width: '100%' },
  cardCorpo: { padding: '11px' },
  selo: { width: '23px', height: '23px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700', color: '#fff', flexShrink: 0, fontFamily: 'var(--fonte-corpo)' },
  cardNome: { fontSize: '0.83rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardMeta: { fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: 0, fontFamily: 'var(--fonte-corpo)' },

  // ── Conteúdo: cabeçalho do detalhe ──
  cabecalhoModelo: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' },
  subtituloFixo: { fontSize: '0.76rem', color: 'var(--texto-apagado)', marginTop: '3px', fontFamily: 'var(--fonte-corpo)' },
  btnInativar: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '9px', color: '#f87171', padding: '7px 14px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnReativar: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '9px', padding: '7px 14px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnExcluirPerm: { background: 'none', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '9px', color: '#f87171', padding: '7px 14px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' },

  // ── Nível 2: fluxo de setores ──
  fluxoSetores: { display: 'flex', flexDirection: 'column' },
  linhaFluxo: { display: 'flex', alignItems: 'stretch', gap: '10px' },
  colNumero: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '22px', flexShrink: 0 },
  numeroCirculo: { width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,177,65,0.12)', color: 'var(--verde)', fontSize: '0.72rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--fonte-corpo)' },
  linhaConectora: { flex: 1, width: '2px', minHeight: '18px', background: 'var(--borda)', margin: '2px 0' },
  linhaConteudo: { flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '11px', padding: '11px 14px', cursor: 'pointer', marginBottom: '8px', minWidth: 0, transition: 'border-color 0.15s' },
  setorNome: { fontSize: '0.85rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  countBadge: { fontSize: '0.68rem', color: 'var(--texto-apagado)', background: 'var(--input)', border: '1px solid var(--borda)', padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap', flexShrink: 0 },
  handleArrastar: { color: 'var(--texto-apagado)', fontSize: '18px', letterSpacing: '2px', cursor: 'grab', display: 'flex', alignItems: 'center', padding: '0 4px 8px', userSelect: 'none', flexShrink: 0 },

  // ── Nível 3: atividades do setor ──
  detalheHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  detalheTitulo: { fontSize: '1rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'var(--fonte-corpo)' },
  listaAtividades: { display: 'flex', flexDirection: 'column' },
  atividadeLinha: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 4px', borderBottom: '1px solid var(--borda)', position: 'relative' },
  atividadeNum: { fontSize: '0.68rem', color: 'var(--texto-apagado)', width: '18px', textAlign: 'center', flexShrink: 0 },
  atividadeDesc: { fontSize: '0.85rem', color: 'var(--texto)', flex: 1, fontFamily: 'var(--fonte-corpo)' },
  respBadge: { fontSize: '0.7rem', color: 'var(--verde)', background: 'rgba(0,177,65,0.08)', border: '1px solid rgba(0,177,65,0.18)', padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap' },
  btnRemov: { background: 'none', border: 'none', color: 'var(--texto-apagado)', fontSize: '11px', cursor: 'pointer', padding: '2px 4px', opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 },
  linhaAdicionar: { textAlign: 'left', background: 'none', border: '1px dashed var(--borda)', borderRadius: '9px', color: 'var(--verde)', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', padding: '10px 12px', marginTop: '10px', fontFamily: 'var(--fonte-corpo)' },
  btnVoltar: { background: 'none', border: 'none', color: 'var(--texto-apagado)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', padding: '0', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' },

  // ── Painel lateral direito (adicionar atividade) ──
  painelWrapper: { width: '300px', flexShrink: 0, position: 'fixed', right: '0', top: '54px', bottom: '0', borderLeft: '1px solid var(--borda)', background: 'var(--card)', display: 'flex', flexDirection: 'column', zIndex: 9200, overflowY: 'auto' },
  painel: { display: 'flex', flexDirection: 'column', height: '100%' },
  painelTopo: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 16px', borderBottom: '1px solid var(--borda)', flexShrink: 0 },
  painelTitulo: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)' },
  abas: { display: 'flex', borderBottom: '1px solid var(--borda)', flexShrink: 0 },
  aba: { flex: 1, padding: '10px 8px', fontSize: '0.78rem', fontFamily: 'var(--fonte-corpo)', background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'all 0.15s' },
  abaAtiva: { color: 'var(--verde)', borderBottomColor: 'var(--verde)', fontWeight: '600' },
  bancoItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid var(--borda)' },
  btnUsar: { fontSize: '0.72rem', color: 'var(--verde)', background: 'rgba(0,177,65,0.08)', border: '1px solid rgba(0,177,65,0.2)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', whiteSpace: 'nowrap' },
  badgeAdicionada: { fontSize: '0.7rem', color: 'var(--texto-apagado)', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap' },
  btnLink: { background: 'none', border: 'none', color: 'var(--verde)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', fontWeight: '600' },
  vazioPanel: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' },

  // ── Compartilhados (modais) ──
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' },
  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  modalTitulo: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer', flexShrink: 0 },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' },
  modalRodape: { display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--borda)' },
  campo: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--fonte-corpo)' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'var(--fonte-corpo)', width: '100%', boxSizing: 'border-box' },
  btnCancelar: { background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'var(--fonte-corpo)', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnSalvar: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px' },
  ordemItem: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px', userSelect: 'none', cursor: 'grab' },
  ordemNum: { width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,177,65,0.12)', color: 'var(--verde)', fontSize: '0.72rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ordemNome: { fontSize: '0.85rem', color: 'var(--texto)', flex: 1, fontFamily: 'var(--fonte-corpo)' },
}
