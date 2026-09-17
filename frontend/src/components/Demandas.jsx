import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import api from '../services/api'
import Icone from './Icones'
import { useAuth } from '../contexts/AuthContext'
import Clientes, { CONFIG_DEMANDA, statusDemanda, SUBFILTROS_POR_SETOR, normalizarNome, competenciaPadraoDoSetor, nomeMes, INICIO_DEMANDA_ANO } from './Clientes'

const mesmoSetor = (a, b) => (a?._id || a) === (b?._id || b)

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
  const [subFiltro, setSubFiltro] = useState(undefined) // undefined = "Todos", mesmo padrão do Clientes.jsx
  const [busca, setBusca] = useState('')
  const [setorDropdownAberto, setSetorDropdownAberto] = useState(false)
  const [subFiltroDropdownAberto, setSubFiltroDropdownAberto] = useState(false)
  const [clienteAberto, setClienteAberto] = useState(null) // { clienteId, setorId, competencia } | null
  const setorDropdownRef = useRef(null)
  const subFiltroDropdownRef = useRef(null)

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

  // Extraído do useEffect (Spec 21) pra poder ser chamado de novo ao fechar o detalhe do cliente
  // — sem isso, voltar de lá deixava a lista com os dados de antes de entrar (qualquer alteração
  // feita dentro, banco/campo/Sem Movimento, não refletia sem trocar de setor ou recarregar).
  const carregarDemandas = () => {
    if (!setorId || !competencia) return
    setCarregando(true)
    api.get(`/clientes/demandas/${setorId}/${competencia}`)
      .then(r => setDemandas(r.data))
      .catch(() => setDemandas([]))
      .finally(() => setCarregando(false))
  }

  useEffect(carregarDemandas, [setorId, competencia])

  useEffect(() => {
    if (!setorDropdownAberto && !subFiltroDropdownAberto) return
    const fecharFora = (e) => {
      if (setorDropdownAberto && !setorDropdownRef.current?.contains(e.target)) setSetorDropdownAberto(false)
      if (subFiltroDropdownAberto && !subFiltroDropdownRef.current?.contains(e.target)) setSubFiltroDropdownAberto(false)
    }
    const fecharEsc = (e) => { if (e.key === 'Escape') { setSetorDropdownAberto(false); setSubFiltroDropdownAberto(false) } }
    document.addEventListener('mousedown', fecharFora)
    document.addEventListener('keydown', fecharEsc)
    return () => { document.removeEventListener('mousedown', fecharFora); document.removeEventListener('keydown', fecharEsc) }
  }, [setorDropdownAberto, subFiltroDropdownAberto])

  if (clienteAberto) {
    return <Clientes
      detalheInicial={clienteAberto.clienteId}
      abaInicial="demanda"
      setorInicial={clienteAberto.setorId}
      competenciaInicial={clienteAberto.competencia}
      onDetalheAberto={() => { setClienteAberto(null); carregarDemandas() }}
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
  const incompletas = comStatus.filter(d => d._status === 'incompleto').length
  const concluidas = comStatus.filter(d => d._status === 'concluido').length
  const total = comStatus.length

  // Subfiltro por regime/situação/periodicidade — mesma config de Clientes.jsx (SUBFILTROS_POR_SETOR),
  // só que aqui os dados já vêm resolvidos e planos (regime/situacao direto no item, não em cliente.*).
  const subFiltroConfig = SUBFILTROS_POR_SETOR[setorNome]
  const valorSubFiltro = (d) => setorNome === 'fiscal' ? d.regime : d.situacao
  const valoresPresentes = new Set(comStatus.map(valorSubFiltro))
  const opcoesVisiveis = subFiltroConfig ? subFiltroConfig.opcoesFixas.filter(op => valoresPresentes.has(op.value)) : []

  const filtrados = comStatus
    .filter(d => filtro === 'todas' || d._status === filtro)
    .filter(d => subFiltro === undefined || valorSubFiltro(d) === subFiltro)
    .filter(d => (d.nome || '').toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (a.nome || '').toLowerCase().localeCompare((b.nome || '').toLowerCase(), 'pt-BR', { numeric: true }))

  // Sem trava — o padrão (mês defasado) continua sendo a competência de abertura,
  // mas dali a pessoa pode navegar livremente pra frente (ex: adiantar um lançamento fora da competência).
  const podeAvancar = true
  const podeVoltar = competencia > `${INICIO_DEMANDA_ANO}-01`

  const chipsFiltro = [
    { id: 'todas', label: 'Todas' },
    { id: 'pendente', label: 'Pendente' },
    { id: 'incompleto', label: 'Incompleto' },
    { id: 'concluido', label: 'Concluído' },
  ]

  const exportarExcel = () => {
    const cabecalho = ['CLIENTE', 'STATUS', 'COMPETÊNCIA']
    const linhas = filtrados.map(d => ({
      'CLIENTE': d.nome || '',
      'STATUS': d._status === 'concluido' ? 'Concluído' : d._status === 'incompleto' ? 'Incompleto' : 'Pendente',
      'COMPETÊNCIA': `${nomeMes(competencia)} ${competencia.slice(0,4)}`,
    }))
    const ws = XLSX.utils.json_to_sheet(linhas, { header: cabecalho })
    cabecalho.forEach((_, i) => {
      const endereco = XLSX.utils.encode_cell({ r: 0, c: i })
      if (ws[endereco]) ws[endereco].s = { font: { bold: true } }
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Demandas')
    XLSX.writeFile(wb, `demandas-${setorNome}-${competencia}.xlsx`)
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--texto)', margin: 0, letterSpacing: '-0.03em' }}>Demandas</h1>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Seletor de setor */}
        {podeTrocarSetor ? (
          <div ref={setorDropdownRef} style={{ position: 'relative' }}>
            <button onClick={() => setSetorDropdownAberto(v => !v)} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(0,177,65,0.3)', background: 'rgba(0,177,65,0.08)', color: 'var(--verde)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: setorSelecionado?.cor || 'var(--verde)' }} />
              {setorSelecionado?.nome}
              <Icone.ChevronDown size={14} />
            </button>
            {setorDropdownAberto && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '210px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 10, padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {setoresList.map(setor => (
                  <button key={setor._id} onClick={() => { setSetorId(setor._id); setSubFiltro(undefined); setSetorDropdownAberto(false) }} style={{ padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', textAlign: 'left', background: mesmoSetor(setor, setorSelecionado) ? 'rgba(0,177,65,0.08)' : 'none', color: mesmoSetor(setor, setorSelecionado) ? 'var(--verde)' : 'var(--texto)' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: setor.cor || 'var(--verde)' }} />
                    {setor.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', fontFamily: 'var(--fonte-corpo)', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--borda)', background: 'var(--input)', color: 'var(--texto-apagado)' }}>
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
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)', minWidth: '130px', textAlign: 'center' }}>
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
          <p style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f59e0b', margin: 0, fontFamily: 'var(--fonte-corpo)' }}>{pendentes}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0' }}>Pendentes</p>
        </div>
        <div style={{ flex: '1', minWidth: '120px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '14px 16px' }}>
          <p style={{ fontSize: '1.4rem', fontWeight: '700', color: '#3b82f6', margin: 0, fontFamily: 'var(--fonte-corpo)' }}>{incompletas}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0' }}>Incompletas</p>
        </div>
        <div style={{ flex: '1', minWidth: '120px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '14px 16px' }}>
          <p style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--verde)', margin: 0, fontFamily: 'var(--fonte-corpo)' }}>{concluidas}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0' }}>Concluídas</p>
        </div>
        <div style={{ flex: '1', minWidth: '120px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '14px 16px' }}>
          <p style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'var(--fonte-corpo)' }}>{total}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0' }}>Clientes no setor</p>
        </div>
      </div>

      {/* Chips de filtro + busca por cliente */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {chipsFiltro.map(c => (
            <button key={c.id} onClick={() => setFiltro(c.id)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', border: `1px solid ${filtro === c.id ? 'rgba(0,177,65,0.3)' : 'var(--borda)'}`, background: filtro === c.id ? 'rgba(0,177,65,0.08)' : 'var(--input)', color: filtro === c.id ? 'var(--verde)' : 'var(--texto-apagado)' }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Subfiltro (ex: Regime tributário quando o setor é Fiscal) — só as opções que realmente aparecem entre os clientes desse setor/competência */}
        {opcoesVisiveis.length > 0 && (
          <div ref={subFiltroDropdownRef} style={{ position: 'relative' }}>
            <button onClick={() => setSubFiltroDropdownAberto(v => !v)} style={{ padding: '5px 12px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--borda)', background: 'transparent', color: 'var(--texto-apagado)' }}>
              {subFiltro === undefined
                ? `Todos · ${subFiltroConfig.nome}`
                : `${opcoesVisiveis.find(op => op.value === subFiltro)?.label} · ${subFiltroConfig.nome}`}
              <Icone.ChevronDown size={12}/>
            </button>
            {subFiltroDropdownAberto && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '190px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 10, padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button onClick={() => { setSubFiltro(undefined); setSubFiltroDropdownAberto(false) }} style={{ padding: '7px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', border: 'none', textAlign: 'left', background: subFiltro === undefined ? 'rgba(0,177,65,0.08)' : 'none', color: subFiltro === undefined ? 'var(--verde)' : 'var(--texto)' }}>
                  Todos
                </button>
                {opcoesVisiveis.map(op => (
                  <button key={String(op.value)} onClick={() => { setSubFiltro(op.value); setSubFiltroDropdownAberto(false) }} style={{ padding: '7px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', border: 'none', textAlign: 'left', background: subFiltro === op.value ? 'rgba(0,177,65,0.08)' : 'none', color: subFiltro === op.value ? 'var(--verde)' : 'var(--texto)' }}>
                    {op.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '420px' }}>
          <Icone.Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-apagado)' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 12px 7px 32px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--input)', color: 'var(--texto)', fontSize: '0.8rem', fontFamily: 'var(--fonte-corpo)' }}
          />
        </div>
        <button onClick={exportarExcel} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', border: '1px solid var(--borda)', background: 'none', color: 'var(--texto)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icone.Download size={14}/> Exportar
        </button>
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
              <span style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)' }}>{d.nome || '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {d.temAnexo && <Icone.Paperclip size={13} style={{ color: 'var(--texto-apagado)' }} title="Tem anexo" />}
                {d._status === 'concluido' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '700', color: 'var(--verde)', fontFamily: 'var(--fonte-corpo)' }}>
                    <Icone.Check size={12} /> Concluído
                  </span>
                ) : d._status === 'incompleto' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '700', color: '#3b82f6', fontFamily: 'var(--fonte-corpo)' }}>
                    <Icone.Circle size={8} /> Incompleto
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '700', color: '#f59e0b', fontFamily: 'var(--fonte-corpo)' }}>
                    <Icone.Circle size={8} /> Pendente
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
