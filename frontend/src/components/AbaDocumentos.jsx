import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { useToast } from './Toast'
import Icone from './Icones'
import ListaDocumentos from './ListaDocumentos'
import { CONFIG_DEMANDA, normalizarNome, competenciaAtual, competenciaPadraoDoSetor, MESES_LABEL, INICIO_DEMANDA_ANO } from './Clientes'

// Aba "Documentos" do cliente — navegador de pastas: raiz (Empresa + um setor por Demanda
// configurada) -> setor abre em Ano -> Mês -> lista de arquivos, mesmo padrão do AbaHistorico.
export default function AbaDocumentos({ clienteId, setores }) {
  const { usuario } = useAuth()
  const { mostrar } = useToast()
  const [setorAberto, setSetorAberto] = useState(undefined) // undefined = raiz; null = pasta Empresa; objeto = setor
  const [anoSelecionado, setAnoSelecionado] = useState(null)
  const [mesSelecionado, setMesSelecionado] = useState(null)
  const [mapa, setMapa] = useState({})

  const isTitular = usuario?.cargo === 'admin'
  const temAcessoAoSetor = (setorId) => isTitular || usuario?.setores?.some(s => (s._id || s) === setorId)
  const podeGerenciarGeral = isTitular || !!usuario?.permissoes?.gerenciarClientes

  // Só setores com Demanda configurada pro cliente, e só os que o usuário tem acesso (titular vê todos)
  const setoresComDemanda = (setores || [])
    .filter(s => s?.nome && CONFIG_DEMANDA[normalizarNome(s.nome)])
    .filter(s => temAcessoAoSetor(s._id))

  const buscarMapa = () => {
    if (!setorAberto) return
    api.get(`/documentos/mapa/${clienteId}/${setorAberto._id}`)
      .then(r => setMapa(r.data))
      .catch(() => mostrar('Erro ao carregar documentos.', 'erro'))
  }
  useEffect(buscarMapa, [setorAberto?._id])

  const irParaRaiz = () => { setSetorAberto(undefined); setAnoSelecionado(null); setMesSelecionado(null) }
  const abrirEmpresa = () => { setSetorAberto(null); setAnoSelecionado(null); setMesSelecionado(null) }
  const abrirSetor = (setor) => { setSetorAberto(setor); setAnoSelecionado(null); setMesSelecionado(null) }

  const btnPasta = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px 12px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '12px', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', fontSize: '0.82rem', fontWeight: '600', color: 'var(--texto)' }
  const btnVoltar = { background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', fontSize: '0.82rem', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '12px' }

  // Nível 3 — documentos do mês selecionado
  if (setorAberto && mesSelecionado) {
    const [ano, mes] = mesSelecionado.split('-')
    return (
      <div>
        <button onClick={() => { setMesSelecionado(null); buscarMapa() }} style={btnVoltar}>
          <Icone.ChevronLeft size={14} /> {MESES_LABEL[Number(mes) - 1]} de {ano}
        </button>
        <ListaDocumentos clienteId={clienteId} tipo="demanda" setor={setorAberto} competencia={mesSelecionado} podeGerenciar={temAcessoAoSetor(setorAberto._id)} />
      </div>
    )
  }

  // Nível 2 — meses do ano selecionado
  if (setorAberto && anoSelecionado) {
    const tetoPadrao = competenciaPadraoDoSetor(setorAberto.nome)
    // Titular pode anexar documento num mês além do teto padrão — se isso já aconteceu, o teto
    // efetivo acompanha a competência mais avançada com dado, senão a pasta dela nem aparece
    const maiorComDado = Object.keys(mapa).reduce((max, c) => c > max ? c : max, tetoPadrao)
    const teto = maiorComDado > tetoPadrao ? maiorComDado : tetoPadrao
    const anoTeto = Number(teto.slice(0, 4))
    const mesTetoNum = Number(teto.slice(5, 7))
    const ultimoMes = anoSelecionado < anoTeto ? 12 : (anoSelecionado === anoTeto ? mesTetoNum : 0)
    return (
      <div>
        <button onClick={() => setAnoSelecionado(null)} style={btnVoltar}><Icone.ChevronLeft size={14} /> Anos</button>
        <div style={grid}>
          {MESES_LABEL.slice(0, ultimoMes).map((label, i) => {
            const mm = String(i + 1).padStart(2, '0')
            const competencia = `${anoSelecionado}-${mm}`
            const qtd = mapa[competencia] || 0
            return (
              <button key={competencia} onClick={() => setMesSelecionado(competencia)} style={btnPasta}>
                <Icone.FolderOpen size={22} style={{ color: qtd ? 'var(--verde)' : 'var(--texto-apagado)' }} />
                <span>{label}</span>
                {qtd > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem', color: 'var(--verde)', fontWeight: '700' }}><Icone.FileText size={10} /> {qtd} doc{qtd !== 1 ? 's' : ''}</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Nível 1 — anos do setor
  if (setorAberto) {
    const anoAtual = Number(competenciaAtual().slice(0, 4))
    const tetoPadrao = competenciaPadraoDoSetor(setorAberto.nome)
    const maiorComDado = Object.keys(mapa).reduce((max, c) => c > max ? c : max, tetoPadrao)
    const anoTeto = Number((maiorComDado > tetoPadrao ? maiorComDado : tetoPadrao).slice(0, 4))
    const anos = []
    for (let a = INICIO_DEMANDA_ANO; a <= Math.max(anoAtual, anoTeto); a++) anos.push(a)
    return (
      <div>
        <button onClick={irParaRaiz} style={btnVoltar}><Icone.ChevronLeft size={14} /> Documentos</button>
        <div style={grid}>
          {anos.map(a => (
            <button key={a} onClick={() => setAnoSelecionado(a)} style={btnPasta}>
              <Icone.FolderOpen size={24} />
              <span>{a}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Pasta "Empresa" — lista solta, sem subpastas
  if (setorAberto === null) {
    return (
      <div>
        <button onClick={irParaRaiz} style={btnVoltar}><Icone.ChevronLeft size={14} /> Documentos</button>
        <ListaDocumentos clienteId={clienteId} tipo="geral" podeGerenciar={podeGerenciarGeral} />
      </div>
    )
  }

  // Raiz — pasta Empresa + uma pasta por setor com Demanda
  return (
    <div style={grid}>
      <button onClick={abrirEmpresa} style={btnPasta}>
        <Icone.Building size={24} />
        <span>Empresa</span>
      </button>
      {setoresComDemanda.map(setor => (
        <button key={setor._id} onClick={() => abrirSetor(setor)} style={btnPasta}>
          <Icone.FolderOpen size={24} style={{ color: setor.cor || 'var(--texto-apagado)' }} />
          <span>{setor.nome}</span>
        </button>
      ))}
    </div>
  )
}
