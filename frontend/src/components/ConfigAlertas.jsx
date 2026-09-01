import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from './Toast'
import Icone from './Icones'

export default function ConfigAlertas() {
  const [dias, setDias] = useState(7)
  const [frequencia, setFrequencia] = useState('semanal')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const { mostrar } = useToast()

  useEffect(() => {
    api.get('/empresa').then(r => {
      setDias(r.data.alertaOnboardingDias || 7)
      setFrequencia(r.data.resumoFrequencia || 'semanal')
    }).catch(() => {}).finally(() => setCarregando(false))
  }, [])

  const salvar = async () => {
    setSalvando(true)
    try {
      await api.put('/empresa/configuracoes', { alertaOnboardingDias: dias, resumoFrequencia: frequencia })
      mostrar('Configurações salvas!', 'sucesso')
    } catch {
      mostrar('Erro ao salvar.', 'erro')
    } finally { setSalvando(false) }
  }

  if (carregando) return <p style={{ color:'var(--texto-apagado)', fontFamily:'var(--fonte-corpo)' }}>Carregando...</p>

  const cardStyle = { background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'13px 14px' }
  const avisoStyle = { background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:'7px', padding:'8px 10px', marginBottom:0, display:'flex', gap:'7px', alignItems:'flex-start' }

  return (
    <div>
      <h2 style={{ fontSize:'0.95rem', fontWeight:'700', color:'var(--texto)', margin:'0 0 5px', letterSpacing:'-0.02em', fontFamily:'var(--fonte-corpo)' }}>Alertas e notificações</h2>
      <p style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', margin:'0 0 14px', fontFamily:'var(--fonte-corpo)' }}>Configure os alertas automáticos enviados por e-mail.</p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'12px', marginBottom:'16px' }}>
        {/* Alerta onboarding parado */}
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
            <Icone.AlertTriangle size={14} style={{ color:'#f59e0b' }}/>
            <p style={{ fontSize:'0.85rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)' }}>Onboarding parado</p>
          </div>
          <p style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', margin:'0 0 11px', fontFamily:'var(--fonte-corpo)', lineHeight:'1.45' }}>
            Envia alerta quando um onboarding ficar sem movimentação por mais de X dias.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'11px' }}>
            <label style={{ fontSize:'0.74rem', fontWeight:'600', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:'var(--fonte-corpo)', whiteSpace:'nowrap' }}>
              Dias sem movimentação
            </label>
            <select value={dias} onChange={e=>setDias(Number(e.target.value))}
              style={{ background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'7px', padding:'5px 10px', color:'var(--texto)', fontSize:'0.8rem', fontFamily:'var(--fonte-corpo)', colorScheme:'dark' }}>
              {[3,5,7,10,14,21,30].map(d => (
                <option key={d} value={d}>{d} dias{d===7?' (padrão)':''}</option>
              ))}
            </select>
          </div>
          <div style={avisoStyle}>
            <Icone.AlertTriangle size={12} style={{ color:'#f59e0b', flexShrink:0, marginTop:'2px' }}/>
            <p style={{ fontSize:'0.72rem', color:'#f59e0b', margin:0, fontFamily:'var(--fonte-corpo)', lineHeight:'1.45' }}>
              Enviado diariamente às 8h para o e-mail do titular.
            </p>
          </div>
        </div>

        {/* Resumo periódico */}
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
            <Icone.FileText size={14} style={{ color:'#818cf8' }}/>
            <p style={{ fontSize:'0.85rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'var(--fonte-corpo)' }}>Resumo periódico</p>
          </div>
          <p style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', margin:'0 0 11px', fontFamily:'var(--fonte-corpo)', lineHeight:'1.45' }}>
            E-mail com um resumo do sistema: onboardings, tarefas e clientes.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'11px' }}>
            <label style={{ fontSize:'0.74rem', fontWeight:'600', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:'var(--fonte-corpo)', whiteSpace:'nowrap' }}>
              Frequência
            </label>
            <select value={frequencia} onChange={e=>setFrequencia(e.target.value)}
              style={{ background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'7px', padding:'5px 10px', color:'var(--texto)', fontSize:'0.8rem', fontFamily:'var(--fonte-corpo)', colorScheme:'dark' }}>
              <option value="semanal">Semanal (toda segunda-feira)</option>
              <option value="quinzenal">Quinzenal (primeira segunda do mês)</option>
              <option value="mensal">Mensal (todo dia 1º)</option>
              <option value="nunca">Desativado</option>
            </select>
          </div>
          <div style={avisoStyle}>
            <Icone.AlertTriangle size={12} style={{ color:'#f59e0b', flexShrink:0, marginTop:'2px' }}/>
            <p style={{ fontSize:'0.72rem', color:'#f59e0b', margin:0, fontFamily:'var(--fonte-corpo)', lineHeight:'1.45' }}>
              Enviado às 8h do dia configurado para o e-mail do titular.
            </p>
          </div>
        </div>
      </div>

      <button onClick={salvar} disabled={salvando} style={{ background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 20px', fontFamily:'var(--fonte-corpo)', fontWeight:'600', fontSize:'0.82rem', cursor:'pointer' }}>
        {salvando ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </div>
  )
}
