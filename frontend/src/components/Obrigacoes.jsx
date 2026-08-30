import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useToast } from './Toast'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function ItemObrigacao({ item, servicoId, mes, ano, onAtualizado }) {
  const [obs, setObs] = useState(item.observacao || '')
  const [editandoObs, setEditandoObs] = useState(false)
  const [salvandoObs, setSalvandoObs] = useState(false)
  const inputRef = useRef(null)
  const { mostrar } = useToast()

  useEffect(() => { setObs(item.observacao || '') }, [item.observacao])
  useEffect(() => { if (editandoObs) inputRef.current?.focus() }, [editandoObs])

  const toggleFeito = async () => {
    try {
      await api.post('/obrigacoes/marcar', {
        clienteId: item.clienteId,
        servicoId, mes, ano,
        feito: !item.feito,
        observacao: obs,
      })
      onAtualizado()
    } catch { mostrar('Erro ao salvar.', 'erro') }
  }

  const salvarObs = async () => {
    setSalvandoObs(true)
    try {
      await api.patch('/obrigacoes/observacao', { clienteId: item.clienteId, servicoId, mes, ano, observacao: obs })
      setEditandoObs(false)
      onAtualizado()
    } catch { mostrar('Erro ao salvar observação.', 'erro') }
    finally { setSalvandoObs(false) }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '14px',
      padding: '12px 16px',
      borderBottom: '1px solid var(--borda)',
      background: item.feito ? 'rgba(0,177,65,0.03)' : 'transparent',
      transition: 'background 0.15s',
    }}>
      {/* Checkbox */}
      <div
        onClick={toggleFeito}
        style={{
          width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
          border: item.feito ? '2px solid var(--verde)' : '2px solid var(--borda)',
          background: item.feito ? 'var(--verde)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s', marginTop: '2px',
        }}
      >
        {item.feito && <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="1.5 5 4 7.5 8.5 2.5"/></svg>}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: '500', color: item.feito ? 'var(--texto-apagado)' : 'var(--texto)', margin: 0, fontFamily: 'var(--fonte-corpo)', textDecoration: item.feito ? 'line-through' : 'none' }}>
            {item.nomeCliente}
          </p>
          {item.cnpj && <span style={{ fontSize: '0.68rem', color: 'var(--texto-apagado)' }}>{item.cnpj}</span>}
          {item.feito && item.feitoPor && (
            <span style={{ fontSize: '0.68rem', color: 'var(--verde)', background: 'rgba(0,177,65,0.08)', padding: '1px 7px', borderRadius: '4px' }}>
              ✓ {item.feitoPor}
            </span>
          )}
        </div>

        {/* Observação */}
        {editandoObs ? (
          <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              ref={inputRef}
              style={{ flex: 1, background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '6px', padding: '5px 10px', color: 'var(--texto)', fontSize: '0.8rem', fontFamily: 'var(--fonte-corpo)' }}
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Observação..."
              onKeyDown={e => e.key === 'Enter' && salvarObs()}
            />
            <button onClick={salvarObs} disabled={salvandoObs} style={{ background: 'var(--verde)', border: 'none', borderRadius: '6px', color: '#fff', padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', whiteSpace: 'nowrap' }}>
              {salvandoObs ? '...' : 'Salvar'}
            </button>
            <button onClick={() => { setEditandoObs(false); setObs(item.observacao || '') }} style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)' }}>
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {obs ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', margin: 0, fontStyle: 'italic' }}>{obs}</p>
            ) : null}
            <button onClick={() => setEditandoObs(true)} style={{ background: 'none', border: 'none', color: 'var(--texto-apagado)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontFamily: 'var(--fonte-corpo)', opacity: 0.6 }}>
              {obs ? '✏️ editar obs.' : '+ observação'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CardServico({ grupo, mes, ano, onAtualizado }) {
  const [aberto, setAberto] = useState(true)
  const pct = grupo.total > 0 ? Math.round((grupo.concluidos / grupo.total) * 100) : 0
  const corPct = pct === 100 ? 'var(--verde)' : pct > 50 ? '#fbbf24' : 'var(--texto-apagado)'

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '14px', overflow: 'hidden' }}>
      {/* Header do serviço */}
      <div
        onClick={() => setAberto(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <p style={{ fontWeight: '700', color: 'var(--texto)', margin: 0, fontSize: '1rem', fontFamily: 'var(--fonte-corpo)' }}>{grupo.nomeServico}</p>
            <span style={{ fontSize: '0.68rem', fontWeight: '600', padding: '2px 8px', borderRadius: '5px', background: 'var(--input)', color: 'var(--texto-apagado)', border: '1px solid var(--borda)' }}>
              {grupo.periodicidade}
            </span>
          </div>
          {/* Barra de progresso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '4px', borderRadius: '99px', background: 'var(--borda)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: corPct, borderRadius: '99px', transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: '0.72rem', color: corPct, fontWeight: '600', flexShrink: 0 }}>
              {grupo.concluidos}/{grupo.total} — {pct}%
            </span>
          </div>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--texto-apagado)', transform: aberto ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>▶</span>
      </div>

      {/* Lista de clientes */}
      {aberto && (
        <div style={{ borderTop: '1px solid var(--borda)' }}>
          {grupo.itens.length === 0 ? (
            <p style={{ padding: '16px 20px', color: 'var(--texto-apagado)', fontSize: '0.82rem', margin: 0 }}>
              Nenhum cliente com este serviço ativo.
            </p>
          ) : (
            grupo.itens.map((item, i) => (
              <ItemObrigacao
                key={item.clienteId}
                item={item}
                servicoId={grupo.servicoId}
                mes={mes}
                ano={ano}
                onAtualizado={onAtualizado}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function Obrigacoes() {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [grupos, setGrupos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const { mostrar } = useToast()

  const carregar = async () => {
    setCarregando(true)
    try {
      const r = await api.get(`/obrigacoes?mes=${mes}&ano=${ano}`)
      setGrupos(r.data)
    } catch { mostrar('Erro ao carregar obrigações.', 'erro') }
    finally { setCarregando(false) }
  }

  useEffect(() => { carregar() }, [mes, ano])

  const anos = [ano - 1, ano, ano + 1]
  const totalConcluidos = grupos.reduce((a, g) => a + g.concluidos, 0)
  const totalGeral = grupos.reduce((a, g) => a + g.total, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--texto)', margin: 0, letterSpacing: '-0.03em', fontFamily: 'var(--fonte-corpo)' }}>Obrigações</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--texto-apagado)', marginTop: '5px', fontFamily: 'var(--fonte-corpo)' }}>
            Acompanhamento mensal dos serviços por cliente
          </p>
        </div>

        {/* Seletor de mês/ano */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => { const d = new Date(ano, mes - 2); setMes(d.getMonth() + 1); setAno(d.getFullYear()) }}
            style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto-apagado)', width: '32px', height: '32px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >‹</button>
          <div style={{ display: 'flex', gap: '6px' }}>
            <select value={mes} onChange={e => setMes(Number(e.target.value))} style={{ background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '6px 10px', color: 'var(--texto)', fontSize: '0.85rem', fontFamily: 'var(--fonte-corpo)', cursor: 'pointer' }}>
              {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '6px 10px', color: 'var(--texto)', fontSize: '0.85rem', fontFamily: 'var(--fonte-corpo)', cursor: 'pointer' }}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button
            onClick={() => { const d = new Date(ano, mes); setMes(d.getMonth() + 1); setAno(d.getFullYear()) }}
            style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto-apagado)', width: '32px', height: '32px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >›</button>
        </div>
      </div>

      {/* Resumo geral */}
      {!carregando && totalGeral > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: '6px', borderRadius: '99px', background: 'var(--borda)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round((totalConcluidos/totalGeral)*100)}%`, background: 'var(--verde)', borderRadius: '99px', transition: 'width 0.3s' }} />
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--texto-apagado)', margin: 0, fontFamily: 'var(--fonte-corpo)', flexShrink: 0 }}>
            <strong style={{ color: 'var(--texto)' }}>{totalConcluidos}</strong> de <strong style={{ color: 'var(--texto)' }}>{totalGeral}</strong> obrigações concluídas em {MESES[mes-1]}/{ano}
          </p>
        </div>
      )}

      {/* Conteúdo */}
      {carregando ? (
        <p style={{ color: 'var(--texto-apagado)', fontFamily: 'var(--fonte-corpo)' }}>Carregando...</p>
      ) : grupos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--texto-apagado)' }}>
          <p style={{ fontSize: '0.9rem', marginBottom: '8px', fontFamily: 'var(--fonte-corpo)' }}>
            Nenhuma obrigação para {MESES[mes-1]}/{ano}.
          </p>
          <p style={{ fontSize: '0.8rem', fontFamily: 'var(--fonte-corpo)' }}>
            Cadastre serviços com periodicidade mensal, trimestral ou anual e vincule-os aos clientes.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {grupos.map(g => (
            <CardServico key={g.servicoId} grupo={g} mes={mes} ano={ano} onAtualizado={carregar} />
          ))}
        </div>
      )}
    </div>
  )
}
