import { useState } from 'react'
import { createPortal } from 'react-dom'

const OPCOES_RAPIDAS = [
  { label: '5 minutos antes', minutos: 5 },
  { label: '15 minutos antes', minutos: 15 },
  { label: '30 minutos antes', minutos: 30 },
  { label: '1 hora antes', minutos: 60 },
  { label: '1 dia antes', minutos: 1440 },
]

function calcularHoraLembrete(dataStr, horaStr, minutosAntes) {
  if (!dataStr || !horaStr) return null
  const [ano, mes, dia] = dataStr.split('-').map(Number)
  const [h, m] = horaStr.split(':').map(Number)
  const dt = new Date(ano, mes - 1, dia, h, m)
  dt.setMinutes(dt.getMinutes() - minutosAntes)
  return dt
}

function formatarHoraLembrete(dt) {
  if (!dt) return ''
  const h = String(dt.getHours()).padStart(2, '0')
  const m = String(dt.getMinutes()).padStart(2, '0')
  const dia = String(dt.getDate()).padStart(2, '0')
  const mes = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes} às ${h}:${m}`
}

export default function ModalLembrete({ tarefa, onSalvar, onFechar }) {
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null) // minutos ou 'personalizado'
  const [dataPersonalizada, setDataPersonalizada] = useState(tarefa.data || '')
  const [horaPersonalizada, setHoraPersonalizada] = useState('')
  const [erro, setErro] = useState('')

  const temHorario = tarefa.data && tarefa.hora

  const validarPersonalizado = () => {
    if (!dataPersonalizada || !horaPersonalizada) {
      setErro('Preencha a data e hora do lembrete.')
      return false
    }

    const lembretedt = new Date(`${dataPersonalizada}T${horaPersonalizada}`)
    const tarefaDt = new Date(`${tarefa.data}T${tarefa.hora || '23:59'}`)

    if (lembretedt >= tarefaDt) {
      setErro('O lembrete precisa ser antes do horário da tarefa.')
      return false
    }

    const agora = new Date()
    if (lembretedt <= agora) {
      setErro('O lembrete precisa ser em um horário futuro.')
      return false
    }

    return true
  }

  const salvar = () => {
    setErro('')

    if (opcaoSelecionada === null) {
      setErro('Selecione uma opção de lembrete.')
      return
    }

    if (opcaoSelecionada === 'personalizado') {
      if (!validarPersonalizado()) return
      onSalvar({
        tipo: 'personalizado',
        data: dataPersonalizada,
        hora: horaPersonalizada,
      })
    } else {
      if (!temHorario) {
        setErro('Esta tarefa não tem data e hora definidas para calcular o lembrete.')
        return
      }
      const dt = calcularHoraLembrete(tarefa.data, tarefa.hora, opcaoSelecionada)
      if (!dt || dt <= new Date()) {
        setErro('O horário calculado já passou. Escolha outra opção.')
        return
      }
      onSalvar({
        tipo: 'rapido',
        minutosAntes: opcaoSelecionada,
        data: dt.toISOString().split('T')[0],
        hora: `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
      })
    }
  }

  const modal = (
    <>
      <div className="modal-fundo" onClick={onFechar} />
      <div className="modal-janela fade-in">
        <div style={s.topo}>
          <div>
            <span style={s.titulo}>Definir lembrete</span>
            <p style={s.subtitulo}>{tarefa.descricao}</p>
          </div>
          <button style={s.btnX} onClick={onFechar}>✕</button>
        </div>

        <div style={s.corpo}>
          {!temHorario && (
            <div style={s.aviso}>
              ⚠️ Esta tarefa não tem horário definido. Apenas a opção personalizada estará disponível.
            </div>
          )}

          {/* Opções rápidas */}
          <div style={s.secaoTitulo}>Opções rápidas</div>
          <div style={s.opcoes}>
            {OPCOES_RAPIDAS.map(op => {
              const dt = temHorario ? calcularHoraLembrete(tarefa.data, tarefa.hora, op.minutos) : null
              const passado = dt && dt <= new Date()
              const desabilitado = !temHorario || passado

              return (
                <button
                  key={op.minutos}
                  style={{
                    ...s.opcao,
                    ...(opcaoSelecionada === op.minutos ? s.opcaoAtiva : {}),
                    ...(desabilitado ? s.opcaoDesabilitada : {}),
                  }}
                  onClick={() => !desabilitado && setOpcaoSelecionada(op.minutos)}
                  disabled={desabilitado}
                >
                  <span style={s.opcaoLabel}>{op.label}</span>
                  {dt && !passado && (
                    <span style={s.opcaoHora}>{formatarHoraLembrete(dt)}</span>
                  )}
                  {passado && <span style={s.opcaoPassado}>Já passou</span>}
                </button>
              )
            })}
          </div>

          {/* Personalizado */}
          <div style={s.secaoTitulo}>Hora personalizada</div>
          <button
            style={{ ...s.opcao, ...(opcaoSelecionada === 'personalizado' ? s.opcaoAtiva : {}) }}
            onClick={() => setOpcaoSelecionada('personalizado')}
          >
            <span style={s.opcaoLabel}>Escolher data e hora</span>
          </button>

          {opcaoSelecionada === 'personalizado' && (
            <div style={s.personalizado}>
              <div style={s.campo}>
                <label style={s.label}>Data do lembrete</label>
                <input
                  style={s.input}
                  type="date"
                  value={dataPersonalizada}
                  max={tarefa.data || undefined}
                  onChange={e => { setDataPersonalizada(e.target.value); setErro('') }}
                />
              </div>
              <div style={s.campo}>
                <label style={s.label}>Hora do lembrete</label>
                <input
                  style={s.input}
                  type="time"
                  value={horaPersonalizada}
                  onChange={e => { setHoraPersonalizada(e.target.value); setErro('') }}
                />
              </div>
              {tarefa.data && tarefa.hora && (
                <p style={s.dica}>
                  ⏰ A tarefa está marcada para {tarefa.data.split('-').reverse().join('/')} às {tarefa.hora}
                </p>
              )}
            </div>
          )}

          {erro && <p style={s.erro}>{erro}</p>}

          <div style={s.botoes}>
            <button style={s.btnCancelar} onClick={onFechar}>Cancelar</button>
            <button style={s.btnSalvar} onClick={salvar}>Salvar lembrete</button>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modal, document.getElementById('portal-root') || document.body)
}

const s = {
  fundo: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 },
  janela: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%', maxWidth: '420px',
    background: 'var(--sidebar)', border: '1px solid var(--borda)',
    borderRadius: '20px', zIndex: 1001,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden',
  },
  topo: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px', borderBottom: '1px solid var(--borda)',
  },
  titulo: { fontFamily: 'var(--fonte-corpo)', fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', display: 'block' },
  subtitulo: { fontSize: '0.8rem', color: 'var(--texto-apagado)', marginTop: '4px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer', flexShrink: 0 },
  corpo: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  aviso: { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '10px 14px', color: '#F59E0B', fontSize: '0.8rem' },
  secaoTitulo: { fontSize: '0.7rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '-4px' },
  opcoes: { display: 'flex', flexDirection: 'column', gap: '6px' },
  opcao: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', borderRadius: '10px',
    background: 'var(--input)', border: '1px solid var(--borda)',
    cursor: 'pointer', transition: 'all 0.15s', width: '100%',
    fontFamily: 'var(--fonte-corpo)',
  },
  opcaoAtiva: { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)' },
  opcaoDesabilitada: { opacity: 0.4, cursor: 'not-allowed' },
  opcaoLabel: { fontSize: '0.875rem', color: 'var(--texto)', fontWeight: '500' },
  opcaoHora: { fontSize: '0.75rem', color: 'var(--texto-apagado)' },
  opcaoPassado: { fontSize: '0.7rem', color: '#F59E0B' },
  personalizado: { display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--input-2)', borderRadius: '10px', padding: '14px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  input: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '8px 12px', color: 'var(--texto)', fontSize: '0.9rem', width: '100%', fontFamily: 'var(--fonte-corpo)' },
  dica: { fontSize: '0.75rem', color: 'var(--texto-apagado)', margin: 0 },
  erro: { color: '#FCA5A5', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px', margin: 0 },
  botoes: { display: 'flex', gap: '10px', marginTop: '4px' },
  btnCancelar: { flex: 1, padding: '10px', borderRadius: '10px', background: 'none', border: '1px solid var(--borda)', color: 'var(--texto-apagado)', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)' },
  btnSalvar: { flex: 1, padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg, #22C55E, #1A6B3C)', border: 'none', color: '#fff', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', fontWeight: '600' },
}
