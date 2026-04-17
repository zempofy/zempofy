import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import api from '../services/api'
import Agenda from '../components/Agenda'
import Icone from '../components/Icones'
import Chat from '../components/Chat'
import Anotacoes from '../components/Anotacoes'
import Mural from '../components/Mural'
import Relatorios from '../components/Relatorios'

// ── Popup com informações da implantação ──
function PopupOnboarding({ tarefaId, onFechar }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api.get(`/implantacoes/por-tarefa/${tarefaId}`)
      .then(r => setDados(r.data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false))
  }, [tarefaId])

  return (
    <div style={styles.overlay} onClick={onFechar}>
      <div style={styles.popup} onClick={e => e.stopPropagation()}>
        <div style={styles.popupTopo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={styles.badgeOnb}>Onboarding</span>
            <span style={styles.popupTitulo}>Informações do cliente</span>
          </div>
          <button style={styles.btnX} onClick={onFechar}>✕</button>
        </div>

        <div style={styles.popupCorpo}>
          {carregando ? (
            <p style={{ color: 'var(--texto-apagado)', fontSize: '0.875rem' }}>Carregando...</p>
          ) : !dados ? (
            <p style={{ color: 'var(--texto-apagado)', fontSize: '0.875rem' }}>Não foi possível carregar os dados.</p>
          ) : (
            <>
              <div style={styles.popupLinha}>
                <span style={styles.popupLabel}>Cliente</span>
                <span style={styles.popupValor}>{dados.nomeCliente}</span>
              </div>
              {dados.cnpj && (
                <div style={styles.popupLinha}>
                  <span style={styles.popupLabel}>CNPJ</span>
                  <span style={{ ...styles.popupValor, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{dados.cnpj}</span>
                </div>
              )}
              {dados.modelo && (
                <div style={styles.popupLinha}>
                  <span style={styles.popupLabel}>Modelo de onboarding</span>
                  <span style={styles.popupValor}>{dados.modelo}</span>
                </div>
              )}
              <div style={styles.popupLinha}>
                <span style={styles.popupLabel}>Criado por</span>
                <span style={styles.popupValor}>{dados.criadoPor}</span>
              </div>
              <div style={styles.popupLinha}>
                <span style={styles.popupLabel}>Data de início</span>
                <span style={styles.popupValor}>
                  {new Date(dados.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div style={styles.popupLinha}>
                <span style={styles.popupLabel}>Status</span>
                <span style={{
                  fontSize: '0.75rem', fontWeight: '600', padding: '2px 8px', borderRadius: '6px',
                  background: dados.status === 'concluida' ? 'rgba(0,177,65,0.12)' : 'rgba(245,158,11,0.12)',
                  color: dados.status === 'concluida' ? 'var(--verde)' : '#F59E0B',
                  border: dados.status === 'concluida' ? '1px solid rgba(0,177,65,0.2)' : '1px solid rgba(245,158,11,0.2)',
                  width: 'fit-content',
                }}>
                  {dados.status === 'concluida' ? 'Concluído' : 'Em andamento'}
                </span>
              </div>
            </>
          )}
        </div>

        <div style={styles.popupRodape}>
          <button style={styles.btnFecharPopup} onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function PaginaMinhasTarefas({ tarefas, recarregar }) {
  const { usuario } = useAuth()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ descricao: '', data: '', hora: '', local: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [idsOnboarding, setIdsOnboarding] = useState(new Set())
  const [popupTarefaId, setPopupTarefaId] = useState(null)

  useEffect(() => {
    api.get('/implantacoes').then(res => {
      const ids = new Set()
      res.data.forEach(imp => {
        imp.etapas?.forEach(etapa => {
          etapa.tarefas?.forEach(t => {
            if (t.tarefa) ids.add(typeof t.tarefa === 'object' ? t.tarefa._id : t.tarefa)
          })
        })
      })
      setIdsOnboarding(ids)
    }).catch(() => {})
  }, [tarefas])

  const ehOnboarding = (t) => idsOnboarding.has(t._id)

  const tarefasOnboarding = tarefas.filter(t => ehOnboarding(t))
  const tarefasNormais = tarefas.filter(t => !ehOnboarding(t))

  const onbPendentes = tarefasOnboarding.filter(t => t.status === 'pendente')
  const onbConcluidas = tarefasOnboarding.filter(t => t.status === 'concluida')
  const normaisPendentes = tarefasNormais.filter(t => t.status === 'pendente')
  const normaisConcluidas = tarefasNormais.filter(t => t.status === 'concluida')
  const totalPendentes = tarefas.filter(t => t.status === 'pendente').length
  const totalConcluidas = tarefas.filter(t => t.status === 'concluida').length

  const concluir = async (id) => { await api.patch(`/tarefas/${id}/concluir`); recarregar() }
  const desmarcar = async (id) => { await api.patch(`/tarefas/${id}/desmarcar`); recarregar() }

  const criar = async (e) => {
    e.preventDefault()
    if (!form.descricao.trim()) return setErro('Descrição é obrigatória.')
    setSalvando(true); setErro('')
    try {
      await api.post('/tarefas', { ...form, responsavelId: usuario?._id || usuario?.id })
      setForm({ descricao: '', data: '', hora: '', local: '' })
      setMostrarForm(false)
      recarregar()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar tarefa.')
    } finally {
      setSalvando(false)
    }
  }

  const BotoesAcao = ({ t }) => (
    <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
      {ehOnboarding(t) && (
        <button style={styles.btnInfo} onClick={() => setPopupTarefaId(t._id)} title="Ver informações do cliente">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Info
        </button>
      )}
      {t.status === 'pendente' ? (
        <button style={styles.btnVerde} onClick={() => concluir(t._id)}>
          <Icone.Check size={13} /> Concluir
        </button>
      ) : (
        <button style={styles.btnDesmarcar} onClick={() => desmarcar(t._id)}>
          Desmarcar
        </button>
      )}
    </div>
  )

  const CardTarefa = ({ t }) => (
    <div style={{
      ...styles.cardTarefa,
      borderLeft: ehOnboarding(t) ? '3px solid var(--verde)' : '3px solid transparent',
      opacity: t.status === 'concluida' ? 0.6 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          {ehOnboarding(t) && <span style={styles.badgeOnb}>Onboarding</span>}
          <p style={{ ...styles.tarefaDesc, margin: 0, textDecoration: t.status === 'concluida' ? 'line-through' : 'none' }}>
            {t.descricao}
          </p>
        </div>
        <p style={styles.tarefaMeta}>
          {t.local && t.local}
          {t.data && ` · ${t.data.split('-').reverse().join('/')}`}
          {t.hora && ` · ${t.hora}`}
          {t.status === 'concluida' && t.concluidaEm && ` · Concluída em ${new Date(t.concluidaEm).toLocaleDateString('pt-BR')}`}
        </p>
      </div>
      <BotoesAcao t={t} />
    </div>
  )

  return (
    <div>
      {popupTarefaId && (
        <PopupOnboarding tarefaId={popupTarefaId} onFechar={() => setPopupTarefaId(null)} />
      )}

      <div style={styles.cabecalho}>
        <div>
          <h1 style={styles.titulo}>Minhas Tarefas</h1>
          <p style={styles.subtitulo}>{totalPendentes} pendente(s) · {totalConcluidas} concluída(s)</p>
        </div>
        <button
          style={mostrarForm ? styles.btnCancelar : styles.btnNovo}
          onClick={() => { setMostrarForm(!mostrarForm); setErro('') }}
        >
          {mostrarForm ? '✕ Cancelar' : '+ Nova tarefa'}
        </button>
      </div>

      {/* Formulário nova tarefa */}
      {mostrarForm && (
        <div style={styles.formulario}>
          <h3 style={{ color: 'var(--texto)', marginBottom: '16px', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: '600' }}>
            Nova tarefa
          </h3>
          {erro && <p style={styles.erroMsg}>{erro}</p>}
          <form onSubmit={criar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
              <label style={styles.label}>Descrição</label>
              <input style={styles.input} placeholder="O que precisa ser feito?"
                value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} autoFocus required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={styles.label}>Data</label>
              <input style={styles.input} type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={styles.label}>Hora</label>
              <input style={styles.input} type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={styles.label}>Local</label>
              <input style={styles.input} placeholder="Ex: Escritório..." value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} />
            </div>
            <button type="submit" disabled={salvando} style={{ ...styles.btnNovo, alignSelf: 'end' }}>
              {salvando ? 'Salvando...' : 'Criar tarefa'}
            </button>
          </form>
        </div>
      )}

      {/* ── ONBOARDING DE CLIENTES ── */}
      <div style={styles.secao}>
        <div style={styles.secaoHeader}>
          <h2 style={styles.secaoTitulo}>Onboarding de clientes</h2>
          <span style={styles.badgeContadorVerde}>{onbPendentes.length} pendente(s)</span>
        </div>
        {onbPendentes.length === 0 && onbConcluidas.length === 0 ? (
          <div style={styles.vazio}>
            <Icone.ClipboardList size={32} style={{ color: 'var(--borda)', opacity: 0.5 }} />
            <p>Nenhuma tarefa de onboarding atribuída a você.</p>
          </div>
        ) : (
          <>
            {onbPendentes.map(t => <CardTarefa key={t._id} t={t} />)}
            {onbConcluidas.length > 0 && (
              <>
                <p style={styles.subLabel}>Concluídas</p>
                {onbConcluidas.map(t => <CardTarefa key={t._id} t={t} />)}
              </>
            )}
          </>
        )}
      </div>

      {/* ── MINHAS TAREFAS ── */}
      <div style={styles.secao}>
        <div style={styles.secaoHeader}>
          <h2 style={styles.secaoTitulo}>Minhas tarefas</h2>
          <span style={styles.badgeContadorNeutro}>{normaisPendentes.length} pendente(s)</span>
        </div>
        {normaisPendentes.length === 0 && normaisConcluidas.length === 0 ? (
          <div style={styles.vazio}>
            <Icone.CheckCircle size={32} style={{ color: 'var(--verde)', opacity: 0.4 }} />
            <p>Nenhuma tarefa ainda. Use "+ Nova tarefa" para criar.</p>
          </div>
        ) : (
          <>
            {normaisPendentes.map(t => <CardTarefa key={t._id} t={t} />)}
            {normaisConcluidas.length > 0 && (
              <>
                <p style={styles.subLabel}>Concluídas</p>
                {normaisConcluidas.map(t => <CardTarefa key={t._id} t={t} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PaginaInicio({ usuario, tarefas, setPagina }) {
  const [avisos, setAvisos] = useState([])
  const hoje = new Date().toISOString().split('T')[0]
  const h = new Date().getHours()
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'

  const pendentes = tarefas.filter(t => t.status === 'pendente')
  const concluidas = tarefas.filter(t => t.status === 'concluida')
  const tarefasHoje = pendentes.filter(t => t.data === hoje)

  useEffect(() => {
    api.get('/mural').then(r => setAvisos(r.data.slice(0, 1))).catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={styles.titulo}>{saudacao}, {usuario.nome.split(' ')[0]}!</h1>
        <p style={styles.subtitulo}>Veja o que tem pra hoje</p>
      </div>

      <div style={styles.cards}>
        <div style={styles.card}>
          <span style={styles.cardIcone}><Icone.ClipboardList size={22} /></span>
          <div>
            <p style={styles.cardNum}>{pendentes.length}</p>
            <p style={styles.cardLabel}>Pendentes</p>
          </div>
        </div>
        <div style={{ ...styles.card, borderColor: tarefasHoje.length > 0 ? 'rgba(245,158,11,0.3)' : undefined }}>
          <span style={{ ...styles.cardIcone, color: tarefasHoje.length > 0 ? '#F59E0B' : undefined }}>
            <Icone.Calendar size={22} />
          </span>
          <div>
            <p style={styles.cardNum}>{tarefasHoje.length}</p>
            <p style={styles.cardLabel}>Para hoje</p>
          </div>
        </div>
        <div style={styles.card}>
          <span style={{ ...styles.cardIcone, color: 'var(--verde)' }}><Icone.CheckCircle size={22} /></span>
          <div>
            <p style={styles.cardNum}>{concluidas.length}</p>
            <p style={styles.cardLabel}>Concluídas</p>
          </div>
        </div>
      </div>

      <div style={styles.gridDois}>
        <div style={styles.secaoCard}>
          <div style={styles.secaoCardTopo}>
            <h2 style={styles.secaoTitulo}>Minhas tarefas de hoje</h2>
            <button style={styles.btnVer} onClick={() => setPagina('tarefas')}>Ver todas</button>
          </div>
          {tarefasHoje.length === 0 ? (
            <div style={styles.vazioCard}>
              <Icone.CheckCircle size={28} style={{ color: 'var(--borda)' }} />
              <p>Nenhuma tarefa para hoje!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tarefasHoje.slice(0, 5).map(t => (
                <div key={t._id} style={styles.linhaTarefa}>
                  <div style={styles.linhaTarefaPonto} />
                  <div style={{ flex: 1 }}>
                    <p style={styles.linhaTarefaDesc}>{t.descricao}</p>
                    {t.hora && <p style={styles.linhaTarefaMeta}>{t.hora}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.secaoCard}>
          <div style={styles.secaoCardTopo}>
            <h2 style={styles.secaoTitulo}>Mural de avisos</h2>
            <button style={styles.btnVer} onClick={() => setPagina('mural')}>Ver todos</button>
          </div>
          {avisos.length === 0 ? (
            <div style={styles.vazioCard}>
              <Icone.Bell size={28} style={{ color: 'var(--borda)' }} />
              <p>Nenhum aviso publicado</p>
            </div>
          ) : (
            avisos.map(a => (
              <div key={a._id} style={styles.linhaAviso}>
                {a.fixado && <span style={styles.badgeFixado}>Fixado</span>}
                <p style={styles.linhaAvisoTitulo}>{a.titulo}</p>
                <p style={styles.linhaAvisoTexto}>{a.texto.slice(0, 100)}{a.texto.length > 100 ? '...' : ''}</p>
                <p style={styles.linhaAvisoMeta}>{new Date(a.criadoEm).toLocaleDateString('pt-BR')}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardFuncionario() {
  const { usuario } = useAuth()
  const [pagina, setPagina] = useState('inicio')
  const [tarefas, setTarefas] = useState([])

  const carregarDados = async () => {
    try {
      const res = await api.get('/tarefas')
      setTarefas(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => { carregarDados() }, [])

  const menuItens = [
    { id: 'inicio', label: 'Início', icone: <Icone.Home size={16} /> },
    { id: 'tarefas', label: 'Minhas Tarefas', icone: <Icone.ClipboardList size={16} /> },
    { id: 'anotacoes', label: 'Anotações', icone: <Icone.Edit size={16} /> },
    { id: 'relatorios', label: 'Relatórios', icone: <Icone.BarChart size={16} /> },
    { id: 'mural', label: 'Mural', icone: <Icone.Bell size={16} /> },
  ]

  return (
    <Layout menuItens={menuItens} paginaAtual={pagina} setPagina={setPagina}>
      {pagina === 'inicio' && <PaginaInicio usuario={usuario} tarefas={tarefas} setPagina={setPagina} />}
      {pagina === 'tarefas' && <PaginaMinhasTarefas tarefas={tarefas} recarregar={carregarDados} />}
      {pagina === 'agenda' && <Agenda cargo="funcionario" usuarioAtualId={usuario?.id} />}
      {pagina === 'chat' && <Chat setPagina={setPagina} />}
      {pagina === 'anotacoes' && <Anotacoes />}
      {pagina === 'relatorios' && <Relatorios />}
      {pagina === 'mural' && <Mural />}
    </Layout>
  )
}

const styles = {
  // Popup
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' },
  popup: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '18px', width: '100%', maxWidth: '420px', margin: '0 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' },
  popupTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--borda)' },
  popupTitulo: { fontWeight: '700', fontSize: '0.95rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  popupCorpo: { padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' },
  popupLinha: { display: 'flex', flexDirection: 'column', gap: '3px' },
  popupLabel: { fontSize: '0.65rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  popupValor: { fontSize: '0.9rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif', fontWeight: '500' },
  popupRodape: { padding: '14px 22px', borderTop: '1px solid var(--borda)', display: 'flex', justifyContent: 'flex-end' },
  btnFecharPopup: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto-apagado)', padding: '8px 18px', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', cursor: 'pointer' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' },

  // Badges
  badgeOnb: { display: 'inline-flex', alignItems: 'center', fontSize: '0.62rem', fontWeight: '700', padding: '2px 7px', borderRadius: '6px', background: 'var(--verde-glow)', color: 'var(--verde)', border: '1px solid rgba(0,177,65,0.2)', whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '0.3px' },
  badgeContadorVerde: { fontSize: '0.72rem', color: 'var(--verde)', background: 'var(--verde-glow)', borderRadius: '20px', padding: '2px 10px', border: '1px solid rgba(0,177,65,0.2)', fontWeight: '600' },
  badgeContadorNeutro: { fontSize: '0.72rem', color: 'var(--texto-apagado)', background: 'var(--input)', borderRadius: '20px', padding: '2px 10px', border: '1px solid var(--borda)', fontWeight: '600' },
  badgeFixado: { fontSize: '0.65rem', fontWeight: '700', color: 'var(--verde)', background: 'rgba(34,197,94,0.15)', padding: '2px 7px', borderRadius: '6px', width: 'fit-content' },

  // Seção
  secaoHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--borda)' },
  subLabel: { fontSize: '0.68rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '12px 0 8px' },

  // Formulário
  formulario: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '14px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  label: { fontSize: '0.68rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' },
  erroMsg: { color: '#f87171', fontSize: '0.8rem', background: 'rgba(248,113,113,0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)', marginBottom: '12px' },

  // Botões
  btnNovo: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,177,65,0.3)', whiteSpace: 'nowrap' },
  btnCancelar: { background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnVerde: { display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,177,65,0.12)', color: 'var(--verde)', border: '1px solid rgba(0,177,65,0.25)', borderRadius: '8px', padding: '7px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', fontWeight: '600' },
  btnDesmarcar: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto-apagado)', padding: '7px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  btnInfo: { display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,177,65,0.06)', border: '1px solid rgba(0,177,65,0.2)', borderRadius: '8px', color: 'var(--verde)', padding: '7px 10px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', fontWeight: '600' },

  // Layout geral
  gridDois: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' },
  secaoCard: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  secaoCardTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  btnVer: { background: 'none', border: 'none', color: 'var(--verde)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' },
  vazioCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px 0', color: 'var(--texto-apagado)', fontSize: '0.85rem' },
  linhaTarefa: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--borda)' },
  linhaTarefaPonto: { width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: '5px' },
  linhaTarefaDesc: { fontSize: '0.875rem', color: 'var(--texto)', margin: 0 },
  linhaTarefaMeta: { fontSize: '0.75rem', color: 'var(--texto-apagado)', margin: '2px 0 0' },
  linhaAviso: { padding: '12px', background: 'var(--input)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' },
  linhaAvisoTitulo: { fontSize: '0.875rem', fontWeight: '600', color: 'var(--texto)', margin: 0 },
  linhaAvisoTexto: { fontSize: '0.8rem', color: 'var(--texto-apagado)', margin: 0, lineHeight: '1.4' },
  linhaAvisoMeta: { fontSize: '0.7rem', color: 'var(--texto-apagado)', margin: 0 },
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' },
  titulo: { fontSize: '1.75rem', color: 'var(--texto)', marginBottom: '4px', letterSpacing: '-0.03em', fontWeight: '700' },
  subtitulo: { color: 'var(--texto-apagado)', fontSize: '0.875rem' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' },
  card: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' },
  cardIcone: { color: 'var(--texto-apagado)', flexShrink: 0 },
  cardNum: { fontSize: '1.8rem', fontFamily: 'Inter, sans-serif', fontWeight: '700', color: 'var(--texto)', lineHeight: 1 },
  cardLabel: { fontSize: '0.8rem', color: 'var(--texto-apagado)', marginTop: '4px' },
  secao: { marginBottom: '32px' },
  secaoTitulo: { fontSize: '0.72rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 },
  vazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '40px', color: 'var(--texto-apagado)', textAlign: 'center', fontSize: '0.875rem' },
  cardTarefa: { display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '14px 18px', marginBottom: '8px', flexWrap: 'wrap', transition: 'border-color 0.15s' },
  tarefaDesc: { fontSize: '0.92rem', color: 'var(--texto)', marginBottom: '3px', fontWeight: '500' },
  tarefaMeta: { fontSize: '0.8rem', color: 'var(--texto-apagado)', margin: 0 },
}
