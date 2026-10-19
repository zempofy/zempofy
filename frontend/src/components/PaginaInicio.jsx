import { useState, useEffect } from 'react'
import api from '../services/api'
import Icone from './Icones'
import { statusDemanda, competenciaDefasada, normalizarNome, CONFIG_DEMANDA, nomeMes } from './Clientes'

const formatData = (d) => {
  if (!d) return ''
  const hoje = new Date()
  const data = new Date(d)
  const diff = Math.floor((hoje - data) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return `${diff} dias atrás`
}

const saudacao = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const dataHoje = () => new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  .replace(/^\w/, c => c.toUpperCase())

function MetricCard({ icone, label, valor, sub, cor }) {
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
        <span style={{ color:'var(--texto-apagado)' }}>{icone}</span>
        <p style={{ fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', margin:0, fontFamily:'var(--fonte-corpo)' }}>{label}</p>
      </div>
      <p style={{ fontSize:'1.8rem', fontWeight:'700', color: cor || 'var(--texto)', margin:'0 0 4px', fontFamily:'var(--fonte-corpo)', letterSpacing:'-0.03em', lineHeight:1 }}>{valor}</p>
      <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:0, fontFamily:'var(--fonte-corpo)' }}>{sub}</p>
    </div>
  )
}

function SecaoHeader({ titulo, icone, onVerTodos }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
        <span style={{ color:'var(--texto-apagado)' }}>{icone}</span>
        <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)' }}>{titulo}</p>
      </div>
      {onVerTodos && <button onClick={onVerTodos} style={{ background:'none', border:'none', color:'var(--verde)', fontSize:'0.75rem', fontWeight:'600', cursor:'pointer', fontFamily:'var(--fonte-corpo)' }}>Ver todos →</button>}
    </div>
  )
}

// ── Resumo de Demandas (Spec 22) — um bloco por setor com rosca em SVG puro (RoscaDemandas,
// abaixo), sem dependência nova (projeto não tem lib de gráfico). Mesma competência de trabalho que Fiscal/DP/Contábil já usam
// (competenciaDefasada — mês anterior ao civil). Compartilhado entre InicioTitular e
// InicioColaborador (mesma lógica pros dois, per Spec 22) em vez de duplicar.
function ResumoDemandas({ usuario, isTitular }) {
  const [linhas, setLinhas] = useState(null) // null = carregando

  useEffect(() => {
    const competencia = competenciaDefasada()
    api.get('/setores').then(r => {
      const comDemanda = r.data.filter(s => CONFIG_DEMANDA[normalizarNome(s.nome)])
      const visiveis = isTitular
        ? comDemanda
        : comDemanda.filter(s => usuario?.setores?.some(us => (us._id || us).toString() === s._id))

      Promise.all(visiveis.map(s => {
        const setorNome = normalizarNome(s.nome)
        return api.get(`/clientes/demandas/${s._id}/${competencia}`)
          .then(r2 => {
            const contagem = { pendente: 0, incompleto: 0, concluido: 0 }
            r2.data.forEach(d => { contagem[statusDemanda(setorNome, d, competencia)]++ })
            return { setor: s, ...contagem, total: r2.data.length }
          })
          .catch(() => ({ setor: s, pendente: 0, incompleto: 0, concluido: 0, total: 0 }))
      })).then(resultados => setLinhas(resultados.filter(l => l.total > 0)))
    }).catch(() => setLinhas([]))
  }, [])

  // Setor sem nenhum cliente configurado pra Demanda não aparece (em vez de barra vazia) — sem
  // nenhum setor visível, o card inteiro some (em vez de aparecer vazio).
  if (!linhas || linhas.length === 0) return null

  const competencia = competenciaDefasada()

  return (
    <div className="rd-card" style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
      <style>{CSS_ROSCA}</style>
      <SecaoHeader titulo={`Demandas de ${nomeMes(competencia)}/${competencia.slice(0,4)}`} icone={<Icone.ClipboardList size={14}/>} />
      <div className="rd-grade">
        {linhas.map(l => {
          const { pendente, incompleto, concluido, total } = l
          return (
            <div key={l.setor._id} className="rd-bloco">
              <p style={{ fontSize:'13px', fontWeight:'600', lineHeight:1.3, color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)' }}>{l.setor.nome}</p>
              <p style={{ fontSize:'11px', lineHeight:1.4, color:'var(--texto-apagado)', margin:'0 0 12px', fontFamily:'var(--fonte-corpo)' }}>{total} {total === 1 ? 'demanda' : 'demandas'}</p>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <RoscaDemandas concluido={concluido} incompleto={incompleto} pendente={pendente} />
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  <ItemLegenda n={concluido} rotulo="Concluídas" cor={COR_CONCLUIDO} />
                  <ItemLegenda n={incompleto} rotulo="Incompletas" cor={COR_INCOMPLETO} />
                  <ItemLegenda n={pendente} rotulo="Pendentes" cor={COR_PENDENTE} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Rosca do card de Demandas (spec_rosca_demandas_inicio.md; referência visual em
// referencia_rosca_demandas.html). SVG puro, sem lib de gráfico. Cores do bloco por tema que não
// têm variável equivalente no index.css ficam aqui (--rd-*); fundo do bloco e sombra reaproveitam
// --card-hover e --sombra-card. Grade usa container query: 1 coluna quando o conteúdo do próprio
// card tem < 670px (a referência usa 640, mas aí entre 640 e ~663 a legenda vaza do bloco: rosca
// 92 + 14 + legenda ~77 + padding 28 = 211px por bloco × 3 + 2 gaps de 12).
const COR_CONCLUIDO = '#00b141'
const COR_INCOMPLETO = '#3b82f6'
const COR_PENDENTE = '#f59e0b'

const CSS_ROSCA = `
  :root, [data-tema="escuro"] {
    --rd-borda: #2e2e33; --rd-borda-hover: #3f3f46; --rd-anel: #2e2e34;
    --rd-sombra-hover: 0 2px 6px rgba(0,0,0,.45), 0 8px 20px rgba(0,0,0,.28);
    --rd-brilho: drop-shadow(0 0 6px rgba(0,177,65,.35));
  }
  [data-tema="claro"] {
    --rd-borda: #e4e4e7; --rd-borda-hover: #d4d4d8; --rd-anel: #e4e4e7;
    --rd-sombra-hover: 0 2px 6px rgba(0,0,0,.08), 0 8px 20px rgba(0,0,0,.08);
    --rd-brilho: drop-shadow(0 0 5px rgba(0,177,65,.25));
  }
  .rd-card { container-type: inline-size; }
  .rd-grade { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  @container (max-width: 669px) { .rd-grade { grid-template-columns: minmax(0, 1fr); } }
  .rd-bloco { background: var(--card-hover); border: 1px solid var(--rd-borda); border-radius: 12px; padding: 14px; min-width: 0; box-shadow: var(--sombra-card); transition: border-color .15s, box-shadow .15s; }
  .rd-bloco:hover { border-color: var(--rd-borda-hover); box-shadow: var(--rd-sombra-hover); }
  @keyframes rd-cresce { from { stroke-dasharray: 0 var(--rd-c); } }
  .rd-seg { animation: rd-cresce .9s ease-out both; }
  .rd-verde { filter: var(--rd-brilho); }
`

// Nunca "0%" com alguma concluída, nunca "100%" com alguma não concluída
const pctConcluido = (concluido, total) => {
  if (!total || concluido === 0) return 0
  const p = Math.round(concluido / total * 100)
  if (p === 0) return 1
  if (p === 100 && concluido < total) return 99
  return p
}

// Começa às 12h, sentido horário, pontas retas; ~3px de folga entre trechos só quando há mais de
// uma cor. A animação é CSS e só roda quando o SVG monta (re-render não repete).
function RoscaDemandas({ concluido, incompleto, pendente }) {
  const tam = 92, esp = 10, r = (tam - esp) / 2, c = 2 * Math.PI * r, m = tam / 2
  const total = concluido + incompleto + pendente
  const segs = [[concluido, COR_CONCLUIDO, true], [incompleto, COR_INCOMPLETO, false], [pendente, COR_PENDENTE, false]].filter(s => s[0] > 0)
  const folga = segs.length > 1 ? 3 : 0
  const pct = pctConcluido(concluido, total)
  let acum = 0
  return (
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} style={{ flex:'none', display:'block' }} role="img" aria-label={`${pct}% concluído`}>
      <circle cx={m} cy={m} r={r} fill="none" stroke="var(--rd-anel)" strokeWidth={esp} />
      {segs.map(([n, cor, verde]) => {
        const len = c * n / total, tr = Math.max(len - folga, 0.5)
        const offset = -acum
        acum += len
        return (
          <circle key={cor} className={verde ? 'rd-seg rd-verde' : 'rd-seg'} cx={m} cy={m} r={r} fill="none" stroke={cor} strokeWidth={esp} strokeLinecap="butt"
            transform={`rotate(-90 ${m} ${m})`}
            style={{ '--rd-c': c.toFixed(2), strokeDasharray: `${tr.toFixed(2)} ${(c - tr).toFixed(2)}`, strokeDashoffset: offset.toFixed(2) }} />
        )
      })}
      <text x={m} y={m - 7} textAnchor="middle" dominantBaseline="central" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="21" fontWeight="600" style={{ fill:'var(--texto)' }}>{pct}%</text>
      <text x={m} y={m + 13} textAnchor="middle" dominantBaseline="central" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="11" style={{ fill:'var(--texto-apagado)' }}>concluído</text>
    </svg>
  )
}

function ItemLegenda({ n, rotulo, cor }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
      <span style={{ width:'3px', height:'28px', borderRadius:'2px', flex:'none', background:cor }} />
      <div>
        <div style={{ fontSize:'16px', fontWeight:'600', lineHeight:1.15, color:'var(--texto)', fontFamily:'var(--fonte-corpo)' }}>{n}</div>
        <div style={{ fontSize:'11px', lineHeight:1.25, color:'var(--texto-apagado)', fontFamily:'var(--fonte-corpo)' }}>{rotulo}</div>
      </div>
    </div>
  )
}

// ── VERSÃO TITULAR ──
function InicioTitular({ usuario, setPagina }) {
  const [dados, setDados] = useState({ implantacoes:[], clientes:[], tarefas:[], logs:[], leads:[] })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/implantacoes').catch(()=>({ data:[] })),
      api.get('/clientes').catch(()=>({ data:[] })),
      api.get('/tarefas').catch(()=>({ data:[] })),
      api.get('/leads').catch(()=>({ data:[] })),
    ]).then(([imp, cli, tar, leads]) => {
      setDados({ implantacoes: imp.data, clientes: cli.data, tarefas: tar.data, leads: leads.data })
      setCarregando(false)
    })
  }, [])

  const impsAtivas = dados.implantacoes.filter(i => i.status !== 'concluida')
  const tarefasPendentes = dados.tarefas.filter(t => t.status !== 'concluida')
  const ultimosClientes = [...dados.clientes].sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm)).slice(0,3)

  // Progresso de cada implantação
  const progresso = (imp) => {
    const total = imp.etapas?.length || 0
    const conc = imp.etapas?.filter(e => e.status === 'concluida').length || 0
    return total ? Math.round((conc/total)*100) : 0
  }

  const etapaAtual = (imp) => imp.etapas?.find(e => e.status === 'em_andamento')?.nome || '—'

  const corPct = (pct) => pct >= 70 ? '#00b141' : pct >= 30 ? '#f59e0b' : '#f87171'

  if (carregando) return <p style={{ color:'var(--texto-apagado)', fontFamily:'var(--fonte-corpo)' }}>Carregando...</p>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {/* Saudação */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
        <div>
          <h1 style={{ fontSize:'1.4rem', fontWeight:'700', color:'var(--texto)', margin:0, letterSpacing:'-0.02em', fontFamily:'var(--fonte-corpo)' }}>
            {saudacao()}, {usuario?.nome?.split(' ')[0]}
          </h1>
          <p style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', margin:'4px 0 0', fontFamily:'var(--fonte-corpo)' }}>{dataHoje()}</p>
        </div>
        {tarefasPendentes.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 12px', background:'rgba(0,177,65,0.08)', border:'1px solid rgba(0,177,65,0.2)', borderRadius:'99px' }}>
            <Icone.CheckCircle size={13} style={{ color:'var(--verde)' }}/>
            <span style={{ fontSize:'0.75rem', fontWeight:'600', color:'var(--verde)', fontFamily:'var(--fonte-corpo)' }}>{tarefasPendentes.length} tarefa(s) pendente(s)</span>
          </div>
        )}
      </div>

      {/* Métricas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'10px' }}>
        <MetricCard icone={<Icone.ClipboardList size={14}/>} label="Onboardings" valor={impsAtivas.length} sub="em andamento" cor="var(--verde)" />
        <MetricCard icone={<Icone.Users size={14}/>} label="Clientes" valor={dados.clientes.length} sub="cadastrados" />
        <MetricCard icone={<Icone.CheckCircle size={14}/>} label="Tarefas" valor={tarefasPendentes.length} sub="pendentes" cor={tarefasPendentes.length > 5 ? '#f59e0b' : 'var(--texto)'} />
        <MetricCard icone={<Icone.Edit size={14}/>} label="Concluídos" valor={dados.implantacoes.filter(i=>i.status==='concluida').length} sub="onboardings" />
      </div>

      {/* Resumo de Demandas da competência atual */}
      <ResumoDemandas usuario={usuario} isTitular={true} />

      {/* Onboardings + Tarefas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
        {/* Onboardings ativos */}
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Onboardings ativos" icone={<Icone.ClipboardList size={14}/>} onVerTodos={()=>setPagina('implantacao')} />
          {impsAtivas.length === 0 ? (
            <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'var(--fonte-corpo)' }}>Nenhum onboarding em andamento.</p>
          ) : impsAtivas.slice(0,4).map(imp => {
            const pct = progresso(imp)
            return (
              <div key={imp._id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:'1px solid var(--borda)' }}
                className="ultimo-item">
                <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'var(--verde)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'700', color:'#fff', flexShrink:0 }}>
                  {imp.nomeCliente?.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)', margin:'0 0 3px', fontFamily:'var(--fonte-corpo)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{imp.nomeCliente}</p>
                  <div style={{ height:'3px', background:'var(--borda)', borderRadius:'99px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:corPct(pct), borderRadius:'99px', transition:'width 0.3s' }}/>
                  </div>
                  <p style={{ fontSize:'0.65rem', color:'var(--texto-apagado)', margin:'2px 0 0', fontFamily:'var(--fonte-corpo)' }}>{etapaAtual(imp)}</p>
                </div>
                <span style={{ fontSize:'0.72rem', fontWeight:'700', color:corPct(pct), flexShrink:0, fontFamily:'var(--fonte-corpo)' }}>{pct}%</span>
              </div>
            )
          })}
        </div>

        {/* Tarefas */}
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Tarefas pendentes" icone={<Icone.CheckCircle size={14}/>} onVerTodos={()=>setPagina('tarefas')} />
          {tarefasPendentes.length === 0 ? (
            <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'var(--fonte-corpo)' }}>Nenhuma tarefa pendente.</p>
          ) : tarefasPendentes.slice(0,5).map(t => (
            <div key={t._id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 0', borderBottom:'1px solid var(--borda)' }}>
              <div style={{ width:'15px', height:'15px', borderRadius:'4px', border:'1.5px solid var(--borda)', flexShrink:0, marginTop:'2px' }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:'0.82rem', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.descricao}</p>
                {t.data && <p style={{ fontSize:'0.68rem', color:'#f59e0b', margin:'2px 0 0', fontFamily:'var(--fonte-corpo)' }}>{new Date(t.data).toLocaleDateString('pt-BR')}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Últimos clientes + Histórico rápido */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
        {/* Últimos clientes */}
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Últimos clientes" icone={<Icone.Users size={14}/>} onVerTodos={()=>setPagina('clientes')} />
          {ultimosClientes.length === 0 ? (
            <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'var(--fonte-corpo)' }}>Nenhum cliente cadastrado ainda.</p>
          ) : ultimosClientes.map(c => {
            const nome = c.razaoSocial || c.nome || '—'
            return (
              <div key={c._id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:'1px solid var(--borda)' }}>
                <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'var(--verde)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'700', color:'#fff', flexShrink:0 }}>
                  {nome.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{nome}</p>
                  <p style={{ fontSize:'0.68rem', color:'var(--texto-apagado)', margin:'2px 0 0', fontFamily:'var(--fonte-corpo)' }}>{formatData(c.criadoEm)}{c.origem==='onboarding'?' · Via onboarding':''}</p>
                </div>
                {c.origem === 'onboarding' && (
                  <span style={{ fontSize:'0.62rem', fontWeight:'700', padding:'2px 6px', borderRadius:'4px', background:'rgba(99,102,241,0.1)', color:'#818cf8', flexShrink:0 }}>ONB</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Resumo CRM */}
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Funil CRM" icone={<Icone.Users size={14}/>} onVerTodos={()=>setPagina('crm')} />
          {(() => {
            const etapasFunil = [
              { id:'prospeccao', label:'Prospecção', cor:'#6366f1' },
              { id:'contato', label:'Contato', cor:'#f59e0b' },
              { id:'reuniao', label:'Reunião', cor:'#3b82f6' },
              { id:'proposta', label:'Proposta', cor:'#8b5cf6' },
              { id:'negocio_fechado', label:'Negócio fechado', cor:'#14b8a6' },
              { id:'ganho', label:'Ganho', cor:'#00b141' },
            ].map(e => ({ ...e, valor: dados.leads.filter(l => l.etapa === e.id).length }))
            const maxValor = Math.max(1, ...etapasFunil.map(e => e.valor))
            return dados.leads.length === 0 ? (
              <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'var(--fonte-corpo)' }}>Nenhum lead cadastrado ainda.</p>
            ) : etapasFunil.map((e,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 0', borderBottom:'1px solid var(--borda)' }}>
                <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:e.cor, flexShrink:0 }}/>
                <p style={{ fontSize:'0.8rem', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)', flex:1 }}>{e.label}</p>
                <div style={{ flex:2, height:'4px', background:'var(--borda)', borderRadius:'99px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(e.valor/maxValor)*100}%`, background:e.cor, borderRadius:'99px' }}/>
                </div>
                <span style={{ fontSize:'0.75rem', fontWeight:'700', color:e.cor, flexShrink:0, minWidth:'16px', textAlign:'right' }}>{e.valor}</span>
              </div>
            ))
          })()}
        </div>
      </div>
    </div>
  )
}

// ── VERSÃO COLABORADOR ──
function InicioColaborador({ usuario, setPagina, temPermissao }) {
  const [tarefas, setTarefas] = useState([])
  const [implantacoes, setImplantacoes] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/tarefas').catch(()=>({ data:[] })),
      api.get('/implantacoes').catch(()=>({ data:[] })),
    ]).then(([tar, imp]) => {
      setTarefas(tar.data)
      setImplantacoes(imp.data)
      setCarregando(false)
    })
  }, [])

  const minhasTarefas = tarefas.filter(t => t.status !== 'concluida')
  const impsAtivas = implantacoes.filter(i => i.status !== 'concluida')

  const progresso = (imp) => {
    const total = imp.etapas?.length || 0
    const conc = imp.etapas?.filter(e => e.status === 'concluida').length || 0
    return total ? Math.round((conc/total)*100) : 0
  }

  if (carregando) return <p style={{ color:'var(--texto-apagado)', fontFamily:'var(--fonte-corpo)' }}>Carregando...</p>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {/* Saudação */}
      <div>
        <h1 style={{ fontSize:'1.4rem', fontWeight:'700', color:'var(--texto)', margin:0, letterSpacing:'-0.02em', fontFamily:'var(--fonte-corpo)' }}>
          {saudacao()}, {usuario?.nome?.split(' ')[0]}
        </h1>
        <p style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', margin:'4px 0 0', fontFamily:'var(--fonte-corpo)' }}>{dataHoje()}</p>
      </div>

      {/* Métricas do colaborador */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'10px' }}>
        <MetricCard icone={<Icone.CheckCircle size={14}/>} label="Minhas tarefas" valor={minhasTarefas.length} sub="pendentes" cor={minhasTarefas.length > 3 ? '#f59e0b' : 'var(--verde)'} />
        <MetricCard icone={<Icone.ClipboardList size={14}/>} label="Onboardings" valor={impsAtivas.length} sub="em andamento" />
        <MetricCard icone={<Icone.CheckCircle size={14}/>} label="Concluídas" valor={tarefas.filter(t=>t.status==='concluida').length} sub="esta semana" cor="var(--verde)" />
      </div>

      {/* Resumo de Demandas da competência atual */}
      <ResumoDemandas usuario={usuario} isTitular={false} />

      {/* Meus setores */}
      {usuario?.setores?.length > 0 && (
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Meus setores" icone={<Icone.Users size={14}/>} />
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {usuario.setores.map(setor => (
              <span key={setor._id||setor} style={{ fontSize:'0.72rem', fontWeight:'600', padding:'4px 10px', borderRadius:'6px', background:'var(--input)', color:'var(--texto-apagado)', border:'1px solid var(--borda)', display:'flex', alignItems:'center', gap:'6px', fontFamily:'var(--fonte-corpo)' }}>
                <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:setor.cor||'var(--verde)', flexShrink:0 }}/>
                {setor.nome||setor}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Minhas tarefas */}
      <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
        <SecaoHeader titulo="Minhas tarefas" icone={<Icone.CheckCircle size={14}/>} onVerTodos={()=>setPagina('tarefas-minhas')} />
        {minhasTarefas.length === 0 ? (
          <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'var(--fonte-corpo)' }}>Nenhuma tarefa pendente. Ótimo trabalho!</p>
        ) : minhasTarefas.slice(0,5).map(t => (
          <div key={t._id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 0', borderBottom:'1px solid var(--borda)' }}>
            <div style={{ width:'15px', height:'15px', borderRadius:'4px', border:'1.5px solid var(--borda)', flexShrink:0, marginTop:'2px' }}/>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:'0.82rem', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)' }}>{t.descricao}</p>
              {t.data && <p style={{ fontSize:'0.68rem', color:'#f59e0b', margin:'2px 0 0', fontFamily:'var(--fonte-corpo)' }}>{new Date(t.data).toLocaleDateString('pt-BR')}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Onboardings onde participa */}
      {(temPermissao('criarImplantacoes') || temPermissao('gerenciarOnboarding')) && (
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Onboardings em andamento" icone={<Icone.ClipboardList size={14}/>} onVerTodos={()=>setPagina('implantacao')} />
          {impsAtivas.length === 0 ? (
            <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'var(--fonte-corpo)' }}>Nenhum onboarding ativo.</p>
          ) : impsAtivas.slice(0,3).map(imp => {
            const pct = progresso(imp)
            return (
              <div key={imp._id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:'1px solid var(--borda)' }}>
                <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'var(--verde)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'700', color:'#fff', flexShrink:0 }}>
                  {imp.nomeCliente?.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)', margin:'0 0 3px', fontFamily:'var(--fonte-corpo)' }}>{imp.nomeCliente}</p>
                  <div style={{ height:'3px', background:'var(--borda)', borderRadius:'99px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'var(--verde)', borderRadius:'99px' }}/>
                  </div>
                </div>
                <span style={{ fontSize:'0.72rem', fontWeight:'700', color:'var(--verde)', fontFamily:'var(--fonte-corpo)' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PaginaInicio({ usuario, setPagina, isTitular, temPermissao }) {
  if (isTitular) return <InicioTitular usuario={usuario} setPagina={setPagina} />
  return <InicioColaborador usuario={usuario} setPagina={setPagina} temPermissao={temPermissao} />
}
