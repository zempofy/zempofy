import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from './Toast'

function ModalAtividade({ setor, atividade, fechar, onSalvo, funcionarios, setoresComMembros }) {
  // Buscar membros do setor a partir de Setor.membros
  const setorComMembros = setoresComMembros?.find(s => s._id === setor._id)
  const idsMembroSetor = setorComMembros?.membros?.map(m => m._id || m) || []
  const funcionariosDoSetor = funcionarios.filter(f => idsMembroSetor.includes(f._id))
  const opcoesFuncionarios = funcionariosDoSetor.length > 0 ? funcionariosDoSetor : funcionarios
  const [descricao, setDescricao] = useState(atividade?.descricao || '')
  const [responsavelId, setResponsavelId] = useState(atividade?.responsavel?._id || '')
  const [observacoes, setObservacoes] = useState(atividade?.observacoes || '')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const { mostrar: toast } = useToast()

  const salvar = async () => {
    if (!descricao.trim()) return setErro('Descrição é obrigatória.')
    setCarregando(true); setErro('')
    try {
      const dados = {
        descricao: descricao.trim(),
        observacoes: observacoes.trim(),
        setor: setor._id,
        responsavelId: responsavelId || null,
      }
      if (atividade?._id) {
        await api.put(`/checklist/${atividade._id}`, dados)
        toast('Atividade atualizada!', 'sucesso')
      } else {
        await api.post('/checklist', dados)
        toast('Atividade criada!', 'sucesso')
      }
      onSalvo()
      fechar()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar atividade.')
    } finally { setCarregando(false) }
  }

  return (
    <div style={s.overlay} onClick={fechar}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalTopo}>
          <div>
            <span style={s.modalTitulo}>{atividade ? 'Editar atividade' : 'Nova atividade'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: setor.cor }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', fontFamily: 'Inter, sans-serif' }}>{setor.nome}</span>
            </div>
          </div>
          <button style={s.btnX} onClick={fechar}>✕</button>
        </div>
        <div style={s.modalCorpo}>
          {erro && <p style={s.erro}>{erro}</p>}
          <div style={s.campo}>
            <label style={s.label}>Descrição</label>
            <input
              style={s.input}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="O que precisa ser feito?"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && salvar()}
            />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Responsável <span style={{ color: 'var(--texto-apagado)', fontWeight: 400 }}>(opcional)</span></label>
            <select style={s.input} value={responsavelId} onChange={e => setResponsavelId(e.target.value)}>
              <option value="">Em aberto — qualquer um do setor</option>
              {funcionariosDoSetor.length === 0 && (
                <option value="" disabled>Nenhum colaborador neste setor ainda</option>
              )}
              {opcoesFuncionarios.map(f => (
                <option key={f._id} value={f._id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Observações <span style={{ color: 'var(--texto-apagado)', fontWeight: 400 }}>(opcional)</span></label>
            <textarea
              style={{ ...s.input, minHeight: '80px', resize: 'vertical' }}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Instruções, documentos necessários..."
            />
          </div>
        </div>
        <div style={s.modalRodape}>
          <button style={s.btnCancelar} onClick={fechar}>Cancelar</button>
          <button style={s.btnSalvar} onClick={salvar} disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BlocoSetor({ setor, atividades, funcionarios, setoresComMembros, onAtualizado }) {
  const [modalAberto, setModalAberto] = useState(false)
  const [atividadeEditando, setAtividadeEditando] = useState(null)
  const { mostrar: toast } = useToast()

  const excluir = async (id) => {
    if (!confirm('Remover esta atividade?')) return
    try {
      await api.delete(`/checklist/${id}`)
      toast('Atividade removida.', 'sucesso')
      onAtualizado()
    } catch { toast('Erro ao remover.', 'erro') }
  }

  const abrirNova = () => { setAtividadeEditando(null); setModalAberto(true) }
  const abrirEditar = (at) => { setAtividadeEditando(at); setModalAberto(true) }

  return (
    <div style={s.setorBloco}>
      <div style={s.setorHeader}>
        <div style={s.setorEsq}>
          <div style={{ ...s.bolinha, background: setor.cor }} />
          <span style={s.setorNome}>{setor.nome}</span>
          <span style={s.countBadge}>{atividades.length}</span>
        </div>
        <button style={s.btnAddSetor} onClick={abrirNova}>+ atividade</button>
      </div>

      <div style={s.atividades}>
        {atividades.length === 0 ? (
          <div style={s.vazio}>Nenhuma atividade ainda</div>
        ) : (
          atividades.map(at => (
            <div key={at._id} style={s.atividadeCard} className="bk-card">
              <div style={s.atividadeIcone}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--texto-apagado)" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="2" y="3" width="12" height="10" rx="2"/>
                  <line x1="5" y1="7" x2="11" y2="7"/>
                  <line x1="5" y1="10" x2="8" y2="10"/>
                </svg>
              </div>
              <span style={s.atividadeDesc}>{at.descricao}</span>
              {at.responsavel?.nome && (
                <span style={s.respBadge}>{at.responsavel.nome}</span>
              )}
              <div style={s.acoes} className="bk-acoes">
                <button style={s.btnAcao} onClick={() => abrirEditar(at)}>Editar</button>
                <button style={{ ...s.btnAcao, color: '#FCA5A5' }} onClick={() => excluir(at._id)}>Remover</button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalAberto && (
        <ModalAtividade
          setor={setor}
          atividade={atividadeEditando}
          fechar={() => setModalAberto(false)}
          onSalvo={onAtualizado}
          funcionarios={funcionarios}
          setoresComMembros={setoresComMembros}
        />
      )}
    </div>
  )
}

export default function BancoAtividades() {
  const [setores, setSetores] = useState([])
  const [atividades, setAtividades] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [carregando, setCarregando] = useState(true)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [resSetores, resAtividades, resFunc] = await Promise.all([
        api.get('/setores'),
        api.get('/checklist'),
        api.get('/usuarios'),
      ])
      setSetores(resSetores.data)
      setAtividades(resAtividades.data)
      setFuncionarios(resFunc.data)
    } catch {}
    finally { setCarregando(false) }
  }

  useEffect(() => { carregar() }, [])

  const atividadesDoSetor = (setorId) =>
    atividades.filter(a => a.setor?._id === setorId || a.setor === setorId)

  return (
    <div>
      <style>{`.bk-card:hover .bk-acoes { opacity: 1 !important; }`}</style>

      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Banco de atividades</h1>
          <p style={s.subtitulo}>Atividades padrão por setor — crie uma vez e reutilize em qualquer modelo</p>
        </div>
      </div>

      {carregando ? (
        <p style={s.vazioGlobal}>Carregando...</p>
      ) : (
        <div style={s.blocos}>
          {setores.map((setor, idx) => (
            <div key={setor._id}>
              <BlocoSetor
                setor={setor}
                atividades={atividadesDoSetor(setor._id)}
                funcionarios={funcionarios}
                setoresComMembros={setores}
                onAtualizado={carregar}
              />
              {idx < setores.length - 1 && <hr style={s.divisor} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' },
  titulo: { fontSize: '1.5rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif', letterSpacing: '-0.03em' },
  subtitulo: { fontSize: '0.82rem', color: 'var(--texto-apagado)', marginTop: '5px', fontFamily: 'Inter, sans-serif' },
  blocos: { display: 'flex', flexDirection: 'column', gap: '0' },
  setorBloco: { paddingTop: '4px', paddingBottom: '4px' },
  setorHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
  setorEsq: { display: 'flex', alignItems: 'center', gap: '10px' },
  bolinha: { width: '11px', height: '11px', borderRadius: '50%', flexShrink: 0 },
  setorNome: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  countBadge: { fontSize: '0.72rem', color: 'var(--texto-apagado)', background: 'var(--input)', border: '1px solid var(--borda)', padding: '1px 8px', borderRadius: '99px', fontFamily: 'Inter, sans-serif' },
  btnAddSetor: { fontSize: '0.78rem', color: 'var(--texto-apagado)', background: 'none', border: '1px dashed var(--borda)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  atividades: { display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '21px' },
  atividadeCard: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '11px 14px' },
  atividadeIcone: { width: '30px', height: '30px', borderRadius: '7px', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  atividadeDesc: { fontSize: '0.875rem', color: 'var(--texto)', flex: 1, fontFamily: 'Inter, sans-serif' },
  respBadge: { fontSize: '0.75rem', color: 'var(--verde)', background: 'rgba(0,177,65,0.08)', border: '1px solid rgba(0,177,65,0.2)', padding: '3px 10px', borderRadius: '99px', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' },
  acoes: { display: 'flex', gap: '6px', opacity: 0, transition: 'opacity .15s' },
  btnAcao: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 10px', fontFamily: 'Inter, sans-serif' },
  vazio: { fontSize: '0.82rem', color: 'var(--texto-apagado)', padding: '10px 0', fontFamily: 'Inter, sans-serif' },
  vazioGlobal: { color: 'var(--texto-apagado)', textAlign: 'center', marginTop: '40px', fontFamily: 'Inter, sans-serif' },
  divisor: { border: 'none', borderTop: '1px solid var(--borda)', margin: '16px 0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', width: '100%', maxWidth: '460px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' },
  modalTopo: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  modalTitulo: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer', flexShrink: 0 },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalRodape: { display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--borda)' },
  campo: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Inter, sans-serif' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' },
  btnCancelar: { background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnSalvar: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px' },
}
