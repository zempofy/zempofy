import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import api from '../services/api'
import ModalConfirmacao from '../components/ModalConfirmacao'
import ModalLembrete from '../components/ModalLembrete'
import Agenda from '../components/Agenda'
import { useToast } from '../components/Toast'
import Icone from '../components/Icones'
import Chat from '../components/Chat'
import Anotacoes from '../components/Anotacoes'
import Mural from '../components/Mural'
import Avatar from '../components/Avatar'
import Relatorios from '../components/Relatorios'
import Implantacao from '../components/Implantacao'
import ModelosOnboarding from '../components/ModelosOnboarding'
import Setores from '../components/Setores'
import Checklist from '../components/Checklist'
import Clientes from '../components/Clientes'

// ============ PÁGINAS INTERNAS ============

function saudacao(nome) {
  const h = new Date().getHours()
  const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${parte}, ${nome.split(' ')[0]}!`
}

function PaginaInicio({ usuario, tarefas, funcionarios, setPagina }) {
  const [avisos, setAvisos] = useState([])
  const hoje = new Date().toISOString().split('T')[0]

  const pendentes = tarefas.filter(t => t.status === 'pendente').length
  const concluidas = tarefas.filter(t => t.status === 'concluida').length
  const taxa = tarefas.length > 0 ? Math.round((concluidas / tarefas.length) * 100) : 0
  const tarefasHoje = tarefas.filter(t => t.data === hoje && t.status === 'pendente')

  useEffect(() => {
    api.get('/mural').then(r => setAvisos(r.data.slice(0, 2))).catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Saudação */}
      <div>
        <h1 style={styles.titulo}>{saudacao(usuario.nome)}</h1>
        <p style={styles.subtitulo}>{usuario.empresa.nome}</p>
      </div>

      {/* Cards métricas */}
      <div style={styles.cards}>
        <div style={styles.card}>
          <span style={styles.cardIcone}><Icone.Users size={22} /></span>
          <div>
            <p style={styles.cardNum}>{funcionarios.length}</p>
            <p style={styles.cardLabel}>Colaboradores</p>
          </div>
        </div>
        <div style={styles.card}>
          <span style={styles.cardIcone}><Icone.ClipboardList size={22} /></span>
          <div>
            <p style={styles.cardNum}>{pendentes}</p>
            <p style={styles.cardLabel}>Pendentes</p>
          </div>
        </div>
        <div style={styles.card}>
          <span style={styles.cardIcone}><Icone.CheckCircle size={22} /></span>
          <div>
            <p style={styles.cardNum}>{concluidas}</p>
            <p style={styles.cardLabel}>Concluídas</p>
          </div>
        </div>
        <div style={{ ...styles.card, borderColor: 'rgba(34,197,94,0.3)' }}>
          <span style={{ ...styles.cardIcone, color: 'var(--verde)' }}><Icone.BarChart size={22} /></span>
          <div>
            <p style={{ ...styles.cardNum, color: 'var(--verde)' }}>{taxa}%</p>
            <p style={styles.cardLabel}>Conclusão</p>
          </div>
        </div>
      </div>

      <div style={styles.gridDois}>
        {/* Tarefas de hoje */}
        <div style={styles.secaoCard}>
          <div style={styles.secaoCardTopo}>
            <h2 style={styles.secaoTitulo}>Tarefas de hoje</h2>
            <button style={styles.btnVer} onClick={() => setPagina('tarefas')}>Ver todas</button>
          </div>
          {tarefasHoje.length === 0 ? (
            <div style={styles.vazioCard}>
              <Icone.CheckCircle size={28} style={{ color: 'var(--borda)' }} />
              <p>Nenhuma tarefa para hoje</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tarefasHoje.slice(0, 5).map(t => (
                <div key={t._id} style={styles.linhaTarefa}>
                  <div style={styles.linhaTarefaPonto} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={styles.linhaTarefaDesc}>{t.descricao}</p>
                    {(t.hora || t.responsavel?.nome) && (
                      <p style={styles.linhaTarefaMeta}>
                        {t.hora && t.hora}{t.hora && t.responsavel?.nome && ' · '}{t.responsavel?.nome}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {tarefasHoje.length > 5 && (
                <p style={{ color: 'var(--texto-apagado)', fontSize: '0.78rem', textAlign: 'center' }}>
                  +{tarefasHoje.length - 5} tarefas
                </p>
              )}
            </div>
          )}
        </div>

        {/* Últimos avisos do mural */}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {avisos.map(a => (
                <div key={a._id} style={styles.linhaAviso}>
                  {a.fixado && <span style={styles.badgeFixado}>Fixado</span>}
                  <p style={styles.linhaAvisoTitulo}>{a.titulo}</p>
                  <p style={styles.linhaAvisoTexto}>{a.texto.slice(0, 80)}{a.texto.length > 80 ? '...' : ''}</p>
                  <p style={styles.linhaAvisoMeta}>{a.autor?.nome} · {new Date(a.criadoEm).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const PERMISSOES_LABELS = [
  { key: 'gerenciarEquipe',     label: 'Gerenciar equipe',      desc: 'Adicionar e remover membros' },
  { key: 'gerenciarOnboarding', label: 'Gerenciar onboarding',  desc: 'Implantações, modelos e checklist' },
  { key: 'gerenciarClientes',   label: 'Gerenciar clientes',    desc: 'Ver e editar carteira de clientes' },
  { key: 'verRelatorios',       label: 'Ver relatórios',        desc: 'Métricas e dados da equipe' },
  { key: 'publicarMural',       label: 'Publicar no mural',     desc: 'Postar avisos para a equipe' },
  { key: 'criarTarefas',         label: 'Criar tarefas para outros', desc: 'Atribuir tarefas a outros colaboradores' },
]

function PainelPermissoes({ permissoes, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
      {PERMISSOES_LABELS.map(p => (
        <div
          key={p.key}
          onClick={() => onChange({ ...permissoes, [p.key]: !permissoes[p.key] })}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
            background: permissoes[p.key] ? 'rgba(0,177,65,0.08)' : 'transparent',
            border: permissoes[p.key] ? '1px solid rgba(0,177,65,0.2)' : '1px solid var(--borda)',
            transition: 'all 0.15s',
          }}
        >
          <div style={{
            width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
            border: permissoes[p.key] ? '2px solid var(--verde)' : '2px solid #3f3f46',
            background: permissoes[p.key] ? 'var(--verde)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          }}>
            {permissoes[p.key] && (
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="1.5 5 4 7.5 8.5 2.5"/>
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' }}>{p.label}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--texto-apagado)' }}>{p.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const PERMISSOES_VAZIAS = {
  gerenciarEquipe: false, gerenciarOnboarding: false,
  gerenciarClientes: false, verRelatorios: false, publicarMural: false, criarTarefas: false,
}

function PaginaEquipe({ usuario, equipe, recarregar }) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', setorId: '' })
  const [permissoes, setPermissoes] = useState({ ...PERMISSOES_VAZIAS })
  const [setores, setSetores] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [editandoPermId, setEditandoPermId] = useState(null)
  const [permEdicao, setPermEdicao] = useState({})
  const { mostrar } = useToast()

  useEffect(() => {
    api.get('/setores').then(r => setSetores(r.data)).catch(() => {})
  }, [])

  const membroParaRemover = equipe.find(f => f._id === confirmandoId)

  const criar = async (e) => {
    e.preventDefault()
    setErro(''); setCarregando(true)
    try {
      const res = await api.post('/usuarios', { ...form, permissoes })
      // Se selecionou setor, adiciona o colaborador ao setor
      if (form.setorId && res?.data?.id) {
        if (res?.data?.id || res?.data?._id) {
        const uid = res.data.id || res.data._id
        await api.patch(`/setores/${form.setorId}/membros`, { usuarioId: uid }).catch(() => {})
      }
      }
      setForm({ nome: '', email: '', senha: '', setorId: '' })
      setPermissoes({ ...PERMISSOES_VAZIAS })
      setMostrarForm(false)
      recarregar()
      mostrar('Colaborador adicionado com sucesso!')
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar colaborador.')
    } finally { setCarregando(false) }
  }

  const excluir = async (id) => {
    await api.delete(`/usuarios/${id}`)
    recarregar(); setConfirmandoId(null)
    mostrar('Membro removido da equipe.', 'aviso')
  }

  const salvarPermissoes = async (id) => {
    try {
      await api.put(`/usuarios/${id}`, { permissoes: permEdicao })
      recarregar(); setEditandoPermId(null)
      mostrar('Permissões atualizadas!')
    } catch { mostrar('Erro ao salvar permissões.', 'erro') }
  }

  return (
    <div>
      {confirmandoId && (
        <ModalConfirmacao
          titulo="Remover membro"
          mensagem={`Tem certeza que deseja remover ${membroParaRemover?.nome} da equipe?`}
          textoBotao="Remover" perigo
          onConfirmar={() => excluir(confirmandoId)}
          onCancelar={() => setConfirmandoId(null)}
        />
      )}

      <div style={styles.cabecalho}>
        <div>
          <h1 style={styles.titulo}>Equipe</h1>
          <p style={styles.subtitulo}>{equipe.length} pessoa(s) cadastrada(s)</p>
        </div>
        <button style={styles.btnPrimario} onClick={() => { setMostrarForm(!mostrarForm); setErro('') }}>
          {mostrarForm ? '✕ Cancelar' : '+ Novo membro'}
        </button>
      </div>

      {mostrarForm && (
        <div style={styles.formulario}>
          <h3 style={{ color: 'var(--texto)', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>Novo colaborador</h3>
          {erro && <div style={styles.erro}>{erro}</div>}
          <form onSubmit={criar} style={styles.formGrid}>
            <div style={styles.campo}>
              <label style={styles.label}>Nome</label>
              <input style={styles.input} placeholder="Nome completo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>E-mail</label>
              <input style={styles.input} type="email" placeholder="email@empresa.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Senha temporária</label>
              <input style={styles.input} type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} required />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Setor</label>
              <select style={styles.input} value={form.setorId} onChange={e => setForm({ ...form, setorId: e.target.value })}>
                <option value="">Selecionar setor (opcional)</option>
                {setores.map(s => <option key={s._id} value={s._id}>{s.nome}</option>)}
              </select>
            </div>
            <button type="submit" style={styles.btnPrimario} disabled={carregando}>
              {carregando ? 'Criando...' : 'Criar colaborador'}
            </button>
          </form>
          <div style={{ marginTop: '20px' }}>
            <label style={styles.label}>Permissões de acesso</label>
            <PainelPermissoes permissoes={permissoes} onChange={setPermissoes} />
          </div>
        </div>
      )}

      <div style={styles.tabelaWrapper}>
        {equipe.length === 0 ? (
          <p style={{ color: 'var(--texto-apagado)', padding: '20px' }}>Nenhum membro cadastrado ainda.</p>
        ) : (
          equipe.map((f, idx) => (
            <div key={f._id}>
              <div style={styles.linhaTabela}>
                <Avatar nome={f.nome} foto={f.avatar} size={40} fontSize={16} />
                <div style={{ flex: 1 }}>
                  <p style={styles.nomeFunc}>{f.nome}</p>
                  <p style={styles.emailFunc}>{f.email}</p>
                </div>
                <span style={{ ...styles.badgeCargo, color: 'var(--texto-apagado)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icone.User size={12} /> Colaborador
                </span>
                {/* Menu "..." */}
                <div style={{ position: 'relative' }}>
                  <button
                    style={styles.btnMenu}
                    onClick={() => setEditandoPermId(editandoPermId === f._id ? null : f._id)}
                  >
                    ···
                  </button>
                  {editandoPermId === f._id && (
                    <div style={{ ...styles.dropdownMenu, ...(idx >= equipe.length - 2 ? { bottom: '100%', top: 'auto', marginBottom: '4px', marginTop: 0 } : {}) }}>
                      <button
                        style={styles.dropdownItem}
                        onClick={() => {
                          setPermEdicao(f.permissoes || { ...PERMISSOES_VAZIAS })
                          setEditandoPermId('perm_' + f._id)
                        }}
                      >
                        Permissões
                      </button>
                      <button
                        style={{ ...styles.dropdownItem, color: '#f87171' }}
                        onClick={() => { setConfirmandoId(f._id); setEditandoPermId(null) }}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Painel de permissões expandido abaixo da linha */}
              {editandoPermId === 'perm_' + f._id && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--borda)', background: 'rgba(0,0,0,0.15)' }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                    Permissões de {f.nome.split(' ')[0]}
                  </p>
                  <PainelPermissoes permissoes={permEdicao} onChange={setPermEdicao} />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <button style={styles.btnPrimario} onClick={() => salvarPermissoes(f._id)}>
                      Salvar
                    </button>
                    <button style={styles.btnNeutro} onClick={() => setEditandoPermId(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const ETIQUETAS_OPCOES = [
  { label: 'Em andamento', cor: '#2196F3' },
  { label: 'Reunião', cor: '#8B5CF6' },
  { label: 'Revisão', cor: '#EC4899' },
]

const PRIORIDADES = {
  alta:  { label: 'Alta',  cor: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  media: { label: 'Média', cor: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  baixa: { label: 'Baixa', cor: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
}

function BadgePrioridade({ prioridade }) {
  if (!prioridade) return null
  const p = PRIORIDADES[prioridade]
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 7px', borderRadius: '5px', background: p.bg, color: p.cor, letterSpacing: '0.3px', flexShrink: 0 }}>
      {p.label}
    </span>
  )
}

function Subtarefas({ tarefaMaeId, concluida }) {
  const [subtarefas, setSubtarefas] = useState([])
  const [expandido, setExpandido] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  const [novaDesc, setNovaDesc] = useState('')
  const { mostrar } = useToast()

  const carregar = async () => {
    try {
      const res = await api.get(`/tarefas/${tarefaMaeId}/subtarefas`)
      setSubtarefas(res.data)
    } catch {}
  }

  useEffect(() => { if (expandido) carregar() }, [expandido])

  const adicionar = async () => {
    if (!novaDesc.trim()) return
    await api.post('/tarefas', { descricao: novaDesc, tarefaMaeId, responsavelId: null })
    setNovaDesc('')
    setAdicionando(false)
    carregar()
    mostrar('Subtarefa adicionada!')
  }

  const concluirSub = async (id) => {
    await api.patch(`/tarefas/${id}/concluir`)
    carregar()
  }

  const excluirSub = async (id) => {
    await api.delete(`/tarefas/${id}`)
    carregar()
    mostrar('Subtarefa excluída.', 'aviso')
  }

  const total = subtarefas.length
  const concluidas = subtarefas.filter(s => s.status === 'concluida').length

  return (
    <div style={{ borderTop: '1px solid var(--borda)', marginTop: '4px', paddingTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
          onClick={() => setExpandido(!expandido)}
        >
          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: expandido ? 'rotate(90deg)' : 'rotate(0deg)', fontSize: '10px' }}>▶</span>
          Subtarefas {total > 0 && <span style={{ color: concluidas === total && total > 0 ? 'var(--verde)' : 'var(--texto-apagado)' }}>({concluidas}/{total})</span>}
        </button>
        {!concluida && (
          <button style={{ background: 'none', border: 'none', color: 'var(--verde)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}
            onClick={() => { setExpandido(true); setAdicionando(true) }}>
            + Adicionar
          </button>
        )}
      </div>

      {expandido && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {subtarefas.map(s => (
            <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--input)', borderRadius: '8px' }}>
              <button
                style={{ width: '16px', height: '16px', minWidth: '16px', borderRadius: '4px', border: `2px solid ${s.status === 'concluida' ? 'var(--verde)' : 'var(--borda)'}`, background: s.status === 'concluida' ? 'var(--verde)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' }}
                onClick={() => s.status === 'pendente' ? concluirSub(s._id) : null}
              >
                {s.status === 'concluida' && '✓'}
              </button>
              <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--texto)', textDecoration: s.status === 'concluida' ? 'line-through' : 'none', opacity: s.status === 'concluida' ? 0.5 : 1 }}>
                {s.descricao}
              </span>
              {s.responsavel?.nome && <span style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)' }}>{s.responsavel.nome}</span>}
              <button style={{ background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontSize: '11px', opacity: 0.6 }} onClick={() => excluirSub(s._id)}>✕</button>
            </div>
          ))}

          {adicionando && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                style={{ flex: 1, background: 'var(--input)', border: '1px solid var(--verde)', borderRadius: '8px', padding: '6px 10px', color: 'var(--texto)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}
                placeholder="Descrição da subtarefa..."
                value={novaDesc}
                onChange={e => setNovaDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') adicionar(); if (e.key === 'Escape') setAdicionando(false) }}
                autoFocus
              />
              <button style={{ background: 'var(--verde)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#fff', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }} onClick={adicionar}>Ok</button>
              <button style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', padding: '6px 10px', color: 'var(--texto-apagado)', fontSize: '0.82rem', cursor: 'pointer' }} onClick={() => setAdicionando(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CardTarefa({ t, onConcluir, onDesmarcar, onEditar, onExcluir, onEtiquetas, etiquetasOpcoes = ETIQUETAS_OPCOES, concluida = false }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [novaDesc, setNovaDesc] = useState(t.descricao)
  const [confirmando, setConfirmando] = useState(false)
  const [lembreteAberto, setLembreteAberto] = useState(false)
  const [etiquetasAbertas, setEtiquetasAbertas] = useState(false)
  const { mostrar } = useToast()

  const infos = [
    t.data && t.data.split('-').reverse().join('/'),
    t.local, t.hora,
    t.responsavel?.nome && `${t.responsavel.nome}`
  ].filter(Boolean)

  const salvarEdicao = async () => {
    if (!novaDesc.trim()) return
    await onEditar(t._id, novaDesc)
    setEditando(false)
  }

  const salvarLembrete = (lembrete) => {
    const lembretes = JSON.parse(localStorage.getItem('zempofy_lembretes') || '[]')
    lembretes.push({ tarefaId: t._id, descricao: t.descricao, ...lembrete })
    localStorage.setItem('zempofy_lembretes', JSON.stringify(lembretes))
    setLembreteAberto(false)
    mostrar(`Lembrete definido para ${lembrete.hora} do dia ${lembrete.data.split('-').reverse().join('/')}`)
  }

  const toggleEtiqueta = async (label) => {
    const novas = (t.etiquetas || []).includes(label) ? [] : [label]
    await onEtiquetas(t._id, novas)
    setEtiquetasAbertas(false)
  }

  return (
    <>
      {confirmando && (
        <ModalConfirmacao
          titulo="Excluir tarefa"
          mensagem={`Tem certeza que deseja excluir "${t.descricao}"?`}
          textoBotao="Excluir" perigo
          onConfirmar={() => { onExcluir(t._id); setConfirmando(false) }}
          onCancelar={() => setConfirmando(false)}
        />
      )}
      {lembreteAberto && (
        <ModalLembrete tarefa={t} onSalvar={salvarLembrete} onFechar={() => setLembreteAberto(false)} />
      )}

      <div style={{ ...styles.cardTarefa, borderLeft: t.prioridade ? `3px solid ${PRIORIDADES[t.prioridade]?.cor}` : undefined }}>
        <div style={styles.cardLinhaTopo}>
          <div style={{ ...styles.cardDescWrapper, opacity: concluida ? 0.5 : 1 }}>
            <BadgePrioridade prioridade={t.prioridade} />
            {editando ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                <input style={styles.inputEdicao} value={novaDesc} onChange={e => setNovaDesc(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(); if (e.key === 'Escape') setEditando(false) }} />
                <button style={styles.btnVerde} onClick={salvarEdicao}>Salvar</button>
                <button style={styles.btnNeutro} onClick={() => setEditando(false)}>Cancelar</button>
              </div>
            ) : (
              <p style={{ ...styles.tarefaDesc, textDecoration: concluida ? 'line-through' : 'none' }}>{t.descricao}</p>
            )}
          </div>

          {!concluida && !editando && (
            <div style={styles.cardBotoes}>
              <button style={styles.btnConcluir} onClick={() => onConcluir(t._id)}>✓ Concluir</button>
              <div style={{ position: 'relative' }}>
                <button style={styles.btnMenu} onClick={() => setMenuAberto(!menuAberto)}>···</button>
                {menuAberto && (
                  <div style={styles.dropdownMenu}>
                    <button style={styles.dropdownItem} onClick={() => { setLembreteAberto(true); setMenuAberto(false) }}>Lembrete</button>
                    <button style={styles.dropdownItem} onClick={() => { setEtiquetasAbertas(!etiquetasAbertas); setMenuAberto(false) }}>Etiquetas</button>
                    <div style={{ height: '1px', background: 'var(--borda)', margin: '2px 8px' }} />
                    <button style={styles.dropdownItem} onClick={() => { setEditando(true); setMenuAberto(false) }}>Editar</button>
                    <button style={{ ...styles.dropdownItem, color: '#FCA5A5' }} onClick={() => { setConfirmando(true); setMenuAberto(false) }}>Excluir</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {concluida && (
            <div style={styles.cardBotoes}>
              <div style={{ position: 'relative' }}>
                <button style={styles.btnMenu} onClick={() => setMenuAberto(!menuAberto)}>···</button>
                {menuAberto && (
                  <div style={{ ...styles.dropdownMenu, right: 0 }}>
                    <button style={styles.dropdownItem} onClick={() => { onDesmarcar(t._id); setMenuAberto(false) }}>Desmarcar</button>
                    <button style={{ ...styles.dropdownItem, color: '#FCA5A5' }} onClick={() => { setConfirmando(true); setMenuAberto(false) }}>Excluir</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Etiquetas */}
        {(t.etiquetas?.length > 0 || etiquetasAbertas) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {t.etiquetas?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {t.etiquetas.map(label => {
                  const op = etiquetasOpcoes.find(o => o.label === label)
                  return <span key={label} style={{ ...styles.etiqueta, background: (op?.cor || '#6B8F78') + '22', color: op?.cor || '#6B8F78', borderColor: (op?.cor || '#6B8F78') + '44' }}>{label}</span>
                })}
              </div>
            )}
            {etiquetasAbertas && (
              <div style={styles.etiquetasSeletor}>
                {etiquetasOpcoes.map(op => (
                  <button key={op.label}
                    style={{ ...styles.etiquetaOpcao, background: op.cor + '22', color: op.cor, borderColor: op.cor + '44', fontWeight: t.etiquetas?.includes(op.label) ? '700' : '400', outline: t.etiquetas?.includes(op.label) ? `2px solid ${op.cor}` : 'none' }}
                    onClick={() => toggleEtiqueta(op.label)}>
                    {t.etiquetas?.includes(op.label) ? '✓ ' : ''}{op.label}
                  </button>
                ))}
                <button style={styles.btnFecharEtiquetas} onClick={() => setEtiquetasAbertas(false)}>Fechar</button>
              </div>
            )}
          </div>
        )}

        {infos.length > 0 && (
          <div style={{ ...styles.cardInfos, opacity: concluida ? 0.5 : 1 }}>
            {infos.map((info, i) => (
              <span key={i} style={styles.cardInfoItem}>
                {i > 0 && <span style={styles.cardInfoSep}>·</span>}
                {info}
              </span>
            ))}
          </div>
        )}

        {/* Subtarefas */}
        <Subtarefas tarefaMaeId={t._id} concluida={concluida} />
      </div>
    </>
  )
}

// Popup de info do onboarding — reutilizado do funcionário
function PopupOnboardingAdmin({ tarefaId, onFechar }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api.get(`/implantacoes/por-tarefa/${tarefaId}`)
      .then(r => setDados(r.data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false))
  }, [tarefaId])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={onFechar}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '18px', width: '100%', maxWidth: '420px', margin: '0 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--borda)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: '700', padding: '2px 7px', borderRadius: '6px', background: 'var(--verde-glow)', color: 'var(--verde)', border: '1px solid rgba(0,177,65,0.2)' }}>Onboarding</span>
            <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' }}>Informações do cliente</span>
          </div>
          <button style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' }} onClick={onFechar}>✕</button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {carregando ? (
            <p style={{ color: 'var(--texto-apagado)', fontSize: '0.875rem' }}>Carregando...</p>
          ) : !dados ? (
            <p style={{ color: 'var(--texto-apagado)', fontSize: '0.875rem' }}>Não foi possível carregar os dados.</p>
          ) : (
            <>
              {[
                { label: 'Cliente', valor: dados.nomeCliente },
                dados.cnpj ? { label: 'CNPJ', valor: dados.cnpj, mono: true } : null,
                dados.modelo ? { label: 'Modelo de onboarding', valor: dados.modelo } : null,
                { label: 'Criado por', valor: dados.criadoPor },
                { label: 'Onboarding criado em', valor: new Date(dados.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) },
              dados.inicioServicos ? { label: 'Início dos serviços', valor: new Date(dados.inicioServicos).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) } : null,
              ].filter(Boolean).map(item => (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{item.label}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--texto)', fontWeight: '500', fontFamily: item.mono ? 'monospace' : 'Inter, sans-serif', letterSpacing: item.mono ? '0.5px' : 0 }}>{item.valor}</span>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</span>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '2px 8px', borderRadius: '6px', width: 'fit-content', background: dados.status === 'concluida' ? 'rgba(0,177,65,0.12)' : 'rgba(245,158,11,0.12)', color: dados.status === 'concluida' ? 'var(--verde)' : '#F59E0B', border: dados.status === 'concluida' ? '1px solid rgba(0,177,65,0.2)' : '1px solid rgba(245,158,11,0.2)' }}>
                  {dados.status === 'concluida' ? 'Concluído' : 'Em andamento'}
                </span>
              </div>
            </>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--borda)', display: 'flex', justifyContent: 'flex-end' }}>
          <button style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto-apagado)', padding: '8px 18px', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', cursor: 'pointer' }} onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function PaginaTarefas({ tarefas, funcionarios, recarregar }) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ descricao: '', data: '', hora: '', local: '', responsavelId: '', prioridade: '' })
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [gerenciarEtiquetas, setGerenciarEtiquetas] = useState(false)
  const [novaEtiqueta, setNovaEtiqueta] = useState('')
  const [idsOnboarding, setIdsOnboarding] = useState(new Set())
  const [popupTarefaId, setPopupTarefaId] = useState(null)
  const [etiquetasCustom, setEtiquetasCustom] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zmp_etiquetas') || 'null') || ETIQUETAS_OPCOES } catch { return ETIQUETAS_OPCOES }
  })
  const { mostrar } = useToast()

  // Busca implantações para identificar tarefas de onboarding
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

  const salvarEtiquetasCustom = (lista) => {
    setEtiquetasCustom(lista)
    localStorage.setItem('zmp_etiquetas', JSON.stringify(lista))
  }

  const adicionarEtiqueta = () => {
    const label = novaEtiqueta.trim()
    if (!label || etiquetasCustom.find(e => e.label.toLowerCase() === label.toLowerCase())) return
    const cores = ['#EF4444','#F59E0B','#2196F3','#8B5CF6','#EC4899','#22C55E','#F97316','#06B6D4','#84CC16','#A855F7']
    const cor = cores[etiquetasCustom.length % cores.length]
    salvarEtiquetasCustom([...etiquetasCustom, { label, cor }])
    setNovaEtiqueta('')
    mostrar(`Etiqueta "${label}" criada!`)
  }

  const removerEtiqueta = (label) => {
    salvarEtiquetasCustom(etiquetasCustom.filter(e => e.label !== label))
    mostrar(`Etiqueta "${label}" removida.`, 'aviso')
  }

  const criar = async (e) => {
    e.preventDefault()
    try {
      await api.post('/tarefas', form)
      setForm({ descricao: '', data: '', hora: '', local: '', responsavelId: '', prioridade: '' })
      setMostrarForm(false)
      recarregar()
      mostrar('Tarefa criada com sucesso!')
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar tarefa.')
    }
  }

  const concluir = async (id) => { await api.patch(`/tarefas/${id}/concluir`); recarregar(); mostrar('Tarefa concluída! ✓') }
  const desmarcar = async (id) => { await api.patch(`/tarefas/${id}/desmarcar`); recarregar(); mostrar('Tarefa reaberta.') }
  const editar = async (id, descricao) => { await api.put(`/tarefas/${id}`, { descricao }); recarregar(); mostrar('Tarefa atualizada.') }
  const excluir = async (id) => { await api.delete(`/tarefas/${id}`); recarregar(); mostrar('Tarefa excluída.', 'aviso') }
  const atualizarEtiquetas = async (id, novas) => { await api.patch(`/tarefas/${id}/etiquetas`, { etiquetas: novas }); recarregar() }

  const tarefasFiltradas = tarefas.filter(t => {
    const matchBusca = !busca || t.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      t.local?.toLowerCase().includes(busca.toLowerCase()) ||
      t.responsavel?.nome?.toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todas' || t.status === filtroStatus
    const matchResp = !filtroResponsavel || t.responsavel?._id === filtroResponsavel
    return matchBusca && matchStatus && matchResp
  })

  // Separar onboarding das normais
  const tarefasOnb = tarefasFiltradas.filter(t => ehOnboarding(t))
  const tarefasNormais = tarefasFiltradas.filter(t => !ehOnboarding(t))
  const onbPendentes = tarefasOnb.filter(t => t.status === 'pendente')
  const onbConcluidas = tarefasOnb.filter(t => t.status === 'concluida')
  const normaisPendentes = tarefasNormais.filter(t => t.status === 'pendente')
  const normaisConcluidas = tarefasNormais.filter(t => t.status === 'concluida')
  const totalPendentes = tarefasFiltradas.filter(t => t.status === 'pendente').length
  const totalConcluidas = tarefasFiltradas.filter(t => t.status === 'concluida').length
  const temFiltro = busca || filtroStatus !== 'todas' || filtroResponsavel

  // Wrapper do CardTarefa que injeta badge e botão Info nas tarefas de onboarding
  const CardComInfo = ({ t, concluida = false }) => (
    <div style={{ position: 'relative' }}>
      {ehOnboarding(t) && (
        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: '700', padding: '1px 6px', borderRadius: '5px', background: 'var(--verde-glow)', color: 'var(--verde)', border: '1px solid rgba(0,177,65,0.2)', letterSpacing: '0.3px' }}>
            Onboarding
          </span>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,177,65,0.06)', border: '1px solid rgba(0,177,65,0.2)', borderRadius: '6px', color: 'var(--verde)', padding: '1px 7px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}
            onClick={() => setPopupTarefaId(t._id)}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Info
          </button>
        </div>
      )}
      <div style={{ paddingTop: ehOnboarding(t) ? '32px' : '0', borderLeft: ehOnboarding(t) ? '3px solid var(--verde)' : undefined, borderRadius: ehOnboarding(t) ? '12px' : undefined }}>
        <CardTarefa t={t} etiquetasOpcoes={etiquetasCustom}
          onConcluir={concluir} onDesmarcar={desmarcar} onEditar={editar}
          onExcluir={excluir} onEtiquetas={atualizarEtiquetas} concluida={concluida} />
      </div>
    </div>
  )

  const SecaoHeader = ({ titulo, count, verde }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--borda)' }}>
      <h2 style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>{titulo}</h2>
      <span style={{ fontSize: '0.72rem', fontWeight: '600', borderRadius: '20px', padding: '2px 10px', ...(verde ? { color: 'var(--verde)', background: 'var(--verde-glow)', border: '1px solid rgba(0,177,65,0.2)' } : { color: 'var(--texto-apagado)', background: 'var(--input)', border: '1px solid var(--borda)' }) }}>
        {count} pendente(s)
      </span>
    </div>
  )

  return (
    <div>
      {popupTarefaId && (
        <PopupOnboardingAdmin tarefaId={popupTarefaId} onFechar={() => setPopupTarefaId(null)} />
      )}

      {/* Cabeçalho */}
      <div style={styles.cabecalho}>
        <div>
          <h1 style={styles.titulo}>Tarefas</h1>
          <p style={styles.subtitulo}>
            {totalPendentes} pendente(s) · {totalConcluidas} concluída(s)
            {temFiltro && <span style={{ color: 'var(--verde)', marginLeft: '8px' }}>· {tarefasFiltradas.length} resultado(s)</span>}
          </p>
        </div>
        <button style={styles.btnPrimario} onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? '✕ Cancelar' : '+ Nova tarefa'}
        </button>
      </div>

      {/* Barra de busca e filtros */}
      <div style={styles.barraFiltros}>
        <div style={styles.buscaWrapper}>
          <Icone.Edit size={14} style={{ color: 'var(--texto-apagado)', flexShrink: 0 }} />
          <input style={styles.inputBusca} placeholder="Buscar por descrição, local ou responsável..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <button style={styles.btnLimpar} onClick={() => setBusca('')}>✕</button>}
        </div>
        <div style={styles.filtrosWrapper}>
          <select style={styles.selectFiltro} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="pendente">Pendentes</option>
            <option value="concluida">Concluídas</option>
          </select>
          <select style={styles.selectFiltro} value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {funcionarios.map(f => <option key={f._id} value={f._id}>{f.nome}</option>)}
          </select>
          {temFiltro && (
            <button style={styles.btnLimparFiltros} onClick={() => { setBusca(''); setFiltroStatus('todas'); setFiltroResponsavel('') }}>
              Limpar
            </button>
          )}
          <button style={styles.btnGerenciarEtiquetas} onClick={() => setGerenciarEtiquetas(!gerenciarEtiquetas)}>
            <Icone.Edit size={12} /> Etiquetas
          </button>
        </div>
      </div>

      {/* Gerenciar etiquetas */}
      {gerenciarEtiquetas && (
        <div style={styles.gerenciarBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontWeight: '600', color: 'var(--texto)', fontSize: '0.875rem' }}>Etiquetas disponíveis</p>
            <button style={styles.btnLimpar} onClick={() => setGerenciarEtiquetas(false)}>✕</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            {etiquetasCustom.map(e => (
              <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: e.cor + '22', borderRadius: '6px', padding: '4px 10px', border: `1px solid ${e.cor}44` }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '600', color: e.cor }}>{e.label}</span>
                <button style={{ background: 'none', border: 'none', color: e.cor, cursor: 'pointer', fontSize: '11px', padding: '0 2px', opacity: 0.7 }} onClick={() => removerEtiqueta(e.label)}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '8px 12px', color: 'var(--texto)', fontSize: '0.875rem', flex: 1, fontFamily: 'Inter, sans-serif' }}
              placeholder="Nome da nova etiqueta..."
              value={novaEtiqueta}
              onChange={e => setNovaEtiqueta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionarEtiqueta()} />
            <button style={styles.btnPrimario} onClick={adicionarEtiqueta}>+ Adicionar</button>
          </div>
        </div>
      )}

      {/* Formulário nova tarefa */}
      {mostrarForm && (
        <div style={styles.formulario}>
          <h3 style={{ color: 'var(--texto)', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>Nova tarefa</h3>
          {erro && <div style={styles.erro}>{erro}</div>}
          <form onSubmit={criar} style={styles.formGrid}>
            <div style={{ ...styles.campo, gridColumn: '1 / -1' }}>
              <label style={styles.label}>Descrição</label>
              <input style={styles.input} placeholder="O que precisa ser feito?" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} required />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Responsável</label>
              <select style={styles.input} value={form.responsavelId} onChange={e => setForm({ ...form, responsavelId: e.target.value })} required>
                <option value="">Selecionar...</option>
                {funcionarios.map(f => <option key={f._id} value={f._id}>{f.nome}</option>)}
              </select>
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Local</label>
              <input style={styles.input} placeholder="Ex: Escritório, Loja..." value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Data</label>
              <input style={styles.input} type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Hora</label>
              <input style={styles.input} type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Prioridade</label>
              <select style={styles.input} value={form.prioridade} onChange={e => setForm({ ...form, prioridade: e.target.value })}>
                <option value="">Sem prioridade</option>
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Média</option>
                <option value="baixa">🟢 Baixa</option>
              </select>
            </div>
            <button type="submit" style={styles.btnPrimario}>Criar tarefa</button>
          </form>
        </div>
      )}

      {/* Lista de tarefas */}
      {tarefasFiltradas.length === 0 && temFiltro ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--texto-apagado)' }}>
          <p>Nenhuma tarefa encontrada com esses filtros.</p>
        </div>
      ) : (
        <>
          {/* ── ONBOARDING DE CLIENTES ── */}
          <div style={styles.secao}>
            <SecaoHeader titulo="Onboarding de clientes" count={onbPendentes.length} verde />
            {onbPendentes.length === 0 && onbConcluidas.length === 0 ? (
              <p style={{ color: 'var(--texto-apagado)', fontSize: '0.875rem' }}>Nenhuma tarefa de onboarding em andamento.</p>
            ) : (
              <>
                {onbPendentes.map(t => <CardComInfo key={t._id} t={t} />)}
              </>
            )}
          </div>

          {/* ── TAREFAS DA EQUIPE ── */}
          <div style={styles.secao}>
            <SecaoHeader titulo="Tarefas da equipe" count={normaisPendentes.length} verde={false} />
            {normaisPendentes.length === 0 && normaisConcluidas.length === 0 && onbConcluidas.length === 0 ? (
              <p style={{ color: 'var(--texto-apagado)', fontSize: '0.875rem' }}>Nenhuma tarefa criada ainda. Use "+ Nova tarefa" para começar.</p>
            ) : (
              <>
                {normaisPendentes.map(t => <CardComInfo key={t._id} t={t} />)}
                {(normaisConcluidas.length > 0 || onbConcluidas.length > 0) && (
                  <>
                    <p style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '16px 0 8px' }}>Concluídas</p>
                    {onbConcluidas.map(t => <CardComInfo key={t._id} t={t} concluida />)}
                    {normaisConcluidas.map(t => <CardComInfo key={t._id} t={t} concluida />)}
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ============ HISTÓRICO DE CONQUISTAS ============

function PaginaHistorico() {
  const [historico, setHistorico] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api.get('/tarefas/historico/conquistas')
      .then(r => setHistorico(r.data))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const porDia = historico.reduce((acc, t) => {
    const dia = t.concluidaEm ? new Date(t.concluidaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sem data'
    if (!acc[dia]) acc[dia] = []
    acc[dia].push(t)
    return acc
  }, {})

  return (
    <div>
      <div style={styles.cabecalho}>
        <div>
          <h1 style={styles.titulo}>Histórico</h1>
          <p style={styles.subtitulo}>{historico.length} tarefa(s) concluída(s)</p>
        </div>
      </div>

      {carregando && <p style={{ color: 'var(--texto-apagado)' }}>Carregando...</p>}

      {!carregando && historico.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--texto-apagado)' }}>
          <Icone.CheckCircle size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p>Nenhuma tarefa concluída ainda.</p>
        </div>
      )}

      {Object.entries(porDia).map(([dia, tarefas]) => (
        <div key={dia} style={styles.secao}>
          <h2 style={styles.secaoTitulo}>{dia} · <span style={{ color: 'var(--verde)' }}>{tarefas.length} concluída(s)</span></h2>
          {tarefas.map(t => (
            <div key={t._id} style={{ ...styles.cardTarefa, opacity: 0.85 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--verde)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icone.Check size={11} style={{ color: '#fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ ...styles.tarefaDesc, textDecoration: 'line-through', opacity: 0.7 }}>{t.descricao}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', marginTop: '2px' }}>
                    {t.responsavel?.nome && `${t.responsavel.nome}`}
                    {t.concluidaPor?.nome && t.concluidaPor._id !== t.responsavel?._id && ` · Concluída por ${t.concluidaPor.nome}`}
                    {t.concluidaEm && ` · ${new Date(t.concluidaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                {t.prioridade && <BadgePrioridade prioridade={t.prioridade} />}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ============ DASHBOARD ADMIN PRINCIPAL ============

export default function DashboardAdmin() {
  const { usuario, temPermissao } = useAuth()
  const isTitular = usuario?.cargo === 'admin'
  const [pagina, setPagina] = useState('inicio')
  const [tarefas, setTarefas] = useState([])
  const [funcionarios, setFuncionarios] = useState([])

  const carregarDados = async () => {
    try {
      const [rTarefas, rFunc] = await Promise.all([
        api.get('/tarefas'),
        api.get('/usuarios')
      ])
      setTarefas(rTarefas.data)
      setFuncionarios(rFunc.data.filter(f => f.cargo !== 'admin'))
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => { carregarDados() }, [])

  // Sidebar dinâmico — cada item só aparece se tiver permissão
  const menuItens = [
    { id: 'inicio', label: 'Início', icone: <Icone.Home size={16} /> },

    // Gestão: Setores sempre visível pro titular; Equipe só com permissão
    ...(isTitular || temPermissao('gerenciarEquipe') ? [{
      id: 'gestao', label: 'Gestão', icone: <Icone.UsersThree size={16} />,
      subItens: [
        ...(isTitular ? [{ id: 'setores', label: 'Setores' }] : []),
        ...(isTitular || temPermissao('gerenciarEquipe') ? [{ id: 'equipe', label: 'Equipe' }] : []),
      ]
    }] : []),

    // Onboarding
    ...(isTitular || temPermissao('gerenciarOnboarding') ? [{
      id: 'onboarding', label: 'Onboarding', icone: <Icone.ClipboardList size={16} />,
      subItens: [
        { id: 'implantacao', label: 'Implantação' },
        { id: 'modelos', label: 'Modelos' },
        { id: 'checklist', label: 'Checklist' },
      ]
    }] : []),

    // Clientes
    ...(isTitular || temPermissao('gerenciarClientes') ? [
      { id: 'clientes', label: 'Clientes', icone: <Icone.Users size={16} /> }
    ] : []),

    // Tarefas — sempre visível
    { id: 'tarefas', label: 'Tarefas', icone: <Icone.ClipboardList size={16} /> },

    // Anotações — sempre visível
    { id: 'anotacoes', label: 'Anotações', icone: <Icone.Edit size={16} /> },

    // Relatórios
    ...(isTitular || temPermissao('verRelatorios') ? [
      { id: 'relatorios', label: 'Relatórios', icone: <Icone.BarChart size={16} /> }
    ] : []),

    // Histórico — sempre visível
    { id: 'historico', label: 'Histórico', icone: <Icone.CheckCircle size={16} /> },
  ]

  const renderPagina = () => {
    if (pagina === 'inicio') return <PaginaInicio usuario={usuario} tarefas={tarefas} funcionarios={funcionarios} setPagina={setPagina} />
    if (pagina === 'equipe') return <PaginaEquipe usuario={usuario} equipe={funcionarios} recarregar={carregarDados} />
    if (pagina === 'tarefas') return <PaginaTarefas tarefas={tarefas} funcionarios={funcionarios} recarregar={carregarDados} />
    if (pagina === 'historico') return <PaginaHistorico />
    if (pagina === 'agenda') return <Agenda cargo="admin" usuarios={funcionarios} usuarioAtualId={usuario?.id} />
    if (pagina === 'clientes') return <Clientes />
    if (pagina === 'chat') return <Chat setPagina={setPagina} />
    if (pagina === 'anotacoes') return <Anotacoes />
    if (pagina === 'relatorios') return <Relatorios />
    if (pagina === 'mural') return <Mural />
    if (pagina === 'implantacao') return <Implantacao />
    if (pagina === 'modelos') return <ModelosOnboarding />
    if (pagina === 'checklist') return <Checklist />
    if (pagina === 'setores') return <Setores funcionarios={funcionarios} />
  }

  return (
    <Layout menuItens={menuItens} paginaAtual={pagina} setPagina={setPagina}>
      {renderPagina()}
    </Layout>
  )
}

const styles = {
  barraFiltros: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' },
  buscaWrapper: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--sombra-card)' },
  inputBusca: { flex: 1, background: 'none', border: 'none', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none' },
  btnLimpar: { background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', flexShrink: 0 },
  filtrosWrapper: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  selectFiltro: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '7px 12px', color: 'var(--texto)', fontSize: '0.82rem', fontFamily: 'Inter, sans-serif', cursor: 'pointer' },
  btnLimparFiltros: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', padding: '7px 12px', color: 'var(--texto-apagado)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  btnGerenciarEtiquetas: { display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--verde-glow)', border: '1px solid rgba(0,177,65,0.2)', borderRadius: '8px', padding: '7px 12px', color: 'var(--verde)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' },
  gerenciarBox: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: 'var(--sombra-card)' },
  gridDois: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' },
  secaoCard: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--sombra-card)' },
  secaoCardTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  btnVer: { background: 'none', border: 'none', color: 'var(--verde)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' },
  vazioCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px 0', color: 'var(--texto-apagado)', fontSize: '0.85rem' },
  linhaTarefa: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--borda)' },
  linhaTarefaPonto: { width: '7px', height: '7px', borderRadius: '50%', background: '#fbbf24', flexShrink: 0, marginTop: '5px' },
  linhaTarefaDesc: { fontSize: '0.875rem', color: 'var(--texto)', margin: 0, lineHeight: '1.3' },
  linhaTarefaMeta: { fontSize: '0.75rem', color: 'var(--texto-apagado)', margin: '2px 0 0' },
  linhaAviso: { padding: '12px', background: 'var(--input)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' },
  badgeFixado: { fontSize: '0.65rem', fontWeight: '700', color: 'var(--verde)', background: 'var(--verde-glow)', padding: '2px 7px', borderRadius: '6px', width: 'fit-content', border: '1px solid rgba(0,177,65,0.2)' },
  linhaAvisoTitulo: { fontSize: '0.875rem', fontWeight: '600', color: 'var(--texto)', margin: 0 },
  linhaAvisoTexto: { fontSize: '0.8rem', color: 'var(--texto-apagado)', margin: 0, lineHeight: '1.4' },
  linhaAvisoMeta: { fontSize: '0.7rem', color: 'var(--texto-apagado)', margin: 0 },
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' },
  titulo: { fontSize: '1.75rem', color: 'var(--texto)', marginBottom: '4px', letterSpacing: '-0.03em', fontWeight: '700' },
  subtitulo: { color: 'var(--texto-apagado)', fontSize: '0.875rem' },
  cards: { gap: '16px', marginBottom: '32px' },
  card: {
    background: 'var(--card)',
    border: '1px solid var(--borda)',
    borderRadius: '16px',
    padding: '20px 22px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: 'var(--sombra-card)',
    transition: 'box-shadow 0.2s, border-color 0.2s',
  },
  cardIcone: { color: 'var(--texto-apagado)', flexShrink: 0, padding: '10px', background: 'var(--input)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardNum: { fontSize: '2rem', fontFamily: 'Inter, sans-serif', fontWeight: '700', color: 'var(--texto)', lineHeight: 1, letterSpacing: '-0.03em' },
  cardLabel: { fontSize: '0.78rem', color: 'var(--texto-apagado)', marginTop: '4px', fontWeight: '500' },
  secao: { marginBottom: '32px' },
  secaoTitulo: { fontSize: '0.72rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--borda)' },
  linhaResumo: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--borda)' },
  badge: { width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 },
  linhaDesc: { flex: 1, color: 'var(--texto)', fontSize: '0.9rem' },
  linhaResp: { color: 'var(--texto-apagado)', fontSize: '0.8rem', minWidth: '100px' },
  linhaData: { color: 'var(--texto-apagado)', fontSize: '0.8rem', minWidth: '80px', textAlign: 'right' },
  formulario: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: 'var(--sombra-card)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.72rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', width: '100%', fontFamily: 'Inter, sans-serif' },
  erro: { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '0.85rem', marginBottom: '12px' },
  btnPrimario: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,177,65,0.3)', transition: 'all 0.15s' },
  btnVerde: { background: 'var(--verde-glow)', color: 'var(--verde)', border: '1px solid rgba(0,177,65,0.25)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' },
  btnPerigo: { background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  tabelaWrapper: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--sombra-card)' },
  linhaTabela: { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', borderBottom: '1px solid var(--borda)' },
  avatar: { width: '36px', height: '36px', minWidth: '36px', background: 'var(--gradiente-verde)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '14px', color: '#fff', boxShadow: '0 2px 6px rgba(0,177,65,0.3)' },
  nomeFunc: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--texto)', letterSpacing: '-0.01em' },
  emailFunc: { fontSize: '0.8rem', color: 'var(--texto-apagado)' },
  badgeCargo: { fontSize: '0.72rem', color: 'var(--texto-apagado)', background: 'var(--input)', borderRadius: '6px', padding: '3px 9px', whiteSpace: 'nowrap', border: '1px solid var(--borda)' },
  cardTarefa: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '16px 20px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: 'var(--sombra-card)', transition: 'box-shadow 0.2s' },
  etiqueta: { fontSize: '0.7rem', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', border: '1px solid', whiteSpace: 'nowrap' },
  etiquetasSeletor: { display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%', padding: '8px', background: 'var(--input)', borderRadius: '8px', marginTop: '4px' },
  etiquetaOpcao: { fontSize: '0.72rem', fontWeight: '500', padding: '4px 10px', borderRadius: '6px', border: '1px solid', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' },
  btnFecharEtiquetas: { fontSize: '0.72rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--borda)', background: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginLeft: 'auto' },
  cardLinhaTopo: { display: 'flex', alignItems: 'center', gap: '16px' },
  cardDescWrapper: { flex: 1, minWidth: 0 },
  cardBotoes: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  cardInfos: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' },
  cardInfoItem: { fontSize: '0.82rem', color: 'var(--texto-apagado)', display: 'flex', alignItems: 'center', gap: '6px' },
  cardInfoSep: { color: 'var(--borda)', fontWeight: '700' },
  tarefaDesc: { fontSize: '0.95rem', color: 'var(--texto)', lineHeight: '1.5', wordBreak: 'break-word', fontWeight: '500' },
  inputEdicao: { flex: 1, background: 'var(--input)', border: '1px solid var(--verde)', borderRadius: '8px', padding: '8px 12px', color: 'var(--texto)', fontSize: '0.95rem', fontFamily: 'Inter, sans-serif' },
  btnConcluir: { background: 'var(--verde-glow)', color: 'var(--verde)', border: '1px solid rgba(0,177,65,0.25)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', fontWeight: '600' },
  btnMenu: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '6px 10px', color: 'var(--texto-apagado)', fontSize: '1rem', cursor: 'pointer', letterSpacing: '2px', lineHeight: 1 },
  btnNeutro: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', padding: '6px 12px', color: 'var(--texto-apagado)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  dropdownMenu: { position: 'absolute', right: 0, top: '36px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '10px', overflow: 'hidden', zIndex: 10, minWidth: '130px', boxShadow: 'var(--sombra-elevada)' },
  dropdownItem: { display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: 'var(--texto)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', transition: 'background 0.1s' },
}
