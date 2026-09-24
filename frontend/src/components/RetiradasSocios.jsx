import { useState, useEffect } from 'react'
import api from '../services/api'
import Icone from './Icones'
import { useToast } from './Toast'
import { competenciaPadraoDoSetor } from './Clientes'
import RetiradasEmpresaDetalhe from './RetiradasEmpresaDetalhe'
import ModalSociosControle from './ModalSociosControle'
import { formatMoeda } from '../utils/mascaras'
import { Badge, SeletorCompetencia, textoLimite } from './RetiradasComum'

// Contábil › Retiradas de sócios — lista das empresas sob controle numa competência.
// Controla também a navegação lista ↔ detalhe da empresa.

const LABEL_REGIME = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
  pessoa_fisica: 'Pessoa Física',
  outro: 'Outro',
}

// Nome longo: 3 primeiras palavras + "…" (o nome completo vai no title)
const nomeCurto = (nome = '') => nome.length > 32 ? `${nome.split(/\s+/).slice(0, 3).join(' ')}…` : nome

export default function RetiradasSocios() {
  const { mostrar } = useToast()
  const [competencia, setCompetencia] = useState(() => competenciaPadraoDoSetor('Contábil'))
  const [parametros, setParametros] = useState(null)
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [detalheId, setDetalheId] = useState(null)
  const [modalAdicionar, setModalAdicionar] = useState(false)

  useEffect(() => {
    api.get('/contabil/retiradas/parametros')
      .then(r => setParametros(r.data))
      .catch(err => mostrar(err.response?.data?.erro || 'Erro ao carregar os parâmetros.', 'erro'))
  }, [])

  const carregar = () => {
    setCarregando(true)
    api.get('/contabil/retiradas', { params: { competencia } })
      .then(r => setLista(r.data))
      .catch(err => { setLista([]); mostrar(err.response?.data?.erro || 'Erro ao carregar as retiradas.', 'erro') })
      .finally(() => setCarregando(false))
  }

  useEffect(carregar, [competencia])

  if (detalheId) {
    return (
      <RetiradasEmpresaDetalhe
        clienteId={detalheId}
        competenciaInicial={competencia}
        parametros={parametros}
        onVoltar={(comp) => {
          setDetalheId(null)
          // Volta na competência em que a pessoa estava no detalhe; se for a mesma, recarrega na mão
          if (comp && comp !== competencia) setCompetencia(comp)
          else carregar()
        }}
      />
    )
  }

  const termo = busca.trim().toLowerCase()
  const termoDigitos = termo.replace(/\D/g, '')
  const filtrados = lista
    .filter(e => !termo
      || (e.nome || '').toLowerCase().includes(termo)
      || (termoDigitos && (e.cnpj || '').replace(/\D/g, '').includes(termoDigitos)))
    .sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1 // inativas no fim
      return (a.nome || '').toLowerCase().localeCompare((b.nome || '').toLowerCase(), 'pt-BR', { numeric: true })
    })

  const qtdAtivas = lista.filter(e => e.ativo).length
  const idsComControle = new Set(lista.map(e => String(e.clienteId)))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--texto)', margin: 0, letterSpacing: '-0.03em' }}>Retiradas de sócios</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--texto-apagado)', marginTop: '5px' }}>
            Contábil · {qtdAtivas} {qtdAtivas === 1 ? 'empresa' : 'empresas'}
          </p>
        </div>
        <button onClick={() => setModalAdicionar(true)} style={s.btnNovo}>+ Adicionar</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '420px' }}>
          <Icone.Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-apagado)' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CNPJ..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 12px 7px 32px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--input)', color: 'var(--texto)', fontSize: '0.8rem', fontFamily: 'var(--fonte-corpo)', colorScheme: 'dark' }}
          />
        </div>
        <SeletorCompetencia competencia={competencia} onChange={setCompetencia} />
      </div>

      {carregando ? (
        <p style={{ color: 'var(--texto-apagado)' }}>Carregando...</p>
      ) : lista.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px dashed var(--borda)', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--verde-glow)', color: 'var(--verde)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icone.Cash size={20} />
          </div>
          <p style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--texto)' }}>Comece adicionando uma empresa</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--texto-apagado)', maxWidth: '360px', lineHeight: 1.5 }}>
            Escolha uma empresa da carteira, confirme os sócios e comece a lançar as retiradas de lucro de cada mês.
          </p>
          <button onClick={() => setModalAdicionar(true)} style={{ ...s.btnNovo, marginTop: '6px' }}>+ Adicionar</button>
        </div>
      ) : filtrados.length === 0 ? (
        <p style={{ color: 'var(--texto-apagado)', fontSize: '0.875rem', padding: '20px 0' }}>Nenhuma empresa encontrada.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(e => (
            <div key={e.clienteId}
              onClick={() => setDetalheId(e.clienteId)}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s', opacity: e.ativo ? 1 : 0.5 }}
              onMouseEnter={ev => ev.currentTarget.style.borderColor = 'rgba(0,177,65,0.3)'}
              onMouseLeave={ev => ev.currentTarget.style.borderColor = 'var(--borda)'}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span title={e.nome} style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {nomeCurto(e.nome) || '—'}
                  </span>
                  {!e.ativo && <Badge>Inativa</Badge>}
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', marginTop: '3px' }}>
                  {LABEL_REGIME[e.regime] || 'Regime não informado'}
                </p>
              </div>

              <span style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                <Icone.Users size={13} /> {e.qtdSocios} {e.qtdSocios === 1 ? 'sócio' : 'sócios'}
              </span>

              <div style={{ minWidth: '120px', textAlign: 'right' }}>
                <p style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)' }}>{formatMoeda(e.totalMes)}</p>
                <p style={{ fontSize: '0.66rem', color: 'var(--texto-apagado)', marginTop: '2px' }}>Retirado no mês</p>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: '130px' }}>
                {e.situacaoMes === 'sem_lancamento' && <Badge>Sem lançamento</Badge>}
                {e.situacaoMes === 'dentro_limite' && <Badge cor="verde">Dentro do limite</Badge>}
                {e.situacaoMes === 'acima_limite' && <Badge cor="ambar">Acima de {textoLimite(parametros?.limiteMensal)}</Badge>}
                {e.acimaDoLucro && <Badge cor="vermelho">Acima do lucro</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAdicionar && (
        <ModalSociosControle
          modo="adicionar"
          idsComControle={idsComControle}
          onFechar={() => setModalAdicionar(false)}
          onSalvo={() => { setModalAdicionar(false); carregar() }}
        />
      )}
    </div>
  )
}

const s = {
  btnNovo: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '9px', padding: '7px 14px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' },
}
