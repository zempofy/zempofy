import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import { useToast } from './Toast'
import ModalConfirmacao from './ModalConfirmacao'
// ── Balão de tour ──
function Balao({ alvo, titulo, texto, passo, total, onProximo, onFechar, posicao = 'bottom' }) {
  const [coords, setCoords] = useState(null)

  useEffect(() => {
    if (!alvo?.current) return
    const atualizar = () => {
      const rect = alvo.current?.getBoundingClientRect()
      if (rect) setCoords({ ...rect.toJSON() })
    }
    atualizar()
    const timer = setInterval(atualizar, 100)
    window.addEventListener('resize', atualizar)
    return () => { clearInterval(timer); window.removeEventListener('resize', atualizar) }
  }, [alvo])

  if (!coords) return null

  const GAP = 14
  let top, left, arrowStyle

  if (posicao === 'bottom') {
    top = coords.bottom + GAP
    left = coords.left + coords.width / 2 - 160
    arrowStyle = { top: -8, left: '50%', transform: 'translateX(-50%)', borderBottom: '8px solid #1c1c1f', borderLeft: '8px solid transparent', borderRight: '8px solid transparent' }
  } else if (posicao === 'top') {
    top = coords.top - GAP - 170
    left = coords.left + coords.width / 2 - 160
    arrowStyle = { bottom: -8, left: '50%', transform: 'translateX(-50%)', borderTop: '8px solid #1c1c1f', borderLeft: '8px solid transparent', borderRight: '8px solid transparent' }
  } else if (posicao === 'right') {
    top = coords.top + coords.height / 2 - 70
    left = coords.right + GAP
    arrowStyle = { top: '40%', left: -8, borderRight: '8px solid #1c1c1f', borderTop: '8px solid transparent', borderBottom: '8px solid transparent' }
  } else {
    top = coords.top + coords.height / 2 - 70
    left = coords.left - 334 - GAP
    arrowStyle = { top: '40%', right: -8, borderLeft: '8px solid #1c1c1f', borderTop: '8px solid transparent', borderBottom: '8px solid transparent' }
  }

  left = Math.max(12, Math.min(left, window.innerWidth - 340))
  top = Math.max(12, Math.min(top, window.innerHeight - 200))

  return createPortal(
    <>
      {/* Spotlight */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <mask id={`spot-${passo}`}>
              <rect width="100%" height="100%" fill="white" />
              <rect x={coords.left - 8} y={coords.top - 8} width={coords.width + 16} height={coords.height + 16} rx="10" fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask={`url(#spot-${passo})`} />
          {/* Borda verde pulsando em volta do elemento destacado */}
          <rect
            x={coords.left - 8} y={coords.top - 8}
            width={coords.width + 16} height={coords.height + 16}
            rx="10" fill="none"
            stroke="rgba(0,177,65,0.8)" strokeWidth="2"
          />
        </svg>
        {/* Glow verde */}
        <div style={{
          position: 'absolute',
          left: coords.left - 8, top: coords.top - 8,
          width: coords.width + 16, height: coords.height + 16,
          borderRadius: '10px',
          boxShadow: '0 0 0 3px rgba(0,177,65,0.3), 0 0 20px rgba(0,177,65,0.2)',
          animation: 'zempofy-pulse 2s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes zempofy-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(0,177,65,0.3), 0 0 20px rgba(0,177,65,0.15); }
          50% { box-shadow: 0 0 0 5px rgba(0,177,65,0.5), 0 0 30px rgba(0,177,65,0.3); }
        }
      `}</style>

      {/* Balão */}
      <div style={{
        position: 'fixed', top, left, width: '320px',
        background: '#1c1c1f',
        border: '1px solid rgba(0,177,65,0.35)',
        borderRadius: '14px', padding: '18px 20px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,177,65,0.1)',
        zIndex: 9999, fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ position: 'absolute', width: 0, height: 0, ...arrowStyle }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>💡</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--verde)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Passo {passo + 1} de {total}
            </span>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', lineHeight: 1, borderRadius: '4px' }}>✕</button>
        </div>

        <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff', margin: '0 0 6px', letterSpacing: '-0.01em' }}>{titulo}</p>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: '1.5' }}>{texto}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{
                width: i === passo ? '16px' : '6px', height: '6px',
                borderRadius: '99px',
                background: i === passo ? 'var(--verde)' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.2s',
              }} />
            ))}
          </div>
          <button onClick={onProximo} style={{
            background: 'var(--gradiente-verde)', color: '#fff',
            border: 'none', borderRadius: '8px', padding: '7px 16px',
            fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            {passo === total - 1 ? 'Concluir ✓' : 'Próximo →'}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ── Modal de criação/edição ──
function ModalAtividade({ setores, atividade, fechar, onSalvo, funcionarios, refSetor, refDescricao, refResponsavel, refObservacoes }) {
  const [setorId, setSetorId] = useState(atividade?.setor?._id || atividade?.setor || '')
  const [descricao, setDescricao] = useState(atividade?.descricao || '')
  const [responsavelId, setResponsavelId] = useState(atividade?.responsavel?._id || '')
  const [observacoes, setObservacoes] = useState(atividade?.observacoes || '')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const { mostrar: toast } = useToast()

  const setorSelecionado = setores.find(s => s._id === setorId)
  const idsDoSetor = setorSelecionado?.membros?.map(m => m._id || m.toString()) || []
  const funcionariosDoSetor = funcionarios.filter(f => idsDoSetor.includes(f._id))
  // Mostrar APENAS membros do setor selecionado
  const opcoesFuncionarios = funcionariosDoSetor

  const salvar = async () => {
    if (!setorId) return setErro('Selecione um setor.')
    if (!descricao.trim()) return setErro('Descrição é obrigatória.')
    setCarregando(true); setErro('')
    try {
      const dados = { descricao: descricao.trim(), observacoes: observacoes.trim(), setor: setorId, responsavelId: responsavelId || null }
      if (atividade?._id) {
        await api.put(`/checklist/${atividade._id}`, dados)
        toast('Atividade atualizada!', 'sucesso')
      } else {
        await api.post('/checklist', dados)
        toast('Atividade criada!', 'sucesso')
      }
      onSalvo(); fechar()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar.')
    } finally { setCarregando(false) }
  }

  return createPortal(
    <div style={s.overlay} onClick={fechar}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalTopo}>
          <span style={s.modalTitulo}>{atividade ? 'Editar atividade' : 'Nova atividade'}</span>
          <button style={s.btnX} onClick={fechar}>✕</button>
        </div>
        <div style={s.modalCorpo}>
          {erro && <p style={s.erro}>{erro}</p>}

          {/* Setor */}
          <div style={s.campo} ref={refSetor}>
            <label style={s.label}>Setor <span style={{ color: '#f87171' }}>*</span></label>
            {atividade ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px' }}>
                {setorSelecionado && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: setorSelecionado.cor }} />}
                <span style={{ fontSize: '0.9rem', color: 'var(--texto)' }}>{setorSelecionado?.nome || '—'}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {setores.map(s2 => {
                  const ativo = setorId === s2._id
                  return (
                    <button key={s2._id} type="button" onClick={() => { setSetorId(s2._id); setResponsavelId('') }} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '99px', cursor: 'pointer',
                      fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', fontWeight: '500',
                      border: ativo ? `2px solid ${s2.cor}` : '1px solid var(--borda)',
                      background: ativo ? `${s2.cor}22` : 'transparent',
                      color: ativo ? s2.cor : 'var(--texto-apagado)',
                      transition: 'all 0.12s',
                    }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s2.cor }} />
                      {s2.nome}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Descrição */}
          <div style={s.campo} ref={refDescricao}>
            <label style={s.label}>Descrição <span style={{ color: '#f87171' }}>*</span></label>
            <input style={s.input} value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="O que precisa ser feito?" onKeyDown={e => e.key === 'Enter' && salvar()} />
          </div>

          {/* Responsável */}
          <div style={s.campo} ref={refResponsavel}>
            <label style={s.label}>Responsável <span style={{ color: 'var(--texto-apagado)', fontWeight: 400 }}>(opcional)</span></label>
            {!setorId ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', fontStyle: 'italic' }}>
                Selecione um setor para ver os responsáveis
              </p>
            ) : (
              <>
                {funcionariosDoSetor.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '4px' }}>Nenhum colaborador neste setor ainda.</p>
                )}
                <select style={s.input} value={responsavelId} onChange={e => setResponsavelId(e.target.value)}>
                  <option value="">Em aberto — qualquer um do setor</option>
                  {opcoesFuncionarios.map(f => <option key={f._id} value={f._id}>{f.nome}</option>)}
                </select>
              </>
            )}
          </div>

          {/* Observações */}
          <div style={s.campo} ref={refObservacoes}>
            <label style={s.label}>Observações <span style={{ color: 'var(--texto-apagado)', fontWeight: 400 }}>(opcional)</span></label>
            <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }}
              value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="Instruções, documentos necessários..." />
          </div>
        </div>
        <div style={s.modalRodape}>
          <button style={s.btnCancelar} onClick={fechar}>Cancelar</button>
          <button style={s.btnSalvar} onClick={salvar} disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar atividade'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Bloco por setor ──
function BlocoSetor({ setor, atividades, onEditar, onExcluir }) {
  return (
    <div style={s.setorBloco}>
      <div style={s.setorHeader}>
        <div style={s.setorEsq}>
          <div style={{ ...s.bolinha, background: setor.cor }} />
          <span style={s.setorNome}>{setor.nome}</span>
          <span style={s.countBadge}>{atividades.length}</span>
        </div>
      </div>
      <div style={s.atividades}>
        {atividades.length === 0 ? (
          <div style={s.vazio}>Nenhuma atividade ainda</div>
        ) : atividades.map(at => (
          <div key={at._id} style={s.atividadeCard} className="bk-card">
            <div style={s.atividadeIcone}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--texto-apagado)" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="3" width="12" height="10" rx="2"/><line x1="5" y1="7" x2="11" y2="7"/><line x1="5" y1="10" x2="8" y2="10"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={s.atividadeDesc}>{at.descricao}</span>
              {at.observacoes && <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{at.observacoes}</p>}
            </div>
            {at.responsavel?.nome && <span style={s.respBadge}>{at.responsavel.nome}</span>}
            <div style={s.acoes} className="bk-acoes">
              <button style={s.btnAcao} onClick={() => onEditar(at)}>Editar</button>
              <button style={{ ...s.btnAcao, color: '#FCA5A5' }} onClick={() => onExcluir(at._id)}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ──
export default function BancoAtividades() {
  const [setores, setSetores] = useState([])
  const [atividades, setAtividades] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [atividadeEditando, setAtividadeEditando] = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const { mostrar: toast } = useToast()

  // ── Tour ──
  const [tourExternoAtivo, setTourExternoAtivo] = useState(false)
  const [tourInternoAtivo, setTourInternoAtivo] = useState(false)
  const [tourInternoPasso, setTourInternoPasso] = useState(0)

  const refBtnNovo = useRef(null)
  const refSetor = useRef(null)
  const refDescricao = useRef(null)
  const refResponsavel = useRef(null)
  const refObservacoes = useRef(null)

  const passosTourInterno = [
    { ref: refSetor, titulo: 'Selecione o setor', texto: 'Escolha em qual setor esta atividade pertence. Isso é obrigatório para organizar corretamente.', posicao: 'bottom' },
    { ref: refDescricao, titulo: 'Descreva a atividade', texto: 'Escreva de forma clara o que precisa ser feito. Ex: "Emitir CND Federal".', posicao: 'bottom' },
    { ref: refResponsavel, titulo: 'Defina um responsável', texto: 'Opcional — se deixar em aberto, qualquer membro do setor pode executar.', posicao: 'bottom' },
    { ref: refObservacoes, titulo: 'Adicione observações', texto: 'Opcional — instruções extras, documentos necessários ou dicas para quem for executar.', posicao: 'top' },
  ]

  const iniciarTour = () => { setTourExternoAtivo(true) }
  const fecharTourExterno = () => setTourExternoAtivo(false)
  const proximoTourExterno = () => {
    setTourExternoAtivo(false)
    setAtividadeEditando(null)
    setModalAberto(true)
    setTourInternoAtivo(true)
    setTourInternoPasso(0)
  }
  const fecharTourInterno = () => setTourInternoAtivo(false)
  const proximoTourInterno = () => {
    setTourInternoPasso(p => {
      if (p >= passosTourInterno.length - 1) { setTourInternoAtivo(false); return 0 }
      return p + 1
    })
  }

  const abrirNova = () => {
    setTourExternoAtivo(false)
    setAtividadeEditando(null)
    setModalAberto(true)
  }

  const fecharModal = () => {
    setModalAberto(false)
    setTourInternoAtivo(false)
  }

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

  const abrirEditar = (at) => { setAtividadeEditando(at); setModalAberto(true) }

  const excluir = async (id) => {
    try {
      await api.delete(`/checklist/${id}`)
      setConfirmandoId(null)
      toast('Atividade removida.', 'sucesso')
      carregar()
    } catch { toast('Erro ao remover.', 'erro') }
  }

  const passoExternoAtual = tourExternoAtivo ? passosTourInterno[0] : null
  const passoInternoAtual = tourInternoAtivo && !atividadeEditando ? passosTourInterno[tourInternoPasso] : null

  return (
    <div>
      <style>{`.bk-card:hover .bk-acoes { opacity: 1 !important; }`}</style>

      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Banco de atividades</h1>
          <p style={s.subtitulo}>Atividades padrão por setor — crie uma vez e reutilize em qualquer modelo</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button style={s.btnTutorial} onClick={iniciarTour}>💡 Tutorial</button>
          <button ref={refBtnNovo} style={s.btnNovo} onClick={abrirNova}>+ Nova atividade</button>
        </div>
      </div>

      {tourExternoAtivo && (
        <Balao
          alvo={refBtnNovo}
          titulo="Crie sua primeira atividade"
          texto='Clique em "+ Nova atividade" para adicionar uma atividade ao banco. Você poderá reutilizá-la em qualquer modelo de onboarding.'
          passo={0}
          total={1}
          onProximo={proximoTourExterno}
          onFechar={fecharTourExterno}
          posicao="bottom"
        />
      )}

      {carregando ? (
        <p style={s.vazioGlobal}>Carregando...</p>
      ) : setores.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--texto-apagado)' }}>
          <p>Nenhum setor configurado ainda.</p>
          <p style={{ fontSize: '0.82rem', marginTop: '8px' }}>Configure os setores do escritório antes de criar atividades.</p>
        </div>
      ) : (
        <div style={s.blocos}>
          {setores.map((setor, idx) => (
            <div key={setor._id}>
              <BlocoSetor setor={setor} atividades={atividadesDoSetor(setor._id)} onEditar={abrirEditar} onExcluir={setConfirmandoId} />
              {idx < setores.length - 1 && <hr style={s.divisor} />}
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <ModalAtividade
          setores={setores}
          atividade={atividadeEditando}
          fechar={fecharModal}
          onSalvo={carregar}
          funcionarios={funcionarios}
          refSetor={refSetor}
          refDescricao={refDescricao}
          refResponsavel={refResponsavel}
          refObservacoes={refObservacoes}
        />
      )}

      {passoInternoAtual && (
        <Balao
          alvo={passoInternoAtual.ref}
          titulo={passoInternoAtual.titulo}
          texto={passoInternoAtual.texto}
          passo={tourInternoPasso}
          total={passosTourInterno.length}
          onProximo={proximoTourInterno}
          onFechar={fecharTourInterno}
          posicao={passoInternoAtual.posicao}
        />
      )}

      {confirmandoId && (
        <ModalConfirmacao
          titulo="Remover atividade"
          mensagem="Remover esta atividade do banco?"
          textoBotao="Remover" perigo
          onConfirmar={() => excluir(confirmandoId)}
          onCancelar={() => setConfirmandoId(null)}
        />
      )}
    </div>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' },
  titulo: { fontSize: '1.05rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif', letterSpacing: '-0.03em' },
  subtitulo: { fontSize: '0.76rem', color: 'var(--texto-apagado)', marginTop: '3px', fontFamily: 'Inter, sans-serif' },
  btnNovo: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '9px', padding: '8px 16px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,177,65,0.25)', whiteSpace: 'nowrap' },
  btnTutorial: { background: 'none', border: '1px solid var(--borda)', borderRadius: '9px', padding: '8px 14px', fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--texto-apagado)', whiteSpace: 'nowrap' },
  blocos: { display: 'flex', flexDirection: 'column', gap: '0' },
  setorBloco: { paddingTop: '3px', paddingBottom: '3px' },
  setorHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  setorEsq: { display: 'flex', alignItems: 'center', gap: '9px' },
  bolinha: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  setorNome: { fontSize: '0.86rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  countBadge: { fontSize: '0.68rem', color: 'var(--texto-apagado)', background: 'var(--input)', border: '1px solid var(--borda)', padding: '1px 7px', borderRadius: '99px' },
  atividades: { display: 'flex', flexDirection: 'column', gap: '5px', marginLeft: '19px' },
  atividadeCard: { display: 'flex', alignItems: 'center', gap: '9px', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '9px', padding: '8px 12px' },
  atividadeIcone: { width: '26px', height: '26px', borderRadius: '6px', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  atividadeDesc: { fontSize: '0.82rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  respBadge: { fontSize: '0.71rem', color: 'var(--verde)', background: 'rgba(0,177,65,0.08)', border: '1px solid rgba(0,177,65,0.2)', padding: '2px 9px', borderRadius: '99px', whiteSpace: 'nowrap' },
  acoes: { display: 'flex', gap: '6px', opacity: 0, transition: 'opacity .15s' },
  btnAcao: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', fontSize: '0.72rem', cursor: 'pointer', padding: '3px 9px', fontFamily: 'Inter, sans-serif' },
  vazio: { fontSize: '0.78rem', color: 'var(--texto-apagado)', padding: '8px 0', fontFamily: 'Inter, sans-serif' },
  vazioGlobal: { color: 'var(--texto-apagado)', textAlign: 'center', marginTop: '32px' },
  divisor: { border: 'none', borderTop: '1px solid var(--borda)', margin: '12px 0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9980, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' },
  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  modalTitulo: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer', flexShrink: 0 },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' },
  modalRodape: { display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--borda)' },
  campo: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Inter, sans-serif' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' },
  btnCancelar: { background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnSalvar: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px' },
}
