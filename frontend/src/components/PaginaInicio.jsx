import { useState, useEffect } from 'react'
import api from '../services/api'
import Icone from './Icones'

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
        <p style={{ fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', margin:0, fontFamily:'Inter,sans-serif' }}>{label}</p>
      </div>
      <p style={{ fontSize:'1.8rem', fontWeight:'700', color: cor || 'var(--texto)', margin:'0 0 4px', fontFamily:'Inter,sans-serif', letterSpacing:'-0.03em', lineHeight:1 }}>{valor}</p>
      <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:0, fontFamily:'Inter,sans-serif' }}>{sub}</p>
    </div>
  )
}

function SecaoHeader({ titulo, icone, onVerTodos }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
        <span style={{ color:'var(--texto-apagado)' }}>{icone}</span>
        <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif' }}>{titulo}</p>
      </div>
      {onVerTodos && <button onClick={onVerTodos} style={{ background:'none', border:'none', color:'var(--verde)', fontSize:'0.75rem', fontWeight:'600', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Ver todos →</button>}
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

  if (carregando) return <p style={{ color:'var(--texto-apagado)', fontFamily:'Inter,sans-serif' }}>Carregando...</p>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {/* Saudação */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
        <div>
          <h1 style={{ fontSize:'1.4rem', fontWeight:'700', color:'var(--texto)', margin:0, letterSpacing:'-0.02em', fontFamily:'Inter,sans-serif' }}>
            {saudacao()}, {usuario?.nome?.split(' ')[0]}
          </h1>
          <p style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', margin:'4px 0 0', fontFamily:'Inter,sans-serif' }}>{dataHoje()}</p>
        </div>
        {tarefasPendentes.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 12px', background:'rgba(0,177,65,0.08)', border:'1px solid rgba(0,177,65,0.2)', borderRadius:'99px' }}>
            <Icone.CheckCircle size={13} style={{ color:'var(--verde)' }}/>
            <span style={{ fontSize:'0.75rem', fontWeight:'600', color:'var(--verde)', fontFamily:'Inter,sans-serif' }}>{tarefasPendentes.length} tarefa(s) pendente(s)</span>
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

      {/* Onboardings + Tarefas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
        {/* Onboardings ativos */}
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Onboardings ativos" icone={<Icone.ClipboardList size={14}/>} onVerTodos={()=>setPagina('implantacao')} />
          {impsAtivas.length === 0 ? (
            <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'Inter,sans-serif' }}>Nenhum onboarding em andamento.</p>
          ) : impsAtivas.slice(0,4).map(imp => {
            const pct = progresso(imp)
            return (
              <div key={imp._id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:'1px solid var(--borda)' }}
                className="ultimo-item">
                <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'var(--verde)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'700', color:'#fff', flexShrink:0 }}>
                  {imp.nomeCliente?.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)', margin:'0 0 3px', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{imp.nomeCliente}</p>
                  <div style={{ height:'3px', background:'var(--borda)', borderRadius:'99px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:corPct(pct), borderRadius:'99px', transition:'width 0.3s' }}/>
                  </div>
                  <p style={{ fontSize:'0.65rem', color:'var(--texto-apagado)', margin:'2px 0 0', fontFamily:'Inter,sans-serif' }}>{etapaAtual(imp)}</p>
                </div>
                <span style={{ fontSize:'0.72rem', fontWeight:'700', color:corPct(pct), flexShrink:0, fontFamily:'Inter,sans-serif' }}>{pct}%</span>
              </div>
            )
          })}
        </div>

        {/* Tarefas */}
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Tarefas pendentes" icone={<Icone.CheckCircle size={14}/>} onVerTodos={()=>setPagina('tarefas')} />
          {tarefasPendentes.length === 0 ? (
            <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'Inter,sans-serif' }}>Nenhuma tarefa pendente.</p>
          ) : tarefasPendentes.slice(0,5).map(t => (
            <div key={t._id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 0', borderBottom:'1px solid var(--borda)' }}>
              <div style={{ width:'15px', height:'15px', borderRadius:'4px', border:'1.5px solid var(--borda)', flexShrink:0, marginTop:'2px' }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:'0.82rem', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.titulo}</p>
                {t.prazo && <p style={{ fontSize:'0.68rem', color:'#f59e0b', margin:'2px 0 0', fontFamily:'Inter,sans-serif' }}>{new Date(t.prazo).toLocaleDateString('pt-BR')}</p>}
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
            <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'Inter,sans-serif' }}>Nenhum cliente cadastrado ainda.</p>
          ) : ultimosClientes.map(c => {
            const nome = c.razaoSocial || c.nome || '—'
            return (
              <div key={c._id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:'1px solid var(--borda)' }}>
                <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'var(--verde)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'700', color:'#fff', flexShrink:0 }}>
                  {nome.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{nome}</p>
                  <p style={{ fontSize:'0.68rem', color:'var(--texto-apagado)', margin:'2px 0 0', fontFamily:'Inter,sans-serif' }}>{formatData(c.criadoEm)}{c.origem==='onboarding'?' · Via onboarding':''}</p>
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
              { id:'fechado', label:'Fechado', cor:'#00b141' },
            ].map(e => ({ ...e, valor: dados.leads.filter(l => l.etapa === e.id).length }))
            const maxValor = Math.max(1, ...etapasFunil.map(e => e.valor))
            return dados.leads.length === 0 ? (
              <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'Inter,sans-serif' }}>Nenhum lead cadastrado ainda.</p>
            ) : etapasFunil.map((e,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 0', borderBottom:'1px solid var(--borda)' }}>
                <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:e.cor, flexShrink:0 }}/>
                <p style={{ fontSize:'0.8rem', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif', flex:1 }}>{e.label}</p>
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

  if (carregando) return <p style={{ color:'var(--texto-apagado)', fontFamily:'Inter,sans-serif' }}>Carregando...</p>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {/* Saudação */}
      <div>
        <h1 style={{ fontSize:'1.4rem', fontWeight:'700', color:'var(--texto)', margin:0, letterSpacing:'-0.02em', fontFamily:'Inter,sans-serif' }}>
          {saudacao()}, {usuario?.nome?.split(' ')[0]}
        </h1>
        <p style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', margin:'4px 0 0', fontFamily:'Inter,sans-serif' }}>{dataHoje()}</p>
      </div>

      {/* Métricas do colaborador */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'10px' }}>
        <MetricCard icone={<Icone.CheckCircle size={14}/>} label="Minhas tarefas" valor={minhasTarefas.length} sub="pendentes" cor={minhasTarefas.length > 3 ? '#f59e0b' : 'var(--verde)'} />
        <MetricCard icone={<Icone.ClipboardList size={14}/>} label="Onboardings" valor={impsAtivas.length} sub="em andamento" />
        <MetricCard icone={<Icone.CheckCircle size={14}/>} label="Concluídas" valor={tarefas.filter(t=>t.status==='concluida').length} sub="esta semana" cor="var(--verde)" />
      </div>

      {/* Meus setores */}
      {usuario?.setores?.length > 0 && (
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Meus setores" icone={<Icone.Users size={14}/>} />
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {usuario.setores.map(setor => (
              <span key={setor._id||setor} style={{ fontSize:'0.72rem', fontWeight:'600', padding:'4px 10px', borderRadius:'6px', background:'var(--input)', color:'var(--texto-apagado)', border:'1px solid var(--borda)', display:'flex', alignItems:'center', gap:'6px', fontFamily:'Inter,sans-serif' }}>
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
          <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'Inter,sans-serif' }}>Nenhuma tarefa pendente. Ótimo trabalho!</p>
        ) : minhasTarefas.slice(0,5).map(t => (
          <div key={t._id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 0', borderBottom:'1px solid var(--borda)' }}>
            <div style={{ width:'15px', height:'15px', borderRadius:'4px', border:'1.5px solid var(--borda)', flexShrink:0, marginTop:'2px' }}/>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:'0.82rem', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif' }}>{t.titulo}</p>
              {t.prazo && <p style={{ fontSize:'0.68rem', color:'#f59e0b', margin:'2px 0 0', fontFamily:'Inter,sans-serif' }}>{new Date(t.prazo).toLocaleDateString('pt-BR')}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Onboardings onde participa */}
      {(temPermissao('criarImplantacoes') || temPermissao('gerenciarOnboarding')) && (
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px' }}>
          <SecaoHeader titulo="Onboardings em andamento" icone={<Icone.ClipboardList size={14}/>} onVerTodos={()=>setPagina('implantacao')} />
          {impsAtivas.length === 0 ? (
            <p style={{ color:'var(--texto-apagado)', fontSize:'0.82rem', fontFamily:'Inter,sans-serif' }}>Nenhum onboarding ativo.</p>
          ) : impsAtivas.slice(0,3).map(imp => {
            const pct = progresso(imp)
            return (
              <div key={imp._id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:'1px solid var(--borda)' }}>
                <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'var(--verde)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'700', color:'#fff', flexShrink:0 }}>
                  {imp.nomeCliente?.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)', margin:'0 0 3px', fontFamily:'Inter,sans-serif' }}>{imp.nomeCliente}</p>
                  <div style={{ height:'3px', background:'var(--borda)', borderRadius:'99px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'var(--verde)', borderRadius:'99px' }}/>
                  </div>
                </div>
                <span style={{ fontSize:'0.72rem', fontWeight:'700', color:'var(--verde)', fontFamily:'Inter,sans-serif' }}>{pct}%</span>
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
