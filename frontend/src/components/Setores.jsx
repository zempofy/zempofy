import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from './Toast'
import { useAuth } from '../contexts/AuthContext'

const CORES = [
  '#2DAA59', '#378ADD', '#EF9F27', '#7F77DD',
  '#D85A30', '#1D9E75', '#D4537E', '#888780'
]

function ModalSetor({ setor, fechar, onSalvo, funcionarios = [], somenteMembros = false }) {
  const [nome, setNome] = useState(setor?.nome || '')
  const [cor, setCor] = useState(setor?.cor || '#2DAA59')
  const [responsavel, setResponsavel] = useState(setor?.responsavel?._id || setor?.responsavel || '')
  const [membrosSelecionados, setMembrosSelecionados] = useState(setor?.membros?.map(m => m._id || m) || [])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const { mostrar } = useToast()

  const toggleMembro = (id) => {
    setMembrosSelecionados(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  // O responsável precisa ter acesso à Demanda desse setor — se ele ainda não é membro,
  // marca automaticamente (o backend garante isso de qualquer forma, isso é só pra não
  // mostrar o checkbox desmarcado enquanto salva).
  const escolherResponsavel = (id) => {
    setResponsavel(id)
    if (id && !membrosSelecionados.includes(id)) setMembrosSelecionados(prev => [...prev, id])
  }

  const salvar = async () => {
    if (!somenteMembros && !nome.trim()) return setErro('Nome é obrigatório.')
    setCarregando(true); setErro('')
    try {
      if (somenteMembros) {
        // Responsável do setor só pode mexer em membros — nunca nome/cor/responsável — por
        // isso usa a rota granular (adiciona/remove um por vez) em vez do PUT completo.
        const membrosAntigos = (setor?.membros || []).map(m => m._id || m)
        const adicionados = membrosSelecionados.filter(id => !membrosAntigos.includes(id))
        const removidos = membrosAntigos.filter(id => !membrosSelecionados.includes(id))
        await Promise.all([
          ...adicionados.map(usuarioId => api.patch(`/setores/${setor._id}/membros`, { usuarioId, acao: 'adicionar' })),
          ...removidos.map(usuarioId => api.patch(`/setores/${setor._id}/membros`, { usuarioId, acao: 'remover' })),
        ])
        mostrar('Membros atualizados!', 'sucesso')
      } else if (setor?._id) {
        await api.put(`/setores/${setor._id}`, { nome, cor, responsavel: responsavel || null, membros: membrosSelecionados })
        mostrar('Setor atualizado!', 'sucesso')
      } else {
        await api.post('/setores', { nome, cor, responsavel: responsavel || null, membros: membrosSelecionados })
        mostrar('Setor criado!', 'sucesso')
      }
      onSalvo()
      fechar()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar setor.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={s.overlay} onClick={fechar}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalTopo}>
          <span style={s.modalTitulo}>{somenteMembros ? `Membros — ${setor?.nome}` : (setor ? 'Editar setor' : 'Novo setor')}</span>
          <button style={s.btnX} onClick={fechar}>✕</button>
        </div>
        <div style={s.modalCorpo}>
          {erro && <p style={s.erro}>{erro}</p>}
          {!somenteMembros && (
            <div style={s.campo}>
              <label style={s.label}>Nome do setor</label>
              <input
                style={s.input}
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Legalização"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && salvar()}
              />
            </div>
          )}
          {!somenteMembros && (
            <div style={s.campo}>
              <label style={s.label}>Cor</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CORES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCor(c)}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: c, border: cor === c ? '3px solid var(--texto)' : '2px solid transparent',
                      cursor: 'pointer', padding: 0
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {!somenteMembros && funcionarios.length > 0 && (
            <div style={s.campo}>
              <label style={s.label}>Responsável</label>
              <select
                style={s.input}
                value={responsavel}
                onChange={e => escolherResponsavel(e.target.value)}
              >
                <option value="">Nenhum</option>
                {funcionarios.map(f => (
                  <option key={f._id} value={f._id}>{f.nome}</option>
                ))}
              </select>
              <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: 0, lineHeight: '1.4' }}>
                Só o titular e o responsável podem mudar a configuração da Demanda deste setor (ex: regime do Fiscal, situação do DP). Os outros membros continuam vendo e preenchendo normalmente.
              </p>
            </div>
          )}
          {funcionarios.length > 0 && (
            <div style={s.campo}>
              <label style={s.label}>Membros</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                {funcionarios.map(f => (
                  <label key={f._id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                    padding: '8px 10px', borderRadius: '8px',
                    background: membrosSelecionados.includes(f._id) ? 'rgba(34,197,94,0.08)' : 'var(--input)',
                    border: `1px solid ${membrosSelecionados.includes(f._id) ? '#22C55E44' : '#2A3830'}`
                  }}>
                    <input
                      type="checkbox"
                      checked={membrosSelecionados.includes(f._id)}
                      onChange={() => toggleMembro(f._id)}
                      style={{ accentColor: '#22C55E', width: '15px', height: '15px' }}
                    />
                    <span style={{ fontSize: '0.875rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif', flex: 1 }}>{f.nome}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)' }}>
                      {f.cargo === 'admin' ? 'Dono' : f.cargo === 'administrador' ? 'Administrador' : 'Colaborador'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
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

export default function Setores({ funcionarios = [], onSalvo: onSalvoExterno }) {
  const [setores, setSetores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [setorEditando, setSetorEditando] = useState(null)
  const [modoSomenteMembros, setModoSomenteMembros] = useState(false)
  const { mostrar } = useToast()
  const { usuario, temPermissao } = useAuth()

  const souGestor = usuario?.cargo === 'admin' || temPermissao('gerenciarSetores')
  const souResponsavelDe = (setor) => {
    const respId = setor.responsavel?._id || setor.responsavel
    return !!respId && respId === usuario?.id
  }

  const buscar = async () => {
    setCarregando(true)
    try {
      const res = await api.get('/setores')
      setSetores(res.data)
    } catch {
      mostrar('Erro ao carregar setores.', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  const inicializar = async () => {
    try {
      await api.post('/setores/inicializar')
      buscar()
    } catch {}
  }

  useEffect(() => { buscar() }, [])

  useEffect(() => {
    if (!carregando && setores.length === 0) inicializar()
  }, [carregando, setores.length])

  const excluir = async (id) => {
    if (!confirm('Remover este setor?')) return
    try {
      await api.delete(`/setores/${id}`)
      mostrar('Setor removido.', 'aviso')
      buscar()
    } catch {
      mostrar('Erro ao remover setor.', 'erro')
    }
  }

  const abrir = (setor = null, somenteMembros = false) => {
    setSetorEditando(setor)
    setModoSomenteMembros(somenteMembros)
    setModalAberto(true)
  }

  return (
    <div>
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Setores</h1>
          <p style={s.subtitulo}>{souGestor ? 'Gerencie os setores do seu escritório' : 'Setores em que você é responsável'}</p>
        </div>
        {souGestor && <button style={s.btnNovo} onClick={() => abrir()}>+ Novo setor</button>}
      </div>

      {carregando ? (
        <p style={s.vazio}>Carregando...</p>
      ) : (
        <div style={s.lista}>
          {setores.map(setor => {
            const souResponsavel = !souGestor && souResponsavelDe(setor)
            return (
              <div key={setor._id} style={s.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: setor.cor, flexShrink: 0 }} />
                  <span style={s.cardNome}>{setor.nome}</span>
                  {setor.padrao && <span style={s.badge}>padrão</span>}
                  {setor.responsavel?.nome && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--texto-apagado)' }}>
                      Responsável: {setor.responsavel.nome}
                    </span>
                  )}
                  {setor.membros?.length > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--texto-apagado)' }}>
                      {setor.membros.length} membro(s)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {souGestor && <button style={s.btnAcao} onClick={() => abrir(setor)}>Editar</button>}
                  {souGestor && <button style={{ ...s.btnAcao, color: '#FCA5A5' }} onClick={() => excluir(setor._id)}>Remover</button>}
                  {souResponsavel && <button style={s.btnAcao} onClick={() => abrir(setor, true)}>Gerenciar membros</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalAberto && (
        <ModalSetor
          setor={setorEditando}
          fechar={() => { setModalAberto(false); setSetorEditando(null); setModoSomenteMembros(false) }}
          onSalvo={() => { buscar(); onSalvoExterno && onSalvoExterno(); }}
          funcionarios={funcionarios}
          somenteMembros={modoSomenteMembros}
        />
      )}
    </div>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  titulo: { fontSize: '1.4rem', fontWeight: '700', color: 'var(--texto)', margin: 0 },
  subtitulo: { fontSize: '0.85rem', color: 'var(--texto-apagado)', marginTop: '4px' },
  btnNovo: { background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  card: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '12px', padding: '14px 18px', gap: '12px' },
  cardNome: { fontSize: '0.9rem', fontWeight: '500', color: 'var(--texto)' },
  badge: { fontSize: '0.65rem', fontWeight: '600', color: 'var(--verde)', background: 'rgba(34,197,94,0.1)', borderRadius: '99px', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  btnAcao: { background: 'none', border: '1px solid #2A3830', borderRadius: '8px', color: 'var(--texto-apagado)', fontSize: '0.8rem', cursor: 'pointer', padding: '6px 12px', fontFamily: 'Inter, sans-serif' },
  vazio: { color: 'var(--texto-apagado)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'var(--sidebar)', border: '1px solid #2A3830', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' },
  modalTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #2A3830' },
  modalTitulo: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  btnX: { background: 'none', border: '1px solid #2A3830', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' },
  modalCorpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalRodape: { display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #2A3830' },
  campo: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Inter, sans-serif' },
  input: { background: 'var(--input)', border: '1px solid #2A3830', borderRadius: '10px', padding: '10px 14px', color: 'var(--texto)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box', colorScheme: 'dark' },
  btnCancelar: { background: 'none', border: '1px solid #2A3830', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnSalvar: { background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px' },
}
