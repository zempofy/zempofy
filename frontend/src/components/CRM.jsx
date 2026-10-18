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
  { id: 'negocio_fechado', label: 'Negócio fechado', cor: '#14b8a6', bg: 'rgba(20,184,166,0.08)' },
  { id: 'ganho', label: 'Ganho', cor: '#00b141', bg: 'rgba(0,177,65,0.08)' },
  { id: 'perdido', label: 'Perdido', cor: '#f87171', bg: 'rgba(248,113,113,0.08)' },
]

// Filtro de mês: o quadro mostra cada lead na etapa em que estava no fim do mês (etapaNoMes, vem do backend)
const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const somarMeses = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(a, m-1+n, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const nomeDoMes = (mes) => { const [a, m] = mes.split('-').map(Number); return `${NOMES_MES[m-1]} ${a}` }
const ultimos24Meses = () => Array.from({ length: 24 }, (_, i) => somarMeses(mesAtual(), -i))
const etapaDoLead = (lead) => lead.etapaNoMes || lead.etapa
const formatData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : ''

const formatMoeda = (v) => `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/mês`
const mascaraTel = (v) => { const d=v.replace(/\D/g,'').slice(0,11); return d.length<=10?d.replace(/(\d{2})(\d{4})(\d)/,'($1) $2-$3'):d.replace(/(\d{2})(\d{5})(\d)/,'($1) $2-$3') }

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  modal: { background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'16px', width:'100%', maxWidth:'440px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.6)' },
  modalTopo: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid var(--borda)' },
  modalTitulo: { fontSize:'1rem', fontWeight:'700', color:'var(--texto)', fontFamily:'var(--fonte-corpo)' },
  modalCorpo: { padding:'20px 22px', display:'flex', flexDirection:'column', gap:'14px', overflowY:'auto' },
  modalRodape: { display:'flex', gap:'10px', justifyContent:'flex-end', padding:'16px 22px', borderTop:'1px solid var(--borda)' },
  btnX: { background:'none', border:'1px solid var(--borda)', borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--texto-apagado)' },
  label: { fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 6px', fontFamily:'var(--fonte-corpo)', display:'block' },
  input: { width:'100%', background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'9px 12px', color:'var(--texto)', fontSize:'0.85rem', fontFamily:'var(--fonte-corpo)', boxSizing:'border-box', colorScheme:'dark' },
  erro: { color:'#FCA5A5', fontSize:'0.8rem', background:'rgba(239,68,68,0.1)', padding:'8px 12px', borderRadius:'8px', fontFamily:'var(--fonte-corpo)', margin:0 },
  btnCancelar: { background:'none', border:'1px solid var(--borda)', borderRadius:'8px', color:'var(--texto-apagado)', padding:'9px 18px', fontFamily:'var(--fonte-corpo)', fontSize:'0.85rem', cursor:'pointer' },
  btnSalvar: { background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'8px', padding:'9px 18px', fontFamily:'var(--fonte-corpo)', fontWeight:'600', fontSize:'0.85rem', cursor:'pointer' },
  select: { background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'0 10px', height:'34px', boxSizing:'border-box', color:'var(--texto)', fontSize:'0.82rem', fontFamily:'var(--fonte-corpo)', colorScheme:'dark', cursor:'pointer' },
  inputBusca: { background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'0 12px', height:'34px', color:'var(--texto)', fontSize:'0.85rem', fontFamily:'var(--fonte-corpo)', boxSizing:'border-box', colorScheme:'dark' },
  // Mesmo visual dos botões de filtro da tela de Clientes (verde translúcido quando ativo)
  btnFiltrar: { display:'flex', alignItems:'center', gap:'6px', height:'34px', boxSizing:'border-box', padding:'0 14px', borderRadius:'8px', fontSize:'0.78rem', fontWeight:'600', fontFamily:'var(--fonte-corpo)', cursor:'pointer', whiteSpace:'nowrap', border:'1px solid var(--borda)', background:'var(--input)', color:'var(--texto)' },
  btnFiltrarAtivo: { border:'1px solid var(--verde)', background:'rgba(0,177,65,0.08)', color:'var(--verde)' },
  linhaFiltro: { display:'flex', flexWrap:'wrap', alignItems:'flex-start', gap:'8px 14px' },
  rotuloFiltro: { width:'92px', flexShrink:0, height:'30px', display:'flex', alignItems:'center', fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:'var(--fonte-corpo)' },
  chip: { height:'30px', boxSizing:'border-box', padding:'0 12px', borderRadius:'7px', fontSize:'0.75rem', fontWeight:'600', cursor:'pointer', fontFamily:'var(--fonte-corpo)' },
  btnSeta: { background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', width:'32px', height:'34px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--texto)', fontSize:'1.1rem', lineHeight:1, fontFamily:'var(--fonte-corpo)', padding:0 },
}

function Campo({ label, children }) {
  return <div><label style={s.label}>{label}</label>{children}</div>
}

function CardLead({ lead, onClick, onDragStart, onDragEnd, isTitular, arrastavel }) {
  // Ganho/Perdido mostram a data em que o lead foi movido pra coluna (canto inferior direito)
  const dataMovido = ['ganho','perdido'].includes(lead.etapaNoMes) ? formatData(lead.movidoEm) : ''
  return (
    <div
      draggable={arrastavel}
      onDragStart={arrastavel ? (e) => { e.dataTransfer.setData('leadId', lead._id); onDragStart && onDragStart() } : undefined}
      onDragEnd={arrastavel ? onDragEnd : undefined}
      onClick={() => onClick(lead)}
      style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'10px', padding:'12px 14px', cursor:'pointer', transition:'border-color 0.12s, opacity 0.15s', position:'relative' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(0,177,65,0.3)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--borda)'}
    >
      {/* Handle de drag — só desktop e mês corrente */}
      {arrastavel && (
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

      <div style={{ marginBottom:'8px', paddingRight: arrastavel ? '16px' : '0' }}>
        <p style={{ fontSize:'0.85rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)' }}>{lead.nomeEmpresa || lead.nome}</p>
        <p style={{ fontSize:'0.75rem', color:'var(--texto-apagado)', margin:'2px 0 0', fontFamily:'var(--fonte-corpo)' }}>{lead.nome}</p>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'0.72rem', fontWeight:'600', color:'var(--verde)' }}>{formatMoeda(lead.valor)}</span>
        {lead.origem && <span style={{ fontSize:'0.65rem', color:'var(--texto-apagado)', background:'var(--input)', padding:'1px 7px', borderRadius:'4px', border:'1px solid var(--borda)' }}>{lead.origem}</span>}
      </div>
      {(isTitular || dataMovido) && (
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'baseline', columnGap:'8px', margin:'6px 0 0', fontSize:'0.65rem', color:'var(--texto-apagado)', fontFamily:'var(--fonte-corpo)', opacity:0.7 }}>
          {isTitular && <span>por {lead.criadoPor?.nome || '—'}</span>}
          {dataMovido && <span style={{ marginLeft:'auto', whiteSpace:'nowrap' }}>{dataMovido}</span>}
        </div>
      )}
    </div>
  )
}

function DetalheDrawer({ lead, fechar, onMoverEtapa, isTitular, podeGerenciar, somenteLeitura, onEditar, onExcluir, onIniciarOnboarding }) {
  // Badge = etapa no mês filtrado; se o lead já andou depois disso, mostra também a etapa atual
  const etapa = ETAPAS.find(e => e.id === etapaDoLead(lead))
  const etapaAtual = ETAPAS.find(e => e.id === lead.etapa)
  const mostrarEtapaAtual = lead.etapaNoMes && lead.etapaNoMes !== lead.etapa
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex' }} onClick={fechar}>
      <div style={{ flex:1, background:'rgba(0,0,0,0.4)' }} />
      <div style={{ width:'380px', background:'var(--fundo)', borderLeft:'1px solid var(--borda)', display:'flex', flexDirection:'column', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--borda)', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:'1rem', fontWeight:'700', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)' }}>{lead.nomeEmpresa || lead.nome}</p>
            <p style={{ fontSize:'0.8rem', color:'var(--texto-apagado)', margin:'3px 0 0', fontFamily:'var(--fonte-corpo)' }}>{lead.nome}</p>
            <span style={{ fontSize:'0.68rem', fontWeight:'600', padding:'2px 8px', borderRadius:'5px', background:etapa?.bg, color:etapa?.cor, display:'inline-block', marginTop:'6px' }}>{etapa?.label}</span>
            {mostrarEtapaAtual && (
              <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:'6px 0 0', fontFamily:'var(--fonte-corpo)' }}>
                Etapa atual: <span style={{ color:etapaAtual?.cor, fontWeight:'600' }}>{etapaAtual?.label}</span>
              </p>
            )}
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
            <span style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', fontFamily:'var(--fonte-corpo)' }}>Valor do serviço</span>
            <span style={{ fontSize:'1rem', fontWeight:'700', color:'var(--verde)', fontFamily:'var(--fonte-corpo)' }}>{formatMoeda(lead.valor)}</span>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {[
              { icone: <Icone.Phone size={14}/>, label:'Telefone', valor: lead.telefone || '—' },
              { icone: <Icone.Mail size={14}/>, label:'E-mail', valor: lead.email || '—' },
              { icone: <Icone.Zap size={14}/>, label:'Origem', valor: lead.origem || '—' },
              { icone: <Icone.Clock size={14}/>, label:'Adicionado em', valor: lead.criadoEm ? new Date(lead.criadoEm).toLocaleDateString('pt-BR') : '—' },
              ...(lead.movidoEm ? [{ icone: <Icone.Clock size={14}/>, label:`Movido para ${etapa?.label} em`, valor: formatData(lead.movidoEm) }] : []),
              { icone: <Icone.FileText size={14}/>, label:'Tipo de serviço', valor: lead.tipoServico || '—' },
              ...(isTitular ? [{ icone: <Icone.Users size={14}/>, label:'Criado por', valor: lead.criadoPor?.nome || '—' }] : []),
            ].map((item,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ color:'var(--texto-apagado)', flexShrink:0 }}>{item.icone}</span>
                <span style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', fontFamily:'var(--fonte-corpo)', minWidth:'80px' }}>{item.label}</span>
                <span style={{ fontSize:'0.82rem', color:'var(--texto)', fontFamily:'var(--fonte-corpo)' }}>{item.valor}</span>
              </div>
            ))}
          </div>

          {lead.obs && (
            <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'12px 14px' }}>
              <p style={{ fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 6px', fontFamily:'var(--fonte-corpo)' }}>Observações</p>
              <p style={{ fontSize:'0.82rem', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)', lineHeight:'1.5' }}>{lead.obs}</p>
            </div>
          )}

          {podeGerenciar && !somenteLeitura && lead.etapa !== 'ganho' && (
            <div>
              <p style={{ fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 10px', fontFamily:'var(--fonte-corpo)' }}>Mover para etapa</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {ETAPAS.filter(e=>e.id!==lead.etapa).map(e=>(
                  <button key={e.id} onClick={()=>onMoverEtapa(e.id)} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', cursor:'pointer', fontFamily:'var(--fonte-corpo)', fontSize:'0.82rem', color:'var(--texto)', textAlign:'left' }}
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

          {lead.etapa === 'ganho' && (
            <div style={{ background:'rgba(0,177,65,0.06)', border:'1px solid rgba(0,177,65,0.2)', borderRadius:'10px', padding:'14px 16px' }}>
              <p style={{ fontSize:'0.78rem', color:'var(--verde)', fontWeight:'600', margin:'0 0 8px', fontFamily:'var(--fonte-corpo)' }}>Lead ganho!</p>
              <p style={{ fontSize:'0.75rem', color:'var(--texto-apagado)', margin:'0 0 12px', fontFamily:'var(--fonte-corpo)' }}>Este lead está pronto para iniciar o onboarding.</p>
              <button onClick={()=>onIniciarOnboarding(lead)} style={{ background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 16px', fontFamily:'var(--fonte-corpo)', fontWeight:'600', fontSize:'0.82rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', width:'100%', justifyContent:'center' }}>
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
    <div style={s.overlay}>
      <div style={s.modal} onClick={e=>e.stopPropagation()}>
        <div style={s.modalTopo}>
          <span style={s.modalTitulo}>{lead ? 'Editar lead' : 'Novo lead'}</span>
          <button style={s.btnX} onClick={fechar} title="Fechar">✕</button>
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
              <input style={s.input} value={form.telefone} onChange={e=>set('telefone',mascaraTel(e.target.value))} placeholder="(31) 99999-9999" maxLength={15} />
            </Campo>
            <Campo label="E-mail">
              <input style={s.input} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="contato@empresa.com" />
            </Campo>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Campo label="Valor do serviço">
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
  const [mes, setMes] = useState(mesAtual)
  const [colaboradorFiltro, setColaboradorFiltro] = useState('todos') // só titular
  const [usuarios, setUsuarios] = useState([])
  const [filtrosAbertos, setFiltrosAbertos] = useState(false) // sempre começa fechado, não persiste
  // Contador de requisições: troca rápida de mês não deixa uma resposta antiga sobrescrever a nova
  const reqAtual = useRef(0)

  const mesPassado = mes < mesAtual()
  const arrastavel = !mobile && !mesPassado

  const carregar = async () => {
    const id = ++reqAtual.current
    setCarregando(true)
    try {
      const params = { mes }
      if (isTitular && colaboradorFiltro !== 'todos') params.colaborador = colaboradorFiltro
      const r = await api.get('/leads', { params })
      if (id !== reqAtual.current) return
      setLeads(r.data)
    } catch (e) {
      if (id !== reqAtual.current) return
      mostrar(e.response?.data?.erro || 'Erro ao carregar leads.', 'erro')
    } finally {
      if (id === reqAtual.current) setCarregando(false)
    }
  }
  useEffect(() => { carregar() }, [mes, colaboradorFiltro])

  useEffect(() => {
    if (!isTitular) return
    api.get('/usuarios', { params: { incluirInativos: true } })
      .then(r => setUsuarios([...r.data].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))))
      .catch(() => {})
  }, [isTitular])

  const colaboradorSelecionado = usuarios.find(u => u._id === colaboradorFiltro)
  const meses = ultimos24Meses()

  // Filtros do painel (contam no botão): etapa + colaborador. Busca e mês não contam
  const qtdFiltros = (etapaFiltro ? 1 : 0) + (isTitular && colaboradorFiltro !== 'todos' ? 1 : 0)
  const limparFiltros = () => { setEtapaFiltro(null); setColaboradorFiltro('todos') }

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
    if (!arrastavel) return
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
    const matchEtapa = !etapaFiltro || etapaDoLead(l) === etapaFiltro
    return matchBusca && matchEtapa
  })

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:'700', color:'var(--texto)', margin:'0 0 4px', letterSpacing:'-0.03em', fontFamily:'var(--fonte-corpo)' }}>CRM</h1>
          <p style={{ fontSize:'0.82rem', color:'var(--texto-apagado)', margin:0, fontFamily:'var(--fonte-corpo)' }}>
            {!isTitular ? 'Visualizando seus leads' : colaboradorSelecionado ? `Visualizando leads de ${colaboradorSelecionado.nome}` : 'Visualizando todos os leads da equipe'}
          </p>
        </div>
        <button onClick={()=>{ setEditandoLead(null); setFormAberto(true) }} style={{ background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontFamily:'var(--fonte-corpo)', fontWeight:'600', fontSize:'0.875rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
          <Icone.Plus size={14}/> Novo lead
        </button>
      </div>

      {/* Resumo (leads do mês carregado, pela etapa em que estavam no mês) */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'Total de leads', valor: leads.length, cor:'var(--texto)' },
          { label:'Em negociação', valor: leads.filter(l=>['prospeccao','contato','reuniao','proposta'].includes(etapaDoLead(l))).length, cor:'#3b82f6' },
          { label:'Negócio fechado', valor: leads.filter(l=>etapaDoLead(l)==='negocio_fechado').length, cor:'#14b8a6' },
          { label:'Ganhos', valor: leads.filter(l=>etapaDoLead(l)==='ganho').length, cor:'var(--verde)' },
          { label:'Perdidos', valor: leads.filter(l=>etapaDoLead(l)==='perdido').length, cor:'#f87171' },
        ].map((item,i) => (
          <div key={i} style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'14px 18px' }}>
            <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:'0 0 6px', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:'var(--fonte-corpo)', fontWeight:'600' }}>{item.label}</p>
            <p style={{ fontSize:'1.6rem', fontWeight:'700', color:item.cor, margin:0, fontFamily:'var(--fonte-corpo)', letterSpacing:'-0.02em' }}>{item.valor}</p>
          </div>
        ))}
      </div>

      {/* Busca + Filtrar + mês. Quebra sem media query: a busca tem flexGrow enorme e o grupo
          "Filtrar + mês" flexGrow 1 — na mesma linha a busca fica com todo o espaço livre; quando o
          grupo quebra pra linha de baixo, ele estica e o space-between põe Filtrar à esquerda e mês à direita */}
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center', marginBottom: mesPassado ? '6px' : (filtrosAbertos ? '10px' : '16px') }}>
        <input style={{ ...s.inputBusca, flex:'9999 1 280px', minWidth:'180px' }} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar lead..." />
        <div style={{ flex:'1 0 auto', maxWidth:'100%', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:'8px 10px' }}>
          <button onClick={()=>setFiltrosAbertos(v=>!v)} style={{ ...s.btnFiltrar, ...(filtrosAbertos || qtdFiltros ? s.btnFiltrarAtivo : {}) }}>
            {qtdFiltros ? `Filtrar · ${qtdFiltros}` : 'Filtrar'}
          </button>
          {/* Em tela muito estreita (celular) o mês desce pra linha de baixo, alinhado à direita */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginLeft:'auto' }}>
            <button onClick={()=>setMes(m=>somarMeses(m,-1))} disabled={mes <= meses[meses.length-1]} title="Mês anterior"
              style={{ ...s.btnSeta, opacity: mes <= meses[meses.length-1] ? 0.4 : 1, cursor: mes <= meses[meses.length-1] ? 'default' : 'pointer' }}>‹</button>
            <select value={mes} onChange={e=>setMes(e.target.value)} style={s.select}>
              {meses.map(m => <option key={m} value={m}>{nomeDoMes(m)}</option>)}
            </select>
            <button onClick={()=>setMes(m=>somarMeses(m,1))} disabled={!mesPassado} title="Próximo mês"
              style={{ ...s.btnSeta, opacity: mesPassado ? 1 : 0.4, cursor: mesPassado ? 'pointer' : 'default' }}>›</button>
          </div>
        </div>
      </div>

      {mesPassado && (
        <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', fontFamily:'var(--fonte-corpo)', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'5px', margin: filtrosAbertos ? '0 0 10px' : '0 0 16px' }}>
          <Icone.Clock size={12}/> Mês encerrado — somente visualização
        </p>
      )}

      {/* Painel de filtros: fechar não desfaz os filtros (o contador no botão mostra que continuam valendo) */}
      {filtrosAbertos && (
        // Uma linha por grupo: rótulo de largura fixa + conteúdo. Em tela estreita o conteúdo desce
        // pra baixo do rótulo (grupos empilhados)
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', padding:'14px 16px', border:'1px solid var(--borda)', borderRadius:'10px', background:'var(--card)', marginBottom:'16px' }}>
          <div style={s.linhaFiltro}>
            <span style={s.rotuloFiltro}>Etapa</span>
            <div style={{ flex:'1 1 280px', display:'flex', flexWrap:'wrap', gap:'6px' }}>
              <button onClick={()=>setEtapaFiltro(null)} style={{ ...s.chip, border:`1px solid ${!etapaFiltro?'rgba(0,177,65,0.3)':'var(--borda)'}`, background:!etapaFiltro?'rgba(0,177,65,0.08)':'var(--input)', color:!etapaFiltro?'var(--verde)':'var(--texto-apagado)' }}>Todos</button>
              {ETAPAS.map(e=>(
                <button key={e.id} onClick={()=>setEtapaFiltro(etapaFiltro===e.id?null:e.id)} style={{ ...s.chip, border:`1px solid ${etapaFiltro===e.id?e.cor+'50':'var(--borda)'}`, background:etapaFiltro===e.id?e.bg:'var(--input)', color:etapaFiltro===e.id?e.cor:'var(--texto-apagado)' }}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          {(isTitular || qtdFiltros > 0) && (
            <div style={s.linhaFiltro}>
              <span style={s.rotuloFiltro}>{isTitular ? 'Colaborador' : ''}</span>
              <div style={{ flex:'1 1 280px', display:'flex', flexWrap:'wrap', alignItems:'center', gap:'8px 12px' }}>
                {isTitular && (
                  <select value={colaboradorFiltro} onChange={e=>setColaboradorFiltro(e.target.value)} style={{ ...s.select, maxWidth:'100%' }}>
                    <option value="todos">Todos os colaboradores</option>
                    {usuarios.map(u => <option key={u._id} value={u._id}>{u.nome}{u.ativo === false ? ' (inativo)' : ''}</option>)}
                  </select>
                )}
                {qtdFiltros > 0 && (
                  <button onClick={limparFiltros} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--texto-apagado)', fontSize:'0.78rem', fontWeight:'600', fontFamily:'var(--fonte-corpo)', cursor:'pointer', padding:'4px 2px', textDecoration:'underline', textUnderlineOffset:'3px' }}>
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dica drag — só desktop e mês corrente */}
      {arrastavel && (
        <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:'0 0 12px', fontFamily:'var(--fonte-corpo)', display:'flex', alignItems:'center', gap:'5px' }}>
          <Icone.Edit size={12}/> Arraste os cards pelos pontinhos para mover entre etapas
        </p>
      )}

      {/* Pipeline Kanban */}
      {carregando ? (
        <p style={{ color:'var(--texto-apagado)' }}>Carregando...</p>
      ) : (
        // Largura fixa: cabeçalhos e cards têm o mesmo tamanho em qualquer tela; tela menor rola na horizontal.
        // 7 × 176px + 6 × 12px = 1304px, cabe na área útil do Layout (1320px = max-width 1400px − 40px de padding de cada lado)
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 176px)', justifyContent:'start', gap:'12px', overflowX:'auto', paddingBottom:'16px', alignItems:'start' }}>
          {ETAPAS.map(etapa => {
            const leadsEtapa = leadsFiltrados.filter(l=>etapaDoLead(l)===etapa.id)
            const sobreDrop = dragSobre === etapa.id
            return (
              <div
                key={etapa.id}
                onDragOver={arrastavel ? (e)=>{ e.preventDefault(); setDragSobre(etapa.id) } : undefined}
                onDragLeave={arrastavel ? ()=>setDragSobre(null) : undefined}
                onDrop={arrastavel ? (e)=>onDrop(etapa.id, e) : undefined}
                style={{ display:'flex', flexDirection:'column', gap:'8px', transition:'all 0.15s', minWidth:0 }}
              >
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', height:'40px', boxSizing:'border-box', padding:'0 12px', borderRadius:'8px', background: sobreDrop ? etapa.bg : 'var(--card)', border:`1px solid ${sobreDrop ? etapa.cor+'50' : 'var(--borda)'}`, transition:'all 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'7px', minWidth:0 }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:etapa.cor, flexShrink:0 }}/>
                    <span style={{ fontSize:'0.8rem', fontWeight:'600', color:'var(--texto)', fontFamily:'var(--fonte-corpo)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0 }}>{etapa.label}</span>
                  </div>
                  <span style={{ fontSize:'0.72rem', fontWeight:'600', padding:'2px 7px', borderRadius:'99px', background:etapa.bg, color:etapa.cor, flexShrink:0 }}>{leadsEtapa.length}</span>
                </div>
                <div style={{ minHeight: sobreDrop ? '60px' : 'auto', borderRadius:'8px', outline: sobreDrop ? `2px dashed ${etapa.cor}50` : 'none', outlineOffset:'-2px', transition:'all 0.15s', display:'flex', flexDirection:'column', gap:'8px', padding: sobreDrop ? '4px' : '0' }}>
                  {leadsEtapa.length === 0 && !sobreDrop ? (
                    <div style={{ padding:'20px 12px', textAlign:'center', color:'var(--texto-apagado)', fontSize:'0.75rem', fontFamily:'var(--fonte-corpo)', border:'1px dashed var(--borda)', borderRadius:'8px' }}>Nenhum lead</div>
                  ) : (
                    leadsEtapa.map(lead => (
                      <CardLead
                        key={lead._id}
                        lead={lead}
                        onClick={setLeadSelecionado}
                        onDragStart={()=>setDragging(true)}
                        onDragEnd={()=>{ setDragging(false); setDragSobre(null) }}
                        isTitular={isTitular}
                        arrastavel={arrastavel}
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
          somenteLeitura={mesPassado}
          onEditar={()=>{ setEditandoLead(leadSelecionado); setFormAberto(true) }}
          onExcluir={()=>setExcluindoLead(leadSelecionado)}
          onIniciarOnboarding={(lead)=>{ setLeadSelecionado(null); onIniciarOnboarding && onIniciarOnboarding(lead) }}
        />
      )}

      {formAberto && (
        <FormLead
          lead={editandoLead}
          fechar={()=>setFormAberto(false)}
          onSalvo={()=>{
            if (leadSelecionado) setLeadSelecionado(null)
            // Lead novo nasce hoje: se estava olhando um mês passado, volta pro mês atual (o efeito recarrega)
            if (!editandoLead && mesPassado) setMes(mesAtual())
            else carregar()
          }}
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
