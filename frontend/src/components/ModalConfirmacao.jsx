import Modal from './Modal'

const IconeLixo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)
const IconeAlerta = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

export default function ModalConfirmacao({ titulo, mensagem, textoBotao = 'Confirmar', perigo = false, onConfirmar, onCancelar }) {
  return (
    <Modal onFechar={onCancelar} maxWidth="380px">
      <div style={styles.conteudo}>
        <div style={{ ...styles.icone, color: perigo ? '#EF4444' : '#F59E0B', background: perigo ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)' }}>
          {perigo ? <IconeLixo /> : <IconeAlerta />}
        </div>
        <h3 style={styles.titulo}>{titulo}</h3>
        <p style={styles.mensagem}>{mensagem}</p>
        <div style={styles.botoes}>
          <button style={styles.btnCancelar} onClick={onCancelar}>Cancelar</button>
          <button
            style={{ ...styles.btnConfirmar, ...(perigo ? styles.btnPerigo : styles.btnVerde) }}
            onClick={onConfirmar}
          >
            {textoBotao}
          </button>
        </div>
      </div>
    </Modal>
  )
}

const styles = {
  conteudo: {
    background: 'var(--sidebar)',
    border: '1px solid var(--borda)',
    borderRadius: '20px',
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'center',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  },
  icone: { width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' },
  titulo: { fontFamily: 'var(--fonte-corpo)', fontWeight: '700', fontSize: '1.1rem', color: 'var(--texto)', margin: 0 },
  mensagem: { color: 'var(--texto-apagado)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 8px' },
  botoes: { display: 'flex', gap: '10px', width: '100%', marginTop: '4px' },
  btnCancelar: { flex: 1, padding: '10px', borderRadius: '10px', background: 'none', border: '1px solid var(--borda)', color: 'var(--texto-apagado)', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', fontWeight: '500' },
  btnConfirmar: { flex: 1, padding: '10px', borderRadius: '10px', border: 'none', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', color: '#fff' },
  btnVerde: { background: 'linear-gradient(135deg, #22C55E, #1A6B3C)' },
  btnPerigo: { background: 'linear-gradient(135deg, #EF4444, #991B1B)' },
}
