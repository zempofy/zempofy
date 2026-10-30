// Diálogos do ciclo de vida da demanda (Spec B — REGRAS_DEMANDA.md): inativar, reativar, remover setor,
// excluir cliente e ajuste manual da vigência. Toda frase de efeito usa o mesmo mês que vai pro backend.
import { useEffect, useState } from 'react'
import Modal from './Modal'
import Icone from './Icones'
import api from '../services/api'
import { rotuloMes, mesAnterior, periodosDoSetor, descreverPeriodos } from '../utils/vigenciaDemanda'

// Mês atual no fuso de Brasília (UTC−3 fixo, igual ao backend)
const mesAtual = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 7)
const somarMeses = (c, n) => {
  const [a, m] = c.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const st = {
  corpo: { padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'var(--fonte-corpo)' },
  titulo: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--texto)', margin: 0 },
  texto: { fontSize: '0.86rem', color: 'var(--texto)', margin: 0, lineHeight: 1.5 },
  apagado: { fontSize: '0.8rem', color: 'var(--texto-apagado)', margin: 0, lineHeight: 1.5 },
  efeito: { fontSize: '0.82rem', color: 'var(--texto)', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 12px', margin: 0, lineHeight: 1.5 },
  perigo: { fontSize: '0.82rem', color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '10px', padding: '10px 12px', margin: 0, lineHeight: 1.5 },
  select: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto)', padding: '8px 10px', fontSize: '0.86rem', fontFamily: 'var(--fonte-corpo)', colorScheme: 'dark', minWidth: '170px' },
  // Texto na cor normal do tema (o amarelo puro some no tema claro); só a moldura e o "Atenção" ficam em âmbar
  atencao: { fontSize: '0.82rem', color: 'var(--texto)', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.45)', borderRadius: '10px', padding: '10px 12px', margin: 0, lineHeight: 1.5 },
  atencaoTitulo: { color: '#d97706' },
  rodape: { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap', padding: '0 24px 22px' },
  btnCanc: { padding: '9px 16px', borderRadius: '9px', border: '1px solid var(--borda)', background: 'var(--input)', color: 'var(--texto)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'var(--fonte-corpo)' },
  btnVerde: { padding: '9px 16px', borderRadius: '9px', border: 'none', background: 'var(--gradiente-verde)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--fonte-corpo)' },
  btnPerigo: { padding: '9px 16px', borderRadius: '9px', border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.15)', color: '#f87171', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--fonte-corpo)' },
  opcao: (ativa, perigo) => ({ border: `1px solid ${ativa ? (perigo ? 'rgba(248,113,113,0.5)' : 'rgba(0,177,65,0.45)') : 'var(--borda)'}`, background: ativa ? (perigo ? 'rgba(248,113,113,0.06)' : 'rgba(0,177,65,0.06)') : 'transparent', borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }),
}

// Mês da ação: de 12 meses atrás a 12 meses à frente (mesma janela que o backend aceita)
export function SeletorMes({ valor, onChange }) {
  const atual = mesAtual()
  const opcoes = []
  for (let n = -12; n <= 12; n++) opcoes.push(somarMeses(atual, n))
  return (
    <select style={st.select} value={valor} onChange={e => onChange(e.target.value)}>
      {opcoes.map(c => <option key={c} value={c}>{rotuloMes(c)}{c === atual ? ' (mês atual)' : ''}</option>)}
    </select>
  )
}

const LinhaMes = ({ rotulo, valor, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.86rem', color: 'var(--texto)' }}>
    {rotulo}
    <SeletorMes valor={valor} onChange={onChange} />
  </label>
)

// Spec D, seção 3: meses que já têm lançamento ou documento e vão sair da vigência com a ação escolhida.
// Pergunta ao servidor (POST /clientes/:id/vigencia/simular), que usa as mesmas funções da ação de verdade.
function useMesesAfetados(clienteId, corpo) {
  const [meses, setMeses] = useState([])
  const chave = corpo ? JSON.stringify(corpo) : ''
  useEffect(() => {
    if (!clienteId || !corpo) { setMeses([]); return }
    let vale = true
    const t = setTimeout(() => {
      api.post(`/clientes/${clienteId}/vigencia/simular`, corpo)
        .then(r => { if (vale) setMeses(r.data.meses || []) })
        .catch(() => { if (vale) setMeses([]) })
    }, 250)
    return () => { vale = false; clearTimeout(t) }
  }, [clienteId, chave])
  return meses
}

const MAX_MESES_AVISO = 6
function AvisoMesesAfetados({ meses, dica = 'Se quiser que algum deles continue, escolha um mês depois deles.' }) {
  if (!meses.length) return null
  const mostrados = meses.slice(0, MAX_MESES_AVISO).map(rotuloMes).join(', ')
  const resto = meses.length - MAX_MESES_AVISO
  return (
    <p style={st.atencao}>
      <strong style={st.atencaoTitulo}>Atenção:</strong> estes meses já têm dados salvos e vão ficar <strong>fora da vigência</strong> (os dados continuam guardados, só para consulta): <strong>{mostrados}{resto > 0 ? ` e mais ${resto} ${resto === 1 ? 'mês' : 'meses'}` : ''}</strong>.<br />{dica}
    </p>
  )
}

const Efeito = ({ mes }) => (
  <p style={st.efeito}>Demandas até <strong>{rotuloMes(mesAnterior(mes))}</strong> continuam no histórico. De <strong>{rotuloMes(mes)}</strong> em diante deixam de existir.</p>
)

export function ModalInativar({ clienteId, nome, onConfirmar, onCancelar, carregando }) {
  const [mes, setMes] = useState(mesAtual())
  const mesesAfetados = useMesesAfetados(clienteId, { acao: 'inativar', mes })
  return (
    <Modal onFechar={onCancelar} maxWidth="480px">
      <div style={st.corpo}>
        <p style={st.titulo}>Inativar {nome}?</p>
        <LinhaMes rotulo="A empresa deixa de ter demandas a partir de:" valor={mes} onChange={setMes} />
        <Efeito mes={mes} />
        <AvisoMesesAfetados meses={mesesAfetados} />
        <p style={st.apagado}>Nada é apagado. Os meses anteriores ficam só para consulta e o cliente não pode ser editado enquanto estiver inativo.</p>
      </div>
      <div style={st.rodape}>
        <button style={st.btnCanc} onClick={onCancelar}>Cancelar</button>
        <button style={st.btnPerigo} onClick={() => onConfirmar(mes)} disabled={carregando}>{carregando ? 'Inativando...' : mesesAfetados.length ? 'Confirmar mesmo assim' : 'Inativar'}</button>
      </div>
    </Modal>
  )
}

export function ModalReativar({ nome, onConfirmar, onCancelar, carregando }) {
  const [mes, setMes] = useState(mesAtual())
  return (
    <Modal onFechar={onCancelar} maxWidth="480px">
      <div style={st.corpo}>
        <p style={st.titulo}>Reativar {nome}?</p>
        <LinhaMes rotulo="A empresa volta a ter demandas a partir de:" valor={mes} onChange={setMes} />
        <p style={st.efeito}>As demandas voltam a existir de <strong>{rotuloMes(mes)}</strong> em diante, nos setores atribuídos ao cliente. Os meses em que ele ficou inativo continuam sem demanda.</p>
      </div>
      <div style={st.rodape}>
        <button style={st.btnCanc} onClick={onCancelar}>Cancelar</button>
        <button style={st.btnVerde} onClick={() => onConfirmar(mes)} disabled={carregando}>{carregando ? 'Reativando...' : 'Reativar'}</button>
      </div>
    </Modal>
  )
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

export function ModalRemoverSetor({ clienteId, setor, onConfirmar, onCancelar }) {
  const [escopo, setEscopo] = useState('frente')
  const [mes, setMes] = useState(mesAtual())
  const [impacto, setImpacto] = useState(null)
  const [erroImpacto, setErroImpacto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const mesesAfetados = useMesesAfetados(clienteId, escopo === 'frente' ? { acao: 'remover_setor', mes, setorId: setor._id } : null)

  useEffect(() => {
    api.get(`/clientes/${clienteId}/setores/${setor._id}/impacto`).then(r => setImpacto(r.data)).catch(() => setErroImpacto(true))
  }, [clienteId, setor._id])

  const confirmar = async () => {
    setEnviando(true)
    try { await onConfirmar(escopo, mes) } finally { setEnviando(false) }
  }

  return (
    <Modal onFechar={onCancelar} maxWidth="500px">
      <div style={st.corpo}>
        <p style={st.titulo}>Remover {setor.nome} deste cliente?</p>
        <div style={st.opcao(escopo === 'frente', false)} onClick={() => setEscopo('frente')}>
          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--texto)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="radio" readOnly checked={escopo === 'frente'} style={{ accentColor: 'var(--verde)' }} /> Daqui pra frente
          </span>
          {escopo === 'frente' && (<>
            <LinhaMes rotulo="A partir de:" valor={mes} onChange={setMes} />
            <Efeito mes={mes} />
            <AvisoMesesAfetados meses={mesesAfetados} />
            <p style={st.apagado}>Nada é apagado: lançamentos, documentos, configurações e particularidades ficam guardados e voltam a ser usados se o setor for adicionado de novo.</p>
          </>)}
        </div>
        <div style={st.opcao(escopo === 'todas', true)} onClick={() => setEscopo('todas')}>
          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: escopo === 'todas' ? '#f87171' : 'var(--texto)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="radio" readOnly checked={escopo === 'todas'} style={{ accentColor: '#f87171' }} /> Remover tudo
          </span>
          {escopo === 'todas' && (
            <p style={st.perigo}>
              {impacto ? (<>Será apagado deste setor: <strong>{plural(impacto.lancamentos, 'demanda preenchida', 'demandas preenchidas')}</strong>, <strong>{plural(impacto.documentos, 'documento', 'documentos')}</strong>
                {impacto.configuracoes ? <>, <strong>configurações</strong> ({plural(impacto.configuracoes, 'item', 'itens')})</> : null}
                {impacto.particularidades ? <> e as <strong>particularidades</strong></> : null}.<br /></>)
                : erroImpacto ? 'Não foi possível calcular o que será apagado. ' : 'Calculando o que será apagado... '}
              <strong>Esta ação não pode ser desfeita.</strong> Se o setor for adicionado de novo, ele volta sem nada configurado.
            </p>
          )}
        </div>
      </div>
      <div style={st.rodape}>
        <button style={st.btnCanc} onClick={onCancelar}>Cancelar</button>
        {escopo === 'frente'
          ? <button style={st.btnVerde} onClick={confirmar} disabled={enviando}>{enviando ? 'Removendo...' : mesesAfetados.length ? 'Confirmar mesmo assim' : 'Remover daqui pra frente'}</button>
          : <button style={st.btnPerigo} onClick={confirmar} disabled={enviando || !impacto}>{enviando ? 'Apagando...' : 'Remover tudo'}</button>}
      </div>
    </Modal>
  )
}

export function ModalExcluirCliente({ clienteId, nome, onConfirmar, onCancelar, carregando }) {
  const [impacto, setImpacto] = useState(null)
  const [erroImpacto, setErroImpacto] = useState(false)
  const [ciente, setCiente] = useState(false)
  useEffect(() => {
    api.get(`/clientes/${clienteId}/impacto-exclusao`).then(r => setImpacto(r.data)).catch(() => setErroImpacto(true))
  }, [clienteId])

  const linhas = impacto ? [
    [impacto.lancamentos, 'demanda preenchida', 'demandas preenchidas'],
    [impacto.documentos + impacto.documentosNaLixeira, 'documento (inclusive na lixeira)', 'documentos (inclusive os da lixeira)'],
    [impacto.implantacoes, 'onboarding', 'onboardings'],
    [impacto.tarefasDeOnboarding, 'atividade de onboarding', 'atividades de onboarding'],
    [impacto.controlesDeRetiradas, 'controle de retiradas de sócios', 'controles de retiradas de sócios'],
    [impacto.retiradasLancadas + impacto.apuracoesDeTrimestre, 'registro de retiradas/apuração', 'registros de retiradas/apuração'],
  ].filter(([n]) => n > 0) : []

  return (
    <Modal onFechar={onCancelar} maxWidth="500px">
      <div style={st.corpo}>
        <p style={{ ...st.titulo, display: 'flex', alignItems: 'center', gap: '8px' }}><Icone.AlertTriangle size={18} style={{ color: '#f87171' }} /> Excluir cliente permanentemente?</p>
        <p style={st.texto}>Tudo que está ligado a <strong>{nome}</strong> será excluído: demandas passadas e futuras, documentos, atividades e registros. <strong>Esta ação não pode ser desfeita.</strong></p>
        <div style={st.perigo}>
          {impacto ? (linhas.length
            ? <>Será apagado:<ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>{linhas.map(([n, um, varios]) => <li key={um}>{plural(n, um, varios)}</li>)}</ul></>
            : 'Além do cadastro, não há demandas, documentos ou onboardings ligados a este cliente.')
            : erroImpacto ? 'Não foi possível calcular o que será apagado.' : 'Calculando o que será apagado...'}
        </div>
        <p style={st.apagado}>O registro de quem fez a exclusão continua no histórico do sistema.</p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-apagado)' }}>
          <input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)} style={{ marginTop: '2px', accentColor: '#f87171', width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer' }} />
          Estou ciente de que essa exclusão é permanente e não pode ser desfeita.
        </label>
      </div>
      <div style={st.rodape}>
        <button style={st.btnCanc} onClick={onCancelar}>Cancelar</button>
        <button style={{ ...st.btnPerigo, background: '#dc2626', color: '#fff', border: 'none', opacity: ciente && impacto ? 1 : 0.5 }} onClick={onConfirmar} disabled={carregando || !ciente || !impacto}>
          {carregando ? 'Excluindo...' : 'Excluir definitivamente'}
        </button>
      </div>
    </Modal>
  )
}

// Vigência do setor mostrada na aba do cliente + ajuste manual (titular / responsável do setor)
export function VigenciaSetor({ cliente, setor, podeAjustar, onAtualizado, mostrar }) {
  const [editando, setEditando] = useState(false)
  const periodos = periodosDoSetor(cliente, setor._id)
  const removido = !(cliente.setores || []).some(s => String(s._id || s) === String(setor._id))
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '9px 14px', marginBottom: '14px', fontFamily: 'var(--fonte-corpo)' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--texto)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Icone.Calendar size={14} style={{ color: 'var(--texto-apagado)' }} />
        <span style={{ color: 'var(--texto-apagado)' }}>Demanda neste setor:</span>
        {periodos.length
          ? descreverPeriodos(periodos).map((t, i) => <span key={i} style={{ fontWeight: 600 }}>{i > 0 ? '· ' : ''}{t}</span>)
          : <span style={{ fontWeight: 600 }}>sem vigência (onboarding em andamento ou setor sem demanda)</span>}
        {removido && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>SETOR REMOVIDO · SÓ CONSULTA</span>}
      </div>
      {podeAjustar && periodos.length > 0 && (
        <button onClick={() => setEditando(true)} style={{ ...st.btnCanc, padding: '5px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Icone.Edit size={12} /> Ajustar</button>
      )}
      {editando && <ModalAjusteVigencia cliente={cliente} setor={setor} periodos={periodos} mostrar={mostrar}
        onCancelar={() => setEditando(false)} onSalvo={() => { setEditando(false); onAtualizado() }} />}
    </div>
  )
}

function ModalAjusteVigencia({ cliente, setor, periodos, onSalvo, onCancelar, mostrar }) {
  const ordenados = [...periodos].sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''))
  const [desdeSempre, setDesdeSempre] = useState(!ordenados[0].inicio)
  const [inicio, setInicio] = useState(ordenados[0].inicio || mesAtual())
  const [emAberto, setEmAberto] = useState(!ordenados[ordenados.length - 1].fim)
  const [fim, setFim] = useState(ordenados[ordenados.length - 1].fim || mesAtual())
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const inp = { ...st.select, minWidth: '150px' }
  const mesesAfetados = useMesesAfetados(cliente._id, { acao: 'ajustar', setorId: setor._id, inicio: desdeSempre ? null : inicio, fim: emAberto ? null : fim })

  const salvar = async () => {
    setErro(''); setSalvando(true)
    try {
      await api.patch(`/clientes/${cliente._id}/vigencia/${setor._id}`, { inicio: desdeSempre ? null : inicio, fim: emAberto ? null : fim })
      mostrar('Vigência ajustada.', 'sucesso')
      onSalvo()
    } catch (e) { setErro(e.response?.data?.erro || 'Erro ao ajustar a vigência.') }
    finally { setSalvando(false) }
  }

  return (
    <Modal onFechar={onCancelar} maxWidth="480px">
      <div style={st.corpo}>
        <p style={st.titulo}>Ajustar vigência — {setor.nome}</p>
        <p style={st.apagado}>Use para registrar meses antigos (início) ou corrigir uma inativação feita no mês errado (fim). Meses fora da vigência não podem ser preenchidos.</p>
        {ordenados.length > 1 && <p style={st.apagado}>Este setor tem {ordenados.length} períodos: o ajuste muda o início do primeiro e o fim do último.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.86rem', color: 'var(--texto)' }}>
            Começa em
            <input type="month" style={inp} value={inicio} disabled={desdeSempre} onChange={e => setInicio(e.target.value)} />
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--texto-apagado)' }}>
              <input type="checkbox" checked={desdeSempre} onChange={e => setDesdeSempre(e.target.checked)} style={{ accentColor: 'var(--verde)' }} /> desde sempre
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.86rem', color: 'var(--texto)' }}>
            Termina em
            <input type="month" style={inp} value={fim} disabled={emAberto} onChange={e => setFim(e.target.value)} />
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--texto-apagado)' }}>
              <input type="checkbox" checked={emAberto} onChange={e => setEmAberto(e.target.checked)} style={{ accentColor: 'var(--verde)' }} /> em aberto
            </span>
          </label>
        </div>
        <AvisoMesesAfetados meses={mesesAfetados} dica="Se quiser que algum deles continue, ajuste a vigência para incluí-los." />
        {erro && <p style={st.perigo}>{erro}</p>}
      </div>
      <div style={st.rodape}>
        <button style={st.btnCanc} onClick={onCancelar}>Cancelar</button>
        <button style={st.btnVerde} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : mesesAfetados.length ? 'Confirmar mesmo assim' : 'Salvar'}</button>
      </div>
    </Modal>
  )
}
