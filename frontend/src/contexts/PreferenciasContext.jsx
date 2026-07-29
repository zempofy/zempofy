import { createContext, useContext, useState, useEffect } from 'react'

const PreferenciasContext = createContext(null)

export function PreferenciasProvider({ children }) {
  const [tema, setTema] = useState(() => localStorage.getItem('zmp_tema') || 'escuro')
  const [fonte, setFonte] = useState(() => Number(localStorage.getItem('zmp_fonte') || 1))

  const tamanhosFonte = {
    0: '13px',
    1: '15px',
    2: '17px',
  }

  useEffect(() => {
    localStorage.setItem('zmp_tema', tema)
    localStorage.setItem('zmp_fonte', fonte)

    // Aplica tema via data-tema no html — CSS variables cuidam do resto
    document.documentElement.setAttribute('data-tema', tema)

    // Aplica tamanho de fonte
    document.documentElement.style.fontSize = tamanhosFonte[fonte]
    document.body.style.fontSize = tamanhosFonte[fonte]

  }, [tema, fonte])

  // Aplica na montagem inicial também
  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema)
    document.documentElement.style.fontSize = tamanhosFonte[fonte]
  }, [])

  return (
    <PreferenciasContext.Provider value={{ tema, setTema, fonte, setFonte }}>
      {children}
    </PreferenciasContext.Provider>
  )
}

export const usePreferencias = () => useContext(PreferenciasContext)
