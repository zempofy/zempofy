import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import api from '../services/api'
import { useToast } from './Toast'
import Icone from './Icones'
import Modal from './Modal'

// Também usada pelo total da empresa na tela de Armazenamento — por isso vai até GB.
export const formatarTamanho = (bytes) => {
  const n = (valor, casas) => valor.toFixed(casas).replace('.', ',')
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${n(bytes / 1024, 1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${n(bytes / (1024 * 1024), 1)} MB`
  return `${n(bytes / (1024 * 1024 * 1024), 2)} GB`
}

const TIPOS_ACEITOS_TEXTO = 'PDF, imagem (JPG, PNG), planilha (XLS, XLSX, CSV) ou Word (DOC, DOCX)'
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv,.doc,.docx'

// Leaf reutilizável: só a lista + upload, sem navegação de pastas — usado na aba Documentos
// (nível folha) e embutido direto na tela da Demanda. `ocultarDropzone` tira a caixa grande de
// arrastar-e-soltar de dentro da lista (quando quem chama já tem seu próprio botão "Carregar
// documentos") — nesse caso a caixa aparece num popup ao chamar `ref.current.abrirSeletor()`,
// em vez de pular direto pro seletor de arquivo do sistema.
const ListaDocumentos = forwardRef(function ListaDocumentos({ clienteId, tipo, setor, competencia, podeGerenciar, compacto = false, onMudanca, ocultarDropzone = false }, ref) {
  const { mostrar } = useToast()
  const [documentos, setDocumentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [popupAberto, setPopupAberto] = useState(false)
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({ abrirSeletor: () => setPopupAberto(true) }))

  const buscar = async () => {
    setCarregando(true)
    try {
      const url = tipo === 'geral'
        ? `/documentos/cliente/${clienteId}`
        : `/documentos/demanda/${clienteId}/${setor._id}/${competencia}`
      const res = await api.get(url)
      setDocumentos(res.data)
      onMudanca?.(res.data)
    } catch { mostrar('Erro ao carregar documentos.', 'erro') }
    finally { setCarregando(false) }
  }

  useEffect(() => { buscar() }, [clienteId, tipo, setor?._id, competencia])

  // Envia um arquivo por vez (uma requisição cada), em sequência — não em paralelo, pra não
  // sobrecarregar o backend nem complicar o feedback de progresso. Retorna motivo do erro, se houver.
  const enviarArquivoIndividual = async (arquivo) => {
    if (arquivo.size > 16 * 1024 * 1024) return { ok: false, motivo: 'Arquivo maior que 16MB.' }
    try {
      const form = new FormData()
      form.append('arquivos', arquivo)
      form.append('clienteId', clienteId)
      form.append('tipo', tipo)
      if (tipo === 'demanda') { form.append('setorId', setor._id); form.append('competencia', competencia) }
      await api.post('/documentos', form)
      return { ok: true }
    } catch (e) {
      const dados = e.response?.data
      const motivo = Array.isArray(dados) ? dados[0]?.erro : dados?.erro
      return { ok: false, motivo: motivo || 'Erro ao enviar documento.' }
    }
  }

  // Usado pelo popup e pelo dropzone: envia todos os arquivos escolhidos (arrastados ou selecionados)
  // e fecha o popup ao final, resumindo o resultado num único toast.
  const enviarArquivos = async (listaDeArquivos) => {
    const lista = Array.from(listaDeArquivos || [])
    if (lista.length === 0) return
    setEnviando(true)
    let sucesso = 0
    const falhas = []
    for (const arquivo of lista) {
      const resultado = await enviarArquivoIndividual(arquivo)
      if (resultado.ok) sucesso++
      else falhas.push({ nome: arquivo.name, motivo: resultado.motivo })
    }
    setEnviando(false)
    setPopupAberto(false)
    buscar()

    if (lista.length === 1) {
      mostrar(sucesso === 1 ? 'Documento enviado!' : (falhas[0]?.motivo || 'Erro ao enviar documento.'), sucesso === 1 ? 'sucesso' : 'erro')
    } else if (falhas.length === 0) {
      mostrar(`${sucesso} de ${lista.length} arquivos enviados.`, 'sucesso')
    } else {
      const detalhe = falhas.length === 1 ? ` (${falhas[0].motivo})` : ''
      mostrar(`${sucesso} de ${lista.length} enviados — ${falhas.length} arquivo(s) recusado(s)${detalhe}.`, sucesso > 0 ? 'aviso' : 'erro')
    }
  }

  const baixar = async (doc) => {
    try {
      const res = await api.get(`/documentos/${doc._id}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = doc.nomeOriginal
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch { mostrar('Erro ao baixar documento.', 'erro') }
  }

  // Excluir manda pra lixeira (Configurações → Lixeira), de onde dá pra restaurar por 30 dias —
  // o documento some daqui na hora, sem passar pelo estado "inativo e cinza" de antes.
  const excluir = async (doc) => {
    try {
      await api.patch(`/documentos/${doc._id}/excluir`)
      mostrar('Documento movido para a lixeira. Será excluído permanentemente em 30 dias.', 'sucesso')
      buscar()
    } catch (e) { mostrar(e.response?.data?.erro || 'Erro ao excluir documento.', 'erro') }
  }

  const ordenados = [...documentos].sort((a, b) => new Date(b.enviadoEm) - new Date(a.enviadoEm))

  if (carregando) return <p style={{ color: 'var(--texto-apagado)', fontSize: '0.85rem' }}>Carregando...</p>

  const caixaDropzone = (
    <div
      onClick={() => !enviando && inputRef.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDragEnter={e => { e.preventDefault(); setArrastando(true) }}
      onDragLeave={e => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setArrastando(false) }}
      onDrop={e => { e.preventDefault(); setArrastando(false); enviarArquivos(e.dataTransfer.files) }}
      style={{
        ...s.dropzone,
        border: `2px dashed ${arrastando ? 'var(--verde)' : 'var(--borda)'}`,
        background: arrastando ? 'var(--verde-glow)' : 'transparent',
        cursor: enviando ? 'default' : 'pointer',
        opacity: enviando ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
        <Icone.FolderOpen size={compacto ? 24 : 32} style={{ color: 'var(--texto-apagado)', opacity: 0.5 }} />
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)', margin: 0 }}>
        {enviando ? 'Enviando...' : 'Clique ou arraste o arquivo aqui'}
      </p>
      {!enviando && <p style={{ fontSize: '0.7rem', color: 'var(--texto-apagado)', fontFamily: 'var(--fonte-corpo)', margin: '4px 0 0' }}>{TIPOS_ACEITOS_TEXTO}</p>}
    </div>
  )

  return (
    <div>
      {!compacto && <p style={s.titulo}>Documentos</p>}

      {ordenados.length === 0 ? (
        <p style={{ color: 'var(--texto-apagado)', fontSize: '0.85rem', margin: podeGerenciar ? '0 0 14px' : 0 }}>Nenhum documento enviado ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: podeGerenciar ? '14px' : 0 }}>
          {ordenados.map(doc => (
            <div key={doc._id} style={s.linha}>
              <Icone.FileText size={16} style={{ color: 'var(--texto-apagado)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={s.nome}>{doc.nomeOriginal}</p>
                <p style={s.meta}>{formatarTamanho(doc.tamanho)} · {doc.enviadoPor?.nome || '—'} · {new Date(doc.enviadoEm).toLocaleDateString('pt-BR')}</p>
              </div>
              <button onClick={() => baixar(doc)} style={s.btnIcone} title="Baixar"><Icone.Download size={14} /></button>
              {podeGerenciar && (
                <button onClick={() => excluir(doc)} style={{ ...s.btnIcone, color: '#f87171' }} title="Excluir"><Icone.Trash size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {podeGerenciar && (
        <>
          <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple style={{ display: 'none' }}
            onChange={e => { enviarArquivos(e.target.files); e.target.value = '' }} disabled={enviando} />

          {!ocultarDropzone && caixaDropzone}

          {ocultarDropzone && popupAberto && (
            <Modal onFechar={() => !enviando && setPopupAberto(false)} maxWidth="380px">
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--texto)', fontFamily: 'var(--fonte-corpo)' }}>Carregar documento</span>
                  <button onClick={() => !enviando && setPopupAberto(false)} style={{ background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
                </div>
                {caixaDropzone}
              </div>
            </Modal>
          )}
        </>
      )}

    </div>
  )
})

export default ListaDocumentos

const s = {
  titulo: { fontSize: '0.85rem', fontWeight: '700', color: 'var(--texto)', margin: '0 0 12px', fontFamily: 'var(--fonte-corpo)' },
  linha: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 12px' },
  nome: { fontSize: '0.82rem', color: 'var(--texto)', margin: 0, fontFamily: 'var(--fonte-corpo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: '0.7rem', color: 'var(--texto-apagado)', margin: '2px 0 0', fontFamily: 'var(--fonte-corpo)' },
  btnIcone: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  dropzone: { border: '2px dashed var(--borda)', borderRadius: '12px', padding: '20px', textAlign: 'center', transition: 'all 0.15s' },
}
