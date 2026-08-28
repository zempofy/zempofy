import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import api from '../services/api'
import { useToast } from './Toast'
import Icone from './Icones'
import ModalConfirmacao from './ModalConfirmacao'
import Modal from './Modal'

const formatarTamanho = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [confirmarExclusao, setConfirmarExclusao] = useState(null)
  const [arrastando, setArrastando] = useState(false)
  const [popupAberto, setPopupAberto] = useState(false)
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({ abrirSeletor: () => setPopupAberto(true) }))

  const buscar = async () => {
    setCarregando(true)
    try {
      const url = tipo === 'geral'
        ? `/documentos/cliente/${clienteId}?incluirInativos=1`
        : `/documentos/demanda/${clienteId}/${setor._id}/${competencia}?incluirInativos=1`
      const res = await api.get(url)
      setDocumentos(res.data)
      onMudanca?.(res.data)
    } catch { mostrar('Erro ao carregar documentos.', 'erro') }
    finally { setCarregando(false) }
  }

  useEffect(() => { buscar() }, [clienteId, tipo, setor?._id, competencia])

  const enviarArquivo = async (arquivo) => {
    if (!arquivo) return
    if (arquivo.size > 16 * 1024 * 1024) return mostrar('Arquivo maior que 16MB.', 'erro')
    setEnviando(true)
    try {
      const form = new FormData()
      form.append('arquivo', arquivo)
      form.append('clienteId', clienteId)
      form.append('tipo', tipo)
      if (tipo === 'demanda') { form.append('setorId', setor._id); form.append('competencia', competencia) }
      await api.post('/documentos', form)
      mostrar('Documento enviado!', 'sucesso')
      buscar()
    } catch (e) { mostrar(e.response?.data?.erro || 'Erro ao enviar documento.', 'erro') }
    finally { setEnviando(false) }
  }

  // Usado pelo popup: envia e já fecha, tanto no caminho de clique quanto no de arrastar-e-soltar
  const escolherEEnviar = async (arquivo) => {
    if (!arquivo) return
    await enviarArquivo(arquivo)
    setPopupAberto(false)
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

  const inativar = async (doc) => {
    try {
      await api.patch(`/documentos/${doc._id}/inativar`)
      mostrar('Documento inativado.', 'sucesso')
      buscar()
    } catch (e) { mostrar(e.response?.data?.erro || 'Erro ao inativar.', 'erro') }
  }

  const excluirDefinitivo = async () => {
    try {
      await api.delete(`/documentos/${confirmarExclusao._id}`)
      mostrar('Documento excluído permanentemente.', 'sucesso')
      setConfirmarExclusao(null)
      buscar()
    } catch (e) { mostrar(e.response?.data?.erro || 'Erro ao excluir.', 'erro') }
  }

  const ordenados = [...documentos].sort((a, b) => {
    const iA = a.ativo ? 0 : 1, iB = b.ativo ? 0 : 1
    if (iA !== iB) return iA - iB
    return new Date(b.enviadoEm) - new Date(a.enviadoEm)
  })

  if (carregando) return <p style={{ color: 'var(--texto-apagado)', fontSize: '0.85rem' }}>Carregando...</p>

  const caixaDropzone = (
    <div
      onClick={() => !enviando && inputRef.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDragEnter={e => { e.preventDefault(); setArrastando(true) }}
      onDragLeave={e => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setArrastando(false) }}
      onDrop={e => { e.preventDefault(); setArrastando(false); escolherEEnviar(e.dataTransfer.files[0]) }}
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
      <p style={{ fontSize: '0.82rem', color: 'var(--texto)', fontFamily: 'Inter,sans-serif', margin: 0 }}>
        {enviando ? 'Enviando...' : 'Clique ou arraste o arquivo aqui'}
      </p>
      {!enviando && <p style={{ fontSize: '0.7rem', color: 'var(--texto-apagado)', fontFamily: 'Inter,sans-serif', margin: '4px 0 0' }}>{TIPOS_ACEITOS_TEXTO}</p>}
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
            <div key={doc._id} style={{ ...s.linha, opacity: doc.ativo ? 1 : 0.55 }}>
              <Icone.FileText size={16} style={{ color: 'var(--texto-apagado)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={s.nome}>{doc.nomeOriginal}</p>
                <p style={s.meta}>{formatarTamanho(doc.tamanho)} · {doc.enviadoPor?.nome || '—'} · {new Date(doc.enviadoEm).toLocaleDateString('pt-BR')}</p>
              </div>
              <button onClick={() => baixar(doc)} style={s.btnIcone} title="Baixar"><Icone.Download size={14} /></button>
              {podeGerenciar && (doc.ativo ? (
                <button onClick={() => inativar(doc)} style={s.btnIcone} title="Inativar"><Icone.X size={14} /></button>
              ) : (
                <button onClick={() => setConfirmarExclusao(doc)} style={{ ...s.btnIcone, color: '#f87171' }} title="Excluir definitivamente"><Icone.Trash size={14} /></button>
              ))}
            </div>
          ))}
        </div>
      )}

      {podeGerenciar && (
        <>
          <input ref={inputRef} type="file" accept={ACCEPT_ATTR} style={{ display: 'none' }}
            onChange={e => { escolherEEnviar(e.target.files[0]); e.target.value = '' }} disabled={enviando} />

          {!ocultarDropzone && caixaDropzone}

          {ocultarDropzone && popupAberto && (
            <Modal onFechar={() => !enviando && setPopupAberto(false)} maxWidth="380px">
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--texto)', fontFamily: 'Inter,sans-serif' }}>Carregar documento</span>
                  <button onClick={() => !enviando && setPopupAberto(false)} style={{ background: 'none', border: 'none', color: 'var(--texto-apagado)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
                </div>
                {caixaDropzone}
              </div>
            </Modal>
          )}
        </>
      )}

      {confirmarExclusao && (
        <ModalConfirmacao
          titulo="Excluir documento"
          mensagem={`Tem certeza que deseja excluir "${confirmarExclusao.nomeOriginal}" permanentemente? Essa ação não pode ser desfeita.`}
          textoBotao="Excluir" perigo
          onConfirmar={excluirDefinitivo}
          onCancelar={() => setConfirmarExclusao(null)}
        />
      )}
    </div>
  )
})

export default ListaDocumentos

const s = {
  titulo: { fontSize: '0.85rem', fontWeight: '700', color: 'var(--texto)', margin: '0 0 12px', fontFamily: 'Inter,sans-serif' },
  linha: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '10px 12px' },
  nome: { fontSize: '0.82rem', color: 'var(--texto)', margin: 0, fontFamily: 'Inter,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: '0.7rem', color: 'var(--texto-apagado)', margin: '2px 0 0', fontFamily: 'Inter,sans-serif' },
  btnIcone: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  dropzone: { border: '2px dashed var(--borda)', borderRadius: '12px', padding: '20px', textAlign: 'center', transition: 'all 0.15s' },
}
