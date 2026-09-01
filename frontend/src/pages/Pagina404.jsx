import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Matter from 'matter-js'

const CORES = {
  fundo: '#09090b',
  card: '#18181b',
  borda: '#27272a',
  verde: '#00b141',
  texto: '#ffffff',
  textoMuted: '#a1a1aa',
  textoSutil: '#52525b',
  iconeCor: '#e4e4e7',
}

const ICONE_TIPOS = ['logo', 'busca', 'home', 'crm', 'onboarding', 'calendario', 'pasta', 'clientes', 'cadeado']

export default function Pagina404() {
  const canvasRef = useRef(null)
  const corposRef = useRef({ blocos: [], icones: [] })

  useEffect(() => {
    let cancelado = false
    let limpar = () => {}
    let frame

    // Logo após montar, window.innerWidth/innerHeight às vezes ainda reportam 0
    // (layout inicial não terminou), o que jogava todo o mundo físico pro canto
    // superior esquerdo. Espera frame a frame até a tela ter tamanho de verdade.
    function tentarIniciar() {
      if (cancelado) return
      if (!window.innerWidth || !window.innerHeight) {
        frame = requestAnimationFrame(tentarIniciar)
        return
      }

      const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint, Body, Events } = Matter

      const engine = Engine.create()
      engine.gravity.y = 0.6

      let largura = window.innerWidth
      let altura = window.innerHeight

      const render = Render.create({
        canvas: canvasRef.current,
        engine,
        options: {
          width: largura,
          height: altura,
          background: 'transparent',
          wireframes: false,
        },
      })

      const espessura = 80
      const chao = Bodies.rectangle(largura / 2, altura + espessura / 2, largura * 2, espessura, { isStatic: true, render: { visible: false } })
      const teto = Bodies.rectangle(largura / 2, -espessura / 2, largura * 2, espessura, { isStatic: true, render: { visible: false } })
      const paredeEsq = Bodies.rectangle(-espessura / 2, altura / 2, espessura, altura * 2, { isStatic: true, render: { visible: false } })
      const paredeDir = Bodies.rectangle(largura + espessura / 2, altura / 2, espessura, altura * 2, { isStatic: true, render: { visible: false } })
      Composite.add(engine.world, [chao, teto, paredeEsq, paredeDir])

      const lado = 120
      const digitos = ['4', '0', '4']
      const blocos = digitos.map((d, i) => {
        const x = largura / 2 + (i - 1) * 190 + (Math.random() * 40 - 20)
        const y = altura * 0.4 + i * 20
        const corpo = Bodies.rectangle(x, y, lado, lado, {
          angle: (Math.random() - 0.5) * 0.6,
          restitution: 0.4,
          friction: 0.5,
          chamfer: { radius: 22 },
          render: { visible: false },
        })
        corpo.digito = d
        corpo.accent = i === 1
        corpo.lado = lado
        return corpo
      })
      Composite.add(engine.world, blocos)

      const icones = []
      for (let n = 0; n < 3; n++) {
        ICONE_TIPOS.forEach((tipo) => {
          const s = 46
          const x = 60 + Math.random() * (largura - 120)
          const y = 60 + Math.random() * (altura - 120)
          const corpo = Bodies.rectangle(x, y, s, s, {
            angle: (Math.random() - 0.5) * 0.8,
            restitution: 0.5,
            friction: 0.3,
            chamfer: { radius: 12 },
            render: { visible: false },
          })
          corpo.lado = s
          corpo.icone = tipo
          icones.push(corpo)
        })
      }
      Composite.add(engine.world, icones)

      corposRef.current = { blocos, icones }

      const mouse = Mouse.create(render.canvas)
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.2, render: { visible: false } },
      })
      Composite.add(engine.world, mouseConstraint)
      render.mouse = mouse

      function desenharIcone(ctx, corpo) {
        const s = corpo.lado
        const e = s / 38
        ctx.save()
        ctx.translate(corpo.position.x, corpo.position.y)
        ctx.rotate(corpo.angle)
        ctx.beginPath()
        ctx.roundRect(-s / 2, -s / 2, s, s, 11)
        ctx.fillStyle = CORES.card
        ctx.fill()
        ctx.strokeStyle = CORES.borda
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.strokeStyle = CORES.iconeCor
        ctx.fillStyle = CORES.iconeCor
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        if (corpo.icone === 'logo') {
          ctx.font = `700 ${16 * e}px Plus Jakarta Sans, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = CORES.verde
          ctx.fillText('Z', 0.5, 1)
        } else if (corpo.icone === 'home') {
          ctx.beginPath()
          ctx.moveTo(-7 * e, -1 * e)
          ctx.lineTo(0, -7 * e)
          ctx.lineTo(7 * e, -1 * e)
          ctx.stroke()
          ctx.strokeRect(-5 * e, -1 * e, 10 * e, 8 * e)
          ctx.beginPath()
          ctx.moveTo(-1.3 * e, 7 * e)
          ctx.lineTo(-1.3 * e, 2 * e)
          ctx.lineTo(1.3 * e, 2 * e)
          ctx.lineTo(1.3 * e, 7 * e)
          ctx.stroke()
        } else if (corpo.icone === 'busca') {
          ctx.beginPath()
          ctx.arc(-1 * e, -1 * e, 5.5 * e, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(3 * e, 3 * e)
          ctx.lineTo(7.5 * e, 7.5 * e)
          ctx.stroke()
        } else if (corpo.icone === 'onboarding') {
          ctx.beginPath()
          ctx.moveTo(-5.5 * e, -6.5 * e)
          ctx.lineTo(1 * e, 0)
          ctx.lineTo(-5.5 * e, 6.5 * e)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(0, -6.5 * e)
          ctx.lineTo(6.5 * e, 0)
          ctx.lineTo(0, 6.5 * e)
          ctx.stroke()
        } else if (corpo.icone === 'crm') {
          ctx.beginPath()
          ctx.arc(0, 0, 6.5 * e, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(0, 0, 3.5 * e, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(0, 0, 1 * e, 0, Math.PI * 2)
          ctx.fill()
        } else if (corpo.icone === 'calendario') {
          ctx.beginPath()
          ctx.roundRect(-6.5 * e, -5.5 * e, 13 * e, 12 * e, 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(-6.5 * e, -1.5 * e)
          ctx.lineTo(6.5 * e, -1.5 * e)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(-3.5 * e, -8 * e)
          ctx.lineTo(-3.5 * e, -3.5 * e)
          ctx.moveTo(3.5 * e, -8 * e)
          ctx.lineTo(3.5 * e, -3.5 * e)
          ctx.stroke()
        } else if (corpo.icone === 'pasta') {
          ctx.beginPath()
          ctx.moveTo(-6.5 * e, -2.5 * e)
          ctx.lineTo(-2.5 * e, -2.5 * e)
          ctx.lineTo(-1 * e, -4.5 * e)
          ctx.lineTo(6.5 * e, -4.5 * e)
          ctx.lineTo(6.5 * e, 5.5 * e)
          ctx.lineTo(-6.5 * e, 5.5 * e)
          ctx.closePath()
          ctx.stroke()
        } else if (corpo.icone === 'clientes') {
          ctx.beginPath()
          ctx.arc(0, -3.5 * e, 2.8 * e, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(0, 4.5 * e, 6.5 * e, Math.PI, Math.PI * 2)
          ctx.stroke()
        } else if (corpo.icone === 'cadeado') {
          ctx.beginPath()
          ctx.arc(0, -2.5 * e, 3.5 * e, Math.PI, 0, false)
          ctx.stroke()
          ctx.beginPath()
          ctx.roundRect(-4.5 * e, 0, 9 * e, 7 * e, 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(0, 3.5 * e, 1 * e, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      function desenharBloco(ctx, corpo) {
        const s = corpo.lado
        ctx.save()
        ctx.translate(corpo.position.x, corpo.position.y)
        ctx.rotate(corpo.angle)
        ctx.beginPath()
        ctx.roundRect(-s / 2, -s / 2, s, s, 22)
        if (corpo.accent) {
          ctx.fillStyle = CORES.verde
          ctx.fill()
        } else {
          ctx.fillStyle = CORES.card
          ctx.fill()
          ctx.strokeStyle = CORES.borda
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
        ctx.font = '700 62px Plus Jakarta Sans, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = corpo.accent ? CORES.fundo : CORES.texto
        ctx.fillText(corpo.digito, 1, 3)
        ctx.restore()
      }

      Events.on(render, 'afterRender', () => {
        const ctx = render.context
        icones.forEach((c) => desenharIcone(ctx, c))
        blocos.forEach((c) => desenharBloco(ctx, c))
      })

      Render.run(render)
      const runner = Runner.create()
      Runner.run(runner, engine)

      function handleResize() {
        largura = window.innerWidth
        altura = window.innerHeight
        render.canvas.width = largura
        render.canvas.height = altura
        render.options.width = largura
        render.options.height = altura
        Body.setPosition(chao, { x: largura / 2, y: altura + espessura / 2 })
        Body.setPosition(teto, { x: largura / 2, y: -espessura / 2 })
        Body.setPosition(paredeDir, { x: largura + espessura / 2, y: altura / 2 })
      }
      window.addEventListener('resize', handleResize)

      limpar = () => {
        window.removeEventListener('resize', handleResize)
        Render.stop(render)
        Runner.stop(runner)
        Composite.clear(engine.world, false)
        Engine.clear(engine)
        render.textures = {}
      }
    }

    frame = requestAnimationFrame(tentarIniciar)

    return () => {
      cancelado = true
      cancelAnimationFrame(frame)
      limpar()
    }
  }, [])

  function organizar() {
    const { Body } = Matter
    const { blocos, icones } = corposRef.current
    const largura = window.innerWidth
    const altura = window.innerHeight

    blocos.forEach((corpo, i) => {
      Body.setPosition(corpo, { x: largura / 2 + (i - 1) * 150, y: altura - 220 })
      Body.setAngle(corpo, 0)
      Body.setVelocity(corpo, { x: 0, y: 0 })
      Body.setAngularVelocity(corpo, 0)
    })

    const cols = 9
    const margem = 60
    const espX = (largura - margem * 2) / (cols - 1)
    icones.forEach((corpo, i) => {
      const col = i % cols
      const lin = Math.floor(i / cols)
      Body.setPosition(corpo, { x: margem + col * espX, y: altura - 60 - lin * 56 })
      Body.setAngle(corpo, 0)
      Body.setVelocity(corpo, { x: 0, y: 0 })
      Body.setAngularVelocity(corpo, 0)
    })
  }

  return (
    <div style={estilos.container}>
      <canvas ref={canvasRef} style={estilos.canvas} />
      <div style={estilos.hud}>
        <h1 style={estilos.titulo}>Essa página se perdeu no caminho.</h1>
        <p style={estilos.subtitulo}>
          Ironia: documento perdido é exatamente o que o Zempofy resolve. Essa página aqui a gente não achou.
        </p>
        <div style={estilos.acoes}>
          <Link to="/" style={estilos.botaoPrimario}>Voltar ao painel</Link>
          <button onClick={organizar} style={estilos.botaoSecundario}>Organizar essa bagunça</button>
        </div>
        <p style={estilos.dica}>arraste os blocos com o mouse</p>
      </div>
    </div>
  )
}

const estilos = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100vh',
    background: CORES.fundo,
    overflow: 'hidden',
    fontFamily: 'var(--fonte-corpo)',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  hud: {
    position: 'relative',
    padding: '3rem 3rem 0',
    pointerEvents: 'none',
    maxWidth: 460,
  },
  titulo: {
    margin: 0,
    fontSize: 28,
    fontWeight: 600,
    color: CORES.texto,
  },
  subtitulo: {
    margin: '0.75rem 0 0',
    fontSize: 15,
    color: CORES.textoMuted,
    lineHeight: 1.6,
  },
  acoes: {
    marginTop: '1.5rem',
    display: 'flex',
    gap: 12,
    pointerEvents: 'auto',
  },
  botaoPrimario: {
    background: CORES.verde,
    color: CORES.fundo,
    border: 'none',
    padding: '12px 22px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
    display: 'inline-block',
  },
  botaoSecundario: {
    background: 'transparent',
    color: CORES.texto,
    border: `1px solid ${CORES.borda}`,
    padding: '12px 22px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  dica: {
    marginTop: 12,
    fontSize: 12,
    color: CORES.textoSutil,
  },
}
