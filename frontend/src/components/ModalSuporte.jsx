import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePreferencias } from '../contexts/PreferenciasContext'
import Modal from './Modal'
import api from '../services/api'
import { useToast } from './Toast'

export default function ModalSuporte({ fechar }) {
  const { usuario } = useAuth()
  const { tema } = usePreferencias()
  const { mostrar } = useToast()
  const colorScheme = tema === 'claro' ? 'light' : 'dark'
  const [assunto, setAssunto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    if (!assunto.trim() || !descricao.trim()) return
    setEnviando(true)
    try {
      await api.post('/feedback', {
        assunto: assunto.trim(),
        mensagem: descricao.trim(),
        nome: usuario?.nome,
        email: usuario?.email,
        empresa: usuario?.empresa?.nome,
      })
      mostrar('Mensagem enviada! Vamos responder por e-mail.', 'sucesso')
      setAssunto('')
      setDescricao('')
    } catch {
      mostrar('Erro ao enviar mensagem.', 'erro')
    } finally { setEnviando(false) }
  }

  return (
    <Modal onFechar={fechar} maxWidth="480px">
      <div style={styles.topo}>
        <span style={styles.titulo}>Suporte</span>
        <button style={styles.btnX} onClick={fechar}>✕</button>
      </div>

      <div style={styles.corpo}>
        <p style={styles.texto}>Encontrou um problema ou tem uma sugestão? Manda pra gente.</p>
        <div>
          <label style={styles.campoLabel}>Assunto</label>
          <input
            style={{ ...styles.input, colorScheme }}
            value={assunto}
            onChange={e => setAssunto(e.target.value)}
            placeholder="Resuma em poucas palavras"
            maxLength={120}
          />
        </div>
        <div>
          <label style={styles.campoLabel}>Descrição</label>
          <textarea
            style={{ ...styles.input, minHeight: '90px', resize: 'vertical', colorScheme }}
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Descreva o problema ou a sugestão..."
          />
        </div>
        <button
          style={{ ...styles.btnEnviar, opacity: (assunto.trim() && descricao.trim()) ? 1 : 0.6 }}
          onClick={enviar}
          disabled={enviando || !assunto.trim() || !descricao.trim()}
        >
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </Modal>
  )
}

const styles = {
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--borda)' },
  titulo: { fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '1rem', color: 'var(--texto)' },
  btnX: { background: 'none', border: '1px solid var(--borda)', borderRadius: '6px', color: 'var(--texto-apagado)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' },
  corpo: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' },
  texto: { fontSize: '0.8rem', color: 'var(--texto-apagado)', margin: 0, lineHeight: '1.4', fontFamily: 'Inter, sans-serif' },
  campoLabel: { fontSize: '0.7rem', fontWeight: '600', color: 'var(--texto-apagado)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', margin: '0 0 6px', fontFamily: 'Inter, sans-serif' },
  input: { width: '100%', background: 'var(--input)', border: '1px solid var(--borda)', borderRadius: '8px', padding: '9px 12px', color: 'var(--texto)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' },
  btnEnviar: { alignSelf: 'flex-start', background: 'var(--gradiente-verde)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' },
}
