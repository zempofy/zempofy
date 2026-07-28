import { useState, useRef, useEffect } from 'react'
import Icone from './Icones'
import api from '../services/api'
import { useToast } from './Toast'
import { useAuth } from '../contexts/AuthContext'
import ModalConfirmacao from './ModalConfirmacao'

const isMobile = () => window.innerWidth < 768 || ('ontouchstart' in window)

const ETAPAS = [
  { id: 'prospeccao', label: 'Prospecção', cor: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  { id: 'contato', label: 'Contato feito', cor: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  { id: 'reuniao', label: 'Reunião', cor: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  { id: 'proposta', label: 'Proposta enviada', cor: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  { id: 'fechado', label: 'Fechado', cor: '#00b141', bg: 'rgba(0,177,65,0.08)' },
  { id: 'perdido', label: 'Perdido', cor: '#f87171', bg: 'rgba(248,113,113,0.08)' },
]

const formatMoeda = (v) => `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/mês`

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  modal: { background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'16px', width:'100%', maxWidth:'440px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.6)' },
  modalTopo: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid var(--borda)' },
  modalTitulo: { fontSize:'1rem', fontWeight:'700', color:'var(--texto)', fontFamily:'Inter,sans-serif' },
  modalCorpo: { padding:'20px 22px', display:'flex', flexDirection:'column', gap:'14px', overflowY:'auto' },
  modalRodape: { display:'flex', gap:'10px', justifyContent:'flex-end', padding:'16px 22px', borderTop:'1px solid var(--borda)' },
  btnX: { background:'none', border:'1px solid var(--borda)', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--texto-apagado)' },
  label: { fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 6px', fontFamily:'Inter,sans-serif', display:'block' },
  input: { width:'100%', background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'9px 12px', color:'var(--texto)', fontSize:'0.85rem', fontFamily:'Inter,sans-serif', boxSizing:'border-box', colorScheme:'dark' },
  erro: { color:'#FCA5A5', fontSize:'0.8rem', background:'rgba(239,68,68,0.1)', padding:'8px 12px', borderRadius:'8px', fontFamily:'Inter,sans-serif', margin:0 },
  btnCancelar: { background:'none', border:'1px solid var(--borda)', borderRadius:'8px', color:'var(--texto-apagado)', padding:'9px 18px', fontFamily:'Inter,sans-serif', fontSize:'0.85rem', cursor:'pointer' },
  btnSalvar: { background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'8px', padding:'9px 18px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.85rem', cursor:'pointer' },
}

function Campo({ label, children }) {
  return <div><label style={s.label}>{label}</label>{children}</div>
}

function CardLead({ lead, onClick, onDragStart, onDragEnd, isTitular, mobile }) {
  return (
    <div
      draggable={!mobile}
      onDragStart={!mobile ? (e) => { e.dataTransfer.setData('leadId', lead._id); onDragStart && onDragStart() } : undefined}
      onDragEnd={!mobile ? onDragEnd : undefined}
      onClick={() => onClick(lead)}
      style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'10px', padding:'12px 14px', cursor:'pointer', transition:'border-color 0.12s, opacity 0.15s', position:'relative' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(0,177,65,0.3)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--borda)'}
    >
      {/* Handle de drag — só desktop */}
      {!mobile && (
        <div style={{ position:'absolute', top:'8px', right:'10px', color:'var(--borda)', cursor:'grab', display:'flex', flexDirection:'column', gap:'2px', padding:'2px' }}
          title="Arrastar para outra etapa"
          onMouseEnter={e=>e.currentTarget.style.color='var(--texto-apagado)'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--borda)'}
        >
          {[0,1].map(i=>(
            <div key={i} style={{ display:'flex', gap:'2px' }}>
              {[0,1].map(j=><div key={j} style={{ width:'3px', height:'3px', borderRadius:'50%', background:'currentColor' }}/>)}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom:'8px', paddingRight: mobile ? '0' : '16px' }}>
        <p style={{ fontSize:'0.85rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif' }}>{lead.nomeEmpresa || lead.nome}</p>
        <p style={{ fontSize:'0.75rem', color:'var(--texto-apagado)', margin:'2px 0 0', fontFamily:'Inter,sans-serif' }}>{lead.nome}</p>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'0.72rem', fontWeight:'600', color:'var(--verde)' }}>{formatMoeda(lead.valor)}</span>
        {lead.origem && <span style={{ fontSize:'0.65rem', color:'var(--texto-apagado)', background:'var(--input)', padding:'1px 7px', borderRadius:'4px', border:'1px solid var(--borda)' }}>{lead.origem}</span>}
      </div>
      {isTitular && (
        <p style={{ fontSize:'0.65rem', color:'var(--texto-apagado)', margin:'6px 0 0', fontFamily:'Inter,sans-serif', opacity:0.7 }}>
          por {lead.criadoPor?.nome || '—'}
        </p>
      )}
    </div>
  )
}

function DetalheDrawer({ lead, fechar, onMoverEtapa, isTitular, podeGerenciar, onEditar, onExcluir, onIniciarOnboarding }) {
  const etapa = ETAPAS.find(e => e.id === lead.etapa)
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex' }} onClick={fechar}>
      <div style={{ flex:1, background:'rgba(0,0,0,0.4)' }} />
      <div style={{ width:'380px', background:'var(--fundo)', borderLeft:'1px solid var(--borda)', display:'flex', flexDirection:'column', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--borda)', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:'1rem', fontWeight:'700', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif' }}>{lead.nomeEmpresa || lead.nome}</p>
            <p style={{ fontSize:'0.8rem', color:'var(--texto-apagado)', margin:'3px 0 0', fontFamily:'Inter,sans-serif' }}>{lead.nome}</p>
            <span style={{ fontSize:'0.68rem', fontWeight:'600', padding:'2px 8px', borderRadius:'5px', background:etapa?.bg, color:etapa?.cor, display:'inline-block', marginTop:'6px' }}>{etapa?.label}</span>
          </div>
          <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
            {podeGerenciar && (
              <>
                <button onClick={onEditar} title="Editar" style={{ background:'none', border:'1px solid var(--borda)', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--texto-apagado)' }}><Icone.Edit size={13}/></button>
                <button onClick={onExcluir} title="Excluir" style={{ background:'none', border:'1px solid rgba(248,113,113,0.3)', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#f87171' }}><Icone.Trash size={13}/></button>
              </>
            )}
            <button onClick={fechar} style={{ background:'none', border:'1px solid var(--borda)', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--texto-apagado)' }}>✕</button>
          </div>
        </div>

        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'20px', flex:1 }}>
          <div style={{ background:'rgba(0,177,65,0.06)', border:'1px solid rgba(0,177,65,0.15)', borderRadius:'10px', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', fontFamily:'Inter,sans-serif' }}>Valor estimado</span>
            <span style={{ fontSize:'1rem', fontWeight:'700', color:'var(--verde)', fontFamily:'Inter,sans-serif' }}>{formatMoeda(lead.valor)}</span>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {[
              { icone: <Icone.Phone size={14}/>, label:'Telefone', valor: lead.telefone || '—' },
              { icone: <Icone.Mail size={14}/>, label:'E-mail', valor: lead.email || '—' },
              { icone: <Icone.Zap size={14}/>, label:'Origem', valor: lead.origem || '—' },
              { icone: <Icone.Clock size={14}/>, label:'Adicionado em', valor: lead.criadoEm ? new Date(lead.criadoEm).toLocaleDateString('pt-BR') : '—' },
              { icone: <Icone.FileText size={14}/>, label:'Tipo de serviço', valor: lead.tipoServico || '—' },
              ...(isTitular ? [{ icone: <Icone.Users size={14}/>, label:'Criado por', valor: lead.criadoPor?.nome || '—' }] : []),
            ].map((item,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ color:'var(--texto-apagado)', flexShrink:0 }}>{item.icone}</span>
                <span style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', fontFamily:'Inter,sans-serif', minWidth:'80px' }}>{item.label}</span>
                <span style={{ fontSize:'0.82rem', color:'var(--texto)', fontFamily:'Inter,sans-serif' }}>{item.valor}</span>
              </div>
            ))}
          </div>

          {lead.obs && (
            <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'12px 14px' }}>
              <p style={{ fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 6px', fontFamily:'Inter,sans-serif' }}>Observações</p>
              <p style={{ fontSize:'0.82rem', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif', lineHeight:'1.5' }}>{lead.obs}</p>
            </div>
          )}

          {podeGerenciar && lead.etapa !== 'fechado' && (
            <div>
              <p style={{ fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 10px', fontFamily:'Inter,sans-serif' }}>Mover para etapa</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {ETAPAS.filter(e=>e.id!==lead.etapa).map(e=>(
                  <button key={e.id} onClick={()=>onMoverEtapa(e.id)} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.82rem', color:'var(--texto)', textAlign:'left' }}
                    onMouseEnter={el=>el.currentTarget.style.borderColor=e.cor}
                    onMouseLeave={el=>el.currentTarget.style.borderColor='var(--borda)'}
                  >
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:e.cor, flexShrink:0 }}/>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lead.etapa === 'fechado' && (
            <div style={{ background:'rgba(0,177,65,0.06)', border:'1px solid rgba(0,177,65,0.2)', borderRadius:'10px', padding:'14px 16px' }}>
              <p style={{ fontSize:'0.78rem', color:'var(--verde)', fontWeight:'600', margin:'0 0 8px', fontFamily:'Inter,sans-serif' }}>Lead fechado!</p>
              <p style={{ fontSize:'0.75rem', color:'var(--texto-apagado)', margin:'0 0 12px', fontFamily:'Inter,sans-serif' }}>Este lead está pronto para iniciar o onboarding.</p>
              <button onClick={()=>onIniciarOnboarding(lead)} style={{ background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 16px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.82rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', width:'100%', justifyContent:'center' }}>
                <Icone.ClipboardList size={14}/> Iniciar onboarding
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FormLead({ lead, fechar, onSalvo }) {
  const { mostrar } = useToast()
  const [form, setForm] = useState({
    nome: lead?.nome || '',
    nomeEmpresa: lead?.nomeEmpresa || '',
    telefone: lead?.telefone || '',
    email: lead?.email || '',
    valorCentavos: lead?.valor ? Math.round(lead.valor*100) : '',
    origem: lead?.origem || '',
    tipoServico: lead?.tipoServico || '',
    obs: lead?.obs || '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const set = (k,v) => setForm(f=>({ ...f, [k]:v }))

  const salvar = async () => {
    if (!form.nome.trim()) return setErro('Nome do contato é obrigatório.')
    setErro(''); setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      nomeEmpresa: form.nomeEmpresa.trim(),
      telefone: form.telefone,
      email: form.email,
      valor: form.valorCentavos ? parseInt(form.valorCentavos,10)/100 : 0,
      origem: form.origem,
      tipoServico: form.tipoServico,
      obs: form.obs,
    }
    try {
      if (lead?._id) { await api.put(`/leads/${lead._id}`, payload); mostrar('Lead atualizado!','sucesso') }
      else { await api.post('/leads', payload); mostrar('Lead criado!','sucesso') }
      onSalvo(); fechar()
    } catch (e) { setErro(e.response?.data?.erro || 'Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  return (
    <div style={s.overlay} onClick={fechar}>
      <div style={s.modal} onClick={e=>e.stopPropagation()}>
        <div style={s.modalTopo}>
          <span style={s.modalTitulo}>{lead ? 'Editar lead' : 'Novo lead'}</span>
          <button style={s.btnX} onClick={fechar}>✕</button>
        </div>
        <div style={s.modalCorpo}>
          {erro && <p style={s.erro}>{erro}</p>}
          <Campo label="Nome do contato *">
            <input style={s.input} value={form.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome de quem você falou" autoFocus />
          </Campo>
          <Campo label="Empresa">
            <input style={s.input} value={form.nomeEmpresa} onChange={e=>set('nomeEmpresa',e.target.value)} placeholder="Razão social ou nome fantasia" />
          </Campo>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Campo label="Telefone">
              <input style={s.input} value={form.telefone} onChange={e=>set('telefone',e.target.value)} placeholder="(31) 99999-9999" />
            </Campo>
            <Campo label="E-mail">
              <input style={s.input} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="contato@empresa.com" />
            </Campo>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Campo label="Valor estimado (R$/mês)">
              <input style={s.input}
                value={form.valorCentavos ? (parseInt(String(form.valorCentavos).replace(/\D/g,''),10)/100).toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''}
                onChange={e=>{ const nums=e.target.value.replace(/\D/g,''); set('valorCentavos', nums?parseInt(nums,10):'') }}
                placeholder="0,00" />
            </Campo>
            <Campo label="Origem">
              <input style={s.input} value={form.origem} onChange={e=>set('origem',e.target.value)} placeholder="Indicação, Instagram..." />
            </Campo>
          </div>
          <Campo label="Tipo de serviço">
            <input style={s.input} value={form.tipoServico} onChange={e=>set('tipoServico',e.target.value)} placeholder="Cliente novo, abertura de empresa..." />
          </Campo>
          <Campo label="Observações">
            <textarea style={{ ...s.input, minHeight:'70px', resize:'vertical' }} value={form.obs} onChange={e=>set('obs',e.target.value)} />
          </Campo>
        </div>
        <div style={s.modalRodape}>
          <button style={s.btnCancelar} onClick={fechar}>Cancelar</button>
          <button style={s.btnSalvar} onClick={salvar} disabled={salvando}>{salvando?'Salvando...':(lead?'Salvar alterações':'Criar lead')}</button>
        </div>
      </div>
    </div>
  )
}

export default function CRM({ onIniciarOnboarding }) {
  const { usuario } = useAuth()
  const { mostrar } = useToast()
  const isTitular = usuario?.cargo === 'admin'
  const [leads, setLeads] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [leadSelecionado, setLeadSelecionado] = useState(null)
  const [etapaFiltro, setEtapaFiltro] = useState(null)
  const [busca, setBusca] = useState('')
  const [dragSobre, setDragSobre] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [mobile] = useState(isMobile)
  const [formAberto, setFormAberto] = useState(false)
  const [editandoLead, setEditandoLead] = useState(null)
  const [excluindoLead, setExcluindoLead] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      const r = await api.get('/leads')
      setLeads(r.data)
    } catch { mostrar('Erro ao carregar leads.', 'erro') }
    finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const podeGerenciar = (lead) => isTitular || lead.criadoPor?._id === usuario?.id

  const moverEtapa = async (novaEtapa) => {
    const alvo = leadSelecionado
    try {
      const r = await api.put(`/leads/${alvo._id}`, { etapa: novaEtapa })
      setLeads(ls => ls.map(l => l._id === alvo._id ? r.data : l))
      setLeadSelecionado(r.data)
    } catch { mostrar('Erro ao mover lead.', 'erro') }
  }

  const onDrop = async (etapaId, e) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('leadId')
    setDragSobre(null); setDragging(false)
    const lead = leads.find(l => l._id === leadId)
    if (!lead || lead.etapa === etapaId || !podeGerenciar(lead)) return
    try {
      const r = await api.put(`/leads/${leadId}`, { etapa: etapaId })
      setLeads(ls => ls.map(l => l._id === leadId ? r.data : l))
    } catch { mostrar('Erro ao mover lead.', 'erro') }
  }

  const excluirLead = async () => {
    try {
      await api.delete(`/leads/${excluindoLead._id}`)
      setLeads(ls => ls.filter(l => l._id !== excluindoLead._id))
      mostrar('Lead removido.', 'aviso')
      setExcluindoLead(null)
      setLeadSelecionado(null)
    } catch { mostrar('Erro ao remover lead.', 'erro') }
  }

  const leadsFiltrados = leads.filter(l => {
    const matchBusca = !busca || (l.nomeEmpresa||'').toLowerCase().includes(busca.toLowerCase()) || l.nome.toLowerCase().includes(busca.toLowerCase())
    const matchEtapa = !etapaFiltro || l.etapa === etapaFiltro
    return matchBusca && matchEtapa
  })

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:'700', color:'var(--texto)', margin:'0 0 4px', letterSpacing:'-0.03em', fontFamily:'Inter,sans-serif' }}>CRM</h1>
          <p style={{ fontSize:'0.82rem', color:'var(--texto-apagado)', margin:0, fontFamily:'Inter,sans-serif' }}>
            {isTitular ? 'Visualizando todos os leads da equipe' : 'Visualizando seus leads'}
          </p>
        </div>
        <button onClick={()=>{ setEditandoLead(null); setFormAberto(true) }} style={{ background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.875rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
          <Icone.Plus size={14}/> Novo lead
        </button>
      </div>

      {/* Resumo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'Total de leads', valor: leads.length, cor:'var(--texto)' },
          { label:'Em negociação', valor: leads.filter(l=>!['fechado','perdido'].includes(l.etapa)).length, cor:'#3b82f6' },
          { label:'Fechados', valor: leads.filter(l=>l.etapa==='fechado').length, cor:'var(--verde)' },
          { label:'Perdidos', valor: leads.filter(l=>l.etapa==='perdido').length, cor:'#f87171' },
        ].map((item,i) => (
          <div key={i} style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'14px 18px' }}>
            <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:'0 0 6px', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:'Inter,sans-serif', fontWeight:'600' }}>{item.label}</p>
            <p style={{ fontSize:'1.6rem', fontWeight:'700', color:item.cor, margin:0, fontFamily:'Inter,sans-serif', letterSpacing:'-0.02em' }}>{item.valor}</p>
          </div>
        ))}
      </div>

      {/* Busca + filtro */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'8px 12px', color:'var(--texto)', fontSize:'0.85rem', fontFamily:'Inter,sans-serif', flex:1, minWidth:'200px', boxSizing:'border-box' }} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar lead..." />
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          <button onClick={()=>setEtapaFiltro(null)} style={{ padding:'7px 12px', borderRadius:'7px', fontSize:'0.75rem', fontWeight:'600', cursor:'pointer', fontFamily:'Inter,sans-serif', border:`1px solid ${!etapaFiltro?'rgba(0,177,65,0.3)':'var(--borda)'}`, background:!etapaFiltro?'rgba(0,177,65,0.08)':'var(--input)', color:!etapaFiltro?'var(--verde)':'var(--texto-apagado)' }}>Todos</button>
          {ETAPAS.map(e=>(
            <button key={e.id} onClick={()=>setEtapaFiltro(etapaFiltro===e.id?null:e.id)} style={{ padding:'7px 12px', borderRadius:'7px', fontSize:'0.75rem', fontWeight:'600', cursor:'pointer', fontFamily:'Inter,sans-serif', border:`1px solid ${etapaFiltro===e.id?e.cor+'50':'var(--borda)'}`, background:etapaFiltro===e.id?e.bg:'var(--input)', color:etapaFiltro===e.id?e.cor:'var(--texto-apagado)' }}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dica drag — só desktop */}
      {!mobile && (
        <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:'0 0 12px', fontFamily:'Inter,sans-serif', display:'flex', alignItems:'center', gap:'5px' }}>
          <Icone.Edit size={12}/> Arraste os cards pelos pontinhos para mover entre etapas
        </p>
      )}

      {/* Pipeline Kanban */}
      {carregando ? (
        <p style={{ color:'var(--texto-apagado)' }}>Carregando...</p>
      ) : (
        <div style={{ display:'flex', gap:'12px', overflowX:'auto', paddingBottom:'16px', alignItems:'flex-start' }}>
          {ETAPAS.map(etapa => {
            const leadsEtapa = leadsFiltrados.filter(l=>l.etapa===etapa.id)
            const sobreDrop = dragSobre === etapa.id
            return (
              <div
                key={etapa.id}
                onDragOver={!mobile ? (e)=>{ e.preventDefault(); setDragSobre(etapa.id) } : undefined}
                onDragLeave={!mobile ? ()=>setDragSobre(null) : undefined}
                onDrop={!mobile ? (e)=>onDrop(etapa.id, e) : undefined}
                style={{ flex:'0 0 220px', display:'flex', flexDirection:'column', gap:'8px', transition:'all 0.15s' }}
              >
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:'8px', background: sobreDrop ? etapa.bg : 'var(--card)', border:`1px solid ${sobreDrop ? etapa.cor+'50' : 'var(--borda)'}`, transition:'all 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:etapa.cor, flexShrink:0 }}/>
                    <span style={{ fontSize:'0.8rem', fontWeight:'600', color:'var(--texto)', fontFamily:'Inter,sans-serif' }}>{etapa.label}</span>
                  </div>
                  <span style={{ fontSize:'0.72rem', fontWeight:'600', padding:'2px 7px', borderRadius:'99px', background:etapa.bg, color:etapa.cor }}>{leadsEtapa.length}</span>
                </div>
                <div style={{ minHeight: sobreDrop ? '60px' : 'auto', borderRadius:'8px', border: sobreDrop ? `2px dashed ${etapa.cor}50` : '2px solid transparent', transition:'all 0.15s', display:'flex', flexDirection:'column', gap:'8px', padding: sobreDrop ? '4px' : '0' }}>
                  {leadsEtapa.length === 0 && !sobreDrop ? (
                    <div style={{ padding:'20px 12px', textAlign:'center', color:'var(--texto-apagado)', fontSize:'0.75rem', fontFamily:'Inter,sans-serif', border:'1px dashed var(--borda)', borderRadius:'8px' }}>Nenhum lead</div>
                  ) : (
                    leadsEtapa.map(lead => (
                      <CardLead
                        key={lead._id}
                        lead={lead}
                        onClick={setLeadSelecionado}
                        onDragStart={()=>setDragging(true)}
                        onDragEnd={()=>{ setDragging(false); setDragSobre(null) }}
                        isTitular={isTitular}
                        mobile={mobile}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {leadSelecionado && (
        <DetalheDrawer
          lead={leadSelecionado}
          fechar={()=>setLeadSelecionado(null)}
          onMoverEtapa={moverEtapa}
          isTitular={isTitular}
          podeGerenciar={podeGerenciar(leadSelecionado)}
          onEditar={()=>{ setEditandoLead(leadSelecionado); setFormAberto(true) }}
          onExcluir={()=>setExcluindoLead(leadSelecionado)}
          onIniciarOnboarding={(lead)=>{ setLeadSelecionado(null); onIniciarOnboarding && onIniciarOnboarding(lead) }}
        />
      )}

      {formAberto && (
        <FormLead
          lead={editandoLead}
          fechar={()=>setFormAberto(false)}
          onSalvo={()=>{ carregar(); if (leadSelecionado) setLeadSelecionado(null) }}
        />
      )}

      {excluindoLead && (
        <ModalConfirmacao
          titulo="Remover lead"
          mensagem={`Tem certeza que deseja remover ${excluindoLead.nomeEmpresa || excluindoLead.nome}?`}
          textoBotao="Remover" perigo
          onConfirmar={excluirLead}
          onCancelar={()=>setExcluindoLead(null)}
        />
      )}
    </div>
  )
}
