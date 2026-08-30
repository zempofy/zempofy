const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import { useToast } from './Toast'

const PERIODICIDADES = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'esporadico', label: 'Esporádico' },
]

const labelPeriodicidade = (v) => PERIODICIDADES.find(p => p.value === v)?.label || v

const formatMoeda = (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

function ModalServico({ servico, fechar, onSalvo }) {
  const [nome, setNome] = useState(servico?.nome || '')
  const [descricao, setDescricao] = useState(servico?.descricao || '')
  const [honorario, setHonorario] = useState(servico?.honorarioPadrao ? Number(servico.honorarioPadrao).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')
  const [periodicidade, setPeriodicidade] = useState(servico?.periodicidade || 'mensal')
  const [mesReferencia, setMesReferencia] = useState(servico?.mesReferencia || 1)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const { mostrar } = useToast()

  const handleHonorario = (e) => {
    const nums = e.target.value.replace(/\D/g, '')
    setHonorario(nums ? (parseInt(nums, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')
  }

  const salvar = async () => {
    if (!nome.trim()) return setErro('Nome é obrigatório.')
    setErro(''); setCarregando(true)
    const honorarioNum = honorario ? parseFloat(honorario.replace(/\./g, '').replace(',', '.')) : 0
    const dados = { nome, descricao, honorarioPadrao: honorarioNum, periodicidade, mesReferencia: ['trimestral','anual'].includes(periodicidade) ? mesReferencia : null }
    try {
      if (servico?._id) {
        await api.put(`/servicos/${servico._id}`, dados)
        mostrar('Serviço atualizado!', 'sucesso')
      } else {
        await api.post('/servicos', dados)
        mostrar('Serviço criado!', 'sucesso')
      }
      onSalvo(); fechar()
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao salvar.')
    } finally { setCarregando(false) }
  }

  return createPortal(
    <div style={s.overlay} onClick={fechar}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalTopo}>
          <p style={s.modalTit}>{servico ? 'Editar serviço' : 'Novo serviço'}</p>
          <button style={s.btnX} onClick={fechar}>✕</button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {erro && <p style={s.erro}>{erro}</p>}
          <div style={s.campo}>
            <label style={s.lbl}>Nome do serviço *</label>
            <input style={s.inp} value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && salvar()} placeholder="Ex: Contábil, Fiscal, Departamento Pessoal..." autoFocus />
          </div>
          <div style={s.campo}>
            <label style={s.lbl}>Descrição <span style={{ color: 'var(--texto-apagado)', fontWeight: 400 }}>(opcional)</span></label>
            <textarea style={{ ...s.inp, minHeight: '70px', resize: 'vertical' }} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva brevemente o que inclui este serviço..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={s.campo}>
              <label style={s.lbl}>Honorário padrão (R$)</label>
              <input style={s.inp} value={honorario} onChange={handleHonorario} placeholder="0,00" />
            </div>
            <div style={s.campo}>
              <label style={s.lbl}>Periodicidade</label>
              <select style={s.inp} value={periodicidade} onChange={e => setPeriodicidade(e.target.value)}>
                {PERIODICIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          {/* Mês de referência — só pra trimestral e anual */}
          {['trimestral','anual'].includes(periodicidade) && (
            <div style={s.campo}>
              <label style={s.lbl}>Mês de referência</label>
              <select style={s.inp} value={mesReferencia} onChange={e => setMesReferencia(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '4px 0 0' }}>
                {periodicidade === 'trimestral'
                  ? `Aparecerá em: ${[0,3,6,9].map(d => MESES[((mesReferencia-1+d)%12)]).join(', ')}`
                  : `Aparecerá todo ano em: ${MESES[mesReferencia-1]}`}
              </p>
            </div>
          )}
        </div>
        <div style={s.modalRodape}>
          <button style={s.btnCanc} onClick={fechar}>Cancelar</button>
          <button style={s.btnSalv} onClick={salvar} disabled={carregando}>{carregando ? 'Salvando...' : servico ? 'Salvar' : 'Criar serviço'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Servicos() {
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const { mostrar } = useToast()

  const carregar = async () => {
    setCarregando(true)
    try { const r = await api.get('/servicos'); setServicos(r.data) }
    catch { mostrar('Erro ao carregar serviços.', 'erro') }
    finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const excluir = async (id) => {
    try { await api.delete(`/servicos/${id}`); mostrar('Serviço removido.', 'sucesso'); setConfirmandoId(null); carregar() }
    catch { mostrar('Erro ao remover.', 'erro') }
  }

  const servicoParaRemover = servicos.find(sv => sv._id === confirmandoId)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--texto)', margin: 0, letterSpacing: '-0.03em', fontFamily: 'var(--fonte-corpo)' }}>Serviços</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--texto-apagado)', marginTop: '5px', fontFamily: 'var(--fonte-corpo)' }}>Serviços oferecidos pelo escritório — vinculados aos clientes</p>
        </div>
        <button onClick={() => { setEditando(null); setModalAberto(true) }} style={s.btnNovo}>+ Novo serviço</button>
      </div>

      {carregando ? <p style={{ color: 'var(--texto-apagado)', fontFamily: 'var(--fonte-corpo)' }}>Carregando...</p>
      : servicos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--texto-apagado)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--borda)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px' }}>📋</div>
          <p style={{ fontSize: '0.9rem', marginBottom: '6px', fontFamily: 'var(--fonte-corpo)' }}>Nenhum serviço cadastrado ainda.</p>
          <p style={{ fontSize: '0.8rem', fontFamily: 'var(--fonte-corpo)' }}>Cadastre os serviços do escritório para vincular aos clientes.</p>
          <button onClick={() => { setEditando(null); setModalAberto(true) }} style={{ ...s.btnNovo, marginTop: '16px' }}>Criar primeiro serviço</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--borda)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--borda)' }}>
          {servicos.map((sv, i) => (
            <div key={sv._id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px', background: 'var(--card)', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--input)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--texto-apagado)', width: '20px', flexShrink: 0, textAlign: 'center' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <p style={{ fontWeight: '600', color: 'var(--texto)', margin: 0, fontSize: '0.9rem', fontFamily: 'var(--fonte-corpo)' }}>{sv.nome}</p>
                  <span style={{ fontSize: '0.68rem', fontWeight: '600', padding: '2px 8px', borderRadius: '5px', background: 'var(--input)', color: 'var(--texto-apagado)', border: '1px solid var(--borda)' }}>{labelPeriodicidade(sv.periodicidade)}</span>
                  {sv.honorarioPadrao > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--verde)', fontWeight: '600' }}>{formatMoeda(sv.honorarioPadrao)}</span>}
                </div>
                {sv.descricao && <p style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', margin: '3px 0 0', fontFamily: 'var(--fonte-corpo)' }}>{sv.descricao}</p>}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => { setEditando(sv); setModalAberto(true) }} style={s.btnAcao}>Editar</button>
                <button onClick={() => setConfirmandoId(sv._id)} style={{ ...s.btnAcao, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAberto && <ModalServico servico={editando} fechar={() => { setModalAberto(false); setEditando(null) }} onSalvo={carregar} />}

      {confirmandoId && createPortal(
        <div style={s.overlay} onClick={() => setConfirmandoId(null)}>
          <div style={{ ...s.modal, maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalTopo}><p style={s.modalTit}>Remover serviço</p><button style={s.btnX} onClick={() => setConfirmandoId(null)}>✕</button></div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--texto)', margin: '0 0 12px', fontFamily: 'var(--fonte-corpo)' }}>Tem certeza que deseja remover <strong>"{servicoParaRemover?.nome}"</strong>?</p>
              <p style={{ fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '10px 12px', margin: 0, fontFamily: 'var(--fonte-corpo)' }}>⚠️ Clientes que possuem este serviço vinculado não serão afetados.</p>
            </div>
            <div style={s.modalRodape}>
              <button style={s.btnCanc} onClick={() => setConfirmandoId(null)}>Cancelar</button>
              <button style={{ ...s.btnSalv, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }} onClick={() => excluir(confirmandoId)}>Remover</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' },
  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  modalTit: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)', margin: 0 },
  modalRodape: { display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--borda)' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' },
  btnNovo: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,177,65,0.25)', whiteSpace: 'nowrap' },
  btnCanc: { background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'var(--fonte-corpo)', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnSalv: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  btnAcao: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', fontSize: '0.75rem', cursor: 'pointer', padding: '5px 12px', fontFamily: 'var(--fonte-corpo)' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  lbl: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--fonte-corpo)' },
  inp: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'var(--fonte-corpo)', width: '100%', boxSizing: 'border-box' },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px', fontFamily: 'var(--fonte-corpo)' },
}
