import { useState } from 'react'
import api from '../services/api'
import Modal from './Modal'
import Avatar from './Avatar'

const PERMISSOES_DISPONIVEIS = [
  {
    id: 'clientes',
    label: 'Clientes',
    descricao: 'Visualizar e gerenciar a carteira de clientes',
  },
  {
    id: 'implantacao',
    label: 'Implantação',
    descricao: 'Acompanhar e gerenciar processos de onboarding',
  },
  {
    id: 'modelos_onboarding',
    label: 'Modelos de Onboarding',
    descricao: 'Criar e editar modelos de onboarding reutilizáveis',
  },
  {
    id: 'checklist',
    label: 'Checklist',
    descricao: 'Gerenciar checklists de documentos e tarefas',
  },
  {
    id: 'setores',
    label: 'Setores',
    descricao: 'Visualizar e gerenciar setores da empresa',
  },
  {
    id: 'adicionar_colaboradores',
    label: 'Adicionar Colaboradores',
    descricao: 'Convidar novos colaboradores para a equipe',
  },
]

export default function ModalPermissoes({ colaborador, onFechar, onSalvo }) {
  const [permissoes, setPermissoes] = useState(colaborador.permissoes || [])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const togglePermissao = (id) => {
    setPermissoes(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const salvar = async () => {
    setSalvando(true)
    setErro('')
    try {
      await api.put(`/usuarios/${colaborador._id}/permissoes`, { permissoes })
      if (onSalvo) onSalvo()
      onFechar()
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar permissões.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal onFechar={onFechar} maxWidth="480px">
      <div style={s.topo}>
        <span style={s.titulo}>Permissões</span>
        <button style={s.btnX} onClick={onFechar}>✕</button>
      </div>

      <div style={s.colaboradorInfo}>
        <Avatar nome={colaborador.nome} foto={colaborador.avatar} size={36} fontSize={15} />
        <div>
          <p style={s.colaboradorNome}>{colaborador.nome}</p>
          <p style={s.colaboradorCargo}>Colaborador</p>
        </div>
      </div>

      <p style={s.descricao}>
        Selecione o que este colaborador pode acessar além do painel padrão.
      </p>

      <div style={s.lista}>
        {PERMISSOES_DISPONIVEIS.map(p => {
          const ativa = permissoes.includes(p.id)
          return (
            <button
              key={p.id}
              style={{ ...s.item, ...(ativa ? s.itemAtivo : {}) }}
              onClick={() => togglePermissao(p.id)}
            >
              <div style={s.itemTexto}>
                <span style={s.itemLabel}>{p.label}</span>
                <span style={s.itemDesc}>{p.descricao}</span>
              </div>
              <div style={{ ...s.toggle, ...(ativa ? s.toggleAtivo : {}) }}>
                <div style={{ ...s.toggleBolinha, ...(ativa ? s.toggleBolinhaAtiva : {}) }} />
              </div>
            </button>
          )
        })}
      </div>

      {erro && <p style={s.erro}>{erro}</p>}

      <div style={s.rodape}>
        <button style={s.btnCancelar} onClick={onFechar}>Cancelar</button>
        <button style={s.btnSalvar} onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar permissões'}
        </button>
      </div>
    </Modal>
  )
}

const s = {
  topo: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '20px',
  },
  titulo: {
    fontSize: '1rem', fontWeight: '700', color: 'var(--texto)',
    fontFamily: 'Inter, sans-serif',
  },
  btnX: {
    background: 'none', border: 'none', color: 'var(--texto-apagado)',
    fontSize: '1rem', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px',
  },
  colaboradorInfo: {
    display: 'flex', alignItems: 'center', gap: '12px',
    background: 'var(--input)', borderRadius: '12px', padding: '12px 16px',
    marginBottom: '16px',
  },
  colaboradorNome: {
    fontSize: '0.9rem', fontWeight: '600', color: 'var(--texto)',
    margin: 0, fontFamily: 'Inter, sans-serif',
  },
  colaboradorCargo: {
    fontSize: '0.75rem', color: 'var(--texto-apagado)',
    margin: '2px 0 0', fontFamily: 'Inter, sans-serif',
  },
  descricao: {
    fontSize: '0.82rem', color: 'var(--texto-apagado)',
    marginBottom: '16px', fontFamily: 'Inter, sans-serif', lineHeight: '1.5',
  },
  lista: {
    display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px',
  },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px', padding: '14px 16px',
    background: 'var(--input)', border: '1px solid var(--borda)',
    borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
    transition: 'border-color 0.15s, background 0.15s',
    fontFamily: 'Inter, sans-serif',
  },
  itemAtivo: {
    borderColor: 'rgba(0,177,65,0.4)',
    background: 'rgba(0,177,65,0.06)',
  },
  itemTexto: {
    display: 'flex', flexDirection: 'column', gap: '2px', flex: 1,
  },
  itemLabel: {
    fontSize: '0.875rem', fontWeight: '600', color: 'var(--texto)',
  },
  itemDesc: {
    fontSize: '0.75rem', color: 'var(--texto-apagado)',
  },
  toggle: {
    width: '36px', height: '20px', borderRadius: '99px',
    background: 'var(--borda)', position: 'relative',
    flexShrink: 0, transition: 'background 0.2s',
  },
  toggleAtivo: {
    background: 'var(--verde)',
  },
  toggleBolinha: {
    position: 'absolute', top: '3px', left: '3px',
    width: '14px', height: '14px', borderRadius: '50%',
    background: '#fff', transition: 'left 0.2s',
  },
  toggleBolinhaAtiva: {
    left: '19px',
  },
  erro: {
    fontSize: '0.8rem', color: '#f87171',
    background: 'rgba(248,113,113,0.08)', padding: '8px 12px',
    borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)',
    marginBottom: '16px', fontFamily: 'Inter, sans-serif',
  },
  rodape: {
    display: 'flex', justifyContent: 'flex-end', gap: '10px',
  },
  btnCancelar: {
    background: 'none', border: '1px solid var(--borda)',
    color: 'var(--texto-apagado)', borderRadius: '10px',
    padding: '10px 20px', fontFamily: 'Inter, sans-serif',
    fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer',
  },
  btnSalvar: {
    background: 'var(--gradiente-verde)', color: '#fff',
    border: 'none', borderRadius: '10px',
    padding: '10px 20px', fontFamily: 'Inter, sans-serif',
    fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,177,65,0.3)',
  },
}
