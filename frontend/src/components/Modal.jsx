import { createPortal } from 'react-dom'

export default function Modal({ children, onFechar, maxWidth = '440px' }) {
  const conteudo = (
    <>
      <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9000 }} />
      <div style={{
        position: 'fixed',
        top: 0, bottom: 0,
        left: 'var(--sidebar-largura, 0px)',
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9001,
        pointerEvents: 'none',
        paddingTop: '52px',
      }}>
        <div
          className="fade-in"
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth,
            maxHeight: 'calc(100vh - 52px - 32px)',
            overflowY: 'auto',
            background: '#111714',
            border: '1px solid #2A3830',
            borderRadius: '20px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            pointerEvents: 'all',
            margin: '0 16px',
          }}
        >
          {children}
        </div>
      </div>
    </>
  )

  return createPortal(conteudo, document.body)
}
