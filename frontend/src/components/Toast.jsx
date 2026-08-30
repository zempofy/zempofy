import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

const IconeCheck = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconeX = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconeAviso = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const mostrar = useCallback((mensagem, tipo = 'sucesso') => {
    const id = Date.now()
    setToasts(t => [...t, { id, mensagem, tipo }])
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id))
    }, 3500)
  }, [])

  const remover = (id) => setToasts(t => t.filter(x => x.id !== id))

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      {createPortal(
        <div style={s.container}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              style={{ ...s.toast, ...(toast.tipo === 'erro' ? s.toastErro : toast.tipo === 'aviso' ? s.toastAviso : s.toastSucesso) }}
              className="fade-in"
            >
              <span style={{
                ...s.icone,
                background: toast.tipo === 'erro' ? 'rgba(239,68,68,0.2)' : toast.tipo === 'aviso' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                color: toast.tipo === 'erro' ? '#EF4444' : toast.tipo === 'aviso' ? '#F59E0B' : 'var(--verde)',
              }}>
                {toast.tipo === 'erro' ? <IconeX /> : toast.tipo === 'aviso' ? <IconeAviso /> : <IconeCheck />}
              </span>
              <span style={s.mensagem}>{toast.mensagem}</span>
              <button style={s.fechar} onClick={() => remover(toast.id)}>✕</button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

const s = {
  container: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    minWidth: '260px',
    maxWidth: '360px',
    pointerEvents: 'all',
    backdropFilter: 'blur(10px)',
  },
  toastSucesso: {
    background: 'rgba(17,23,20,0.97)',
    border: '1px solid rgba(34,197,94,0.4)',
  },
  toastErro: {
    background: 'rgba(17,23,20,0.97)',
    border: '1px solid rgba(239,68,68,0.4)',
  },
  toastAviso: {
    background: 'rgba(17,23,20,0.97)',
    border: '1px solid rgba(245,158,11,0.4)',
  },
  icone: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '700',
    flexShrink: 0,
  },
  mensagem: {
    flex: 1,
    fontSize: '0.875rem',
    color: 'var(--texto)',
    fontFamily: 'var(--fonte-corpo)',
    lineHeight: '1.4',
  },
  fechar: {
    background: 'none',
    border: 'none',
    color: 'var(--texto-apagado)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '2px',
    flexShrink: 0,
  },
}
