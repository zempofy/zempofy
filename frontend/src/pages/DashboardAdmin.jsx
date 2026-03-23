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

function PaginaEquipe({ usuario, equipe, recarregar }) {
  const isDono = usuario?.cargo === 'admin'
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', cargo: 'colaborador' })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const { mostrar } = useToast()

  const membroParaRemover = equipe.find(f => f._id === confirmandoId)

  const criar = async (e) => {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await api.post('/usuarios', form)
      setForm({ nome: '', email: '', senha: '', cargo: 'colaborador' })
      setMostrarForm(false)
      recarregar()
      mostrar(`${form.cargo === 'administrador' ? 'Administrador' : 'Colaborador'} adicionado com sucesso!`)
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar colaborador.')
    } finally {
      setCarregando(false)
    }
  }

  const excluir = async (id) => {
    await api.delete(`/usuarios/${id}`)
    recarregar()
    setConfirmandoId(null)
    mostrar('Membro removido da equipe.', 'aviso')
  }

  const badgeCargo = (cargo) => {
    if (cargo === 'admin') return { label: 'Dono', cor: 'var(--verde)', icone: <Icone.Crown size={12} /> }
    if (cargo === 'administrador') return { label: 'Administrador', cor: '#2196F3', icone: <Icone.UserCheck size={12} /> }
    return { label: 'Colaborador', cor: 'var(--texto-apagado)', icone: <Icone.User size={12} /> }
  }

  return (
    <div>
      {confirmandoId && (
        <ModalConfirmacao
          titulo="Remover membro"
          mensagem={`Tem certeza que deseja remover ${membroParaRemover?.nome} da equipe?`}
          textoBotao="Remover"
          perigo
          onConfirmar={() => excluir(confirmandoId)}
          onCancelar={() => setConfirmandoId(null)}
        />
      )}
      <div style={styles.cabecalho}>
        <div>
          <h1 style={styles.titulo}>Equipe</h1>
          <p style={styles.subtitulo}>{equipe.length} pessoa(s) cadastrada(s)</p>
        </div>
        <button style={styles.btnPrimario} onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? '✕ Cancelar' : '+ Novo membro'}
        </button>
      </div>

      {mostrarForm && (
        <div style={styles.formulario}>
          <h3 style={{ color: 'var(--texto)', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>Novo membro</h3>
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
              <label style={styles.label}>Tipo de acesso</label>
              <select style={styles.input} value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })}>
                <option value="colaborador">Colaborador</option>
                {isDono && <option value="administrador">Administrador</option>}
              </select>
            </div>
            <button type="submit" style={styles.btnPrimario} disabled={carregando}>
              {carregando ? 'Criando...' : 'Criar membro'}
            </button>
          </form>
        </div>
      )}

      <div style={styles.tabelaWrapper}>
        {equipe.length === 0 ? (
          <p style={{ color: 'var(--texto-apagado)', padding: '20px' }}>Nenhum membro cadastrado ainda.</p>
        ) : (
          equipe.map(f => {
            const badge = badgeCargo(f.cargo)
            const podeRemover = f.cargo !== 'admin' && (isDono || f.cargo === 'colaborador')
            return (
              <div key={f._id} style={styles.linhaTabela}>
                <Avatar nome={f.nome} foto={f.avatar} size={40} fontSize={16} />
                <div style={{ flex: 1 }}>
                  <p style={styles.nomeFunc}>{f.nome}</p>
                  <p style={styles.emailFunc}>{f.email}</p>
                </div>
                <span style={{ ...styles.badgeCargo, color: badge.cor, borderColor: badge.cor + '40', background: badge.cor + '15', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {badge.icone}{badge.label}
                </span>
                {podeRemover && (
                  <button style={styles.btnPerigo} onClick={() => setConfirmandoId(f._id)}>Remover</button>
                )}
              </div>
            )
          })
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

function PaginaTarefas({ tarefas, funcionarios, recarregar }) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ descricao: '', data: '', hora: '', local: '', responsavelId: '', prioridade: '' })
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [gerenciarEtiquetas, setGerenciarEtiquetas] = useState(false)
  const [novaEtiqueta, setNovaEtiqueta] = useState('')
  const [etiquetasCustom, setEtiquetasCustom] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zmp_etiquetas') || 'null') || ETIQUETAS_OPCOES } catch { return ETIQUETAS_OPCOES }
  })
  const { mostrar } = useToast()

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
      setForm({ descricao: '', data: '', hora: '', local: '', responsavelId: '' })
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

  const pendentes = tarefasFiltradas.filter(t => t.status === 'pendente')
  const concluidas = tarefasFiltradas.filter(t => t.status === 'concluida')
  const temFiltro = busca || filtroStatus !== 'todas' || filtroResponsavel

  return (
    <div>
      {/* Cabeçalho */}
      <div style={styles.cabecalho}>
        <div>
          <h1 style={styles.titulo}>Tarefas</h1>
          <p style={styles.subtitulo}>
            {pendentes.length} pendente(s) · {concluidas.length} concluída(s)
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
          <div style={styles.secao}>
            <h2 style={styles.secaoTitulo}>Pendentes</h2>
            {pendentes.length === 0
              ? <p style={{ color: 'var(--texto-apagado)' }}>Nenhuma tarefa pendente.</p>
              : pendentes.map(t => (
                <CardTarefa key={t._id} t={t} etiquetasOpcoes={etiquetasCustom}
                  onConcluir={concluir} onDesmarcar={desmarcar} onEditar={editar}
                  onExcluir={excluir} onEtiquetas={atualizarEtiquetas} />
              ))
            }
          </div>
          {concluidas.length > 0 && (
            <div style={styles.secao}>
              <h2 style={styles.secaoTitulo}>Concluídas</h2>
              {concluidas.map(t => (
                <CardTarefa key={t._id} t={t} etiquetasOpcoes={etiquetasCustom}
                  onConcluir={concluir} onDesmarcar={desmarcar} onEditar={editar}
                  onExcluir={excluir} onEtiquetas={atualizarEtiquetas} concluida />
              ))}
            </div>
          )}
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
  const { usuario } = useAuth()
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

  const menuItens = [
    { id: 'inicio', label: 'Início', icone: <Icone.Home size={16} /> },
    { id: 'equipe', label: 'Equipe', icone: <Icone.Users size={16} /> },
    { id: 'tarefas', label: 'Tarefas', icone: <Icone.ClipboardList size={16} /> },
    { id: 'historico', label: 'Histórico', icone: <Icone.CheckCircle size={16} /> },
    { id: 'anotacoes', label: 'Anotações', icone: <Icone.Edit size={16} /> },
    { id: 'relatorios', label: 'Relatórios', icone: <Icone.BarChart size={16} /> },
    { id: 'mural', label: 'Mural', icone: <Icone.Bell size={16} /> },
  ]

  const renderPagina = () => {
    if (pagina === 'inicio') return <PaginaInicio usuario={usuario} tarefas={tarefas} funcionarios={funcionarios} setPagina={setPagina} />
    if (pagina === 'equipe') return <PaginaEquipe usuario={usuario} equipe={funcionarios} recarregar={carregarDados} />
    if (pagina === 'tarefas') return <PaginaTarefas tarefas={tarefas} funcionarios={funcionarios} recarregar={carregarDados} />
    if (pagina === 'historico') return <PaginaHistorico />
    if (pagina === 'agenda') return <Agenda cargo="admin" usuarios={funcionarios} usuarioAtualId={usuario?.id} />
    if (pagina === 'chat') return <Chat setPagina={setPagina} />
    if (pagina === 'anotacoes') return <Anotacoes />
    if (pagina === 'relatorios') return <Relatorios />
    if (pagina === 'mural') return <Mural />
  }

  return (
    <Layout menuItens={menuItens} paginaAtual={pagina} setPagina={setPagina}>
      {renderPagina()}
    </Layout>
  )
}

const styles = {
  barraFiltros: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' },
  buscaWrapper: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px' },
  inputBusca: { flex: 1, background: 'none', border: 'none', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', outline: 'none' },
  btnLimpar: { background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', flexShrink: 0 },
  filtrosWrapper: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  selectFiltro: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '7px 12px', color: 'var(--texto)', fontSize: '0.82rem', fontFamily: 'Inter, sans-serif', cursor: 'pointer' },
  btnLimparFiltros: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', padding: '7px 12px', color: 'var(--texto-apagado)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  btnGerenciarEtiquetas: { display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '7px 12px', color: 'var(--verde)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '500' },
  gerenciarBox: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '16px', marginBottom: '16px' },
  gridDois: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' },
  secaoCard: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  secaoCardTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  btnVer: { background: 'none', border: 'none', color: 'var(--verde)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' },
  vazioCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px 0', color: 'var(--texto-apagado)', fontSize: '0.85rem' },
  linhaTarefa: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--borda)' },
  linhaTarefaPonto: { width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: '5px' },
  linhaTarefaDesc: { fontSize: '0.875rem', color: 'var(--texto)', margin: 0, lineHeight: '1.3' },
  linhaTarefaMeta: { fontSize: '0.75rem', color: 'var(--texto-apagado)', margin: '2px 0 0' },
  linhaAviso: { padding: '12px', background: 'var(--input)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' },
  badgeFixado: { fontSize: '0.65rem', fontWeight: '700', color: 'var(--verde)', background: 'rgba(34,197,94,0.15)', padding: '2px 7px', borderRadius: '6px', width: 'fit-content' },
  linhaAvisoTitulo: { fontSize: '0.875rem', fontWeight: '600', color: 'var(--texto)', margin: 0 },
  linhaAvisoTexto: { fontSize: '0.8rem', color: 'var(--texto-apagado)', margin: 0, lineHeight: '1.4' },
  linhaAvisoMeta: { fontSize: '0.7rem', color: 'var(--texto-apagado)', margin: 0 },
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' },
  titulo: { fontSize: '1.8rem', color: 'var(--texto)', marginBottom: '4px' },
  subtitulo: { color: 'var(--texto-apagado)', fontSize: '0.9rem' },
  cards: { gap: '16px', marginBottom: '32px' },
  card: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' },
  cardIcone: { color: 'var(--texto-apagado)', flexShrink: 0 },
  cardNum: { fontSize: '1.8rem', fontFamily: 'Inter, sans-serif', fontWeight: '700', color: 'var(--texto)', lineHeight: 1 },
  cardLabel: { fontSize: '0.8rem', color: 'var(--texto-apagado)', marginTop: '4px' },
  secao: { marginBottom: '32px' },
  secaoTitulo: { fontSize: '0.75rem', fontWeight: '600', color: 'var(--verde)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--borda)' },
  linhaResumo: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--input)' },
  badge: { width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 },
  linhaDesc: { flex: 1, color: 'var(--texto)', fontSize: '0.9rem' },
  linhaResp: { color: 'var(--texto-apagado)', fontSize: '0.8rem', minWidth: '100px' },
  linhaData: { color: 'var(--texto-apagado)', fontSize: '0.8rem', minWidth: '80px', textAlign: 'right' },
  formulario: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '16px', padding: '24px', marginBottom: '24px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.75rem', fontWeight: '500', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', width: '100%', fontFamily: 'Inter, sans-serif' },
  erro: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#FCA5A5', fontSize: '0.85rem', marginBottom: '12px' },
  btnPrimario: { background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnVerde: { background: 'rgba(34,197,94,0.15)', color: 'var(--verde)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  btnPerigo: { background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  tabelaWrapper: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '16px', overflow: 'hidden' },
  linhaTabela: { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', borderBottom: '1px solid var(--input)' },
  avatar: { width: '36px', height: '36px', minWidth: '36px', background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '14px', color: '#fff' },
  nomeFunc: { fontSize: '0.9rem', fontWeight: '500', color: 'var(--texto)' },
  emailFunc: { fontSize: '0.8rem', color: 'var(--texto-apagado)' },
  badgeCargo: { fontSize: '0.75rem', color: 'var(--texto-apagado)', background: 'var(--input)', borderRadius: '6px', padding: '4px 10px', whiteSpace: 'nowrap' },
  cardTarefa: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '16px 20px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '10px' },
  etiqueta: { fontSize: '0.7rem', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', border: '1px solid', whiteSpace: 'nowrap' },
  etiquetasSeletor: { display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%', padding: '8px', background: 'var(--input)', borderRadius: '8px', marginTop: '4px' },
  etiquetaOpcao: { fontSize: '0.72rem', fontWeight: '500', padding: '4px 10px', borderRadius: '6px', border: '1px solid', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' },
  btnFecharEtiquetas: { fontSize: '0.72rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--borda)', background: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginLeft: 'auto' },
  cardLinhaTopo: { display: 'flex', alignItems: 'center', gap: '16px' },
  cardDescWrapper: { flex: 1, minWidth: 0 },
  cardBotoes: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  cardInfos: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' },
  cardInfoItem: { fontSize: '0.85rem', color: 'var(--texto-apagado)', display: 'flex', alignItems: 'center', gap: '6px' },
  cardInfoSep: { color: 'var(--borda)', fontWeight: '700' },
  tarefaDesc: { fontSize: '1rem', color: 'var(--texto)', lineHeight: '1.5', wordBreak: 'break-word' },
  inputEdicao: { flex: 1, background: 'var(--input)', border: '1px solid #22C55E', borderRadius: '8px', padding: '8px 12px', color: 'var(--texto)', fontSize: '1rem', fontFamily: 'Inter, sans-serif' },
  btnConcluir: { background: 'rgba(34,197,94,0.15)', color: 'var(--verde)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' },
  btnMenu: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '6px 10px', color: 'var(--texto-apagado)', fontSize: '1rem', cursor: 'pointer', letterSpacing: '2px', lineHeight: 1 },
  btnNeutro: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', padding: '6px 12px', color: 'var(--texto-apagado)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  dropdownMenu: { position: 'absolute', right: 0, top: '36px', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', overflow: 'hidden', zIndex: 10, minWidth: '120px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
  dropdownItem: { display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: 'var(--texto)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' },
}
