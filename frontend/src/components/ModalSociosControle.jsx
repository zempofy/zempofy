import { useState, useEffect } from 'react'
import api from '../services/api'
import Modal from './Modal'
import ModalConfirmacao from './ModalConfirmacao'
import Icone from './Icones'
import { useToast } from './Toast'
import { useAuth } from '../contexts/AuthContext'
import { mascaraCPF, soDigitos } from '../utils/mascaras'
import { normalizarNome } from '../utils/setores'

// Modal do Contábil › Retiradas usado pra:
// - modo "adicionar": escolher a empresa da carteira (passo 1) e confirmar os sócios (passo 2)
// - modo "editar": editar os sócios de uma empresa que já está sob controle
// No rodapé, opção (desmarcada por padrão) de refletir a lista no cadastro da empresa.

let proximaChave = 1
const novaLinha = (dados = {}) => ({ chave: proximaChave++, _id: null, nome: '', cpf: '', percentual: '', ativo: true, ativoOriginal: true, ...dados })

// Converte o CPF vindo do cadastro: só aproveita se tiver os 11 dígitos (o que não existir fica em branco)
const cpfDoCadastro = (cpf) => soDigitos(cpf).length === 11 ? mascaraCPF(cpf) : ''

// Espelha sincronizarCadastro de backend/routes/retiradas.js pra mostrar ANTES de salvar o que
// mudaria no cadastro. Casa por CPF (quando os dois têm os 11 dígitos), depois por nome.
const simularSincronizacao = (ativos, cadastro) => {
  const cad = cadastro.filter(c => (c.nome || '').trim())
  const usados = new Set()
  const pares = new Map()
  ativos.forEach((a, i) => {
    const cpfA = soDigitos(a.cpf)
    if (cpfA.length !== 11) return
    const j = cad.findIndex((c, k) => !usados.has(k) && soDigitos(c.cpf) === cpfA)
    if (j >= 0) { usados.add(j); pares.set(i, j) }
  })
  ativos.forEach((a, i) => {
    if (pares.has(i)) return
    const cpfA = soDigitos(a.cpf)
    const j = cad.findIndex((c, k) => {
      if (usados.has(k)) return false
      if (cpfA.length === 11 && soDigitos(c.cpf).length === 11) return false
      return normalizarNome(c.nome) === normalizarNome(a.nome)
    })
    if (j >= 0) { usados.add(j); pares.set(i, j) }
  })

  const mudancas = []
  ativos.forEach((a, i) => {
    if (!pares.has(i)) { mudancas.push(`+ ${a.nome.trim()}`); return }
    const c = cad[pares.get(i)]
    if (c.nome.trim() !== a.nome.trim()) mudancas.push(`nome de ${c.nome.trim()} alterado`)
    const cpfA = soDigitos(a.cpf)
    if (cpfA.length === 11 && cpfA !== soDigitos(c.cpf)) mudancas.push(`CPF de ${a.nome.trim()} alterado`)
  })
  cad.forEach((c, k) => { if (!usados.has(k)) mudancas.push(`− ${c.nome.trim()}`) })
  return mudancas
}

export default function ModalSociosControle({ modo, clienteId: clienteIdInicial, idsComControle, onFechar, onSalvo }) {
  const { mostrar } = useToast()
  const { usuario } = useAuth()
  const isTitular = usuario?.cargo === 'admin'
  const adicionando = modo === 'adicionar'

  const [passo, setPasso] = useState(adicionando ? 1 : 2)
  const [clientes, setClientes] = useState([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [cliente, setCliente] = useState(null) // { _id, nome }
  const [linhas, setLinhas] = useState([])
  const [sociosCadastro, setSociosCadastro] = useState([])
  const [sincronizar, setSincronizar] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [excluindo, setExcluindo] = useState(null) // linha a excluir permanentemente

  useEffect(() => {
    if (adicionando) {
      api.get('/clientes')
        .then(r => setClientes(r.data
          .filter(c => c.status !== 'inativo' && c.tipoPessoa !== 'fisica' && !idsComControle?.has(String(c._id)))
          .sort((a, b) => (a.razaoSocial || a.nomeFantasia || '').localeCompare(b.razaoSocial || b.nomeFantasia || '', 'pt-BR', { numeric: true }))))
        .catch(() => mostrar('Erro ao carregar a carteira de clientes.', 'erro'))
        .finally(() => setCarregando(false))
    } else {
      api.get(`/contabil/retiradas/${clienteIdInicial}`)
        .then(r => {
          setCliente({ _id: r.data.clienteId, nome: r.data.nome })
          setSociosCadastro(r.data.sociosCadastro || [])
          setLinhas(r.data.socios.map(sc => novaLinha({
            _id: sc._id, nome: sc.nome, cpf: sc.cpf ? mascaraCPF(sc.cpf) : '',
            percentual: sc.percentual ?? '', ativo: sc.ativo, ativoOriginal: sc.ativo,
          })))
        })
        .catch(err => { mostrar(err.response?.data?.erro || 'Erro ao carregar os sócios.', 'erro'); onFechar() })
        .finally(() => setCarregando(false))
    }
  }, [])

  const escolherCliente = (c) => {
    const socios = (c.socios || []).filter(sc => (sc.nome || '').trim())
    setCliente({ _id: c._id, nome: c.razaoSocial || c.nomeFantasia })
    setSociosCadastro(c.socios || [])
    // % sempre em branco: o cadastro não tem esse campo
    setLinhas(socios.length ? socios.map(sc => novaLinha({ nome: sc.nome.trim(), cpf: cpfDoCadastro(sc.cpf) })) : [novaLinha()])
    setSincronizar(false)
    setTentouSalvar(false)
    setPasso(2)
  }

  const setCampo = (chave, campo, valor) => setLinhas(ls => ls.map(l => l.chave === chave ? { ...l, [campo]: valor } : l))
  const adicionarLinha = () => setLinhas(ls => [...ls, novaLinha()])
  // Adicionar: o X remove a linha (ainda não existe histórico). Editar: sócio já salvo é inativado
  // (regra do projeto: inativar antes de excluir); linha nova, ainda não salva, só some.
  const clicarX = (l) => {
    if (adicionando || !l._id) setLinhas(ls => ls.filter(x => x.chave !== l.chave))
    else setCampo(l.chave, 'ativo', false)
  }

  // Linhas totalmente em branco (sem _id) são ignoradas ao salvar
  const linhasValidas = linhas.filter(l => l._id || l.nome.trim() || soDigitos(l.cpf) || String(l.percentual).trim() !== '')
  const ativas = linhasValidas.filter(l => l.ativo)

  const erroDaLinha = (l) => {
    if (!linhasValidas.includes(l)) return null
    if (!l.nome.trim()) return 'Informe o nome completo.'
    const cpf = soDigitos(l.cpf)
    if (cpf && cpf.length !== 11) return 'CPF incompleto.'
    if (l.ativo && cpf && ativas.some(o => o !== l && soDigitos(o.cpf) === cpf)) return 'CPF repetido.'
    if (String(l.percentual).trim() !== '') {
      const p = Number(l.percentual)
      if (Number.isNaN(p) || p < 0 || p > 100) return '% deve ficar entre 0 e 100.'
    }
    return null
  }
  const algumErro = linhasValidas.some(l => erroDaLinha(l))

  const comPercentual = ativas.filter(l => String(l.percentual).trim() !== '')
  const somaPercentual = Math.round(comPercentual.reduce((s, l) => s + (Number(l.percentual) || 0), 0) * 100) / 100
  const avisoPercentual = comPercentual.length > 0 && somaPercentual !== 100

  const mudancasCadastro = passo === 2 && !carregando
    ? simularSincronizacao(ativas.filter(l => l.nome.trim()).map(l => ({ nome: l.nome, cpf: l.cpf })), sociosCadastro)
    : []

  const salvar = async () => {
    setTentouSalvar(true)
    if (algumErro) return mostrar('Corrija os campos destacados.', 'aviso')
    if (!ativas.length) return mostrar('Informe pelo menos um sócio ativo.', 'aviso')
    const socios = linhasValidas.map(l => ({
      ...(l._id ? { _id: l._id } : {}),
      nome: l.nome.trim(),
      cpf: soDigitos(l.cpf),
      percentual: String(l.percentual).trim() === '' ? null : Number(l.percentual),
      ativo: l.ativo,
    }))
    const sincronizarCadastro = sincronizar && mudancasCadastro.length > 0
    setSalvando(true)
    try {
      if (adicionando) {
        await api.post('/contabil/retiradas', { clienteId: cliente._id, socios, sincronizarCadastro })
        mostrar('Empresa adicionada ao controle de retiradas.')
      } else {
        await api.patch(`/contabil/retiradas/${cliente._id}/socios`, { socios, sincronizarCadastro })
        mostrar('Sócios atualizados.')
      }
      onSalvo()
    } catch (err) {
      mostrar(err.response?.data?.erro || 'Erro ao salvar os sócios.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const excluirPermanente = async () => {
    const l = excluindo
    setExcluindo(null)
    try {
      await api.delete(`/contabil/retiradas/${cliente._id}/socios/${l._id}`)
      setLinhas(ls => ls.filter(x => x.chave !== l.chave))
      mostrar(`${l.nome} excluído permanentemente.`)
    } catch (err) {
      mostrar(err.response?.data?.erro || 'Erro ao excluir o sócio.', 'erro')
    }
  }

  const termo = buscaCliente.trim().toLowerCase()
  const termoDigitos = termo.replace(/\D/g, '')
  const clientesFiltrados = clientes.filter(c => !termo
    || (c.razaoSocial || '').toLowerCase().includes(termo)
    || (c.nomeFantasia || '').toLowerCase().includes(termo)
    || (termoDigitos && soDigitos(c.cnpj).includes(termoDigitos)))

  // Ativos primeiro (na ordem em que estão), inativos esmaecidos no fim
  const linhasOrdenadas = [...linhas.filter(l => l.ativo), ...linhas.filter(l => !l.ativo)]

  const titulo = adicionando ? (passo === 1 ? 'Adicionar empresa' : 'Sócios da empresa') : 'Editar sócios'

  return (
    <Modal onFechar={onFechar} maxWidth={passo === 1 ? '480px' : '680px'}>
      <div style={s.topo}>
        <div style={{ minWidth: 0 }}>
          <h3 style={s.titulo}>{titulo}</h3>
          {passo === 2 && cliente && <p style={{ fontSize: '0.78rem', color: 'var(--texto-apagado)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.nome}</p>}
        </div>
        <button onClick={onFechar} style={s.btnX} aria-label="Fechar"><Icone.X size={12} /></button>
      </div>

      {carregando ? (
        <p style={{ color: 'var(--texto-apagado)', padding: '24px' }}>Carregando...</p>
      ) : passo === 1 ? (
        <div style={{ padding: '18px 24px 24px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--texto-apagado)', marginBottom: '12px' }}>Escolha a empresa da carteira de clientes.</p>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Icone.Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-apagado)' }} />
            <input autoFocus value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} placeholder="Buscar por nome ou CNPJ..." style={{ ...s.inp, paddingLeft: '32px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
            {clientesFiltrados.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--texto-apagado)', padding: '12px 0' }}>
                {clientes.length === 0 ? 'Todas as empresas ativas da carteira já estão no controle.' : 'Nenhuma empresa encontrada.'}
              </p>
            ) : clientesFiltrados.map(c => (
              <button key={c._id} onClick={() => escolherCliente(c)} style={s.itemCliente}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,177,65,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--borda)'}>
                <span style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--texto)' }}>{c.razaoSocial || c.nomeFantasia}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)' }}>
                  {c.cnpj || 'Sem CNPJ'} · {(() => { const n = (c.socios || []).filter(sc => (sc.nome || '').trim()).length; return n === 0 ? 'nenhum sócio no cadastro' : n === 1 ? '1 sócio no cadastro' : `${n} sócios no cadastro` })()}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: '18px 24px' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '560px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ ...s.gradeSocio, padding: '0 2px' }}>
                  <span style={s.cabecalho}>Nome completo</span>
                  <span style={s.cabecalho}>CPF</span>
                  <span style={s.cabecalho}>%</span>
                  <span />
                </div>
                {linhasOrdenadas.map(l => {
                  const erro = tentouSalvar || l.nome || l.cpf || l.percentual !== '' ? erroDaLinha(l) : null
                  if (!l.ativo) {
                    return (
                      <div key={l.chave} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', border: '1px dashed var(--borda)' }}>
                        <div style={{ flex: 1, minWidth: 0, opacity: 0.55 }}>
                          <p style={{ fontSize: '0.82rem', color: 'var(--texto)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--texto-apagado)', marginTop: '2px' }}>
                            {l.cpf || 'Sem CPF'} · {l.percentual !== '' ? `${l.percentual}%` : 'sem %'} · {l.ativoOriginal ? 'será inativado ao salvar' : 'inativo'}
                          </p>
                        </div>
                        <button onClick={() => setCampo(l.chave, 'ativo', true)} style={s.btnLink}>Reativar</button>
                        {isTitular && !l.ativoOriginal && (
                          <button onClick={() => setExcluindo(l)} style={{ ...s.btnLink, color: 'var(--erro)' }}>Excluir permanentemente</button>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div key={l.chave}>
                      <div style={s.gradeSocio}>
                        <input value={l.nome} onChange={e => setCampo(l.chave, 'nome', e.target.value)} placeholder="Nome completo do sócio" style={{ ...s.inp, ...(erro && !l.nome.trim() ? s.inpErro : {}) }} />
                        <input value={l.cpf} onChange={e => setCampo(l.chave, 'cpf', mascaraCPF(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" style={{ ...s.inp, ...(erro && /CPF/.test(erro) ? s.inpErro : {}) }} />
                        <input type="number" min="0" max="100" step="0.01" value={l.percentual} onChange={e => setCampo(l.chave, 'percentual', e.target.value)} placeholder="%" style={{ ...s.inp, ...(erro && /%/.test(erro) ? s.inpErro : {}) }} />
                        <button onClick={() => clicarX(l)} title={adicionando || !l._id ? 'Remover linha' : 'Inativar sócio'} style={s.btnX} aria-label="Remover"><Icone.X size={12} /></button>
                      </div>
                      {erro && <p style={{ fontSize: '0.72rem', color: 'var(--erro)', marginTop: '4px' }}>{erro}</p>}
                    </div>
                  )
                })}
              </div>
            </div>

            <button onClick={adicionarLinha} style={{ ...s.btnSecundario, marginTop: '12px' }}>+ Adicionar sócio</button>

            {avisoPercentual && (
              <p style={{ fontSize: '0.75rem', color: 'var(--alerta)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icone.AlertTriangle size={13} /> A soma dos percentuais é {somaPercentual.toLocaleString('pt-BR')}% (diferente de 100%).
              </p>
            )}
            {!adicionando && linhas.some(l => !l.ativo && l.ativoOriginal) && (
              <p style={{ fontSize: '0.72rem', color: 'var(--texto-apagado)', marginTop: '10px' }}>
                Sócio inativado continua aparecendo nos meses em que teve retirada e contando no trimestre.
              </p>
            )}

            {mudancasCadastro.length > 0 && (
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '16px', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--borda)', background: 'var(--input)', cursor: 'pointer' }}>
                <input type="checkbox" checked={sincronizar} onChange={e => setSincronizar(e.target.checked)} style={{ marginTop: '2px', accentColor: 'var(--verde)', colorScheme: 'dark' }} />
                <span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--texto)' }}>Atualizar também os sócios no cadastro da empresa</span>
                  <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--texto-apagado)', marginTop: '4px', lineHeight: 1.5 }}>
                    {mudancasCadastro.join(', ')}
                  </span>
                </span>
              </label>
            )}
          </div>

          <div style={s.rodape}>
            {adicionando && <button onClick={() => setPasso(1)} style={{ ...s.btnCanc, marginRight: 'auto' }}>Voltar</button>}
            <button onClick={onFechar} style={s.btnCanc}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ ...s.btnSalv, opacity: salvando ? 0.6 : 1 }}>
              {salvando ? 'Salvando...' : adicionando ? 'Adicionar empresa' : 'Salvar'}
            </button>
          </div>
        </>
      )}

      {excluindo && (
        <ModalConfirmacao
          titulo="Excluir sócio permanentemente?"
          mensagem={`Isso apaga ${excluindo.nome} e TODAS as retiradas lançadas dele, em todos os meses. Não dá pra desfazer.`}
          textoBotao="Excluir"
          perigo
          onConfirmar={excluirPermanente}
          onCancelar={() => setExcluindo(null)}
        />
      )}
    </Modal>
  )
}

const s = {
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  titulo: { fontWeight: '700', fontSize: '1rem', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)', margin: 0 },
  rodape: { display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--borda)', flexWrap: 'wrap' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  btnCanc: { background: 'none', border: '1px solid var(--borda)', borderRadius: '10px', color: 'var(--texto-apagado)', padding: '10px 20px', fontFamily: 'var(--fonte-corpo)', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' },
  btnSalv: { background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  btnSecundario: { background: 'none', border: '1px solid var(--borda)', borderRadius: '8px', color: 'var(--verde)', padding: '8px 14px', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnLink: { background: 'none', border: 'none', color: 'var(--verde)', fontFamily: 'var(--fonte-corpo)', fontWeight: '600', fontSize: '0.74rem', cursor: 'pointer', padding: '4px 2px', whiteSpace: 'nowrap' },
  inp: { background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '8px 12px', color: 'var(--texto)', fontSize: '0.85rem', fontFamily: 'var(--fonte-corpo)', width: '100%', boxSizing: 'border-box', colorScheme: 'dark' },
  inpErro: { border: '1px solid rgba(248,113,113,0.6)' },
  gradeSocio: { display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 80px 28px', gap: '8px', alignItems: 'center' },
  cabecalho: { fontSize: '0.66rem', fontWeight: '700', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px' },
  itemCliente: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px', textAlign: 'left', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '9px', padding: '10px 12px', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)' },
}
