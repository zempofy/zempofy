import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
let promessaScript = null

function carregarScript() {
  if (window.turnstile) return Promise.resolve()
  if (!promessaScript) {
    promessaScript = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  return promessaScript
}

// Widget do Cloudflare Turnstile (modo "Managed"). Some (retorna null) se
// VITE_TURNSTILE_SITE_KEY não estiver configurada — mesma lógica de transição
// usada no backend, pra não travar cadastro/recuperação antes da chave existir.
const Turnstile = forwardRef(function Turnstile({ onVerify, onExpire }, ref) {
  const containerRef = useRef(null)
  const widgetId = useRef(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.reset(widgetId.current)
      }
    },
  }))

  useEffect(() => {
    if (!siteKey) return
    let cancelado = false

    carregarScript().then(() => {
      if (cancelado || !containerRef.current || !window.turnstile) return
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token) => onVerify?.(token),
        'expired-callback': () => onExpire?.(),
        'error-callback': () => onExpire?.(),
      })
    })

    return () => {
      cancelado = true
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [siteKey])

  if (!siteKey) return null

  return <div ref={containerRef} style={{ margin: '4px 0' }} />
})

export default Turnstile
