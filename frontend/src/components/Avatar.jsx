// Avatar com cor padrão do sistema
export default function Avatar({ nome = '', foto = '', size = 36, fontSize = 14 }) {
  const inicial = nome.charAt(0).toUpperCase()

  if (foto) {
    return (
      <img
        src={foto}
        alt={nome}
        style={{
          width: size, height: size, minWidth: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid rgba(255,255,255,0.1)',
        }}
      />
    )
  }

  return (
    <div style={{
      width: size, height: size, minWidth: size,
      background: 'linear-gradient(135deg, #22C55E, #1A6B3C)',
      borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--fonte-corpo)', fontWeight: '700',
      fontSize, color: '#fff',
      flexShrink: 0,
    }}>
      {inicial}
    </div>
  )
}
