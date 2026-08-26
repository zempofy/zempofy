import { useState, useEffect, useRef } from 'react'
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

const FUSOS_BRASIL = [
  { valor: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
  { valor: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
  { valor: 'America/Manaus', label: 'Manaus, Cuiabá (UTC-4)' },
  { valor: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
]

// ── Botão de tema: quadrado compacto, sol↔lua animado. Estado vem do valor real do tema
// (nunca de :focus — senão a animação desfaz sozinha ao perder o foco, sem refletir o tema real).
function BotaoTema({ tema, setTema }) {
  const escuro = tema === 'escuro'
  return (
    <button
      type="button"
      onClick={() => setTema(escuro ? 'claro' : 'escuro')}
      aria-label={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={escuro ? 'Tema escuro' : 'Tema claro'}
      style={s.botaoTema}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
        <g style={{
          transformOrigin: '12px 12px',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          opacity: escuro ? 0 : 1,
          transform: escuro ? 'scale(0.3)' : 'scale(1)',
        }}>
          <line x1="12" y1="0.5" x2="12" y2="3.5" stroke="var(--texto)" strokeWidth="2" strokeLinecap="round" />
          <line x1="22.5" y1="6" x2="19.8" y2="8" stroke="var(--texto)" strokeWidth="2" strokeLinecap="round" />
          <line x1="1.5" y1="6" x2="4.2" y2="8" stroke="var(--texto)" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx="12" cy="12" r="6.5" fill="var(--texto)" />
        <circle
          cx="16.5" cy="7.5" r="6.5"
          fill="var(--card)"
          style={{
            transformOrigin: '16.5px 7.5px',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
            opacity: escuro ? 1 : 0,
            transform: escuro ? 'translate(0, 0)' : 'translate(3px, -3px)',
          }}
        />
      </svg>
    </button>
  )
}

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

function CategoriaAcessoSenha({ usuario }) {
  const [aba, setAba] = useState(null)
  const [form, setForm] = useState({ novoEmail: '', novaSenha: '', confirmar: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  const resetar = () => { setErro(''); setSucesso(''); setForm({ novoEmail: '', novaSenha: '', confirmar: '' }) }
  const trocarAba = (novaAba) => { resetar(); setAba(novaAba) }

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

// ── Categoria Geral: foto, nome, dados do escritório, fuso, aparência e o toggle de atribuição ──
function CategoriaGeral({ usuario, isTitular, tema, setTema, fonte, setFonte, onPerfilAtualizado }) {
  const { mostrar } = useToast()
  const fileInputRef = useRef(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)

  const [nomeUsuario, setNomeUsuario] = useState(usuario?.nome || '')
  const [salvandoNome, setSalvandoNome] = useState(false)

  const [empresa, setEmpresa] = useState(null)
  const [nomeEscritorio, setNomeEscritorio] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [fusoHorario, setFusoHorario] = useState('America/Sao_Paulo')
  const [salvandoEscritorio, setSalvandoEscritorio] = useState(false)

  const [podeAtribuir, setPodeAtribuir] = useState(true)
  const [salvandoToggle, setSalvandoToggle] = useState(false)

  useEffect(() => {
    api.get('/empresa').then(r => {
      setEmpresa(r.data)
      setNomeEscritorio(r.data.nome || '')
      setCnpj(r.data.cnpj || '')
      setFusoHorario(r.data.fusoHorario || 'America/Sao_Paulo')
      setPodeAtribuir(r.data.colaboradoresPodeAtribuirTitular ?? true)
    }).catch(() => {})
  }, [])

  useEffect(() => { setNomeUsuario(usuario?.nome || '') }, [usuario?.nome])

  const escolherFoto = () => fileInputRef.current?.click()

  const onArquivoFoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return mostrar('Escolha um arquivo de imagem.', 'erro')
    if (file.size > 1.5 * 1024 * 1024) return mostrar('Imagem muito grande. Máximo 1,5 MB.', 'erro')
    setEnviandoFoto(true)
    try {
      const foto = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await api.put('/usuarios/minha-foto', { foto })
      mostrar('Foto atualizada!', 'sucesso')
      onPerfilAtualizado()
    } catch { mostrar('Erro ao enviar foto.', 'erro') }
    finally { setEnviandoFoto(false) }
  }

  const salvarNomeUsuario = async () => {
    if (!nomeUsuario.trim()) return mostrar('Digite seu nome.', 'aviso')
    setSalvandoNome(true)
    try {
      await api.put('/usuarios/meu-perfil', { nome: nomeUsuario.trim() })
      mostrar('Nome atualizado!', 'sucesso')
      onPerfilAtualizado()
    } catch (err) { mostrar(err.response?.data?.erro || 'Erro ao salvar nome.', 'erro') }
    finally { setSalvandoNome(false) }
  }

  const salvarEscritorio = async () => {
    if (!nomeEscritorio.trim()) return mostrar('Nome do escritório é obrigatório.', 'aviso')
    setSalvandoEscritorio(true)
    try {
      const res = await api.put('/empresa', { nome: nomeEscritorio.trim(), cnpj: cnpj.trim() })
      setEmpresa(res.data)
      mostrar('Dados do escritório atualizados!', 'sucesso')
    } catch (err) { mostrar(err.response?.data?.erro || 'Erro ao salvar.', 'erro') }
    finally { setSalvandoEscritorio(false) }
  }

  const salvarFuso = async (valor) => {
    const anterior = fusoHorario
    setFusoHorario(valor)
    try {
      await api.put('/empresa', { fusoHorario: valor })
      mostrar('Fuso horário atualizado!', 'sucesso')
    } catch { mostrar('Erro ao salvar fuso horário.', 'erro'); setFusoHorario(anterior) }
  }

  const salvarPodeAtribuir = async (valor) => {
    setPodeAtribuir(valor)
    setSalvandoToggle(true)
    try {
      await api.put('/empresa', { colaboradoresPodeAtribuirTitular: valor })
      mostrar(valor ? 'Colaboradores podem te atribuir tarefas.' : 'Colaboradores não podem mais te atribuir tarefas.', 'sucesso')
    } catch { mostrar('Erro ao salvar configuração.', 'erro') }
    finally { setSalvandoToggle(false) }
  }

  const nomeUsuarioMudou = !!nomeUsuario.trim() && nomeUsuario.trim() !== usuario?.nome
  const escritorioMudou = !!empresa && (nomeEscritorio.trim() !== (empresa.nome || '') || cnpj.trim() !== (empresa.cnpj || ''))
  const camposDesabilitados = !isTitular ? { opacity: 0.6, cursor: 'not-allowed' } : {}

  return (
    <div>
      <h2 style={s.categoriaTitulo}>Geral</h2>

      {/* Foto */}
      <div style={s.secao}>
        <p style={s.secaoTitulo}>Foto</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Avatar nome={usuario?.nome} foto={usuario?.avatar} size={52} fontSize={20} />
          <div>
            <button style={s.btnAddMembro} onClick={escolherFoto} disabled={enviandoFoto}>
              {enviandoFoto ? 'Enviando...' : 'Trocar foto'}
            </button>
            <p style={s.hint}>JPG ou PNG, até 1,5 MB.</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onArquivoFoto} />
        </div>
      </div>

      {/* Nome do usuário */}
      <div style={s.campo}>
        <label style={s.label}>Seu nome</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input style={{ ...s.input, flex: 1 }} value={nomeUsuario} onChange={e => setNomeUsuario(e.target.value)} placeholder="Seu nome completo" />
          {nomeUsuarioMudou && (
            <button style={s.btnMini} onClick={salvarNomeUsuario} disabled={salvandoNome}>{salvandoNome ? 'Salvando...' : 'Salvar'}</button>
          )}
        </div>
      </div>

      {/* Nome do escritório + CNPJ */}
      <div style={s.secao}>
        <p style={s.secaoTitulo}>Escritório</p>
        <div style={s.campo}>
          <label style={s.label}>Nome do escritório</label>
          <input style={{ ...s.input, ...camposDesabilitados }} value={nomeEscritorio} onChange={e => setNomeEscritorio(e.target.value)} disabled={!isTitular} />
        </div>
        <div style={s.campo}>
          <label style={s.label}>CNPJ</label>
          <input style={{ ...s.input, ...camposDesabilitados }} value={cnpj} onChange={e => setCnpj(e.target.value)} disabled={!isTitular} placeholder="00.000.000/0000-00" />
        </div>
        {!isTitular && <p style={s.hint}>Só o titular pode alterar os dados do escritório.</p>}
        {isTitular && escritorioMudou && (
          <button style={s.btnMini} onClick={salvarEscritorio} disabled={salvandoEscritorio}>{salvandoEscritorio ? 'Salvando...' : 'Salvar'}</button>
        )}
      </div>

      {/* Fuso horário */}
      <div style={s.campo}>
        <label style={s.label}>Fuso horário</label>
        <select style={{ ...s.input, ...camposDesabilitados }} value={fusoHorario} disabled={!isTitular} onChange={e => salvarFuso(e.target.value)}>
          {FUSOS_BRASIL.map(f => <option key={f.valor} value={f.valor}>{f.label}</option>)}
        </select>
        <p style={s.hint}>Usado para calcular o horário de envio dos e-mails automáticos (ex: resumo periódico).</p>
      </div>

      {/* Tema */}
      <div style={s.secao}>
        <p style={s.secaoTitulo}>Tema</p>
        <BotaoTema tema={tema} setTema={setTema} />
      </div>

      {/* Tamanho da fonte */}
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

      {/* Toggle: colaboradores podem atribuir tarefa ao titular */}
      {isTitular && (
        <div style={s.toggleRow}>
          <div>
            <p style={s.toggleLabel}>Colaboradores podem me atribuir tarefas</p>
            <p style={s.toggleDesc}>Quando ativo, seu nome aparece na lista de responsáveis ao criar uma tarefa</p>
          </div>
          <button
            style={{ ...s.toggle, ...(podeAtribuir ? s.toggleAtivo : {}) }}
            onClick={() => salvarPodeAtribuir(!podeAtribuir)}
            disabled={salvandoToggle}
          >
            <div style={{ ...s.toggleBola, ...(podeAtribuir ? s.toggleBolaAtiva : {}) }} />
          </button>
        </div>
      )}
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
  const isTitular = usuario?.cargo === 'admin'
  const souGestorSetores = isTitular || temPermissao('gerenciarSetores')
  const acessaSetores = souGestorSetores || !!usuario?.souResponsavelDeSetor

  const podeModelos = isTitular || temPermissao('gerenciarModelos')
  const podeBanco = isTitular || temPermissao('gerenciarBancoAtividades')
  const podeColaboradores = isTitular || temPermissao('gerenciarEquipe') || temPermissao('gerenciarMembros')

  const gruposCategorias = [
    { grupo: 'Escritório', itens: [
      { id: 'geral', label: 'Geral', icone: <Icone.Settings size={15} /> },
      ...(acessaSetores ? [{ id: 'setores', label: 'Setores', icone: <Icone.UsersThree size={15} /> }] : []),
      ...(podeColaboradores ? [{ id: 'colaboradores', label: 'Colaboradores', icone: <Icone.Users size={15} /> }] : []),
    ]},
    { grupo: 'Onboarding', itens: [
      ...(podeModelos ? [{ id: 'modelos', label: 'Modelos', icone: <Icone.ClipboardList size={15} /> }] : []),
      ...(podeBanco ? [{ id: 'banco', label: 'Banco de atividades', icone: <Icone.Edit size={15} /> }] : []),
      ...(isTitular ? [{ id: 'alertas', label: 'Alertas', icone: <Icone.AlertTriangle size={15} /> }] : []),
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

  return (
    <Modal onFechar={fechar} maxWidth="920px">
      <div style={{ colorScheme: tema === 'claro' ? 'light' : 'dark' }}>
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
          {categoria === 'modelos' && podeModelos && <ModelosOnboarding />}

          {categoria === 'geral' && (
            <CategoriaGeral usuario={usuario} isTitular={isTitular} tema={tema} setTema={setTema} fonte={fonte} setFonte={setFonte} onPerfilAtualizado={recarregarUsuario} />
          )}

          {categoria === 'setores' && acessaSetores && <CategoriaSetores souGestor={souGestorSetores} />}
          {categoria === 'banco' && podeBanco && <BancoAtividades />}
          {categoria === 'alertas' && isTitular && <ConfigAlertas />}
          {categoria === 'colaboradores' && podeColaboradores && (
            <PaginaEquipe usuario={usuario} recarregar={() => window.dispatchEvent(new CustomEvent('zempofy:equipe-atualizada'))} />
          )}
          {categoria === 'acesso-senha' && <CategoriaAcessoSenha usuario={usuario} />}
          {categoria === 'plano' && isTitular && <CategoriaMeuPlano />}
          {categoria === 'suporte' && <CategoriaSuporte />}
        </div>
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
  botaoTema: { width: '50px', height: '50px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
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
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '9px', padding: '8px 12px', color: 'var(--texto)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' },
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
