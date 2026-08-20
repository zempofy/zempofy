import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import Icone from './Icones'
import { useAuth } from '../contexts/AuthContext'
import Clientes, { CONFIG_DEMANDA, blocosFixosDoSetor, normalizarNome, competenciaPadraoDoSetor, nomeMes, INICIO_DEMANDA_ANO } from './Clientes'

const mesmoSetor = (a, b) => (a?._id || a) === (b?._id || b)

// Todos os campos configurados pra esse setor/regime/situação naquele mês (exceto tipo 'calculado',
// que nunca é salvo — ver spec do campo Faturamento total) preenchidos em `dados` = concluído
const statusDemanda = (setorNome, item, competencia) => {
  const config = CONFIG_DEMANDA[setorNome]
  const blocos = blocosFixosDoSetor(config, { regime: item.regime, situacao: item.situacao, competencia })
  const campos = blocos.flatMap(b => b.campos).filter(c => c.tipo !== 'calculado')
  if (campos.length === 0) {
    // Setor por regime (Fiscal): 0 campos = regime ainda não definido = pendente de verdade.
    // Setor por situação (DP/Contábil): se a situação já foi respondida mas esse mês específico
    // não tem nenhum módulo ativo (ex: Contábil trimestral fora de mar/jun/set/dez, ou sem banco
    // cadastrado), mesmo sem campo pra preencher ainda existe algo a confirmar — só conta como
    // concluído se o lançamento dessa competência já foi salvo de verdade (alguém clicou em
    // "Salvar competência"), não automaticamente.
    if (config?.modulos && item.situacao) return item.existe ? 'concluido' : 'pendente'
    return 'pendente'
  }
  const completo = campos.every(c => {
    const v = item.dados?.[c.id]
    return !(v === undefined || v === null || v === '')
  })
  return completo ? 'concluido' : 'pendente'
}

const mudarCompetencia = (competencia, delta) => {
  const [ano, mes] = competencia.split('-').map(Number)
  const d = new Date(ano, mes - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Demandas() {
  const { usuario } = useAuth()
  const isTitular = usuario?.cargo === 'admin'

  const [setoresList, setSetoresList] = useState([])
  const [carregandoSetores, setCarregandoSetores] = useState(true)
  const [setorId, setSetorId] = useState(null)
  const [competencia, setCompetencia] = useState(null)
  const [demandas, setDemandas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [filtro, setFiltro] = useState('todas')
  const [setorDropdownAberto, setSetorDropdownAberto] = useState(false)
  const [clienteAberto, setClienteAberto] = useState(null) // { clienteId, setorId, competencia } | null
  const setorDropdownRef = useRef(null)

  useEffect(() => {
    api.get('/setores').then(r => {
      const comDemanda = r.data.filter(s => CONFIG_DEMANDA[normalizarNome(s.nome)])
      const visiveis = isTitular
        ? comDemanda
        : comDemanda.filter(s => usuario?.setores?.some(us => (us._id || us).toString() === s._id))
      setSetoresList(visiveis)
      setSetorId(prev => prev || visiveis[0]?._id || null)
      // Fiscal/DP/Contábil trabalham em cima do mês anterior ao civil — abre nessa competência por
      // padrão (ver competenciaPadraoDoSetor em Clientes.jsx, mesma função reaproveitada aqui)
      setCompetencia(prev => prev || competenciaPadraoDoSetor(visiveis[0]?.nome))
    }).finally(() => setCarregandoSetores(false))
  }, [])

  useEffect(() => {
    if (!setorId || !competencia) return
    setCarregando(true)
    api.get(`/clientes/demandas/${setorId}/${competencia}`)
      .then(r => setDemandas(r.data))
      .catch(() => setDemandas([]))
      .finally(() => setCarregando(false))
  }, [setorId, competencia])

  useEffect(() => {
    if (!setorDropdownAberto) return
    const fecharFora = (e) => { if (!setorDropdownRef.current?.contains(e.target)) setSetorDropdownAberto(false) }
    const fecharEsc = (e) => { if (e.key === 'Escape') setSetorDropdownAberto(false) }
    document.addEventListener('mousedown', fecharFora)
    document.addEventListener('keydown', fecharEsc)
    return () => { document.removeEventListener('mousedown', fecharFora); document.removeEventListener('keydown', fecharEsc) }
  }, [setorDropdownAberto])

  if (clienteAberto) {
    return <Clientes
      detalheInicial={clienteAberto.clienteId}
      abaInicial="demanda"
      setorInicial={clienteAberto.setorId}
      competenciaInicial={clienteAberto.competencia}
      onDetalheAberto={() => setClienteAberto(null)}
    />
  }

  if (carregandoSetores) return <p style={{ color: 'var(--texto-apagado)' }}>Carregando...</p>

  if (setoresList.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--texto)', margin: 0, letterSpacing: '-0.03em' }}>Demandas</h1>
        <p style={{ color: 'var(--texto-apagado)', fontSize: '0.875rem', marginTop: '20px' }}>Você não participa de nenhum setor com demanda mensal configurada ainda.</p>
      </div>
    )
  }

  const setorSelecionado = setoresList.find(s => s._id === setorId) || setoresList[0]
  const setorNome = normalizarNome(setorSelecionado?.nome || '')
  const podeTrocarSetor = setoresList.length > 1

  const comStatus = demandas.map(d => ({ ...d, _status: statusDemanda(setorNome, d, competencia) }))
  const pendentes = comStatus.filter(d => d._status === 'pendente').length
  const concluidas = comStatus.filter(d => d._status === 'concluido').length
  const total = comStatus.length

  const filtrados = comStatus
    .filter(d => filtro === 'todas' || d._status === filtro)
    .sort((a, b) => (a.nome || '').toLowerCase().localeCompare((b.nome || '').toLowerCase(), 'pt-BR', { numeric: true }))

  // Sem trava — o padrão (mês defasado) continua sendo a competência de abertura,
  // mas dali a pessoa pode navegar livremente pra frente (ex: adiantar um lançamento fora da competência).
  const podeAvancar = true
  const podeVoltar = competencia > `${INICIO_DEMANDA_ANO}-01`

  const chipsFiltro = [
    { id: 'todas', label: 'Todas' },
    { id: 'pendente', label: 'Pendente' },
    { id: 'concluido', label: 'Concluído' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--texto)', margin: 0, letterSpacing: '-0.03em' }}>Demandas</h1>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Seletor de setor */}
        {podeTrocarSetor ? (
          <div ref={setorDropdownRef} style={{ position: 'relative' }}>
            <button onClick={() => setSetorDropdownAberto(v => !v)} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(0,177,65,0.3)', background: 'rgba(0,177,65,0.08)', color: 'var(--verde)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: setorSelecionado?.cor || 'var(--verde)' }} />
              {setorSelecionado?.nome}
              <Icone.ChevronDown size={14} />
            </button>
            {setorDropdownAberto && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '210px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 10, padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {setoresList.map(setor => (
                  <button key={setor._id} onClick={() => { setSetorId(setor._id); setSetorDropdownAberto(false) }} style={{ padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', textAlign: 'left', background: mesmoSetor(setor, setorSelecionado) ? 'rgba(0,177,65,0.08)' : 'none', color: mesmoSetor(setor, setorSelecionado) ? 'var(--verde)' : 'var(--texto)' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: setor.cor || 'var(--verde)' }} />
                    {setor.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--borda)', background: 'var(--input)', color: 'var(--texto-apagado)' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: setorSelecionado?.cor || 'var(--verde)' }} />
            {setorSelecionado?.nome}
          </div>
        )}

        {/* Navegador de mês */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Competência</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={() => podeVoltar && setCompetencia(c => mudarCompetencia(c, -1))} disabled={!podeVoltar} style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid var(--borda)', background: 'var(--input)', color: podeVoltar ? 'var(--texto)' : 'var(--texto-apagado)', cursor: podeVoltar ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: podeVoltar ? 1 : 0.4 }}>
              <Icone.ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter,sans-serif', minWidth: '130px', textAlign: 'center' }}>
              {nomeMes(competencia)} {competencia.slice(0, 4)}
            </span>
            <button onClick={() => podeAvancar && setCompetencia(c => mudarCompetencia(c, 1))} disabled={!podeAvancar} style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid var(--borda)', background: 'var(--input)', color: podeAvancar ? 'var(--texto)' : 'var(--texto-apagado)', cursor: podeAvancar ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: podeAvancar ? 1 : 0.4 }}>
              <Icone.ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Barra de resumo */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '120px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '14px 16px' }}>
          <p style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f59e0b', margin: 0, fontFamily: 'Inter,sans-serif' }}>{pendentes}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0' }}>Pendentes</p>
        </div>
        <div style={{ flex: '1', minWidth: '120px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '14px 16px' }}>
          <p style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--verde)', margin: 0, fontFamily: 'Inter,sans-serif' }}>{concluidas}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0' }}>Concluídas</p>
        </div>
        <div style={{ flex: '1', minWidth: '120px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '14px 16px' }}>
          <p style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'Inter,sans-serif' }}>{total}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0' }}>Clientes no setor</p>
        </div>
      </div>

      {/* Chips de filtro */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {chipsFiltro.map(c => (
          <button key={c.id} onClick={() => setFiltro(c.id)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif', border: `1px solid ${filtro === c.id ? 'rgba(0,177,65,0.3)' : 'var(--borda)'}`, background: filtro === c.id ? 'rgba(0,177,65,0.08)' : 'var(--input)', color: filtro === c.id ? 'var(--verde)' : 'var(--texto-apagado)' }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {carregando ? (
        <p style={{ color: 'var(--texto-apagado)' }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: 'var(--texto-apagado)', fontSize: '0.875rem', padding: '20px 0' }}>Nenhum cliente encontrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(d => (
            <div key={d.clienteId}
              onClick={() => setClienteAberto({ clienteId: d.clienteId, setorId, competencia })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,177,65,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--borda)'}>
              <span style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter,sans-serif' }}>{d.nome || '—'}</span>
              {d._status === 'concluido' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '700', color: 'var(--verde)', fontFamily: 'Inter,sans-serif' }}>
                  <Icone.Check size={12} /> Concluído
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '700', color: '#f59e0b', fontFamily: 'Inter,sans-serif' }}>
                  <Icone.Circle size={8} /> Pendente
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
