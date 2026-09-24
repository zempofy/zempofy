import Icone from './Icones'
import { nomeMes, INICIO_DEMANDA_ANO } from './Clientes'
import { formatMoeda } from '../utils/mascaras'

// Peças compartilhadas pela lista (RetiradasSocios) e pelo detalhe (RetiradasEmpresaDetalhe) —
// num arquivo à parte pra os dois não importarem um do outro.

export const mudarCompetencia = (competencia, delta) => {
  const [ano, mes] = competencia.split('-').map(Number)
  const d = new Date(ano, mes - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Limite formatado sem centavos quando for redondo: "Acima de 50 mil"
export const textoLimite = (limite) => {
  if (!limite) return ''
  if (limite % 1000 === 0) return `${(limite / 1000).toLocaleString('pt-BR')} mil`
  return formatMoeda(limite)
}

// Badge com as cores já existentes no index.css (verde, alerta, erro) — cinza = texto apagado
const CORES_BADGE = {
  cinza: { cor: 'var(--texto-apagado)', bg: 'var(--input)', borda: 'var(--borda)' },
  verde: { cor: 'var(--verde)', bg: 'var(--verde-glow)', borda: 'rgba(0,177,65,0.3)' },
  ambar: { cor: 'var(--alerta)', bg: 'rgba(251,191,36,0.1)', borda: 'rgba(251,191,36,0.3)' },
  vermelho: { cor: 'var(--erro)', bg: 'rgba(248,113,113,0.1)', borda: 'rgba(248,113,113,0.3)' },
}
export const Badge = ({ cor = 'cinza', children, title }) => {
  const c = CORES_BADGE[cor]
  return (
    <span title={title} style={{ fontSize: '0.68rem', fontWeight: '700', padding: '3px 9px', borderRadius: '6px', background: c.bg, color: c.cor, border: `1px solid ${c.borda}`, whiteSpace: 'nowrap', fontFamily: 'var(--fonte-corpo)' }}>
      {children}
    </span>
  )
}

export function SeletorCompetencia({ competencia, onChange }) {
  const podeVoltar = competencia > `${INICIO_DEMANDA_ANO}-01`
  const btn = (habilitado) => ({ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid var(--borda)', background: 'var(--input)', color: habilitado ? 'var(--texto)' : 'var(--texto-apagado)', cursor: habilitado ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: habilitado ? 1 : 0.4 })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Competência</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button onClick={() => podeVoltar && onChange(mudarCompetencia(competencia, -1))} disabled={!podeVoltar} style={btn(podeVoltar)} aria-label="Mês anterior">
          <Icone.ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)', minWidth: '130px', textAlign: 'center' }}>
          {nomeMes(competencia)} {competencia.slice(0, 4)}
        </span>
        {/* Contábil nunca trava competência — pode avançar livremente */}
        <button onClick={() => onChange(mudarCompetencia(competencia, 1))} style={btn(true)} aria-label="Próximo mês">
          <Icone.ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
