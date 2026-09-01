import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import Icone from './Icones'

// ===== HELPERS =====
function semanaStr(date) {
  const d = new Date(date)
  const inicio = new Date(d)
  inicio.setDate(d.getDate() - d.getDay())
  return inicio.toISOString().split('T')[0]
}

function formatarData(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('pt-BR')
}

function isAtrasada(tarefa) {
  if (tarefa.status === 'concluida' || !tarefa.data) return false
  return new Date(tarefa.data) < new Date(new Date().toDateString())
}

// ===== MINI BARRA DE PROGRESSO =====
function BarraProgresso({ valor, cor = 'var(--verde)', altura = 6 }) {
  return (
    <div style={{ background: 'var(--borda)', borderRadius: 99, height: altura, overflow: 'hidden', width: '100%' }}>
      <div style={{
        width: `${Math.min(valor, 100)}%`,
        height: '100%',
        background: cor,
        borderRadius: 99,
        transition: 'width 0.6s ease',
      }} />
    </div>
  )
}

// ===== CARD MÉTRICA =====
function CardMetrica({ icone, label, valor, sub, cor = 'var(--verde)' }) {
  return (
    <div style={s.cardMetrica}>
      <div style={{ ...s.cardMetricaIcone, color: cor, background: cor + '18' }}>
        {icone}
      </div>
      <div>
        <p style={s.cardMetricaValor}>{valor}</p>
        <p style={s.cardMetricaLabel}>{label}</p>
        {sub && <p style={s.cardMetricaSub}>{sub}</p>}
      </div>
    </div>
  )
}

// ===== GRÁFICO DE BARRAS SIMPLES =====
function GraficoSemanas({ dados }) {
  if (!dados.length) return <p style={{ color: 'var(--texto-apagado)', fontSize: '0.85rem' }}>Sem dados suficientes.</p>

  const max = Math.max(...dados.map(d => d.total), 1)

  return (
    <div style={s.grafico}>
      {dados.map((d, i) => (
        <div key={i} style={s.graficoColuna}>
          <span style={s.graficoBarra}>
            <span style={{
              ...s.graficoBarraInterna,
              height: `${(d.total / max) * 100}%`,
            }} />
          </span>
          <span style={s.graficoValor}>{d.total}</span>
          <span style={s.graficoLabel}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ===== VISÃO GERAL (todos) =====
function VisaoGeral({ tarefas, colaboradores }) {
  const total = tarefas.length
  const concluidas = tarefas.filter(t => t.status === 'concluida').length
  const pendentes = tarefas.filter(t => t.status === 'pendente').length
  const atrasadas = tarefas.filter(isAtrasada).length
  const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0

  // Produtividade por semana (últimas 6 semanas)
  const semanas = {}
  tarefas.filter(t => t.status === 'concluida' && t.concluidaEm).forEach(t => {
    const s = semanaStr(t.concluidaEm)
    semanas[s] = (semanas[s] || 0) + 1
  })
  const ultimasSemanas = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (5 - i) * 7)
    const key = semanaStr(d)
    const label = `${d.getDate()}/${d.getMonth() + 1}`
    return { label, total: semanas[key] || 0 }
  })

  // Por colaborador
  const porColab = colaboradores.map(c => {
    const minhas = tarefas.filter(t => t.responsavel?._id === c._id || t.responsavel === c._id)
    const feitas = minhas.filter(t => t.status === 'concluida').length
    const taxaC = minhas.length > 0 ? Math.round((feitas / minhas.length) * 100) : 0
    return { ...c, total: minhas.length, feitas, taxa: taxaC }
  }).sort((a, b) => b.feitas - a.feitas)

  return (
    <div style={s.conteudo}>
      {/* Cards de resumo */}
      <div style={s.gridCards}>
        <CardMetrica icone={<Icone.ClipboardList size={20} />} label="Total de tarefas" valor={total} />
        <CardMetrica icone={<Icone.CheckCircle size={20} />} label="Concluídas" valor={concluidas} cor="#22C55E" />
        <CardMetrica icone={<Icone.Circle size={20} />} label="Pendentes" valor={pendentes} cor="#F59E0B" />
        <CardMetrica icone={<Icone.AlertTriangle size={20} />} label="Em atraso" valor={atrasadas} cor="#EF4444" sub={atrasadas > 0 ? 'Requerem atenção' : 'Tudo em dia!'} />
      </div>

      <div style={s.gridDois}>
        {/* Taxa geral */}
        <div style={s.secaoCard}>
          <h3 style={s.secaoTitulo}>Taxa de conclusão geral</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <span style={{ fontSize: '2.5rem', fontFamily: 'var(--fonte-corpo)', fontWeight: '800', color: taxa >= 70 ? 'var(--verde)' : taxa >= 40 ? '#F59E0B' : '#EF4444' }}>
              {taxa}%
            </span>
            <div style={{ flex: 1 }}>
              <BarraProgresso valor={taxa} cor={taxa >= 70 ? 'var(--verde)' : taxa >= 40 ? '#F59E0B' : '#EF4444'} altura={10} />
              <p style={{ color: 'var(--texto-apagado)', fontSize: '0.78rem', marginTop: '6px' }}>{concluidas} de {total} tarefas concluídas</p>
            </div>
          </div>
        </div>

        {/* Gráfico semanal */}
        <div style={s.secaoCard}>
          <h3 style={s.secaoTitulo}>Tarefas concluídas por semana</h3>
          <GraficoSemanas dados={ultimasSemanas} />
        </div>
      </div>

      {/* Ranking por colaborador */}
      <div style={s.secaoCard}>
        <h3 style={s.secaoTitulo}>Desempenho por colaborador</h3>
        {porColab.length === 0 ? (
          <p style={{ color: 'var(--texto-apagado)', fontSize: '0.85rem' }}>Nenhum colaborador cadastrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {porColab.map((c, i) => (
              <div key={c._id} style={s.linhaColab}>
                <span style={s.ranking}>#{i + 1}</span>
                <Avatar nome={c.nome} foto={c.avatar} size={36} fontSize={14} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={s.colabNome}>{c.nome}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)' }}>{c.feitas}/{c.total} tarefas · {c.taxa}%</span>
                  </div>
                  <BarraProgresso valor={c.taxa} cor={c.taxa >= 70 ? 'var(--verde)' : c.taxa >= 40 ? '#F59E0B' : '#EF4444'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tarefas em atraso */}
      {atrasadas > 0 && (
        <div style={s.secaoCard}>
          <h3 style={{ ...s.secaoTitulo, color: '#EF4444' }}>Tarefas em atraso</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tarefas.filter(isAtrasada).map(t => (
              <div key={t._id} style={s.linhaAtrasada}>
                <div style={s.atrasadaPonto} />
                <div style={{ flex: 1 }}>
                  <p style={s.atrasadaDesc}>{t.descricao}</p>
                  <p style={s.atrasadaMeta}>
                    Venceu em {formatarData(t.data)}
                    {t.responsavel?.nome && ` · ${t.responsavel.nome}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== VISÃO INDIVIDUAL =====
function VisaoIndividual({ colaborador, tarefas }) {
  const minhas = tarefas.filter(t => t.responsavel?._id === colaborador._id || t.responsavel === colaborador._id)
  const concluidas = minhas.filter(t => t.status === 'concluida')
  const pendentes = minhas.filter(t => t.status === 'pendente')
  const atrasadas = minhas.filter(isAtrasada)
  const taxa = minhas.length > 0 ? Math.round((concluidas.length / minhas.length) * 100) : 0

  const semanas = {}
  concluidas.filter(t => t.concluidaEm).forEach(t => {
    const s = semanaStr(t.concluidaEm)
    semanas[s] = (semanas[s] || 0) + 1
  })
  const ultimasSemanas = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (5 - i) * 7)
    const key = semanaStr(d)
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, total: semanas[key] || 0 }
  })

  return (
    <div style={s.conteudo}>
      {/* Perfil */}
      <div style={s.perfilCard}>
        <Avatar nome={colaborador.nome} foto={colaborador.avatar} size={56} fontSize={22} />
        <div>
          <p style={{ fontFamily: 'var(--fonte-corpo)', fontWeight: '700', fontSize: '1.2rem', color: 'var(--texto)' }}>{colaborador.nome}</p>
          <p style={{ color: 'var(--texto-apagado)', fontSize: '0.85rem' }}>{colaborador.cargo === 'administrador' ? 'Administrador' : 'Colaborador'}</p>
        </div>
      </div>

      <div style={s.gridCards}>
        <CardMetrica icone={<Icone.ClipboardList size={20} />} label="Total" valor={minhas.length} />
        <CardMetrica icone={<Icone.CheckCircle size={20} />} label="Concluídas" valor={concluidas.length} cor="#22C55E" />
        <CardMetrica icone={<Icone.Circle size={20} />} label="Pendentes" valor={pendentes.length} cor="#F59E0B" />
        <CardMetrica icone={<Icone.AlertTriangle size={20} />} label="Em atraso" valor={atrasadas.length} cor="#EF4444" />
      </div>

      <div style={s.gridDois}>
        <div style={s.secaoCard}>
          <h3 style={s.secaoTitulo}>Taxa de conclusão</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <span style={{ fontSize: '2.5rem', fontFamily: 'var(--fonte-corpo)', fontWeight: '800', color: taxa >= 70 ? 'var(--verde)' : taxa >= 40 ? '#F59E0B' : '#EF4444' }}>
              {taxa}%
            </span>
            <div style={{ flex: 1 }}>
              <BarraProgresso valor={taxa} cor={taxa >= 70 ? 'var(--verde)' : taxa >= 40 ? '#F59E0B' : '#EF4444'} altura={10} />
              <p style={{ color: 'var(--texto-apagado)', fontSize: '0.78rem', marginTop: '6px' }}>{concluidas.length} de {minhas.length} tarefas</p>
            </div>
          </div>
        </div>

        <div style={s.secaoCard}>
          <h3 style={s.secaoTitulo}>Concluídas por semana</h3>
          <GraficoSemanas dados={ultimasSemanas} />
        </div>
      </div>

      {atrasadas.length > 0 && (
        <div style={s.secaoCard}>
          <h3 style={{ ...s.secaoTitulo, color: '#EF4444' }}>Tarefas em atraso</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {atrasadas.map(t => (
              <div key={t._id} style={s.linhaAtrasada}>
                <div style={s.atrasadaPonto} />
                <div style={{ flex: 1 }}>
                  <p style={s.atrasadaDesc}>{t.descricao}</p>
                  <p style={s.atrasadaMeta}>Venceu em {formatarData(t.data)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendentes.length > 0 && (
        <div style={s.secaoCard}>
          <h3 style={s.secaoTitulo}>Tarefas pendentes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendentes.map(t => (
              <div key={t._id} style={{ ...s.linhaAtrasada, borderColor: 'var(--borda)' }}>
                <div style={{ ...s.atrasadaPonto, background: '#F59E0B' }} />
                <div style={{ flex: 1 }}>
                  <p style={s.atrasadaDesc}>{t.descricao}</p>
                  <p style={s.atrasadaMeta}>{t.data ? `Vence em ${formatarData(t.data)}` : 'Sem data definida'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== VISÃO DO COLABORADOR (seus próprios dados) =====
function VisaoColaborador({ tarefas, usuario }) {
  const minhas = tarefas
  const concluidas = minhas.filter(t => t.status === 'concluida')
  const pendentes = minhas.filter(t => t.status === 'pendente')
  const atrasadas = minhas.filter(isAtrasada)
  const taxa = minhas.length > 0 ? Math.round((concluidas.length / minhas.length) * 100) : 0

  const semanas = {}
  concluidas.filter(t => t.concluidaEm).forEach(t => {
    const s = semanaStr(t.concluidaEm)
    semanas[s] = (semanas[s] || 0) + 1
  })
  const ultimasSemanas = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (5 - i) * 7)
    const key = semanaStr(d)
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, total: semanas[key] || 0 }
  })

  return (
    <div style={s.conteudo}>
      <div style={s.gridCards}>
        <CardMetrica icone={<Icone.ClipboardList size={20} />} label="Total de tarefas" valor={minhas.length} />
        <CardMetrica icone={<Icone.CheckCircle size={20} />} label="Concluídas" valor={concluidas.length} cor="#22C55E" />
        <CardMetrica icone={<Icone.Circle size={20} />} label="Pendentes" valor={pendentes.length} cor="#F59E0B" />
        <CardMetrica icone={<Icone.AlertTriangle size={20} />} label="Em atraso" valor={atrasadas.length} cor="#EF4444" />
      </div>

      <div style={s.gridDois}>
        <div style={s.secaoCard}>
          <h3 style={s.secaoTitulo}>Minha taxa de conclusão</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <span style={{ fontSize: '2.5rem', fontFamily: 'var(--fonte-corpo)', fontWeight: '800', color: taxa >= 70 ? 'var(--verde)' : taxa >= 40 ? '#F59E0B' : '#EF4444' }}>
              {taxa}%
            </span>
            <div style={{ flex: 1 }}>
              <BarraProgresso valor={taxa} cor={taxa >= 70 ? 'var(--verde)' : taxa >= 40 ? '#F59E0B' : '#EF4444'} altura={10} />
              <p style={{ color: 'var(--texto-apagado)', fontSize: '0.78rem', marginTop: '6px' }}>{concluidas.length} de {minhas.length} tarefas</p>
            </div>
          </div>
        </div>
        <div style={s.secaoCard}>
          <h3 style={s.secaoTitulo}>Concluídas por semana</h3>
          <GraficoSemanas dados={ultimasSemanas} />
        </div>
      </div>

      {atrasadas.length > 0 && (
        <div style={s.secaoCard}>
          <h3 style={{ ...s.secaoTitulo, color: '#EF4444' }}>Minhas tarefas em atraso</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {atrasadas.map(t => (
              <div key={t._id} style={s.linhaAtrasada}>
                <div style={s.atrasadaPonto} />
                <div style={{ flex: 1 }}>
                  <p style={s.atrasadaDesc}>{t.descricao}</p>
                  <p style={s.atrasadaMeta}>Venceu em {formatarData(t.data)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== COMPONENTE PRINCIPAL =====
export default function Relatorios() {
  const { usuario } = useAuth()
  const [tarefas, setTarefas] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [selecionado, setSelecionado] = useState('geral') // 'geral' ou id do colaborador
  const isGestor = ['admin', 'administrador'].includes(usuario?.cargo)

  useEffect(() => {
    const carregar = async () => {
      try {
        const [rTarefas, rUsers] = await Promise.all([
          api.get('/tarefas'),
          isGestor ? api.get('/usuarios') : Promise.resolve({ data: [] })
        ])
        setTarefas(rTarefas.data)
        if (isGestor) setColaboradores(rUsers.data.filter(u => u._id !== usuario?.id))
      } catch (err) { console.error(err) }
    }
    carregar()
  }, [])

  const colaboradorSelecionado = colaboradores.find(c => c._id === selecionado)

  return (
    <div style={s.wrapper}>
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Relatórios</h1>
          <p style={s.subtitulo}>Acompanhe o desempenho da equipe</p>
        </div>

        {/* Seletor de colaborador — só gestores */}
        {isGestor && (
          <div style={s.seletorWrapper}>
            <button
              style={{ ...s.seletorBtn, ...(selecionado === 'geral' ? s.seletorBtnAtivo : {}) }}
              onClick={() => setSelecionado('geral')}
            >
              <Icone.Users size={14} /> Geral
            </button>
            {colaboradores.map(c => (
              <button
                key={c._id}
                style={{ ...s.seletorBtn, ...(selecionado === c._id ? s.seletorBtnAtivo : {}) }}
                onClick={() => setSelecionado(c._id)}
              >
                <Avatar nome={c.nome} foto={c.avatar} size={18} fontSize={9} />
                {c.nome.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {isGestor ? (
        selecionado === 'geral'
          ? <VisaoGeral tarefas={tarefas} colaboradores={colaboradores} />
          : <VisaoIndividual colaborador={colaboradorSelecionado} tarefas={tarefas} />
      ) : (
        <VisaoColaborador tarefas={tarefas} usuario={usuario} />
      )}
    </div>
  )
}

const s = {
  wrapper: { height: '100%', overflowY: 'auto', paddingBottom: '32px' },
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' },
  titulo: { fontSize: '1.8rem', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)', fontWeight: '700', marginBottom: '4px' },
  subtitulo: { color: 'var(--texto-apagado)', fontSize: '0.9rem' },

  seletorWrapper: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  seletorBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px', border: '1px solid var(--borda)', background: 'var(--input)', color: 'var(--texto)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', transition: 'all 0.15s', whiteSpace: 'nowrap' },
  seletorBtnAtivo: { background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)', color: 'var(--verde)' },

  conteudo: { display: 'flex', flexDirection: 'column', gap: '20px' },
  gridCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' },
  gridDois: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' },

  cardMetrica: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '14px', padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' },
  cardMetricaIcone: { width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardMetricaValor: { fontSize: '1.6rem', fontFamily: 'var(--fonte-corpo)', fontWeight: '800', color: 'var(--texto)', lineHeight: 1 },
  cardMetricaLabel: { fontSize: '0.78rem', color: 'var(--texto-apagado)', marginTop: '4px' },
  cardMetricaSub: { fontSize: '0.7rem', color: 'var(--texto-apagado)', marginTop: '2px' },

  secaoCard: { background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '14px', padding: '20px' },
  secaoTitulo: { fontSize: '0.75rem', fontWeight: '700', color: 'var(--verde)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '16px' },

  grafico: { display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px' },
  graficoColuna: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 },
  graficoBarra: { flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', background: 'var(--input)', borderRadius: '6px', overflow: 'hidden', minHeight: '60px' },
  graficoBarraInterna: { width: '100%', background: 'linear-gradient(to top, #22C55E, #4ADE80)', borderRadius: '6px', transition: 'height 0.6s ease', minHeight: '4px' },
  graficoValor: { fontSize: '0.7rem', color: 'var(--texto-apagado)', fontWeight: '600' },
  graficoLabel: { fontSize: '0.6rem', color: 'var(--borda)' },

  linhaColab: { display: 'flex', alignItems: 'center', gap: '12px' },
  ranking: { fontSize: '0.75rem', fontWeight: '700', color: 'var(--texto-apagado)', width: '24px', flexShrink: 0, textAlign: 'center' },
  colabNome: { fontSize: '0.875rem', fontWeight: '600', color: 'var(--texto)' },

  linhaAtrasada: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 12px', background: 'var(--input-2)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' },
  atrasadaPonto: { width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', flexShrink: 0, marginTop: '4px' },
  atrasadaDesc: { fontSize: '0.875rem', color: 'var(--texto)', margin: 0 },
  atrasadaMeta: { fontSize: '0.75rem', color: 'var(--texto-apagado)', margin: '2px 0 0' },

  perfilCard: { display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--sidebar)', border: '1px solid var(--borda)', borderRadius: '14px', padding: '20px' },
}
