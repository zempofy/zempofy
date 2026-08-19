import { useState, useEffect } from 'react'
import { usePreferencias } from '../contexts/PreferenciasContext'
import { useAuth } from '../contexts/AuthContext'
import Modal from './Modal'
import Avatar from './Avatar'
import Icone from './Icones'
import api from '../services/api'
import { useToast } from './Toast'
import { CONFIG_DEMANDA, normalizarNome } from './Clientes'
import ModelosOnboarding from './ModelosOnboarding'
import BancoAtividades from './BancoAtividades'
import ConfigAlertas from './ConfigAlertas'
import PaginaEquipe from './Equipe'

const CORES_SETOR = ['#2DAA59', '#378ADD', '#EF9F27', '#7F77DD', '#D85A30', '#1D9E75', '#D4537E', '#888780']

const IconeAparencia = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
)

// ── Categoria Setores: card de um setor na grade ──
function CardSetor({ setor, onClick }) {
  const temDemanda = !!CONFIG_DEMANDA[normalizarNome(setor.nome)]
  const membros = setor.membros || []
  return (
    <div style={s.cardSetor} onClick={onClick}>
      <div style={{ ...s.cardBarra, background: setor.cor }} />
      <div style={s.cardCorpo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ ...s.selo, background: setor.cor }}>{setor.nome.slice(0, 1).toUpperCase()}</div>
          <span style={s.cardNome}>{setor.nome}</span>
          {setor.padrao && (
            <span title="Criado automaticamente pelo sistema" style={s.iconeCadeado}>
              <Icone.Lock size={11} />
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px', minHeight: '18px' }}>
          {temDemanda && <span style={s.badgeDemanda}>Demanda</span>}
        </div>
        <p style={s.cardResponsavel}>Responsável: {setor.responsavel?.nome || '—'}</p>
        <div style={s.avataresRow}>
          {membros.length > 0 ? (
            <>
              {membros.slice(0, 5).map((m, i) => (
                <div key={m._id || m} style={{ ...s.avatarOverlap, zIndex: 5 - i, marginLeft: i === 0 ? 0 : '-8px' }}>
                  <Avatar nome={m.nome || ''} foto={m.avatar} size={24} fontSize={10} />
                </div>
              ))}
              {membros.length > 5 && <span style={s.maisMembros}>+{membros.length - 5}</span>}
            </>
          ) : (
            <span style={s.semMembros}>Nenhum membro ainda</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Categoria Setores: tela de detalhe (criar/editar) ──
function SetorDetalhe({ setor, funcionarios, souGestor, souResponsavelDeste, voltar, onSalvo }) {
  const [nome, setNome] = useState(setor?.nome || '')
  const [cor, setCor] = useState(setor?.cor || CORES_SETOR[0])
  const [responsavel, setResponsavel] = useState(setor?.responsavel?._id || setor?.responsavel || '')
  const [membrosSelecionados, setMembrosSelecionados] = useState((setor?.membros || []).map(m => m._id || m))
  const [adicionandoMembro, setAdicionandoMembro] = useState(false)
  const [novoMembroId, setNovoMembroId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const { mostrar } = useToast()

  const podeEditarTudo = souGestor
  const podeEditarMembros = souGestor || souResponsavelDeste

  // Prioriza os dados já populados no próprio setor (inclui gente desativada que ainda está na
  // lista de membros) — a lista de funcionarios só tem gente ativa, então cai pra ela só pra
  // achar quem acabou de ser adicionado agora (ainda não salvo).
  const membrosPopulados = new Map((setor?.membros || []).map(m => [m._id || m, m]))
  const membrosObjs = membrosSelecionados.map(id => membrosPopulados.get(id) || funcionarios.find(f => f._id === id)).filter(Boolean)
  const candidatos = funcionarios.filter(f => !membrosSelecionados.includes(f._id))

  const removerMembro = (id) => {
    setMembrosSelecionados(prev => prev.filter(m => m !== id))
    if (responsavel === id) setResponsavel('')
  }
  const adicionarMembro = () => {
    if (!novoMembroId) return
    setMembrosSelecionados(prev => [...prev, novoMembroId])
    setNovoMembroId(''); setAdicionandoMembro(false)
  }

  const salvar = async () => {
    if (podeEditarTudo && !nome.trim()) return setErro('Nome é obrigatório.')
    setErro(''); setSalvando(true)
    try {
      if (podeEditarTudo) {
        if (setor?._id) {
          await api.put(`/setores/${setor._id}`, { nome, cor, responsavel: responsavel || null, membros: membrosSelecionados })
          mostrar('Setor atualizado!', 'sucesso')
        } else {
          await api.post('/setores', { nome, cor, responsavel: responsavel || null, membros: membrosSelecionados })
          mostrar('Setor criado!', 'sucesso')
        }
      } else if (podeEditarMembros) {
        // Responsável (não-gestor) só pode mexer em membros — nunca nome/cor/responsável —
        // por isso usa a rota granular em vez do PUT completo.
        const membrosAntigos = (setor?.membros || []).map(m => m._id || m)
        const adicionados = membrosSelecionados.filter(id => !membrosAntigos.includes(id))
        const removidos = membrosAntigos.filter(id => !membrosSelecionados.includes(id))
        await Promise.all([
          ...adicionados.map(usuarioId => api.patch(`/setores/${setor._id}/membros`, { usuarioId, acao: 'adicionar' })),
          ...removidos.map(usuarioId => api.patch(`/setores/${setor._id}/membros`, { usuarioId, acao: 'remover' })),
        ])
        mostrar('Membros atualizados!', 'sucesso')
      }
      onSalvo()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <button onClick={voltar} style={s.btnVoltar}><Icone.ChevronLeft size={14} /> Voltar pra Setores</button>

      <div style={s.detalheHeader}>
        <div style={{ ...s.selo, width: '36px', height: '36px', fontSize: '0.95rem', background: cor }}>
          {(nome || '?').slice(0, 1).toUpperCase()}
        </div>
        <h2 style={s.detalheTitulo}>{setor ? (nome || setor.nome) : 'Novo setor'}</h2>
      </div>

      {erro && <p style={s.erro}>{erro}</p>}

      <div style={s.campo}>
        <label style={s.label}>Nome do setor</label>
        <input style={s.input} value={nome} onChange={e => setNome(e.target.value)} disabled={!podeEditarTudo} placeholder="Ex: Legalização" />
      </div>

      <div style={s.campo}>
        <label style={s.label}>Cor</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CORES_SETOR.map(c => (
            <button
              key={c}
              disabled={!podeEditarTudo}
              onClick={() => setCor(c)}
              style={{
                width: '28px', height: '28px', borderRadius: '50%', background: c,
                border: cor === c ? '3px solid var(--texto)' : '2px solid transparent',
                cursor: podeEditarTudo ? 'pointer' : 'default', padding: 0, opacity: podeEditarTudo ? 1 : 0.6,
              }}
            />
          ))}
        </div>
      </div>

      <div style={s.campo}>
        <label style={s.label}>Responsável</label>
        <select style={s.input} value={responsavel} onChange={e => setResponsavel(e.target.value)} disabled={!podeEditarTudo}>
          <option value="">Nenhum</option>
          {membrosObjs.map(f => <option key={f._id} value={f._id}>{f.nome}</option>)}
        </select>
        {podeEditarTudo && membrosObjs.length === 0 && (
          <p style={s.hint}>Adicione membros abaixo antes de escolher um responsável.</p>
        )}
      </div>

      <div style={s.campo}>
        <label style={s.label}>Membros</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {membrosObjs.length === 0 && <p style={s.hint}>Nenhum membro ainda.</p>}
          {membrosObjs.map(f => (
            <div key={f._id} style={s.membroLinha}>
              <Avatar nome={f.nome} foto={f.avatar} size={26} fontSize={11} />
              <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--texto)', fontFamily: 'Inter,sans-serif' }}>{f.nome}</span>
              {podeEditarMembros && (
                <button onClick={() => removerMembro(f._id)} style={s.btnRemoverMembro} title="Remover"><Icone.X size={12} /></button>
              )}
            </div>
          ))}
        </div>
        {podeEditarMembros && (
          adicionandoMembro ? (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <select style={{ ...s.input, flex: 1 }} value={novoMembroId} onChange={e => setNovoMembroId(e.target.value)} autoFocus>
                <option value="">Selecione...</option>
                {candidatos.map(f => <option key={f._id} value={f._id}>{f.nome}</option>)}
              </select>
              <button style={s.btnMini} onClick={adicionarMembro} disabled={!novoMembroId}>Adicionar</button>
              <button style={s.btnMiniCanc} onClick={() => { setAdicionandoMembro(false); setNovoMembroId('') }}>Cancelar</button>
            </div>
          ) : (
            <button style={s.btnAddMembro} onClick={() => setAdicionandoMembro(true)}>+ Adicionar membro</button>
          )
        )}
      </div>

      {(podeEditarTudo || podeEditarMembros) && (
        <button style={s.btnSalvar} onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      )}
    </div>
  )
}

// ── Categoria Setores: grade + roteamento pro detalhe ──
function CategoriaSetores({ souGestor }) {
  const { usuario } = useAuth()
  const [setores, setSetores] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [setorAberto, setSetorAberto] = useState(undefined) // undefined = grade; null = novo; objeto = editar
  const { mostrar } = useToast()

  const buscar = async () => {
    setCarregando(true)
    try {
      const [rSetores, rUsuarios] = await Promise.all([api.get('/setores'), api.get('/usuarios')])
      setSetores(rSetores.data)
      setFuncionarios(rUsuarios.data)
    } catch {
      mostrar('Erro ao carregar setores.', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { buscar() }, [])
  useEffect(() => {
    if (!carregando && setores.length === 0) api.post('/setores/inicializar').then(buscar).catch(() => {})
  }, [carregando, setores.length])

  const souResponsavelDe = (setor) => {
    const respId = setor?.responsavel?._id || setor?.responsavel
    return !!respId && respId === usuario?.id
  }

  if (setorAberto !== undefined) {
    return (
      <SetorDetalhe
        setor={setorAberto}
        funcionarios={funcionarios}
        souGestor={souGestor}
        souResponsavelDeste={setorAberto ? souResponsavelDe(setorAberto) : false}
        voltar={() => setSetorAberto(undefined)}
        onSalvo={() => { buscar(); setSetorAberto(undefined) }}
      />
    )
  }

  return (
    <div>
      <div style={s.categoriaHeader}>
        <h2 style={s.categoriaTitulo}>Setores</h2>
        {souGestor && <button style={s.btnNovo} onClick={() => setSetorAberto(null)}>+ Novo setor</button>}
      </div>
      {carregando ? (
        <p style={{ color: 'var(--texto-apagado)' }}>Carregando...</p>
      ) : (
        <div style={s.gridSetores}>
          {setores.map(setor => (
            <CardSetor
              key={setor._id}
              setor={setor}
              onClick={() => (souGestor || souResponsavelDe(setor)) && setSetorAberto(setor)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Categoria Acesso e senha ──
function InputSenha({ id, value, onChange, onKeyDown, placeholder, autoFocus }) {
  const [ver, setVer] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input id={id} style={{ ...s.input, paddingRight: '40px' }}
        type={ver ? 'text' : 'password'} placeholder={placeholder} value={value}
        onChange={onChange} onKeyDown={onKeyDown} autoFocus={autoFocus}
      />
      <button type="button" onClick={() => setVer(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-apagado)', display: 'flex', alignItems: 'center', padding: '2px' }}>
        {ver ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  )
}

function CategoriaAcessoSenha({ usuario, onNomeAtualizado }) {
  const [aba, setAba] = useState(null)
  const [form, setForm] = useState({ novoNome: '', novoEmail: '', novaSenha: '', confirmar: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  const resetar = () => { setErro(''); setSucesso(''); setForm({ novoNome: '', novoEmail: '', novaSenha: '', confirmar: '' }) }
  const trocarAba = (novaAba) => { resetar(); setAba(novaAba) }

  const salvarNome = async () => {
    if (!form.novoNome.trim()) return setErro('Digite o novo nome.')
    setCarregando(true); setErro('')
    try {
      await api.put('/usuarios/meu-perfil', { nome: form.novoNome.trim() })
      setSucesso('Nome atualizado!'); setAba(null)
      if (onNomeAtualizado) onNomeAtualizado()
    } catch (err) { setErro(err.response?.data?.erro || 'Erro ao atualizar nome.') }
    finally { setCarregando(false) }
  }

  const salvarEmail = async () => {
    if (!form.novoEmail) return setErro('Digite o novo e-mail.')
    setCarregando(true); setErro('')
    try {
      await api.put('/usuarios/meu-perfil', { email: form.novoEmail })
      setSucesso('E-mail atualizado!'); setAba(null)
    } catch (err) { setErro(err.response?.data?.erro || 'Erro ao atualizar e-mail.') }
    finally { setCarregando(false) }
  }

  const salvarSenha = async () => {
    if (!form.novaSenha) return setErro('Digite a nova senha.')
    if (form.novaSenha !== form.confirmar) return setErro('As senhas não coincidem.')
    if (form.novaSenha.length < 6) return setErro('Mínimo 6 caracteres.')
    setCarregando(true); setErro('')
    try {
      await api.put('/usuarios/minha-senha', { novaSenha: form.novaSenha })
      setSucesso('Senha atualizada!'); setAba(null)
    } catch (err) { setErro(err.response?.data?.erro || 'Erro ao atualizar senha.') }
    finally { setCarregando(false) }
  }

  return (
    <div>
      <h2 style={s.categoriaTitulo}>Acesso e senha</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
        <Avatar nome={usuario?.nome} foto={usuario?.avatar} size={38} fontSize={15} />
        <div>
          <p style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--texto)', margin: 0 }}>{usuario?.nome}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--texto-apagado)', margin: '2px 0 0' }}>{usuario?.cargo === 'admin' ? 'Titular' : 'Colaborador'}</p>
        </div>
      </div>

      {/* Nome */}
      <div style={s.campo}>
        <label style={s.label}>Nome</label>
        <div style={s.valorComAcao}>
          <span>{usuario?.nome}</span>
          <button style={s.btnAlterar} onClick={() => trocarAba(aba === 'nome' ? null : 'nome')}>{aba === 'nome' ? 'Cancelar' : 'Alterar'}</button>
        </div>
      </div>
      {aba === 'nome' && (
        <div style={s.subForm}>
          {erro && <p style={s.erro}>{erro}</p>}
          {sucesso && <p style={s.sucessoMsg}>{sucesso}</p>}
          <div style={s.campo}>
            <label style={s.label}>Novo nome</label>
            <input style={s.input} placeholder="Seu nome completo" value={form.novoNome} onChange={e => setForm({ ...form, novoNome: e.target.value })} autoFocus />
          </div>
          <button style={s.btnSalvar} onClick={salvarNome} disabled={carregando}>{carregando ? 'Salvando...' : 'Salvar nome'}</button>
        </div>
      )}

      {/* E-mail */}
      <div style={s.campo}>
        <label style={s.label}>E-mail</label>
        <div style={s.valorComAcao}>
          <span>{usuario?.email}</span>
          <button style={s.btnAlterar} onClick={() => trocarAba(aba === 'email' ? null : 'email')}>{aba === 'email' ? 'Cancelar' : 'Alterar'}</button>
        </div>
      </div>
      {aba === 'email' && (
        <div style={s.subForm}>
          {erro && <p style={s.erro}>{erro}</p>}
          {sucesso && <p style={s.sucessoMsg}>{sucesso}</p>}
          <div style={s.campo}>
            <label style={s.label}>Novo e-mail</label>
            <input style={s.input} type="email" placeholder="novo@email.com" value={form.novoEmail} onChange={e => setForm({ ...form, novoEmail: e.target.value })} />
          </div>
          <button style={s.btnSalvar} onClick={salvarEmail} disabled={carregando}>{carregando ? 'Salvando...' : 'Salvar e-mail'}</button>
        </div>
      )}

      {/* Senha */}
      <div style={s.campo}>
        <label style={s.label}>Senha</label>
        {aba !== 'senha' ? (
          <button onClick={() => trocarAba('senha')} style={{ ...s.valorComAcao, cursor: 'pointer', border: '1px solid var(--borda)', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ letterSpacing: '3px' }}>••••••••</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)' }}>Alterar senha</span>
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {erro && <p style={s.erro}>{erro}</p>}
            {sucesso && <p style={s.sucessoMsg}>{sucesso}</p>}
            <InputSenha id="input-nova-senha-modal" placeholder="Nova senha" value={form.novaSenha} autoFocus
              onChange={e => setForm({ ...form, novaSenha: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('input-confirmar-senha-modal')?.focus()} />
            <InputSenha id="input-confirmar-senha-modal" placeholder="Confirmar nova senha" value={form.confirmar}
              onChange={e => setForm({ ...form, confirmar: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && salvarSenha()} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ ...s.btnSalvar, flex: 1, marginTop: 0 }} onClick={salvarSenha} disabled={carregando}>{carregando ? 'Salvando...' : 'Salvar senha'}</button>
              <button style={s.btnMiniCanc} onClick={() => trocarAba(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {sucesso && aba === null && <p style={s.sucessoMsg}>{sucesso}</p>}
    </div>
  )
}

// ── Categoria Suporte ──
function CategoriaSuporte() {
  const { usuario } = useAuth()
  const { mostrar } = useToast()
  const [assunto, setAssunto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    if (!assunto.trim() || !descricao.trim()) return
    setEnviando(true)
    try {
      await api.post('/feedback', { assunto: assunto.trim(), mensagem: descricao.trim(), nome: usuario?.nome, email: usuario?.email, empresa: usuario?.empresa?.nome })
      mostrar('Mensagem enviada! Vamos responder por e-mail.', 'sucesso')
      setAssunto(''); setDescricao('')
    } catch { mostrar('Erro ao enviar mensagem.', 'erro') }
    finally { setEnviando(false) }
  }

  return (
    <div>
      <h2 style={s.categoriaTitulo}>Suporte</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--texto-apagado)', margin: '-7px 0 14px' }}>Encontrou um problema ou tem uma sugestão? Manda pra gente.</p>
      <div style={s.campo}>
        <label style={s.label}>Assunto</label>
        <input style={s.input} value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Resuma em poucas palavras" maxLength={120} />
      </div>
      <div style={s.campo}>
        <label style={s.label}>Descrição</label>
        <textarea style={{ ...s.input, minHeight: '84px', resize: 'vertical' }} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva o problema ou a sugestão..." />
      </div>
      <button style={{ ...s.btnSalvar, opacity: (assunto.trim() && descricao.trim()) ? 1 : 0.6 }} onClick={enviar} disabled={enviando || !assunto.trim() || !descricao.trim()}>
        {enviando ? 'Enviando...' : 'Enviar'}
      </button>
    </div>
  )
}

// ── Categoria Meu plano ──
function CategoriaMeuPlano() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px', gap: '12px', textAlign: 'center' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--input)', border: '1px solid var(--borda)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🚧</div>
      <div>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--texto)', margin: '0 0 6px', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Meu plano</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--texto-apagado)', maxWidth: '340px', lineHeight: '1.55', margin: 0, fontFamily: 'Inter, sans-serif' }}>
          O gerenciamento de planos e assinaturas estará disponível em breve. Por enquanto, entre em contato para mais informações.
        </p>
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--verde)', background: 'rgba(0,177,65,0.1)', border: '1px solid rgba(0,177,65,0.2)', borderRadius: '99px', padding: '3px 11px' }}>Em breve</span>
    </div>
  )
}

export default function ModalConfiguracoes({ fechar, categoriaInicial }) {
  const { tema, setTema, fonte, setFonte } = usePreferencias()
  const { usuario, temPermissao, recarregarUsuario } = useAuth()
  const { mostrar } = useToast()
  const isTitular = usuario?.cargo === 'admin'
  const souGestorSetores = isTitular || temPermissao('gerenciarSetores')
  const acessaSetores = souGestorSetores || !!usuario?.souResponsavelDeSetor
  const [podeAtribuir, setPodeAtribuir] = useState(true)
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  const podeModelos = isTitular || temPermissao('gerenciarModelos')
  const podeBanco = isTitular || temPermissao('gerenciarBancoAtividades')
  const podeColaboradores = isTitular || temPermissao('gerenciarEquipe') || temPermissao('gerenciarMembros')

  const gruposCategorias = [
    { grupo: null, itens: [
      ...(isTitular ? [{ id: 'geral', label: 'Geral', icone: <Icone.Settings size={15} /> }] : []),
      { id: 'aparencia', label: 'Aparência', icone: <IconeAparencia size={15} /> },
    ]},
    { grupo: 'Onboarding', itens: [
      ...(podeModelos ? [{ id: 'modelos', label: 'Modelos', icone: <Icone.ClipboardList size={15} /> }] : []),
      ...(podeBanco ? [{ id: 'banco', label: 'Banco de atividades', icone: <Icone.Edit size={15} /> }] : []),
      ...(isTitular ? [{ id: 'alertas', label: 'Alertas', icone: <Icone.AlertTriangle size={15} /> }] : []),
    ]},
    { grupo: 'Equipe', itens: [
      ...(acessaSetores ? [{ id: 'setores', label: 'Setores', icone: <Icone.UsersThree size={15} /> }] : []),
      ...(podeColaboradores ? [{ id: 'colaboradores', label: 'Colaboradores', icone: <Icone.Users size={15} /> }] : []),
    ]},
    { grupo: 'Conta', itens: [
      { id: 'acesso-senha', label: 'Acesso e senha', icone: <Icone.Lock size={15} /> },
      ...(isTitular ? [{ id: 'plano', label: 'Meu plano', icone: <Icone.CreditCard size={15} /> }] : []),
      { id: 'suporte', label: 'Suporte', icone: <Icone.MessageSquare size={15} /> },
    ]},
  ].filter(g => g.itens.length > 0)

  const categorias = gruposCategorias.flatMap(g => g.itens)
  const [categoria, setCategoria] = useState(
    categorias.find(c => c.id === categoriaInicial)?.id || categorias[0]?.id
  )

  useEffect(() => {
    if (!isTitular) return
    api.get('/empresa').then(r => {
      setPodeAtribuir(r.data.colaboradoresPodeAtribuirTitular ?? true)
    }).catch(() => {})
  }, [])

  const salvarPodeAtribuir = async (valor) => {
    setPodeAtribuir(valor)
    setSalvandoConfig(true)
    try {
      await api.put('/empresa', { colaboradoresPodeAtribuirTitular: valor })
      mostrar(valor ? 'Colaboradores podem te atribuir tarefas.' : 'Colaboradores não podem mais te atribuir tarefas.', 'sucesso')
    } catch {
      mostrar('Erro ao salvar configuração.', 'erro')
    } finally { setSalvandoConfig(false) }
  }

  return (
    <Modal onFechar={fechar} maxWidth="920px">
      <div style={s.topo}>
        <span style={s.titulo}>Configurações</span>
        <button style={s.btnX} onClick={fechar}>✕</button>
      </div>

      <div style={s.corpoGeral}>
        {/* Barra lateral de categorias */}
        <div style={s.sidebarCategorias}>
          {gruposCategorias.map((g, gi) => (
            <div key={g.grupo || 'raiz'}>
              {g.grupo && <p style={{ ...s.grupoTitulo, marginTop: gi > 0 ? '14px' : 0 }}>{g.grupo}</p>}
              {g.itens.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoria(cat.id)}
                  style={{ ...s.itemCategoria, ...(categoria === cat.id ? s.itemCategoriaAtivo : {}) }}
                >
                  <span style={{ display: 'flex', opacity: categoria === cat.id ? 1 : 0.7 }}>{cat.icone}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Conteúdo da categoria */}
        <div style={s.conteudoCategoria}>
          {categoria === 'geral' && isTitular && (
            <div>
              <h2 style={s.categoriaTitulo}>Geral</h2>
              <div style={s.toggleRow}>
                <div>
                  <p style={s.toggleLabel}>Colaboradores podem me atribuir tarefas</p>
                  <p style={s.toggleDesc}>Quando ativo, seu nome aparece na lista de responsáveis ao criar uma tarefa</p>
                </div>
                <button
                  style={{ ...s.toggle, ...(podeAtribuir ? s.toggleAtivo : {}) }}
                  onClick={() => salvarPodeAtribuir(!podeAtribuir)}
                  disabled={salvandoConfig}
                >
                  <div style={{ ...s.toggleBola, ...(podeAtribuir ? s.toggleBolaAtiva : {}) }} />
                </button>
              </div>
            </div>
          )}

          {categoria === 'aparencia' && (
            <div>
              <h2 style={s.categoriaTitulo}>Aparência</h2>
              <div style={s.secao}>
                <p style={s.secaoTitulo}>Tema</p>
                <div style={s.temaOpcoes}>
                  <button style={{ ...s.temaBotao, ...(tema === 'escuro' ? s.temaBotaoAtivo : {}) }} onClick={() => setTema('escuro')}>
                    <div style={s.temaPreview}>
                      <div style={{ ...s.temaPreviewSidebar, background: 'var(--sidebar)' }} />
                      <div style={{ ...s.temaPreviewConteudo, background: 'var(--fundo)' }}>
                        <div style={{ width: '60%', height: '6px', background: 'var(--borda)', borderRadius: '3px', marginBottom: '4px' }} />
                        <div style={{ width: '40%', height: '6px', background: 'var(--input)', borderRadius: '3px' }} />
                      </div>
                    </div>
                    <span style={s.temaLabel}>Escuro</span>
                    {tema === 'escuro' && <span style={s.temaCheck}>✓</span>}
                  </button>

                  <button style={{ ...s.temaBotao, ...(tema === 'claro' ? s.temaBotaoAtivo : {}) }} onClick={() => setTema('claro')}>
                    <div style={s.temaPreview}>
                      <div style={{ ...s.temaPreviewSidebar, background: '#ffffff' }} />
                      <div style={{ ...s.temaPreviewConteudo, background: '#F0FAF4' }}>
                        <div style={{ width: '60%', height: '6px', background: '#D1EAD9', borderRadius: '3px', marginBottom: '4px' }} />
                        <div style={{ width: '40%', height: '6px', background: '#EAF5EE', borderRadius: '3px' }} />
                      </div>
                    </div>
                    <span style={{ ...s.temaLabel, color: tema === 'claro' ? '#0F3D22' : undefined }}>Claro</span>
                    {tema === 'claro' && <span style={{ ...s.temaCheck, color: '#16A34A' }}>✓</span>}
                  </button>
                </div>
              </div>

              <div style={s.secao}>
                <p style={s.secaoTitulo}>Tamanho da fonte</p>
                <div style={s.sliderWrapper}>
                  <span style={s.sliderLabel}>A</span>
                  <div style={s.sliderTrack}>
                    <div style={s.sliderLinha} />
                    {[0, 1, 2].map(val => (
                      <button
                        key={val}
                        style={{
                          ...s.sliderPonto,
                          left: `${val * 50}%`,
                          background: fonte >= val ? 'var(--verde)' : 'var(--borda)',
                          transform: fonte === val ? 'translate(-50%, -50%) scale(1.4)' : 'translate(-50%, -50%) scale(1)',
                          border: fonte === val ? '2px solid #22C55E' : '2px solid var(--borda)',
                        }}
                        onClick={() => setFonte(val)}
                      />
                    ))}
                    <div style={{ ...s.sliderLinhaAtiva, width: `${fonte * 50}%` }} />
                  </div>
                  <span style={{ ...s.sliderLabel, fontSize: '1.3rem' }}>A</span>
                </div>
                <div style={s.sliderLabels}>
                  <span style={{ ...s.sliderOpcaoLabel, color: fonte === 0 ? 'var(--verde)' : 'var(--texto-apagado)' }}>Pequena</span>
                  <span style={{ ...s.sliderOpcaoLabel, color: fonte === 1 ? 'var(--verde)' : 'var(--texto-apagado)' }}>Padrão</span>
                  <span style={{ ...s.sliderOpcaoLabel, color: fonte === 2 ? 'var(--verde)' : 'var(--texto-apagado)' }}>Grande</span>
                </div>
                <div style={s.fontePreview}>
                  <p style={{ fontSize: fonte === 0 ? '0.875rem' : fonte === 1 ? '1rem' : '1.125rem', color: 'var(--texto)', margin: 0, transition: 'font-size 0.2s' }}>
                    Zempofy — Sistema de gestão de tarefas
                  </p>
                </div>
              </div>
            </div>
          )}

          {categoria === 'setores' && acessaSetores && <CategoriaSetores souGestor={souGestorSetores} />}
          {categoria === 'modelos' && podeModelos && <ModelosOnboarding />}
          {categoria === 'banco' && podeBanco && <BancoAtividades />}
          {categoria === 'alertas' && isTitular && <ConfigAlertas />}
          {categoria === 'colaboradores' && podeColaboradores && (
            <PaginaEquipe usuario={usuario} recarregar={() => window.dispatchEvent(new CustomEvent('zempofy:equipe-atualizada'))} />
          )}
          {categoria === 'acesso-senha' && <CategoriaAcessoSenha usuario={usuario} onNomeAtualizado={recarregarUsuario} />}
          {categoria === 'plano' && isTitular && <CategoriaMeuPlano />}
          {categoria === 'suporte' && <CategoriaSuporte />}
        </div>
      </div>
    </Modal>
  )
}

const s = {
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--borda)' },
  titulo: { fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '0.92rem', color: 'var(--texto)' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', cursor: 'pointer' },

  corpoGeral: { display: 'flex', height: '78vh' },
  sidebarCategorias: { width: '175px', flexShrink: 0, borderRight: '1px solid var(--borda)', padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: '1px', overflowY: 'auto' },
  itemCategoria: { display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '7px', background: 'none', border: 'none', borderLeft: '3px solid transparent', color: 'var(--texto-apagado)', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', width: '100%' },
  itemCategoriaAtivo: { borderLeft: '3px solid var(--verde)', background: 'rgba(0,177,65,0.08)', color: 'var(--texto)', fontWeight: '600', borderRadius: '0 7px 7px 0' },
  grupoTitulo: { fontSize: '0.6rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 10px 4px', fontFamily: 'Inter, sans-serif' },
  conteudoCategoria: { flex: 1, padding: '18px', overflowY: 'auto', minWidth: 0 },

  categoriaHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' },
  categoriaTitulo: { fontSize: '0.95rem', fontWeight: '700', color: 'var(--texto)', margin: '0 0 14px', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' },

  secao: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' },
  secaoTitulo: { fontSize: '0.66rem', fontWeight: '700', color: 'var(--verde)', textTransform: 'uppercase', letterSpacing: '1.2px', margin: 0 },
  temaOpcoes: { display: 'flex', gap: '10px' },
  temaBotao: { flex: 1, background: 'var(--input)', border: '2px solid var(--borda)', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'all 0.2s', position: 'relative' },
  temaBotaoAtivo: { borderColor: 'var(--verde)', background: 'rgba(34,197,94,0.08)' },
  temaPreview: { width: '100%', height: '48px', borderRadius: '6px', overflow: 'hidden', display: 'flex', border: '1px solid var(--borda)' },
  temaPreviewSidebar: { width: '25%' },
  temaPreviewConteudo: { flex: 1, padding: '7px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  temaLabel: { fontSize: '0.76rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' },
  temaCheck: { position: 'absolute', top: '7px', right: '7px', color: 'var(--verde)', fontSize: '11px', fontWeight: '700' },
  sliderWrapper: { display: 'flex', alignItems: 'center', gap: '10px' },
  sliderLabel: { fontSize: '0.82rem', fontWeight: '700', color: 'var(--texto-apagado)', fontFamily: 'Inter, sans-serif', flexShrink: 0 },
  sliderTrack: { flex: 1, position: 'relative', height: '18px', display: 'flex', alignItems: 'center' },
  sliderLinha: { position: 'absolute', left: 0, right: 0, height: '2px', background: 'var(--borda)', borderRadius: '2px' },
  sliderLinhaAtiva: { position: 'absolute', left: 0, height: '2px', background: 'var(--verde)', borderRadius: '2px', transition: 'width 0.2s' },
  sliderPonto: { position: 'absolute', width: '13px', height: '13px', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', zIndex: 1 },
  sliderLabels: { display: 'flex', justifyContent: 'space-between', marginTop: '-7px' },
  sliderOpcaoLabel: { fontSize: '0.68rem', fontFamily: 'Inter, sans-serif', transition: 'color 0.2s' },
  fontePreview: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '9px', padding: '11px 13px', marginTop: '3px' },
  toggleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '11px 13px' },
  toggleLabel: { fontSize: '0.82rem', fontWeight: '500', color: 'var(--texto)', margin: '0 0 3px', fontFamily: 'Inter, sans-serif' },
  toggleDesc: { fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: 0, lineHeight: '1.4', fontFamily: 'Inter, sans-serif' },
  toggle: { width: '38px', height: '21px', borderRadius: '99px', background: 'var(--borda)', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s', marginTop: '2px', padding: 0 },
  toggleAtivo: { background: 'var(--verde)' },
  toggleBola: { position: 'absolute', top: '3px', left: '3px', width: '15px', height: '15px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  toggleBolaAtiva: { left: '20px' },

  // ── Setores: grade ──
  btnNovo: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '9px', padding: '7px 14px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' },
  gridSetores: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '10px' },
  cardSetor: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.1s' },
  cardBarra: { height: '4px', width: '100%' },
  cardCorpo: { padding: '11px' },
  selo: { width: '23px', height: '23px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700', color: '#fff', flexShrink: 0, fontFamily: 'Inter, sans-serif' },
  cardNome: { fontSize: '0.83rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'Inter, sans-serif', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  iconeCadeado: { color: 'var(--texto-apagado)', display: 'flex', flexShrink: 0, cursor: 'help' },
  badgeDemanda: { fontSize: '0.6rem', fontWeight: '700', color: 'var(--verde)', background: 'rgba(0,177,65,0.1)', border: '1px solid rgba(0,177,65,0.2)', borderRadius: '99px', padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  cardResponsavel: { fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '0 0 8px', fontFamily: 'Inter, sans-serif' },
  avataresRow: { display: 'flex', alignItems: 'center', minHeight: '22px' },
  avatarOverlap: { border: '2px solid var(--card)', borderRadius: '50%' },
  maisMembros: { fontSize: '0.65rem', fontWeight: '600', color: 'var(--texto-apagado)', marginLeft: '6px' },
  semMembros: { fontSize: '0.7rem', color: 'var(--texto-apagado)', fontStyle: 'italic', fontFamily: 'Inter, sans-serif' },

  // ── Setores: detalhe ──
  btnVoltar: { background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontSize: '0.8rem', padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' },
  detalheHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' },
  detalheTitulo: { fontSize: '1rem', fontWeight: '700', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '13px' },
  label: { fontSize: '0.68rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Inter, sans-serif' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '9px', padding: '8px 12px', color: 'var(--texto)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box', colorScheme: 'dark' },
  hint: { fontSize: '0.7rem', color: 'var(--texto-apagado)', margin: 0, lineHeight: '1.4', fontFamily: 'Inter, sans-serif' },
  membroLinha: { display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 9px', borderRadius: '7px', background: 'var(--input)', border: '1px solid var(--borda)' },
  btnRemoverMembro: { background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', display: 'flex', padding: '4px' },
  btnAddMembro: { background: 'none', border: '1px dashed var(--borda)', borderRadius: '7px', color: 'var(--texto-apagado)', padding: '7px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', marginTop: '7px', width: '100%' },
  btnMini: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '7px', padding: '0 12px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' },
  btnMiniCanc: { background: 'none', border: '1px solid var(--borda)', borderRadius: '7px', color: 'var(--texto-apagado)', padding: '0 11px', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', cursor: 'pointer' },
  btnSalvar: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '9px', padding: '8px 16px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.84rem', cursor: 'pointer', marginTop: '4px' },
  erro: { color: '#FCA5A5', fontSize: '0.78rem', background: 'rgba(239,68,68,0.1)', padding: '7px 11px', borderRadius: '7px', marginBottom: '13px' },

  // ── Acesso e senha ──
  valorComAcao: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '9px', padding: '8px 12px', color: 'var(--texto)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' },
  btnAlterar: { background: 'none', border: 'none', color: 'var(--verde)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '500' },
  subForm: { background: 'var(--input-2)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '13px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '13px' },
  sucessoMsg: { color: 'var(--verde)', fontSize: '0.78rem', background: 'rgba(0,177,65,0.08)', padding: '7px 11px', borderRadius: '7px' },
}
