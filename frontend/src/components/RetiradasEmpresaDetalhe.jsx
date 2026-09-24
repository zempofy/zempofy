import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import Icone from './Icones'
import { useToast } from './Toast'
import { useAuth } from '../contexts/AuthContext'
import ModalConfirmacao from './ModalConfirmacao'
import ModalSociosControle from './ModalSociosControle'
import { Badge, SeletorCompetencia } from './RetiradasComum'
import { formatMoeda, mascaraCPF, moedaParaInput, inputParaMoeda } from '../utils/mascaras'

// Contábil › Retiradas › detalhe de uma empresa numa competência: resumo do mês, sócios (com
// lançamento inline) e painel do trimestre. Todo imposto vem calculado do backend; aqui só há
// prévia ao vivo do que está sendo digitado, com os parâmetros de /parametros.

const TRATAMENTOS = [
  { value: '', label: 'Não classificado' },
  { value: 'adiantamento', label: 'Adiantamento a compensar com lucros futuros' },
  { value: 'a_regularizar', label: 'A regularizar (pendente)' },
  { value: 'rendimento_tributavel', label: 'Tratar como rendimento tributável do sócio' },
  { value: 'outro', label: 'Outro (ver observação)' },
]
const MESES_TRIMESTRE = ['jan–mar', 'abr–jun', 'jul–set', 'out–dez']

const round2 = (n) => Math.round((Number(n) || 0) * 100 + (n < 0 ? -1e-9 : 1e-9)) / 100
const percentualTexto = (aliquota) => aliquota == null ? '' : `${(aliquota * 100).toLocaleString('pt-BR')}%`
const ultimoDiaDoMes = (competencia) => {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${competencia}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`
}

const SITUACAO = {
  sem_retirada: { label: 'Sem retirada', cor: 'cinza' },
  isento: { label: 'Isento', cor: 'verde' },
  tributavel: { label: 'Tributável', cor: 'ambar' },
}

export default function RetiradasEmpresaDetalhe({ clienteId, competenciaInicial, parametros, onVoltar }) {
  const { mostrar } = useToast()
  const { usuario } = useAuth()
  const isTitular = usuario?.cargo === 'admin'

  const [competencia, setCompetencia] = useState(competenciaInicial)
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [lancandoId, setLancandoId] = useState(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [modalSocios, setModalSocios] = useState(false)
  const [confirmacao, setConfirmacao] = useState(null) // 'inativar' | 'excluir'
  const menuRef = useRef(null)
  // Largura visível da tabela de sócios: no celular a tabela rola na horizontal, e o editor de
  // lançamento fica preso (sticky) nessa largura pra não esconder o botão Salvar fora da tela
  const tabelaRef = useRef(null)
  const [larguraTabela, setLarguraTabela] = useState(null)

  // Só a primeira carga mostra "Carregando..."; nas seguintes (trocar mês, salvar) a tela fica
  // como está até os dados novos chegarem, sem piscar
  const carregar = () => {
    return api.get(`/contabil/retiradas/${clienteId}/mes/${competencia}`)
      .then(r => setDados(r.data))
      .catch(err => {
        mostrar(err.response?.data?.erro || 'Erro ao carregar a empresa.', 'erro')
        if (err.response?.status === 404) onVoltar(competencia)
      })
      .finally(() => setCarregando(false))
  }

  useEffect(() => { setLancandoId(null); carregar() }, [competencia])

  useEffect(() => {
    const el = tabelaRef.current
    if (!el) return
    const medir = () => setLarguraTabela(el.clientWidth)
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [!!dados])

  useEffect(() => {
    if (!menuAberto) return
    const fecharFora = (e) => { if (!menuRef.current?.contains(e.target)) setMenuAberto(false) }
    const fecharEsc = (e) => { if (e.key === 'Escape') setMenuAberto(false) }
    document.addEventListener('mousedown', fecharFora)
    document.addEventListener('keydown', fecharEsc)
    return () => { document.removeEventListener('mousedown', fecharFora); document.removeEventListener('keydown', fecharEsc) }
  }, [menuAberto])

  if (carregando || !dados) return <p style={{ color: 'var(--texto-apagado)' }}>Carregando...</p>

  const { empresa, socios, resumoMes, trimestre } = dados
  const somenteLeitura = !empresa.ativo || !empresa.clienteAtivo
  const limite = parametros?.limiteMensal
  // Ativos na ordem do cadastro, inativos esmaecidos no fim
  const sociosOrdenados = [...socios.filter(s => s.ativo), ...socios.filter(s => !s.ativo)]

  // Executa uma ação do menu; mensagemSucesso recebe a resposta e devolve [texto, tipo do toast]
  const acao = async (fn, mensagemSucesso) => {
    setMenuAberto(false)
    try {
      const r = await fn()
      mostrar(...mensagemSucesso(r))
      await carregar()
    } catch (err) {
      mostrar(err.response?.data?.erro || 'Não foi possível concluir a ação.', 'erro')
    }
  }

  const marcarSemRetiradas = () => acao(
    () => api.post(`/contabil/retiradas/${clienteId}/mes/${competencia}/sem-retiradas`),
    (r) => r.data.criados
      ? [`${r.data.criados} ${r.data.criados === 1 ? 'sócio marcado' : 'sócios marcados'} sem retirada no mês.`, 'sucesso']
      : ['Todos os sócios já tinham lançamento neste mês.', 'aviso']
  )
  const inativar = () => { setConfirmacao(null); acao(() => api.patch(`/contabil/retiradas/${clienteId}/inativar`), () => ['Empresa inativada no controle.', 'sucesso']) }
  const reativar = () => acao(() => api.patch(`/contabil/retiradas/${clienteId}/reativar`), () => ['Empresa reativada.', 'sucesso'])
  const excluir = async () => {
    setConfirmacao(null)
    try {
      await api.delete(`/contabil/retiradas/${clienteId}`)
      mostrar('Empresa excluída do controle de retiradas.')
      onVoltar(competencia)
    } catch (err) {
      mostrar(err.response?.data?.erro || 'Erro ao excluir.', 'erro')
    }
  }

  return (
    <div>
      {/* Topo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => onVoltar(competencia)} style={s.btnVoltar} aria-label="Voltar"><Icone.ChevronLeft size={16} /></button>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--texto)', margin: 0, letterSpacing: '-0.02em' }}>{empresa.nome}</h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', marginTop: '4px' }}>
            Retiradas de sócios{empresa.cnpj ? ` · ${empresa.cnpj}` : ''}
          </p>
        </div>
        <SeletorCompetencia competencia={competencia} onChange={setCompetencia} />
        {empresa.clienteAtivo && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setMenuAberto(v => !v)} style={s.btnMenu} aria-label="Mais ações">···</button>
            {menuAberto && (
              <div style={s.dropdown}>
                {empresa.ativo ? (
                  <>
                    <button style={s.dropdownItem} onClick={() => { setMenuAberto(false); setModalSocios(true) }}>Editar sócios</button>
                    <button style={s.dropdownItem} onClick={marcarSemRetiradas}>Marcar mês sem retiradas</button>
                    <button style={{ ...s.dropdownItem, color: 'var(--erro)' }} onClick={() => { setMenuAberto(false); setConfirmacao('inativar') }}>Inativar empresa</button>
                  </>
                ) : (
                  <>
                    <button style={s.dropdownItem} onClick={reativar}>Reativar empresa</button>
                    {isTitular && (
                      <button style={{ ...s.dropdownItem, color: 'var(--erro)' }} onClick={() => { setMenuAberto(false); setConfirmacao('excluir') }}>Excluir permanentemente</button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {somenteLeitura && (
        <div style={{ ...s.aviso, marginBottom: '16px' }}>
          <Icone.Lock size={14} />
          {!empresa.clienteAtivo
            ? 'Cliente inativo no cadastro — o controle fica só para consulta.'
            : 'Empresa inativa no controle — só para consulta. Reative pelo menu ··· para voltar a lançar.'}
        </div>
      )}

      {/* Cards do mês */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <CardResumo valor={formatMoeda(resumoMes.distribuido)} label="Distribuído no mês" />
        <CardResumo valor={formatMoeda(resumoMes.tributavel)} label="Tributável" cor={resumoMes.tributavel > 0 ? 'var(--alerta)' : undefined} />
        <CardResumo valor={formatMoeda(resumoMes.irrf)} label={`IRRF estimado${parametros ? ` (${percentualTexto(parametros.aliquota)})` : ''}`} cor={resumoMes.irrf > 0 ? 'var(--alerta)' : undefined} />
      </div>

      {/* Sócios */}
      <div style={{ ...s.card, padding: 0, marginBottom: '20px' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--borda)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <p style={s.secTit}>Sócios</p>
          {limite != null && <span style={{ fontSize: '0.7rem', color: 'var(--texto-apagado)' }}>Limite mensal isento: {formatMoeda(limite)} por sócio</span>}
        </div>
        <div ref={tabelaRef} style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '680px' }}>
            <div style={{ ...s.gradeSocio, padding: '10px 18px', borderBottom: '1px solid var(--borda)' }}>
              <span style={s.cabecalho}>Sócio</span>
              <span style={s.cabecalho}>%</span>
              <span style={s.cabecalho}>Retirado</span>
              <span style={s.cabecalho}>Situação</span>
              <span />
            </div>
            {sociosOrdenados.length === 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--texto-apagado)', padding: '16px 18px' }}>Nenhum sócio cadastrado. Use "Editar sócios" no menu ···.</p>
            )}
            {sociosOrdenados.map(sc => {
              const aberto = lancandoId === sc.socioId
              const situacao = SITUACAO[sc.situacao]
              const proporcao = limite ? Math.min(1, sc.total / limite) : 0
              return (
                <div key={sc.socioId} style={{ borderBottom: '1px solid var(--borda-sutil)' }}>
                  <div style={{ ...s.gradeSocio, padding: '12px 18px', opacity: sc.ativo ? 1 : 0.5 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--texto)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.nome}</p>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px', flexWrap: 'wrap' }}>
                        {sc.cpf
                          ? <span style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)' }}>{mascaraCPF(sc.cpf)}</span>
                          : <Badge cor="ambar">CPF pendente</Badge>}
                        {!sc.ativo && <Badge>Inativo</Badge>}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: 'var(--texto)' }}>{sc.percentual != null ? `${sc.percentual.toLocaleString('pt-BR')}%` : '—'}</span>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--texto)' }}>{sc.lancado ? formatMoeda(sc.total) : '—'}</p>
                      <div style={{ height: '4px', borderRadius: '99px', background: 'var(--input)', marginTop: '6px', overflow: 'hidden', maxWidth: '140px' }}>
                        <div style={{ width: `${proporcao * 100}%`, height: '100%', background: sc.situacao === 'tributavel' ? 'var(--alerta)' : 'var(--verde)' }} />
                      </div>
                    </div>
                    <div>
                      {sc.lancado ? <Badge cor={situacao.cor}>{situacao.label}</Badge> : <Badge>Sem lançamento</Badge>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {sc.ativo && !somenteLeitura && (
                        <button onClick={() => setLancandoId(aberto ? null : sc.socioId)} style={aberto ? s.btnAcaoAtivo : s.btnSecundario}>
                          {aberto ? 'Fechar' : 'Lançar'}
                        </button>
                      )}
                    </div>
                  </div>
                  {aberto && (
                    <EditorRetirada
                      largura={larguraTabela}
                      key={`${sc.socioId}-${competencia}`}
                      socio={sc}
                      clienteId={clienteId}
                      competencia={competencia}
                      parametros={parametros}
                      onCancelar={() => setLancandoId(null)}
                      onSalvo={() => { setLancandoId(null); carregar() }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <PainelTrimestre
        key={`${trimestre.ano}-${trimestre.trimestre}-${trimestre.lucroApurado}-${trimestre.saldoAnterior}-${trimestre.tratamentoExcedente}-${trimestre.obsExcedente}`}
        trimestre={trimestre}
        clienteId={clienteId}
        somenteLeitura={somenteLeitura}
        onSalvo={carregar}
      />

      {modalSocios && (
        <ModalSociosControle
          modo="editar"
          clienteId={clienteId}
          onFechar={() => setModalSocios(false)}
          onSalvo={() => { setModalSocios(false); carregar() }}
        />
      )}

      {confirmacao === 'inativar' && (
        <ModalConfirmacao
          titulo="Inativar empresa?"
          mensagem={`${empresa.nome} vai para o fim da lista e fica só para consulta. Nada é apagado — dá pra reativar depois.`}
          textoBotao="Inativar"
          onConfirmar={inativar}
          onCancelar={() => setConfirmacao(null)}
        />
      )}
      {confirmacao === 'excluir' && (
        <ModalConfirmacao
          titulo="Excluir permanentemente?"
          mensagem={`Isso apaga o controle de ${empresa.nome} com TODAS as retiradas e apurações de trimestre lançadas. O cadastro do cliente não é afetado. Não dá pra desfazer.`}
          textoBotao="Excluir"
          perigo
          onConfirmar={excluir}
          onCancelar={() => setConfirmacao(null)}
        />
      )}
    </div>
  )
}

function CardResumo({ valor, label, cor }) {
  return (
    <div style={{ flex: '1', minWidth: '160px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '14px 16px' }}>
      <p style={{ fontSize: '1.25rem', fontWeight: '700', color: cor || 'var(--texto)', margin: 0, fontFamily: 'var(--fonte-corpo)' }}>{valor}</p>
      <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0' }}>{label}</p>
    </div>
  )
}

// Lançamento de um sócio no mês: "Total do mês" (padrão) ou "Detalhar retiradas"
function EditorRetirada({ largura, socio, clienteId, competencia, parametros, onCancelar, onSalvo }) {
  const { mostrar } = useToast()
  const [modo, setModo] = useState(socio.lancado ? socio.modo : 'total')
  const [valorTotal, setValorTotal] = useState(socio.lancado && socio.modo === 'total' ? socio.valorTotal : '')
  const [linhas, setLinhas] = useState(() => socio.modo === 'detalhado' && socio.lancamentos?.length
    ? socio.lancamentos.map(l => ({ data: l.data, valor: l.valor, obs: l.obs || '' }))
    : [{ data: '', valor: '', obs: '' }])
  const [trocaPendente, setTrocaPendente] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const limite = parametros?.limiteMensal
  const aliquota = parametros?.aliquota
  const minData = `${competencia}-01`
  const maxData = ultimoDiaDoMes(competencia)

  const totalDetalhado = round2(linhas.reduce((s, l) => round2(s + (Number(l.valor) || 0)), 0))
  const totalAtual = modo === 'total' ? round2(valorTotal || 0) : totalDetalhado
  const passou = limite != null && totalAtual > limite
  // Estava dentro do limite (ou sem lançamento) e passou agora: o total inteiro vira tributável
  const cruzouAgora = passou && socio.total <= limite

  const temDadoNoModo = (m) => m === 'total'
    ? Number(valorTotal) > 0
    : linhas.some(l => l.data || Number(l.valor) > 0 || l.obs.trim())

  const trocarModo = (novo) => {
    if (novo === modo) return
    if (temDadoNoModo(modo)) setTrocaPendente(novo)
    else setModo(novo)
  }
  const confirmarTroca = () => {
    if (modo === 'total') setValorTotal('')
    else setLinhas([{ data: '', valor: '', obs: '' }])
    setModo(trocaPendente)
    setTrocaPendente(null)
  }

  const setLinha = (i, campo, v) => setLinhas(ls => ls.map((l, j) => j === i ? { ...l, [campo]: v } : l))

  const salvar = async () => {
    let payload
    if (modo === 'total') {
      payload = { modo, valorTotal: round2(valorTotal || 0) }
    } else {
      const preenchidas = linhas.filter(l => l.data || l.valor !== '' || l.obs.trim())
      const incompleta = preenchidas.find(l => !l.data || l.valor === '')
      if (incompleta) return mostrar('Cada lançamento precisa de data e valor.', 'aviso')
      const foraDoMes = preenchidas.find(l => l.data < minData || l.data > maxData)
      if (foraDoMes) return mostrar(`A data ${foraDoMes.data.split('-').reverse().join('/')} não é deste mês.`, 'aviso')
      payload = { modo, lancamentos: preenchidas.map(l => ({ data: l.data, valor: round2(l.valor), obs: l.obs.trim() })) }
    }
    setSalvando(true)
    try {
      await api.put(`/contabil/retiradas/${clienteId}/mes/${competencia}/socios/${socio.socioId}`, payload)
      mostrar(`Retirada de ${socio.nome} salva.`)
      onSalvo()
    } catch (err) {
      mostrar(err.response?.data?.erro || 'Erro ao salvar a retirada.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={{ padding: '4px 18px 18px', position: 'sticky', left: 0, width: largura || '100%', boxSizing: 'border-box' }}>
      <div style={{ background: 'var(--input-2)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'inline-flex', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '3px', gap: '3px', marginBottom: '14px' }}>
          {[{ id: 'total', label: 'Total do mês' }, { id: 'detalhado', label: 'Detalhar retiradas' }].map(op => (
            <button key={op.id} onClick={() => trocarModo(op.id)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', fontSize: '0.76rem', fontWeight: '600', background: modo === op.id ? 'var(--verde-glow-forte)' : 'transparent', color: modo === op.id ? 'var(--verde)' : 'var(--texto-apagado)' }}>
              {op.label}
            </button>
          ))}
        </div>

        {modo === 'total' ? (
          <div style={{ maxWidth: '260px' }}>
            <label style={s.label}>Valor retirado no mês (R$)</label>
            <input autoFocus style={s.inp} value={moedaParaInput(valorTotal)} placeholder="0,00" inputMode="numeric"
              onChange={e => setValorTotal(inputParaMoeda(e.target.value))}
              onKeyDown={e => e.key === 'Enter' && salvar()} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={s.gradeLanc}>
              <span style={s.cabecalho}>Data</span>
              <span style={s.cabecalho}>Valor (R$)</span>
              <span style={s.cabecalho}>Observação</span>
              <span />
            </div>
            {linhas.map((l, i) => (
              <div key={i} style={s.gradeLanc}>
                <input type="date" min={minData} max={maxData} value={l.data} onChange={e => setLinha(i, 'data', e.target.value)} style={s.inp} />
                <input value={moedaParaInput(l.valor)} placeholder="0,00" inputMode="numeric" onChange={e => setLinha(i, 'valor', inputParaMoeda(e.target.value))} style={s.inp} />
                <input value={l.obs} maxLength={300} placeholder="Opcional" onChange={e => setLinha(i, 'obs', e.target.value)} style={s.inp} />
                <button onClick={() => setLinhas(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : [{ data: '', valor: '', obs: '' }])} style={s.btnX} aria-label="Remover linha"><Icone.X size={12} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setLinhas(ls => [...ls, { data: '', valor: '', obs: '' }])} disabled={linhas.length >= 200} style={{ ...s.btnSecundario, opacity: linhas.length >= 200 ? 0.5 : 1 }}>+ linha</button>
              <span style={{ fontSize: '0.82rem', color: 'var(--texto)' }}>Soma: <strong>{formatMoeda(totalDetalhado)}</strong></span>
            </div>
          </div>
        )}

        {passou && (
          <div style={{ ...s.alertaAmbar, marginTop: '14px' }}>
            <Icone.AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              Com este valor, o total do mês vira tributável: IRRF de <strong>{formatMoeda(round2(totalAtual * (aliquota || 0)))}</strong>.
              {cruzouAgora && <> <strong>Todo o valor ({formatMoeda(totalAtual)}) é tributado</strong>, não só o que passa de {formatMoeda(limite)}.</>}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
          <button onClick={onCancelar} style={s.btnCanc}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...s.btnSalv, opacity: salvando ? 0.6 : 1 }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>

      {trocaPendente && (
        <ModalConfirmacao
          titulo="Trocar o modo de lançamento?"
          mensagem={`Os valores de "${modo === 'total' ? 'Total do mês' : 'Detalhar retiradas'}" serão descartados ao salvar.`}
          textoBotao="Trocar"
          onConfirmar={confirmarTroca}
          onCancelar={() => setTrocaPendente(null)}
        />
      )}
    </div>
  )
}

// Painel do trimestre: lucro apurado e lucros acumulados digitados à mão; saldo e excedente
// aparecem ao vivo enquanto digita (o backend recalcula tudo na leitura)
function PainelTrimestre({ trimestre, clienteId, somenteLeitura, onSalvo }) {
  const { mostrar } = useToast()
  const [lucro, setLucro] = useState(trimestre.lucroApurado ?? '')
  const [saldoAnterior, setSaldoAnterior] = useState(trimestre.saldoAnterior || '')
  const [tratamento, setTratamento] = useState(trimestre.tratamentoExcedente || '')
  const [obs, setObs] = useState(trimestre.obsExcedente || '')
  const [salvando, setSalvando] = useState(false)

  const distribuido = trimestre.distribuido
  const lucroInformado = lucro !== '' && lucro !== null
  const disponivel = lucroInformado ? round2(Number(lucro) + Number(saldoAnterior || 0)) : null
  const saldo = lucroInformado ? round2(disponivel - distribuido) : null
  const excedente = saldo != null && saldo < 0 ? round2(-saldo) : 0
  const proporcao = disponivel > 0 ? Math.min(1, distribuido / disponivel) : (lucroInformado && distribuido > 0 ? 1 : 0)

  const mudou = (lucroInformado ? Number(lucro) : null) !== (trimestre.lucroApurado ?? null)
    || Number(saldoAnterior || 0) !== Number(trimestre.saldoAnterior || 0)
    || tratamento !== (trimestre.tratamentoExcedente || '')
    || obs.trim() !== (trimestre.obsExcedente || '')

  const salvar = async () => {
    setSalvando(true)
    try {
      await api.put(`/contabil/retiradas/${clienteId}/trimestre/${trimestre.ano}/${trimestre.trimestre}`, {
        lucroApurado: lucroInformado ? round2(lucro) : null,
        saldoAnterior: round2(saldoAnterior || 0),
        tratamentoExcedente: tratamento,
        obsExcedente: obs.trim(),
      })
      mostrar('Trimestre atualizado.')
      onSalvo()
    } catch (err) {
      mostrar(err.response?.data?.erro || 'Erro ao salvar o trimestre.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={s.card}>
      <p style={{ ...s.secTit, marginBottom: '14px' }}>
        {trimestre.trimestre}º trimestre de {trimestre.ano} ({MESES_TRIMESTRE[trimestre.trimestre - 1]})
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: '1 1 200px', maxWidth: '280px' }}>
          <label style={s.label}>Lucro apurado (R$)</label>
          <input style={s.inp} value={moedaParaInput(lucro)} placeholder="Não informado" inputMode="numeric" disabled={somenteLeitura}
            onChange={e => setLucro(inputParaMoeda(e.target.value))} />
        </div>
        <div style={{ flex: '1 1 200px', maxWidth: '280px' }}>
          <label style={s.label}>Lucros acumulados anteriores (R$)</label>
          <input style={s.inp} value={moedaParaInput(saldoAnterior)} placeholder="0,00" inputMode="numeric" disabled={somenteLeitura}
            onChange={e => setSaldoAnterior(inputParaMoeda(e.target.value))} />
        </div>
      </div>

      {!lucroInformado ? (
        <div style={s.neutro}>
          <p style={{ fontSize: '0.82rem', color: 'var(--texto)' }}>Distribuído no trimestre até agora: <strong>{formatMoeda(distribuido)}</strong></p>
          <p style={{ fontSize: '0.76rem', color: 'var(--texto-apagado)', marginTop: '4px' }}>Informe o lucro apurado pra ver o saldo.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <Numero label="Disponível" valor={formatMoeda(disponivel)} />
            <Numero label="Distribuído no trimestre" valor={formatMoeda(distribuido)} />
            <Numero label="Saldo" valor={formatMoeda(saldo)} cor={saldo < 0 ? 'var(--erro)' : 'var(--verde)'} />
          </div>
          <div style={{ height: '6px', borderRadius: '99px', background: 'var(--input)', overflow: 'hidden', maxWidth: '520px' }}>
            <div style={{ width: `${proporcao * 100}%`, height: '100%', background: excedente > 0 ? 'var(--erro)' : 'var(--verde)', transition: 'width 0.2s' }} />
          </div>
        </>
      )}

      {excedente > 0 && (
        <div style={{ ...s.alertaVermelho, marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Icone.AlertTriangle size={15} />
            <strong style={{ fontSize: '0.85rem' }}>Retirado {formatMoeda(excedente)} acima do lucro disponível</strong>
            {!tratamento && <Badge cor="vermelho">Não classificado</Badge>}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
            <div style={{ flex: '1 1 260px' }}>
              <label style={s.label}>Tratamento do excedente</label>
              <select value={tratamento} onChange={e => setTratamento(e.target.value)} disabled={somenteLeitura} style={s.inp}>
                {TRATAMENTOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <label style={s.label}>Observação</label>
              <input value={obs} onChange={e => setObs(e.target.value)} maxLength={1000} disabled={somenteLeitura} placeholder="Opcional" style={s.inp} />
            </div>
          </div>
        </div>
      )}

      {!somenteLeitura && mudou && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button onClick={() => { setLucro(trimestre.lucroApurado ?? ''); setSaldoAnterior(trimestre.saldoAnterior || ''); setTratamento(trimestre.tratamentoExcedente || ''); setObs(trimestre.obsExcedente || '') }} style={s.btnCanc}>Descartar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...s.btnSalv, opacity: salvando ? 0.6 : 1 }}>{salvando ? 'Salvando...' : 'Salvar trimestre'}</button>
        </div>
      )}
    </div>
  )
}

function Numero({ label, valor, cor }) {
  return (
    <div>
      <p style={{ fontSize: '0.7rem', color: 'var(--texto-apagado)' }}>{label}</p>
      <p style={{ fontSize: '1rem', fontWeight: '700', color: cor || 'var(--texto)', marginTop: '2px' }}>{valor}</p>
    </div>
  )
}

const s = {
  card: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '18px 20px' },
  secTit: { fontSize: '0.75rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, fontFamily: 'var(--fonte-corpo)' },
  cabecalho: { fontSize: '0.66rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  gradeSocio: { display: 'grid', gridTemplateColumns: 'minmax(200px, 1.6fr) 60px minmax(150px, 1fr) 120px 90px', gap: '12px', alignItems: 'center' },
  gradeLanc: { display: 'grid', gridTemplateColumns: '150px 140px minmax(160px, 1fr) 28px', gap: '8px', alignItems: 'center' },
  label: { display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--texto-apagado)', marginBottom: '6px', fontFamily: 'var(--fonte-corpo)' },
  inp: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '8px 12px', color: 'var(--texto)', fontSize: '0.85rem', fontFamily: 'var(--fonte-corpo)', width: '100%', boxSizing: 'border-box', colorScheme: 'dark' },
  btnVoltar: { width: '34px', height: '34px', borderRadius: '9px', border: '1px solid var(--borda)', background: 'var(--input)', color: 'var(--texto)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btnMenu: { width: '34px', height: '34px', borderRadius: '9px', border: '1px solid var(--borda)', background: 'var(--input)', color: 'var(--texto)', cursor: 'pointer', fontSize: '1rem', fontWeight: '700', lineHeight: 1 },
  dropdown: { position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: '210px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '9px', boxShadow: 'var(--sombra-elevada)', zIndex: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  dropdownItem: { background: 'none', border: 'none', textAlign: 'left', padding: '10px 14px', fontSize: '0.8rem', fontFamily: 'var(--fonte-corpo)', color: 'var(--texto)', cursor: 'pointer' },
  btnSecundario: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--verde)', padding: '6px 14px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnAcaoAtivo: { background: 'var(--verde-glow)', border: '1px solid rgba(0,177,65,0.3)', borderRadius: '8px', color: 'var(--verde)', padding: '6px 14px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnCanc: { background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '9px 18px', fontFamily: 'var(--fonte-corpo)', fontWeight: '500', fontSize: '0.84rem', cursor: 'pointer' },
  btnSalv: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 18px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.84rem', cursor: 'pointer' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  aviso: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--texto-apagado)', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px' },
  neutro: { background: 'var(--input)', border: '1px dashed var(--borda)', borderRadius: '10px', padding: '12px 14px' },
  alertaAmbar: { display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--alerta)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '10px', padding: '10px 12px' },
  alertaVermelho: { color: 'var(--erro)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '14px' },
}
