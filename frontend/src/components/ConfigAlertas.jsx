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

  if (carregando) return <p style={{ color:'var(--texto-apagado)', fontFamily:'Inter,sans-serif' }}>Carregando...</p>

  const cardStyle = { background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'14px', padding:'16px 18px' }
  const avisoStyle = { background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:'8px', padding:'10px 12px', marginBottom:0, display:'flex', gap:'8px', alignItems:'flex-start' }

  return (
    <div>
      <h2 style={{ fontSize:'1.2rem', fontWeight:'700', color:'var(--texto)', margin:'0 0 6px', letterSpacing:'-0.02em', fontFamily:'Inter,sans-serif' }}>Alertas e notificações</h2>
      <p style={{ fontSize:'0.82rem', color:'var(--texto-apagado)', margin:'0 0 18px', fontFamily:'Inter,sans-serif' }}>Configure os alertas automáticos enviados por e-mail.</p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'16px', maxWidth:'920px', marginBottom:'20px' }}>
        {/* Alerta onboarding parado */}
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
            <Icone.AlertTriangle size={16} style={{ color:'#f59e0b' }}/>
            <p style={{ fontSize:'0.9rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif' }}>Onboarding parado</p>
          </div>
          <p style={{ fontSize:'0.82rem', color:'var(--texto-apagado)', margin:'0 0 14px', fontFamily:'Inter,sans-serif', lineHeight:'1.5' }}>
            Envia alerta quando um onboarding ficar sem movimentação por mais de X dias.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
            <label style={{ fontSize:'0.78rem', fontWeight:'600', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap' }}>
              Dias sem movimentação
            </label>
            <select value={dias} onChange={e=>setDias(Number(e.target.value))}
              style={{ background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'7px 12px', color:'var(--texto)', fontSize:'0.85rem', fontFamily:'Inter,sans-serif', colorScheme:'dark' }}>
              {[3,5,7,10,14,21,30].map(d => (
                <option key={d} value={d}>{d} dias{d===7?' (padrão)':''}</option>
              ))}
            </select>
          </div>
          <div style={avisoStyle}>
            <Icone.AlertTriangle size={13} style={{ color:'#f59e0b', flexShrink:0, marginTop:'2px' }}/>
            <p style={{ fontSize:'0.75rem', color:'#f59e0b', margin:0, fontFamily:'Inter,sans-serif', lineHeight:'1.5' }}>
              Enviado diariamente às 8h para o e-mail do titular.
            </p>
          </div>
        </div>

        {/* Resumo periódico */}
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
            <Icone.FileText size={16} style={{ color:'#818cf8' }}/>
            <p style={{ fontSize:'0.9rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif' }}>Resumo periódico</p>
          </div>
          <p style={{ fontSize:'0.82rem', color:'var(--texto-apagado)', margin:'0 0 14px', fontFamily:'Inter,sans-serif', lineHeight:'1.5' }}>
            E-mail com um resumo do sistema: onboardings, tarefas e clientes.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
            <label style={{ fontSize:'0.78rem', fontWeight:'600', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap' }}>
              Frequência
            </label>
            <select value={frequencia} onChange={e=>setFrequencia(e.target.value)}
              style={{ background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'7px 12px', color:'var(--texto)', fontSize:'0.85rem', fontFamily:'Inter,sans-serif', colorScheme:'dark' }}>
              <option value="semanal">Semanal (toda segunda-feira)</option>
              <option value="quinzenal">Quinzenal (primeira segunda do mês)</option>
              <option value="mensal">Mensal (todo dia 1º)</option>
              <option value="nunca">Desativado</option>
            </select>
          </div>
          <div style={avisoStyle}>
            <Icone.AlertTriangle size={13} style={{ color:'#f59e0b', flexShrink:0, marginTop:'2px' }}/>
            <p style={{ fontSize:'0.75rem', color:'#f59e0b', margin:0, fontFamily:'Inter,sans-serif', lineHeight:'1.5' }}>
              Enviado às 8h do dia configurado para o e-mail do titular.
            </p>
          </div>
        </div>
      </div>

      <button onClick={salvar} disabled={salvando} style={{ background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 24px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.875rem', cursor:'pointer' }}>
        {salvando ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </div>
  )
}
