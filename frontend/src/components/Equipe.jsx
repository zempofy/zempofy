import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import { useToast } from './Toast'
import Icone from './Icones'
import Avatar from './Avatar'
import ModalConfirmacao from './ModalConfirmacao'

const PERMISSOES_LABELS = [
  { key: 'gerenciarEquipe', label: 'Gerenciar equipe', desc: 'Acesso à gestão de membros e setores', subpermissoes: [
    { key: 'gerenciarMembros', label: 'Convidar e remover membros', desc: 'Adicionar e remover colaboradores' },
    { key: 'gerenciarSetores', label: 'Gerenciar setores', desc: 'Criar e editar setores' },
  ]},
  { key: 'gerenciarOnboarding', label: 'Gerenciar onboarding', desc: 'Acesso aos onboardings e modelos', subpermissoes: [
    { key: 'criarImplantacoes', label: 'Criar implantações', desc: 'Iniciar onboarding de novos clientes' },
    { key: 'gerenciarModelos', label: 'Gerenciar modelos', desc: 'Criar e editar modelos de onboarding' },
    { key: 'gerenciarBancoAtividades', label: 'Banco de atividades', desc: 'Gerenciar atividades do checklist' },
  ]},
  { key: 'gerenciarClientes', label: 'Gerenciar clientes', desc: 'Ver e editar a carteira de clientes' },
  { key: 'publicarMural', label: 'Publicar no mural', desc: 'Postar avisos para a equipe' },
  { key: 'criarTarefas', label: 'Criar tarefas para outros', desc: 'Atribuir tarefas a outros colaboradores' },
]

export const PERMISSOES_VAZIAS = {
  gerenciarEquipe: false, gerenciarMembros: false, gerenciarSetores: false,
  gerenciarOnboarding: false,
  criarImplantacoes: false, gerenciarModelos: false, gerenciarBancoAtividades: false,
  gerenciarClientes: false, publicarMural: false, criarTarefas: false,
}

function CheckItem({ ativo, label, desc, onClick, sub = false, somenteLeitura = false }) {
  return (
    <div onClick={somenteLeitura ? undefined : onClick} style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: sub ? '8px 12px 8px 28px' : '10px 12px',
      borderRadius: '8px', cursor: somenteLeitura ? 'default' : 'pointer',
      background: ativo ? 'rgba(0,177,65,0.08)' : sub ? 'rgba(var(--sobreposicao-rgb),0.02)' : 'transparent',
      border: ativo ? '1px solid rgba(0,177,65,0.2)' : '1px solid var(--borda)',
      transition: 'all 0.15s',
    }}>
      <div style={{
        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
        border: ativo ? '2px solid var(--verde)' : '2px solid var(--scrollbar-thumb)',
        background: ativo ? 'var(--verde)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
      }}>
        {ativo && <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="1.5 5 4 7.5 8.5 2.5"/></svg>}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: sub ? '0.82rem' : '0.875rem', fontWeight: '500', color: sub ? 'var(--texto-apagado)' : 'var(--texto)', fontFamily: 'Inter, sans-serif' }}>{label}</p>
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--texto-apagado)' }}>{desc}</p>
      </div>
    </div>
  )
}

export function PainelPermissoes({ permissoes, onChange, somenteLeitura = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
      {PERMISSOES_LABELS.map(p => (
        <div key={p.key}>
          <div
            onClick={somenteLeitura ? undefined : () => {
              const novo = { ...permissoes, [p.key]: !permissoes[p.key] }
              if (p.subpermissoes) {
                if (!permissoes[p.key]) {
                  p.subpermissoes.forEach(s => { novo[s.key] = true })
                } else {
                  p.subpermissoes.forEach(s => { novo[s.key] = false })
                }
              }
              onChange(novo)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 12px', borderRadius: '8px', cursor: somenteLeitura ? 'default' : 'pointer',
              background: permissoes[p.key] ? 'rgba(0,177,65,0.08)' : 'transparent',
              border: permissoes[p.key] ? '1px solid rgba(0,177,65,0.2)' : '1px solid var(--borda)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
              border: permissoes[p.key] ? '2px solid var(--verde)' : '2px solid var(--scrollbar-thumb)',
              background: permissoes[p.key] ? 'var(--verde)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
            }}>
              {permissoes[p.key] && <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="1.5 5 4 7.5 8.5 2.5"/></svg>}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' }}>{p.label}</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--texto-apagado)' }}>{p.desc}</p>
            </div>
            {p.subpermissoes?.length > 0 && (
              <Icone.ChevronDown size={14} style={{
                color: 'var(--texto-apagado)', flexShrink: 0,
                transition: 'transform 0.2s',
                transform: permissoes[p.key] ? 'rotate(180deg)' : 'rotate(0deg)',
              }} />
            )}
          </div>

          {p.subpermissoes && permissoes[p.key] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', paddingLeft: '8px', borderLeft: '2px solid rgba(0,177,65,0.2)' }}>
              {p.subpermissoes.map(sub => (
                <CheckItem
                  key={sub.key}
                  ativo={!!permissoes[sub.key]}
                  label={sub.label}
                  desc={sub.desc}
                  sub
                  somenteLeitura={somenteLeitura}
                  onClick={e => { e.stopPropagation(); onChange({ ...permissoes, [sub.key]: !permissoes[sub.key] }) }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Uma linha da tabela — o menu "···" muda de opção conforme a seção (ativo/pendente/inativo).
// Hoisted de propósito, fora de PaginaEquipe: definir isso dentro do componente pai fazia a
// lista inteira desmontar/remontar a cada clique no "···" (uma função inline dentro do render vira
// um "componente" novo pro React a cada render), o que jogava o scroll da lista pro topo sempre
// que alguém abria o menu de uma linha lá embaixo.
function LinhaMembro({
  f, tipo, editandoPermId, menuPos, isTitular, usuarioId, permEdicao,
  onAbrirMenu, onAbrirPermissoes, onSetPermEdicao, onSalvarPermissoes, onCancelarPermissoes,
  onReenviarConvite, onReativar, onDesativarClick, onResetarSenhaClick, onExcluirClick,
}) {
  return (
    <div style={tipo === 'inativo' ? { opacity: 0.55 } : undefined}>
      <div style={s.linhaTabela}>
        <Avatar nome={f.nome} foto={f.avatar} size={34} fontSize={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={s.nomeFunc}>{f.nome}</p>
          <p style={s.emailFunc}>{f.email}</p>
          {f.setores?.length > 0 && (
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginTop:'4px' }}>
              {f.setores.map(setor => (
                <span key={setor._id||setor} style={{ fontSize:'0.6rem', fontWeight:'600', padding:'1px 7px', borderRadius:'4px', background:'var(--input)', color:'var(--texto-apagado)', border:'1px solid var(--borda)', display:'flex', alignItems:'center', gap:'4px' }}>
                  <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:setor.cor||'var(--verde)', flexShrink:0 }}/>
                  {setor.nome||setor}
                </span>
              ))}
            </div>
          )}
        </div>
        <span style={{ ...s.badgeCargo, color: 'var(--texto-apagado)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Icone.User size={12} /> {f.cargo === 'admin' ? 'Titular' : 'Colaborador'}
        </span>
        {/* Menu "..." — o titular não tem nenhuma ação disponível na própria linha */}
        {f.cargo !== 'admin' && (
        <div style={{ position: 'relative' }} data-membro-menu>
          <button style={s.btnMenu} onClick={(e) => onAbrirMenu(e, f._id)}>
            ···
          </button>
          {editandoPermId === f._id && menuPos && createPortal(
            // Portal pro body: um dropdown position:absolute dentro da linha ficava cortado pelo
            // overflow-y:auto do modal de Configurações quando a linha estava perto do rodapé —
            // fora da árvore do container com scroll, isso não acontece mais.
            <div data-membro-menu-portal style={{ position: 'fixed', right: menuPos.right, top: menuPos.top, bottom: menuPos.bottom, background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '9px', overflow: 'hidden', zIndex: 10000, minWidth: '120px', boxShadow: 'var(--sombra-elevada)' }}>
              {tipo !== 'inativo' && f.cargo !== 'admin' && (
                <button style={s.dropdownItem} onClick={() => onAbrirPermissoes(f)}>
                  Permissões
                </button>
              )}
              {tipo === 'pendente' && (
                <button style={s.dropdownItem} onClick={() => onReenviarConvite(f._id)}>
                  Reenviar convite
                </button>
              )}
              {tipo === 'ativo' && isTitular && f.cargo !== 'admin' && (
                <button style={s.dropdownItem} onClick={() => onResetarSenhaClick(f._id)}>
                  Resetar senha
                </button>
              )}
              {tipo === 'inativo' ? (
                <button style={s.dropdownItem} onClick={() => onReativar(f._id)}>
                  Reativar
                </button>
              ) : f._id !== usuarioId && f.cargo !== 'admin' && (
                <button
                  style={{ ...s.dropdownItem, color: '#f87171' }}
                  onClick={() => onDesativarClick(f._id)}
                >
                  Desativar
                </button>
              )}
              {tipo === 'inativo' && isTitular && (
                <button style={{ ...s.dropdownItem, color: '#f87171' }} onClick={() => onExcluirClick(f._id)}>
                  Excluir permanentemente
                </button>
              )}
            </div>, document.body
          )}
        </div>
        )}
      </div>
      {/* Painel de permissões expandido abaixo da linha */}
      {editandoPermId === 'perm_' + f._id && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--borda)', background: 'rgba(0,0,0,0.15)' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
            Permissões de {f.nome.split(' ')[0]}
          </p>
          {f._id === usuarioId ? (
            <>
              <p style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', margin: '0 0 12px', fontFamily: 'Inter, sans-serif' }}>
                Você não pode editar suas próprias permissões — só o titular pode alterar isso.
              </p>
              <PainelPermissoes permissoes={f.permissoes || PERMISSOES_VAZIAS} onChange={() => {}} somenteLeitura />
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button style={s.btnNeutro} onClick={onCancelarPermissoes}>
                  Fechar
                </button>
              </div>
            </>
          ) : (
            <>
              <PainelPermissoes permissoes={permEdicao} onChange={onSetPermEdicao} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button style={s.btnPrimario} onClick={() => onSalvarPermissoes(f._id)}>
                  Salvar
                </button>
                <button style={s.btnNeutro} onClick={onCancelarPermissoes}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SecaoEquipe({ titulo, lista, tipo, vazio, ...propsLinha }) {
  if (lista.length === 0 && !vazio) return null
  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 7px' }}>
        {titulo} {lista.length > 0 && `(${lista.length})`}
      </p>
      <div style={s.tabelaWrapper}>
        {lista.length === 0 ? (
          <p style={{ color: 'var(--texto-apagado)', padding: '14px' }}>{vazio}</p>
        ) : (
          lista.map((f) => <LinhaMembro key={f._id} f={f} tipo={tipo} {...propsLinha} />)
        )}
      </div>
    </div>
  )
}

// ── Equipe: convite por link, reset de senha (titular), ciclo de vida (ativos/pendentes/inativos) ──
// Usado tanto pelo titular quanto por colaborador com permissão gerenciarEquipe/gerenciarMembros —
// isTitular (calculado a partir de `usuario`) controla o que cada um pode fazer dentro da mesma tela.
export default function PaginaEquipe({ usuario, recarregar }) {
  const isTitular = usuario?.cargo === 'admin'
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '' })
  const [setoresIds, setSetoresIds] = useState([])
  const [permissoes, setPermissoes] = useState({ ...PERMISSOES_VAZIAS })
  const [setores, setSetores] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [equipe, setEquipe] = useState([])
  const [carregandoEquipe, setCarregandoEquipe] = useState(true)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [confirmandoResetId, setConfirmandoResetId] = useState(null)
  const [confirmandoExcluirId, setConfirmandoExcluirId] = useState(null)
  const [cienteExclusao, setCienteExclusao] = useState(false)
  const [editandoPermId, setEditandoPermId] = useState(null)
  const [menuPos, setMenuPos] = useState(null)
  const [permEdicao, setPermEdicao] = useState({})
  const [podeAtribuir, setPodeAtribuir] = useState(true)
  const { mostrar } = useToast()

  const carregarEquipe = async () => {
    setCarregandoEquipe(true)
    try {
      const r = await api.get('/usuarios?incluirInativos=true')
      setEquipe(r.data)
    } catch { mostrar('Erro ao carregar equipe.', 'erro') }
    finally { setCarregandoEquipe(false) }
  }

  useEffect(() => {
    api.get('/setores').then(r => setSetores(r.data)).catch(() => {})
    carregarEquipe()
    if (isTitular) {
      api.get('/empresa').then(r => setPodeAtribuir(r.data.colaboradoresPodeAtribuirTitular ?? true)).catch(() => {})
    }
  }, [])

  const toggleAtribuir = async (valor) => {
    setPodeAtribuir(valor)
    try {
      await api.put('/empresa', { colaboradoresPodeAtribuirTitular: valor })
      mostrar(valor ? 'Colaboradores podem te atribuir tarefas.' : 'Colaboradores não podem mais te atribuir tarefas.', 'sucesso')
    } catch { mostrar('Erro ao salvar configuração.', 'erro') }
  }

  const membroParaDesativar = equipe.find(f => f._id === confirmandoId)
  const membroParaExcluir = equipe.find(f => f._id === confirmandoExcluirId)

  const criar = async (e) => {
    e.preventDefault()
    if (setoresIds.length === 0) return setErro('Selecione pelo menos um setor.')
    setErro(''); setCarregando(true)
    try {
      const res = await api.post('/usuarios', { ...form, permissoes, setores: setoresIds })
      const uid = res.data?.id || res.data?._id
      if (uid) {
        await Promise.all(setoresIds.map(sid =>
          api.patch(`/setores/${sid}/membros`, { usuarioId: uid }).catch(() => {})
        ))
      }
      setForm({ nome: '', email: '' })
      setSetoresIds([])
      setPermissoes({ ...PERMISSOES_VAZIAS })
      setMostrarForm(false)
      carregarEquipe(); recarregar && recarregar()
      mostrar('Convite enviado! A pessoa vai receber um e-mail para definir a senha.')
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao convidar colaborador.')
    } finally { setCarregando(false) }
  }

  const desativar = async (id) => {
    try {
      await api.delete(`/usuarios/${id}`)
      carregarEquipe(); recarregar && recarregar(); setConfirmandoId(null)
      mostrar('Membro desativado.', 'aviso')
    } catch (err) { mostrar(err.response?.data?.erro || 'Erro ao desativar.', 'erro') }
  }

  const reativar = async (id) => {
    try {
      await api.put(`/usuarios/${id}/reativar`)
      carregarEquipe(); recarregar && recarregar()
      mostrar('Membro reativado!', 'sucesso')
    } catch (err) { mostrar(err.response?.data?.erro || 'Erro ao reativar.', 'erro') }
  }

  const resetarSenha = async (id) => {
    try {
      await api.post(`/usuarios/${id}/resetar-senha`)
      mostrar('E-mail de redefinição enviado.', 'sucesso')
    } catch (err) { mostrar(err.response?.data?.erro || 'Erro ao resetar senha.', 'erro') }
    finally { setConfirmandoResetId(null) }
  }

  const reenviarConvite = async (id) => {
    try {
      await api.post(`/usuarios/${id}/reenviar-convite`)
      mostrar('Convite reenviado!', 'sucesso')
    } catch (err) { mostrar(err.response?.data?.erro || 'Erro ao reenviar convite.', 'erro') }
  }

  const excluirPermanente = async (id) => {
    try {
      await api.delete(`/usuarios/${id}/permanente`)
      carregarEquipe(); recarregar && recarregar()
      mostrar('Membro excluído permanentemente.', 'aviso')
    } catch (err) { mostrar(err.response?.data?.erro || 'Erro ao excluir.', 'erro') }
    finally { setConfirmandoExcluirId(null); setCienteExclusao(false) }
  }

  const salvarPermissoes = async (id) => {
    try {
      await api.put(`/usuarios/${id}`, { permissoes: permEdicao })
      carregarEquipe(); recarregar && recarregar(); setEditandoPermId(null)
      mostrar('Permissões atualizadas!')
    } catch { mostrar('Erro ao salvar permissões.', 'erro') }
  }

  const ativos = equipe.filter(f => f.ativo && !f.convitePendente)
  const pendentes = equipe.filter(f => f.ativo && f.convitePendente)
  const inativos = equipe.filter(f => !f.ativo)

  // Fecha o menu "···" ao clicar fora dele — não fecha o painel de Permissões expandido,
  // que já tem seu próprio botão "Cancelar" (esse fica marcado com prefixo 'perm_').
  useEffect(() => {
    if (!editandoPermId || editandoPermId.startsWith('perm_')) return
    const aoClicarFora = (e) => {
      if (!e.target.closest('[data-membro-menu]') && !e.target.closest('[data-membro-menu-portal]')) setEditandoPermId(null)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [editandoPermId])

  const abrirMenu = (e, id) => {
    if (editandoPermId === id) { setEditandoPermId(null); return }
    // Decide abrir pra cima/baixo pelo espaço real na tela, não pela posição na lista —
    // um heurístico baseado só em idx/total abria pra cima até em listas com 1 item
    // (ex: "Convites pendentes" com só 1 pessoa), escondendo o menu atrás do cabeçalho.
    const rect = e.currentTarget.getBoundingClientRect()
    const espacoAbaixo = window.innerHeight - rect.bottom
    const right = window.innerWidth - rect.right
    setMenuPos(espacoAbaixo < 180
      ? { right, bottom: window.innerHeight - rect.top + 4 }
      : { right, top: rect.bottom + 4 })
    setEditandoPermId(id)
  }

  const abrirPermissoes = (f) => {
    setPermEdicao(f.permissoes || { ...PERMISSOES_VAZIAS })
    setEditandoPermId('perm_' + f._id)
  }

  const propsLinha = {
    editandoPermId, menuPos, isTitular, usuarioId: usuario?.id, permEdicao,
    onAbrirMenu: abrirMenu,
    onAbrirPermissoes: abrirPermissoes,
    onSetPermEdicao: setPermEdicao,
    onSalvarPermissoes: salvarPermissoes,
    onCancelarPermissoes: () => setEditandoPermId(null),
    onReenviarConvite: (id) => { reenviarConvite(id); setEditandoPermId(null) },
    onReativar: (id) => { reativar(id); setEditandoPermId(null) },
    onDesativarClick: (id) => { setConfirmandoId(id); setEditandoPermId(null) },
    onResetarSenhaClick: (id) => { setConfirmandoResetId(id); setEditandoPermId(null) },
    onExcluirClick: (id) => { setConfirmandoExcluirId(id); setEditandoPermId(null) },
  }

  return (
    <div>
      {confirmandoId && (
        <ModalConfirmacao
          titulo="Desativar membro"
          mensagem={`Tem certeza que deseja desativar ${membroParaDesativar?.nome}? O cadastro fica preservado e pode ser reativado depois.`}
          textoBotao="Desativar" perigo
          onConfirmar={() => desativar(confirmandoId)}
          onCancelar={() => setConfirmandoId(null)}
        />
      )}

      {confirmandoResetId && (
        <ModalConfirmacao
          titulo="Resetar senha"
          mensagem="A pessoa vai receber um e-mail para definir uma senha nova, e a senha atual dela deixa de funcionar assim que isso acontecer. Continuar?"
          textoBotao="Resetar senha" perigo
          onConfirmar={() => resetarSenha(confirmandoResetId)}
          onCancelar={() => setConfirmandoResetId(null)}
        />
      )}

      {confirmandoExcluirId && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => { setConfirmandoExcluirId(null); setCienteExclusao(false) }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '18px', width: '100%', maxWidth: '420px', margin: '0 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--borda)' }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--texto)', fontFamily: 'Inter, sans-serif' }}>Excluir membro</span>
              <button style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' }} onClick={() => { setConfirmandoExcluirId(null); setCienteExclusao(false) }}>✕</button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--texto)', margin: '0 0 12px', fontFamily: 'Inter, sans-serif' }}>Tem certeza que deseja excluir <strong>{membroParaExcluir?.nome}</strong> permanentemente?</p>
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                <p style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: '700', margin: '0 0 4px', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}><Icone.AlertTriangle size={14}/> Essa ação é permanente.</p>
                <p style={{ fontSize: '0.8rem', color: '#f87171', margin: 0, fontFamily: 'Inter, sans-serif', lineHeight: '1.4' }}>O registro deste membro será apagado e não há como desfazer.</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-apagado)', fontFamily: 'Inter, sans-serif' }}>
                <input type="checkbox" checked={cienteExclusao} onChange={e => setCienteExclusao(e.target.checked)} style={{ marginTop: '2px', accentColor: '#f87171', width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer' }} />
                Estou ciente de que essa exclusão é permanente e não pode ser desfeita.
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', padding: '16px 22px', borderTop: '1px solid var(--borda)', justifyContent: 'flex-end' }}>
              <button style={{ background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--texto-apagado)', padding: '9px 18px', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => { setConfirmandoExcluirId(null); setCienteExclusao(false) }}>Cancelar</button>
              <button
                style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', color: '#f87171', padding: '9px 18px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem', cursor: cienteExclusao ? 'pointer' : 'default', opacity: cienteExclusao ? 1 : 0.5 }}
                disabled={!cienteExclusao}
                onClick={() => excluirPermanente(confirmandoExcluirId)}
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Equipe</h1>
          <p style={s.subtitulo}>{equipe.length} pessoa(s) cadastrada(s)</p>
        </div>
        <button style={s.btnPrimario} onClick={() => { setMostrarForm(!mostrarForm); setErro('') }}>
          {mostrarForm ? '✕ Cancelar' : '+ Novo membro'}
        </button>
      </div>

      {/* Toggle — colaboradores podem atribuir tarefas ao titular */}
      {isTitular && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '11px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <p style={{ fontSize: '0.82rem', fontWeight: '500', color: 'var(--texto)', margin: 0, fontFamily: 'Inter, sans-serif' }}>Colaboradores podem me atribuir tarefas</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', margin: '2px 0 0', fontFamily: 'Inter, sans-serif' }}>Permite que a equipe crie tarefas com você como responsável</p>
          </div>
          <div
            onClick={() => toggleAtribuir(!podeAtribuir)}
            style={{
              width: '38px', height: '21px', borderRadius: '99px', cursor: 'pointer',
              background: podeAtribuir ? 'var(--verde)' : 'rgba(var(--sobreposicao-rgb),0.1)',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: '3px',
              left: podeAtribuir ? '20px' : '3px',
              width: '15px', height: '15px', borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      )}

      {mostrarForm && (
        <div style={s.formulario}>
          <h3 style={{ color: 'var(--texto)', marginBottom: '12px', fontSize: '0.92rem', fontFamily: 'Inter, sans-serif' }}>Convidar colaborador</h3>
          <p style={{ fontSize: '0.76rem', color: 'var(--texto-apagado)', margin: '-6px 0 12px', fontFamily: 'Inter, sans-serif' }}>A pessoa recebe um e-mail com um link pra definir a própria senha.</p>
          {erro && <div style={s.erro}>{erro}</div>}
          <form onSubmit={criar} style={s.formGrid}>
            <div style={s.campo}>
              <label style={s.label}>Nome</label>
              <input style={s.input} placeholder="Nome completo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div style={s.campo}>
              <label style={s.label}>E-mail</label>
              <input style={s.input} type="email" placeholder="email@empresa.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div style={{ ...s.campo, gridColumn: '1 / -1' }}>
              <label style={s.label}>Setores <span style={{ color: '#f87171', marginLeft: '2px' }}>*</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {setores.map(st => {
                  const ativo = setoresIds.includes(st._id)
                  return (
                    <button key={st._id} type="button" onClick={() => {
                      setSetoresIds(prev => ativo ? prev.filter(id => id !== st._id) : [...prev, st._id])
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '99px', cursor: 'pointer',
                      fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', fontWeight: '500',
                      border: ativo ? `2px solid ${st.cor}` : '1px solid var(--borda)',
                      background: ativo ? `${st.cor}22` : 'transparent',
                      color: ativo ? st.cor : 'var(--texto-apagado)',
                      transition: 'all 0.15s'
                    }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: st.cor }} />
                      {st.nome}
                    </button>
                  )
                })}
              </div>
              {setoresIds.length === 0 && <p style={{ fontSize: '0.75rem', color: '#f87171', margin: '4px 0 0' }}>Selecione pelo menos um setor</p>}
            </div>
            <button type="submit" style={s.btnPrimario} disabled={carregando}>
              {carregando ? 'Enviando convite...' : 'Enviar convite'}
            </button>
          </form>
          <div style={{ marginTop: '20px' }}>
            <label style={s.label}>Permissões de acesso</label>
            <PainelPermissoes permissoes={permissoes} onChange={setPermissoes} />
          </div>
        </div>
      )}

      {carregandoEquipe ? (
        <p style={{ color: 'var(--texto-apagado)', padding: '20px' }}>Carregando equipe...</p>
      ) : (
        <>
          <SecaoEquipe titulo="Ativos" lista={ativos} tipo="ativo" vazio="Nenhum membro ativo ainda." {...propsLinha} />
          <SecaoEquipe titulo="Convites pendentes" lista={pendentes} tipo="pendente" {...propsLinha} />
          <SecaoEquipe titulo="Inativos" lista={inativos} tipo="inativo" {...propsLinha} />
        </>
      )}
    </div>
  )
}

const s = {
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' },
  titulo: { fontSize: '1.05rem', color: 'var(--texto)', marginBottom: '3px', letterSpacing: '-0.02em', fontWeight: '700' },
  subtitulo: { color: 'var(--texto-apagado)', fontSize: '0.78rem' },
  formulario: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '13px', padding: '14px', marginBottom: '14px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', alignItems: 'end' },
  campo: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '0.66rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '9px', padding: '7px 11px', color: 'var(--texto)', fontSize: '0.83rem', width: '100%', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' },
  erro: { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '7px', padding: '8px 12px', color: '#f87171', fontSize: '0.8rem', marginBottom: '10px' },
  btnPrimario: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '9px', padding: '7px 15px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnNeutro: { background: 'none', border: '1px solid var(--borda)', borderRadius: '7px', padding: '5px 10px', color: 'var(--texto-apagado)', fontSize: '0.76rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  tabelaWrapper: { background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '13px', overflow: 'hidden' },
  linhaTabela: { display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 13px', borderBottom: '1px solid var(--borda)' },
  nomeFunc: { fontSize: '0.83rem', fontWeight: '600', color: 'var(--texto)', letterSpacing: '-0.01em', margin: 0 },
  emailFunc: { fontSize: '0.74rem', color: 'var(--texto-apagado)', margin: 0 },
  badgeCargo: { fontSize: '0.66rem', color: 'var(--texto-apagado)', background: 'var(--input)', borderRadius: '6px', padding: '2px 8px', whiteSpace: 'nowrap', border: '1px solid var(--borda)' },
  btnMenu: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '7px', padding: '4px 8px', color: 'var(--texto-apagado)', fontSize: '0.9rem', cursor: 'pointer', letterSpacing: '2px', lineHeight: 1 },
  dropdownMenu: { position: 'absolute', right: 0, top: '32px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '9px', overflow: 'hidden', zIndex: 10, minWidth: '120px', boxShadow: 'var(--sombra-elevada)' },
  dropdownItem: { display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', color: 'var(--texto)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', transition: 'background 0.1s' },
}
