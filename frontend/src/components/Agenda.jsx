import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import ModalConfirmacao from './ModalConfirmacao'

const CORES = [
  { nome: 'Azul',     valor: '#2196F3' },
  { nome: 'Verde',    valor: '#22C55E' },
  { nome: 'Vermelho', valor: '#EF4444' },
  { nome: 'Amarelo',  valor: '#F59E0B' },
  { nome: 'Roxo',     valor: '#8B5CF6' },
]

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const HORAS = Array.from({ length: 24 }, (_, i) => i)
const ALTURA_HORA = 60

function hojeStr() { return new Date().toISOString().split('T')[0] }
function dataStr(ano, mes, dia) {
  return `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
}
function horaParaMinutos(hora) {
  if (!hora) return null
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + (m || 0)
}
function minutosParaPx(min) { return (min / 60) * ALTURA_HORA }

// ===== MODAL CRIAR/EDITAR EVENTO =====
function ModalEvento({ data, horaInicio, evento, onSalvar, onFechar }) {
  const [form, setForm] = useState({
    titulo: evento?.titulo || '',
    descricao: evento?.descricao || '',
    data: evento?.data || data || hojeStr(),
    horaInicio: evento?.horaInicio || horaInicio || '',
    horaFim: evento?.horaFim || '',
    cor: evento?.cor || '#2196F3',
  })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const salvar = async () => {
    if (!form.titulo.trim()) return setErro('Digite um título.')
    setCarregando(true)
    try { await onSalvar(form, evento?._id); onFechar() }
    catch { setErro('Erro ao salvar evento.') }
    finally { setCarregando(false) }
  }

  return createPortal(
    <>
      <div className="modal-fundo" onClick={onFechar} />
      <div className="modal-janela fade-in">
        <div className="modal-janela fade-in">
          <span style={s.modalTitulo}>{evento ? 'Editar evento' : 'Novo evento'}</span>
          <button style={s.btnX} onClick={onFechar}>✕</button>
        </div>
        <div className="modal-janela fade-in">
          {erro && <p style={s.erro}>{erro}</p>}
          <div style={s.campo}>
            <label style={s.label}>Título</label>
            <input style={s.input} placeholder="Ex: Reunião de equipe" value={form.titulo}
              onChange={e => setForm({...form, titulo: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && salvar()} autoFocus />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Descrição (opcional)</label>
            <input style={s.input} placeholder="Detalhes..." value={form.descricao}
              onChange={e => setForm({...form, descricao: e.target.value})} />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Data</label>
            <input style={s.input} type="date" value={form.data}
              onChange={e => setForm({...form, data: e.target.value})} />
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
            <div style={s.campo}>
              <label style={s.label}>Início</label>
              <input style={s.input} type="time" value={form.horaInicio}
                onChange={e => setForm({...form, horaInicio: e.target.value})} />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Fim</label>
              <input style={s.input} type="time" value={form.horaFim}
                onChange={e => setForm({...form, horaFim: e.target.value})} />
            </div>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Cor</label>
            <div style={s.coresWrapper}>
              {CORES.map(c => (
                <button key={c.valor} title={c.nome}
                  style={{...s.bolinhaCor, background: c.valor,
                    outline: form.cor === c.valor ? `3px solid ${c.valor}` : 'none',
                    outlineOffset: '2px',
                    transform: form.cor === c.valor ? 'scale(1.2)' : 'scale(1)'}}
                  onClick={() => setForm({...form, cor: c.valor})} />
              ))}
            </div>
          </div>
          <div style={{display:'flex', gap:'10px', marginTop:'4px'}}>
            <button style={s.btnCancelar} onClick={onFechar}>Cancelar</button>
            <button style={s.btnSalvar} onClick={salvar} disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar evento'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

// ===== BLOCO DE EVENTO POSICIONADO NA GRADE =====
function BlocoEvento({ item, tipo, onClick }) {
  const inicio = horaParaMinutos(item.horaInicio || item.hora)
  if (inicio === null) return null
  const fim = horaParaMinutos(item.horaFim)
  const duracaoMin = fim && fim > inicio ? fim - inicio : 60
  const top = minutosParaPx(inicio)
  const height = Math.max(minutosParaPx(duracaoMin), 22)
  const cor = tipo === 'tarefa' ? 'var(--texto-apagado)' : item.cor

  return (
    <div onClick={e => { e.stopPropagation(); onClick(item, tipo) }}
      style={{
        position:'absolute', top, left:'2px', right:'2px', height,
        background: cor + '25',
        borderLeft: `3px solid ${cor}`,
        borderRadius:'4px', padding:'2px 5px',
        cursor:'pointer', overflow:'hidden', zIndex:2, boxSizing:'border-box',
      }}>
      <p style={{margin:0, fontSize:'0.7rem', fontWeight:'600', color: cor, lineHeight:1.3,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace: height < 36 ? 'nowrap' : 'normal'}}>
        {item.titulo || item.descricao}
      </p>
      {height >= 36 && (
        <p style={{margin:0, fontSize:'0.65rem', color: cor + 'BB'}}>
          {item.horaInicio || item.hora}{item.horaFim ? ` → ${item.horaFim}` : ''}
        </p>
      )}
    </div>
  )
}

// ===== GRADE DE HORÁRIOS =====
function GradeHorarios({ dias, eventos, tarefas, hoje, onCelulaClick, onEventoClick }) {
  const scrollRef = useRef(null)
  const agora = new Date()
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, minutosParaPx(minutosAgora) - 200)
    }
  }, [])

  return (
    <div style={s.gradeContainer} className="grade-agenda">
      {/* Cabeçalho dos dias */}
      <div style={s.gradeCabecalho}>
        <div style={s.celulaHoraVazia} />
        {dias.map(({data, label, numDia}) => (
          <div key={data} style={{...s.colCabecalho, ...(data===hoje ? s.colCabecalhoHoje : {})}}>
            <span style={s.diaLabel}>{label}</span>
            <span style={{...s.diaNumero, ...(data===hoje ? s.diaNumeroHoje : {})}}>{numDia}</span>
          </div>
        ))}
      </div>

      {/* Área com scroll */}
      <div style={s.gradeScroll} ref={scrollRef}>
        {/* Labels de hora */}
        <div style={s.colunaHoras}>
          {HORAS.map(h => (
            <div key={h} style={s.celulaHora}>
              <span style={s.horaLabel}>{String(h).padStart(2,'0')}:00</span>
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {dias.map(({data}) => {
          const evsNoDia = eventos.filter(e => e.data === data)
          const tarNoDia = tarefas.filter(t => t.data === data && t.hora)
          const ehHoje = data === hoje

          return (
            <div key={data} style={{...s.colunaDia, ...(ehHoje ? s.colunaDiaHoje : {})}}>
              {/* Linhas de fundo clicáveis */}
              {HORAS.map(h => (
                <div key={h} style={s.linhaHora}
                  onClick={() => onCelulaClick(data, `${String(h).padStart(2,'0')}:00`)} />
              ))}

              {/* Linha do agora */}
              {ehHoje && (
                <div style={{...s.linhaAgora, top: minutosParaPx(minutosAgora)}}>
                  <div style={s.bolhinhaAgora} />
                </div>
              )}

              {/* Eventos */}
              {evsNoDia.map((ev, i) => (
                <BlocoEvento key={i} item={ev} tipo="evento" onClick={onEventoClick} />
              ))}
              {tarNoDia.map((t, i) => (
                <BlocoEvento key={`t${i}`} item={t} tipo="tarefa" onClick={onEventoClick} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===== VISÃO SEMANA =====
function VisaoSemana({ ano, mes, diaBase, eventos, tarefas, hoje, onCelulaClick, onEventoClick }) {
  const base = new Date(ano, mes, diaBase)
  const ini = new Date(base); ini.setDate(base.getDate() - base.getDay())
  const dias = Array.from({length:7}, (_, i) => {
    const d = new Date(ini); d.setDate(ini.getDate() + i)
    return { data: d.toISOString().split('T')[0], label: DIAS_SEMANA[i], numDia: d.getDate() }
  })
  return <GradeHorarios dias={dias} eventos={eventos} tarefas={tarefas} hoje={hoje}
    onCelulaClick={onCelulaClick} onEventoClick={onEventoClick} />
}

// ===== VISÃO DIA =====
function VisaoDia({ ano, mes, diaBase, eventos, tarefas, hoje, onCelulaClick, onEventoClick }) {
  const d = new Date(ano, mes, diaBase)
  const dias = [{ data: d.toISOString().split('T')[0], label: DIAS_SEMANA[d.getDay()], numDia: d.getDate() }]
  return <GradeHorarios dias={dias} eventos={eventos} tarefas={tarefas} hoje={hoje}
    onCelulaClick={onCelulaClick} onEventoClick={onEventoClick} />
}

// ===== VISÃO MÊS =====
function VisaoMes({ ano, mes, eventos, tarefas, hoje, onDiaClick }) {
  const primeiroDia = new Date(ano, mes, 1).getDay()
  const totalDias = new Date(ano, mes+1, 0).getDate()
  const celulas = [...Array(primeiroDia).fill(null), ...Array.from({length:totalDias}, (_,i) => i+1)]

  return (
    <div style={s.grade}>
      {DIAS_SEMANA.map(d => <div key={d} style={s.cabecalhoDia}>{d}</div>)}
      {celulas.map((dia, i) => {
        if (!dia) return <div key={`v${i}`} style={s.celulaVazia} />
        const data = dataStr(ano, mes, dia)
        const evsNoDia = eventos.filter(e => e.data === data)
        const tarNoDia = tarefas.filter(t => t.data === data)
        const total = evsNoDia.length + tarNoDia.length
        const ehHoje = data === hoje
        return (
          <div key={data} style={{...s.celula, ...(ehHoje ? s.celulaHoje : {})}} onClick={() => onDiaClick(data)}>
            <span style={{...s.numeroDia, ...(ehHoje ? s.numeroDiaHoje : {})}}>{dia}</span>
            <div style={s.eventosNaDia}>
              {[...evsNoDia.slice(0,2).map(e=>({...e,_t:'evento'})),
                ...tarNoDia.slice(0,Math.max(0,2-evsNoDia.length)).map(t=>({...t,_t:'tarefa'}))
              ].map((item,j) => (
                <div key={j} style={{...s.eventoTag,
                  background: item._t==='tarefa' ? 'var(--borda)' : item.cor+'33',
                  color: item._t==='tarefa' ? 'var(--texto-apagado)' : item.cor,
                  borderLeft: `3px solid ${item._t==='tarefa' ? 'var(--texto-apagado)' : item.cor}`}}>
                  {item.titulo || item.descricao}
                </div>
              ))}
              {total > 2 && <span style={s.mais}>+{total-2} mais</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ===== POPOVER DETALHE =====
function PopoverEvento({ item, tipo, onEditar, onExcluir, onFechar }) {
  const [confirmando, setConfirmando] = useState(false)
  return createPortal(
    <>
      <div className="modal-fundo" onClick={onFechar} />
      {confirmando && (
        <ModalConfirmacao titulo="Excluir evento" mensagem={`Excluir "${item.titulo}"?`}
          textoBotao="Excluir" perigo
          onConfirmar={() => { onExcluir(item._id); onFechar() }}
          onCancelar={() => setConfirmando(false)} />
      )}
      <div style={s.popoverEvento} className="fade-in">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <div style={{width:'12px', height:'12px', borderRadius:'3px', background: tipo==='tarefa' ? 'var(--texto-apagado)' : item.cor, flexShrink:0}} />
            <p style={{margin:0, fontFamily:'Inter, sans-serif', fontWeight:'700', fontSize:'1rem', color:'var(--texto)'}}>{item.titulo || item.descricao}</p>
          </div>
          <button style={s.btnX} onClick={onFechar}>✕</button>
        </div>
        {item.descricao && item.titulo && <p style={{margin:'0 0 8px', fontSize:'0.85rem', color:'var(--texto-apagado)'}}>{item.descricao}</p>}
        <p style={{margin:'0 0 8px', fontSize:'0.8rem', color:'var(--texto-apagado)'}}>
          📅 {item.data?.split('-').reverse().join('/')}
          {(item.horaInicio||item.hora) && ` · ${item.horaInicio||item.hora}${item.horaFim ? ` → ${item.horaFim}` : ''}`}
        </p>
        {tipo === 'tarefa' && (
          <span style={{fontSize:'0.75rem', padding:'3px 8px', borderRadius:'6px',
            background: item.status==='concluida' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
            color: item.status==='concluida' ? 'var(--verde)' : '#F59E0B', fontWeight:'600'}}>
            {item.status === 'concluida' ? 'Concluída' : 'Pendente'}
          </span>
        )}
        {tipo === 'evento' && (
          <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
            <button style={s.btnAcao} onClick={() => { onEditar(item); onFechar() }}>Editar</button>
            <button style={{...s.btnAcao, color:'#FCA5A5', borderColor:'rgba(239,68,68,0.3)'}} onClick={() => setConfirmando(true)}>Excluir</button>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

// ===== AGENDA PRINCIPAL =====
export default function Agenda({ cargo, usuarios = [] }) {
  const hoje = hojeStr()
  const dataHoje = new Date()
  const [visao, setVisao] = useState('semana')
  const [ano, setAno] = useState(dataHoje.getFullYear())
  const [mes, setMes] = useState(dataHoje.getMonth())
  const [diaBase, setDiaBase] = useState(dataHoje.getDate())
  const [eventos, setEventos] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [modalEvento, setModalEvento] = useState(null)
  const [editandoEvento, setEditandoEvento] = useState(null)
  const [eventoDetalhe, setEventoDetalhe] = useState(null)
  const [filtroUsuario, setFiltroUsuario] = useState('todos')

  const carregarDados = async () => {
    try {
      const params = filtroUsuario !== 'todos' ? `?usuarioId=${filtroUsuario}` : ''
      const [rEv, rTar] = await Promise.all([api.get(`/eventos${params}`), api.get('/tarefas')])
      setEventos(rEv.data)
      setTarefas(rTar.data)
    } catch(err) { console.error(err) }
  }

  useEffect(() => { carregarDados() }, [filtroUsuario])

  const salvarEvento = async (form, id) => {
    if (id) await api.put(`/eventos/${id}`, form)
    else await api.post('/eventos', form)
    carregarDados()
  }

  const excluirEvento = async (id) => {
    await api.delete(`/eventos/${id}`)
    carregarDados()
  }

  const navegar = (dir) => {
    if (visao === 'mes') {
      const nova = new Date(ano, mes+dir, 1)
      setAno(nova.getFullYear()); setMes(nova.getMonth())
    } else if (visao === 'semana') {
      const base = new Date(ano, mes, diaBase); base.setDate(base.getDate() + dir*7)
      setAno(base.getFullYear()); setMes(base.getMonth()); setDiaBase(base.getDate())
    } else {
      const base = new Date(ano, mes, diaBase); base.setDate(base.getDate() + dir)
      setAno(base.getFullYear()); setMes(base.getMonth()); setDiaBase(base.getDate())
    }
  }

  const irHoje = () => { setAno(dataHoje.getFullYear()); setMes(dataHoje.getMonth()); setDiaBase(dataHoje.getDate()) }

  const onDiaClick = (data) => {
    const [a,m,d] = data.split('-').map(Number)
    setAno(a); setMes(m-1); setDiaBase(d); setVisao('dia')
  }

  const tituloNav = () => {
    if (visao === 'mes') return `${MESES[mes]} ${ano}`
    if (visao === 'dia') return `${diaBase} de ${MESES[mes]} de ${ano}`
    const base = new Date(ano, mes, diaBase)
    const ini = new Date(base); ini.setDate(base.getDate() - base.getDay())
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6)
    if (ini.getMonth() === fim.getMonth())
      return `${ini.getDate()} – ${fim.getDate()} de ${MESES[ini.getMonth()]} ${ini.getFullYear()}`
    return `${ini.getDate()} ${MESES[ini.getMonth()].slice(0,3)} – ${fim.getDate()} ${MESES[fim.getMonth()].slice(0,3)} ${ini.getFullYear()}`
  }

  return (
    <div>
      <div style={s.cabecalho}>
        <div style={{display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap'}}>
          <h1 style={s.titulo}>Agenda</h1>
          <button style={s.btnHoje} onClick={irHoje}>Hoje</button>
          <div style={s.navBotoes}>
            <button style={s.btnNav} onClick={() => navegar(-1)}>‹</button>
            <span style={s.navTitulo}>{tituloNav()}</span>
            <button style={s.btnNav} onClick={() => navegar(1)}>›</button>
          </div>
        </div>
        <div style={{display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap'}}>
          {cargo === 'admin' && usuarios.length > 0 && (
            <select style={s.select} value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}>
              <option value="todos">Toda a equipe</option>
              {usuarios.map(u => <option key={u._id} value={u._id}>{u.nome}</option>)}
            </select>
          )}
          <div style={s.visaoBotoes}>
            {['dia','semana','mes'].map(v => (
              <button key={v} style={{...s.btnVisao, ...(visao===v ? s.btnVisaoAtivo : {})}} onClick={() => setVisao(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button style={s.btnNovo} onClick={() => setModalEvento({ data: hojeStr() })}>+ Evento</button>
        </div>
      </div>

      <div style={s.calendarioWrapper} className="zempofy-agenda">
        {visao === 'mes' && <VisaoMes ano={ano} mes={mes} eventos={eventos} tarefas={tarefas} hoje={hoje} onDiaClick={onDiaClick} />}
        {visao === 'semana' && <VisaoSemana ano={ano} mes={mes} diaBase={diaBase} eventos={eventos} tarefas={tarefas} hoje={hoje}
          onCelulaClick={(data, hora) => setModalEvento({data, hora})} onEventoClick={(item, tipo) => setEventoDetalhe({item, tipo})} />}
        {visao === 'dia' && <VisaoDia ano={ano} mes={mes} diaBase={diaBase} eventos={eventos} tarefas={tarefas} hoje={hoje}
          onCelulaClick={(data, hora) => setModalEvento({data, hora})} onEventoClick={(item, tipo) => setEventoDetalhe({item, tipo})} />}
      </div>

      {modalEvento && <ModalEvento data={modalEvento.data} horaInicio={modalEvento.hora} evento={null} onSalvar={salvarEvento} onFechar={() => setModalEvento(null)} />}
      {editandoEvento && <ModalEvento data={editandoEvento.data} evento={editandoEvento} onSalvar={salvarEvento} onFechar={() => setEditandoEvento(null)} />}
      {eventoDetalhe && <PopoverEvento item={eventoDetalhe.item} tipo={eventoDetalhe.tipo}
        onEditar={ev => { setEditandoEvento(ev); setEventoDetalhe(null) }}
        onExcluir={excluirEvento} onFechar={() => setEventoDetalhe(null)} />}
    </div>
  )
}

const s = {
  cabecalho: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px', overflow:'hidden' },
  titulo: { fontSize:'1.8rem', color:'var(--texto)', fontFamily:'Inter, sans-serif', fontWeight:'700' },
  btnHoje: { background:'none', border:'1px solid var(--borda)', borderRadius:'8px', padding:'6px 14px', color:'var(--texto)', fontSize:'0.85rem', cursor:'pointer', fontFamily:'Inter, sans-serif' },
  navBotoes: { display:'flex', alignItems:'center', gap:'8px' },
  btnNav: { background:'none', border:'1px solid var(--borda)', borderRadius:'8px', width:'32px', height:'32px', color:'var(--texto)', fontSize:'1.2rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  navTitulo: { fontFamily:'Inter, sans-serif', fontWeight:'600', fontSize:'1rem', color:'var(--texto)', minWidth:'120px', textAlign:'center' },
  visaoBotoes: { display:'flex', background:'var(--input)', borderRadius:'8px', padding:'3px', gap:'2px' },
  btnVisao: { background:'none', border:'none', borderRadius:'6px', padding:'5px 14px', color:'var(--texto-apagado)', fontSize:'0.85rem', cursor:'pointer', fontFamily:'Inter, sans-serif' },
  btnVisaoAtivo: { background:'var(--borda)', color:'var(--texto)' },
  btnNovo: { background:'linear-gradient(135deg, var(--verde), var(--verde-escuro))', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 16px', fontFamily:'Inter, sans-serif', fontWeight:'600', fontSize:'0.85rem', cursor:'pointer' },
  select: { background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'6px 12px', color:'var(--texto)', fontSize:'0.85rem', fontFamily:'Inter, sans-serif', cursor:'pointer' },
  calendarioWrapper: { background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'16px', overflow:'hidden', width:'100%' },

  // Grade
  gradeContainer: { display:'flex', flexDirection:'column' },
  gradeCabecalho: { display:'flex', borderBottom:'1px solid var(--borda)', background:'var(--card)', flexShrink:0, overflow:'hidden' },
  celulaHoraVazia: { width:'52px', flexShrink:0 },
  colCabecalho: { flex:1, padding:'10px 4px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', borderLeft:'1px solid var(--input)' },
  colCabecalhoHoje: { background:'rgba(34,197,94,0.05)' },
  diaLabel: { fontSize:'0.7rem', fontWeight:'600', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.5px' },
  diaNumero: { fontSize:'1.1rem', fontWeight:'700', color:'var(--texto)', width:'34px', height:'34px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%' },
  diaNumeroHoje: { background:'var(--verde)', color:'#fff' },
  gradeScroll: { display:'flex', overflowY:'auto', flex:1 },
  colunaHoras: { width:'52px', flexShrink:0, borderRight:'1px solid var(--borda)' },
  celulaHora: { height:`${ALTURA_HORA}px`, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:'6px', paddingTop:'2px', borderBottom:'1px solid var(--input)', boxSizing:'border-box' },
  horaLabel: { fontSize:'0.65rem', color:'var(--texto-apagado)', whiteSpace:'nowrap' },
  colunaDia: { flex:1, position:'relative', borderLeft:'1px solid var(--input)' },
  colunaDiaHoje: { background:'rgba(34,197,94,0.02)' },
  linhaHora: { height:`${ALTURA_HORA}px`, borderBottom:'1px solid var(--input)', boxSizing:'border-box', cursor:'pointer' },
  linhaAgora: { position:'absolute', left:0, right:0, height:'2px', background:'var(--verde)', zIndex:3, display:'flex', alignItems:'center', pointerEvents:'none' },
  bolhinhaAgora: { width:'10px', height:'10px', borderRadius:'50%', background:'var(--verde)', marginLeft:'-5px', flexShrink:0 },

  // Mês
  grade: { display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))', width:'100%', overflow:'hidden' },
  cabecalhoDia: { padding:'10px 0', textAlign:'center', fontSize:'0.75rem', fontWeight:'600', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid var(--borda)' },
  celula: { minHeight:'100px', padding:'8px', borderRight:'1px solid var(--input)', borderBottom:'1px solid var(--input)', cursor:'pointer', transition:'background 0.15s' },
  celulaVazia: { minHeight:'100px', borderRight:'1px solid var(--input)', borderBottom:'1px solid var(--input)', background:'var(--card)' },
  celulaHoje: { background:'rgba(34,197,94,0.05)' },
  numeroDia: { fontSize:'0.85rem', fontWeight:'500', color:'var(--texto-apagado)', display:'block', marginBottom:'4px' },
  numeroDiaHoje: { background:'var(--verde)', color:'#fff', borderRadius:'50%', width:'24px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', fontWeight:'700' },
  eventosNaDia: { display:'flex', flexDirection:'column', gap:'2px' },
  eventoTag: { fontSize:'0.7rem', padding:'2px 6px', borderRadius:'4px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:'500' },
  mais: { fontSize:'0.7rem', color:'var(--texto-apagado)', paddingLeft:'4px' },

  // Modal
  fundo: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000 },
  janelaEvento: { position:'fixed', top:'50%', left:'50%', transform:'translate(-50%, -50%)', width:'100%', maxWidth:'440px', background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'20px', zIndex:1001, boxShadow:'0 24px 64px rgba(0,0,0,0.6)', overflow:'hidden' },
  modalTopo: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid var(--borda)' },
  modalTitulo: { fontFamily:'Inter, sans-serif', fontWeight:'700', fontSize:'1rem', color:'var(--texto)' },
  btnX: { background:'none', border:'1px solid var(--borda)', borderRadius:'6px', color:'var(--texto-apagado)', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', cursor:'pointer' },
  modalCorpo: { padding:'24px', display:'flex', flexDirection:'column', gap:'16px' },
  campo: { display:'flex', flexDirection:'column', gap:'6px' },
  label: { fontSize:'0.7rem', fontWeight:'600', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px' },
  input: { background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'10px', padding:'10px 14px', color:'var(--texto)', fontSize:'0.9rem', width:'100%', fontFamily:'Inter, sans-serif' },
  coresWrapper: { display:'flex', gap:'10px', alignItems:'center' },
  bolinhaCor: { width:'26px', height:'26px', borderRadius:'50%', border:'none', cursor:'pointer', transition:'all 0.2s', flexShrink:0 },
  btnCancelar: { flex:1, padding:'10px', borderRadius:'10px', background:'none', border:'1px solid var(--borda)', color:'var(--texto-apagado)', fontSize:'0.9rem', cursor:'pointer', fontFamily:'Inter, sans-serif' },
  btnSalvar: { flex:1, padding:'10px', borderRadius:'10px', background:'linear-gradient(135deg, var(--verde), var(--verde-escuro))', border:'none', color:'#fff', fontSize:'0.9rem', cursor:'pointer', fontFamily:'Inter, sans-serif', fontWeight:'600' },
  erro: { color:'#FCA5A5', fontSize:'0.8rem', background:'rgba(239,68,68,0.1)', padding:'8px 12px', borderRadius:'8px', margin:0 },

  // Popover detalhe
  popoverEvento: { position:'fixed', top:'50%', left:'50%', transform:'translate(-50%, -50%)', width:'100%', maxWidth:'340px', background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'16px', zIndex:1001, boxShadow:'0 24px 64px rgba(0,0,0,0.6)', padding:'20px' },
  btnAcao: { flex:1, padding:'8px', borderRadius:'8px', background:'none', border:'1px solid var(--borda)', color:'var(--texto)', fontSize:'0.85rem', cursor:'pointer', fontFamily:'Inter, sans-serif' },
}
