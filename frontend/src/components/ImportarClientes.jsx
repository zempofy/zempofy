import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import Icone from './Icones'
import api from '../services/api'
import { useToast } from './Toast'

const PORTES_MAP = {
  'MEI': 'mei', 'ME': 'me', 'MICRO EMPRESA': 'me', 'MICRO': 'me',
  'EPP': 'epp', 'EMPRESA DE PEQUENO PORTE': 'epp', 'PEQUENO PORTE': 'epp',
  'GRANDE': 'grande', 'GRANDE PORTE': 'grande',
}
const REGIMES_MAP = {
  'SIMPLES NACIONAL': 'simples_nacional', 'SIMPLES': 'simples_nacional',
  'LUCRO PRESUMIDO': 'lucro_presumido', 'PRESUMIDO': 'lucro_presumido',
  'LUCRO REAL': 'lucro_real', 'REAL': 'lucro_real',
  'MEI': 'mei', 'OUTRO': 'outro',
}
const STATUS_MAP = {
  'ATIVO': 'ativo', 'ATIVA': 'ativo',
  'INATIVO': 'inativo', 'INATIVA': 'inativo',
  'EM ENCERRAMENTO': 'encerramento', 'ENCERRAMENTO': 'encerramento',
}

const mascaraCNPJ = (v) => v.replace(/\D/g,'').slice(0,14)
  .replace(/^(\d{2})(\d)/,'$1.$2')
  .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
  .replace(/\.(\d{3})(\d)/,'.$1/$2')
  .replace(/(\d{4})(\d)/,'$1-$2')

function baixarModelo() {
  const cabecalho = [
    ['Razão Social *', 'CNPJ *', 'Porte *', 'Regime *', 'Status *', 'Nome Fantasia', 'Telefone', 'E-mail'],
    ['', '', 'MEI / ME / EPP / Grande', 'Simples Nacional / Lucro Presumido / Lucro Real / MEI / Outro', 'Ativo / Inativo / Em encerramento', '', '', ''],
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([...cabecalho])

  // Larguras das colunas
  ws['!cols'] = [
    { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 22 }, { wch: 25 }, { wch: 18 }, { wch: 28 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
  XLSX.writeFile(wb, 'modelo_importacao_clientes.xlsx')
}

export default function ImportarClientes({ fechar, onImportado }) {
  const [etapa, setEtapa] = useState('upload') // upload | preview | enriquecendo | resultado
  const [clientes, setClientes] = useState([])
  const [enriquecidos, setEnriquecidos] = useState([])
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [importando, setImportando] = useState(false)
  const inputRef = useRef()
  const { mostrar } = useToast()

  const processarArquivo = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        // Pular as 2 primeiras linhas (cabeçalho + legenda)
        const dados = rows.slice(2).filter(row => row[0]?.toString().trim())

        const lista = dados.map(row => ({
          razaoSocial: row[0]?.toString().trim() || '',
          cnpj: row[1]?.toString().trim() ? mascaraCNPJ(row[1].toString().replace(/\D/g,'')) : '',
          porte: PORTES_MAP[row[2]?.toString().trim().toUpperCase()] || '',
          regime: REGIMES_MAP[row[3]?.toString().trim().toUpperCase()] || '',
          status: STATUS_MAP[row[4]?.toString().trim().toUpperCase()] || 'ativo',
          nomeFantasia: row[5]?.toString().trim() || '',
          telefone: row[6]?.toString().trim() || '',
          email: row[7]?.toString().trim() || '',
          socios: [],
          endereco: {},
          dataAbertura: null,
          cnaePrincipal: '',
          _enriquecido: false,
          _erro: '',
        }))

        if (!lista.length) return mostrar('Nenhum cliente encontrado na planilha.', 'aviso')
        setClientes(lista)
        setEtapa('preview')
      } catch { mostrar('Erro ao ler a planilha. Verifique o formato.', 'erro') }
    }
    reader.readAsBinaryString(file)
  }

  const enriquecerReceita = async () => {
    setEtapa('enriquecendo')
    const lista = [...clientes]
    const comCNPJ = lista.filter(c => c.cnpj.replace(/\D/g,'').length === 14)
    let feito = 0

    for (let i = 0; i < lista.length; i++) {
      const c = lista[i]
      const cnpjLimpo = c.cnpj.replace(/\D/g,'')
      if (cnpjLimpo.length === 14) {
        try {
          const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
          if (r.ok) {
            const data = await r.json()
            lista[i] = {
              ...c,
              razaoSocial: data.razao_social || c.razaoSocial,
              nomeFantasia: data.nome_fantasia || c.nomeFantasia || data.razao_social,
              dataAbertura: data.data_inicio_atividade || null,
              cnaePrincipal: data.cnae_fiscal ? String(data.cnae_fiscal) : '',
              // A Receita só confirma com certeza Simples Nacional e MEI — Lucro Presumido/Real
              // não têm como ser identificados via CNPJ, então mantém o que veio da planilha
              // (ou vazio) e sinaliza pra confirmação manual.
              regime: data.opcao_pelo_mei
                ? 'mei'
                : data.opcao_pelo_simples
                  ? 'simples_nacional'
                  : c.regime || '',
              _regimeIncerto: !data.opcao_pelo_mei && !data.opcao_pelo_simples,
              porte: (() => {
                const p = data.porte?.toUpperCase() || ''
                if (p.includes('MEI')) return 'mei'
                if (p.includes('MICRO')) return 'me'
                if (p.includes('PEQUENO')) return 'epp'
                if (p.includes('GRANDE') || p.includes('MÉDIO')) return 'grande'
                return c.porte
              })(),
              socios: data.qsa?.length
                ? data.qsa.map(s => ({ nome: s.nome_socio||'', cpf:'', telefone:'', email:'', qualificacao: s.qualificacao_socio||'' }))
                : [],
              endereco: {
                logradouro: data.logradouro || '',
                numero: data.numero || '',
                complemento: data.complemento || '',
                bairro: data.bairro || '',
                cidade: data.municipio || '',
                estado: data.uf || '',
                cep: data.cep ? data.cep.replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2') : '',
              },
              _enriquecido: true,
            }
          }
        } catch { lista[i]._erro = 'Não encontrado na Receita' }
        feito++
        setProgresso(Math.round((feito / comCNPJ.length) * 100))
        // Pequena pausa pra não sobrecarregar a API
        await new Promise(res => setTimeout(res, 400))
      }
    }
    setEnriquecidos(lista)
    setEtapa('preview')
    mostrar(`${comCNPJ.length} empresas consultadas na Receita Federal!`, 'sucesso')
  }

  const importar = async () => {
    setImportando(true)
    try {
      const lista = enriquecidos.length ? enriquecidos : clientes
      const r = await api.post('/clientes/importar', { clientes: lista })
      setResultado(r.data)
      setEtapa('resultado')
      onImportado()
    } catch { mostrar('Erro ao importar.', 'erro') }
    finally { setImportando(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'28px', flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:'700', color:'var(--texto)', margin:0, letterSpacing:'-0.03em', fontFamily:'Inter,sans-serif' }}>Importar clientes</h1>
          <p style={{ fontSize:'0.82rem', color:'var(--texto-apagado)', marginTop:'4px', fontFamily:'Inter,sans-serif' }}>Importe sua carteira de clientes via planilha Excel</p>
        </div>
        <button onClick={fechar} style={s.btnX}>✕</button>
      </div>

      {/* Etapa: upload */}
      {etapa === 'upload' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'20px' }}>
          {/* Passo 1 */}
          <div style={s.passo}>
            <div style={s.passoBadge}>1</div>
            <div style={{ flex:1 }}>
              <p style={s.passoTit}>Baixe o modelo de planilha</p>
              <p style={s.passoSub}>Preencha com os dados dos seus clientes. Campos com * são obrigatórios.</p>
              <button onClick={baixarModelo} style={{ ...s.btnSec, marginTop:'10px' }}>
                <span style={{display:'flex',alignItems:'center',gap:'6px'}}><Icone.Download size={14}/> Baixar modelo .xlsx</span>
              </button>
            </div>
          </div>

          {/* Passo 2 */}
          <div style={s.passo}>
            <div style={s.passoBadge}>2</div>
            <div style={{ flex:1 }}>
              <p style={s.passoTit}>Faça o upload da planilha preenchida</p>
              <p style={s.passoSub}>Formatos aceitos: .xlsx e .xls</p>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) processarArquivo(f) }}
                style={{ marginTop:'10px', border:'2px dashed var(--borda)', borderRadius:'12px', padding:'32px', textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--verde)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--borda)'}
              >
                <div style={{ display:'flex', justifyContent:'center', marginBottom:'12px' }}><Icone.FolderOpen size={32} style={{color:'var(--texto-apagado)',opacity:0.5}}/></div>
                <p style={{ fontSize:'0.875rem', color:'var(--texto)', fontFamily:'Inter,sans-serif', margin:0 }}>Clique ou arraste o arquivo aqui</p>
                <p style={{ fontSize:'0.75rem', color:'var(--texto-apagado)', fontFamily:'Inter,sans-serif', margin:'4px 0 0' }}>.xlsx ou .xls</p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e=>{ if(e.target.files[0]) processarArquivo(e.target.files[0]) }} />
            </div>
          </div>

          <div style={{ padding:'14px 16px', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:'10px' }}>
            <p style={{ fontSize:'0.78rem', color:'#fbbf24', margin:0, fontFamily:'Inter,sans-serif', lineHeight:'1.5' }}>
              <span style={{display:'flex',alignItems:'flex-start',gap:'8px'}}><Icone.AlertTriangle size={14} style={{color:'#fbbf24',flexShrink:0,marginTop:'1px'}}/> Após importar, complete as informações de cada cliente (serviços, sócios, endereço) editando individualmente.</span>
            </p>
          </div>
        </div>
      )}

      {/* Etapa: preview */}
      {etapa === 'preview' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, gap:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
            <p style={{ fontSize:'0.875rem', color:'var(--texto)', fontFamily:'Inter,sans-serif', margin:0 }}>
              <strong>{clientes.length}</strong> cliente(s) encontrado(s) na planilha
            </p>
            {!enriquecidos.length && clientes.some(c=>c.cnpj) && (
              <button onClick={enriquecerReceita} style={s.btnVerde}>
                <span style={{display:'flex',alignItems:'center',gap:'6px'}}><Icone.Building size={14}/> Enriquecer com dados da Receita Federal</span>
              </button>
            )}
            {enriquecidos.length > 0 && (
              <span style={{ fontSize:'0.75rem', color:'var(--verde)', fontWeight:'600' }}>✓ Dados enriquecidos com a Receita</span>
            )}
          </div>

          {/* Tabela preview */}
          <div style={{ flex:1, overflowY:'auto', border:'1px solid var(--borda)', borderRadius:'12px', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter,sans-serif', fontSize:'0.8rem' }}>
              <thead>
                <tr style={{ background:'var(--card)', borderBottom:'1px solid var(--borda)' }}>
                  {['Razão Social','CNPJ','Porte','Regime','Status','Receita'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(enriquecidos.length ? enriquecidos : clientes).map((c,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid var(--borda)', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding:'10px 14px', color:'var(--texto)', fontWeight:'500', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.razaoSocial}</td>
                    <td style={{ padding:'10px 14px', color:'var(--texto-apagado)' }}>{c.cnpj||'—'}</td>
                    <td style={{ padding:'10px 14px', color:'var(--texto-apagado)' }}>{c.porte?.toUpperCase()||'—'}</td>
                    <td style={{ padding:'10px 14px', color:'var(--texto-apagado)', maxWidth:'160px' }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{c.regime||'—'}</span>
                      {c._regimeIncerto && (
                        <span title="A Receita só confirma Simples Nacional e MEI — Lucro Presumido/Real precisa ser confirmado manualmente." style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'0.65rem', color:'#fbbf24', whiteSpace:'nowrap' }}>
                          <Icone.AlertTriangle size={10}/> confirmar manualmente
                        </span>
                      )}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:'0.7rem', fontWeight:'600', padding:'2px 8px', borderRadius:'99px', background: c.status==='ativo'?'rgba(0,177,65,0.1)':c.status==='inativo'?'rgba(248,113,113,0.1)':'rgba(251,191,36,0.1)', color: c.status==='ativo'?'#00b141':c.status==='inativo'?'#f87171':'#fbbf24' }}>
                        {c.status==='ativo'?'Ativo':c.status==='inativo'?'Inativo':'Encerramento'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      {c._enriquecido ? <span style={{ color:'#00b141', fontSize:'0.75rem', display:'flex', alignItems:'center', gap:'4px' }}><Icone.Check size={11}/>OK</span>
                      : c._erro ? <span style={{ color:'#f87171', fontSize:'0.72rem' }}>{c._erro}</span>
                      : <span style={{ color:'var(--texto-apagado)', fontSize:'0.72rem' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', flexShrink:0 }}>
            <button onClick={()=>{ setEtapa('upload'); setClientes([]); setEnriquecidos([]) }} style={s.btnCanc}>← Voltar</button>
            <button onClick={importar} disabled={importando} style={s.btnVerde}>
              {importando ? 'Importando...' : `Importar ${clientes.length} cliente(s)`}
            </button>
          </div>
        </div>
      )}

      {/* Etapa: enriquecendo */}
      {etapa === 'enriquecendo' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px' }}>
          <Icone.Building size={40} style={{color:'var(--verde)',opacity:0.7}}/>
          <p style={{ fontSize:'1rem', fontWeight:'600', color:'var(--texto)', fontFamily:'Inter,sans-serif' }}>Consultando a Receita Federal...</p>
          <div style={{ width:'300px' }}>
            <div style={{ height:'6px', background:'var(--borda)', borderRadius:'99px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progresso}%`, background:'var(--verde)', borderRadius:'99px', transition:'width 0.3s' }} />
            </div>
            <p style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', textAlign:'center', marginTop:'8px', fontFamily:'Inter,sans-serif' }}>{progresso}% concluído</p>
          </div>
          <p style={{ fontSize:'0.75rem', color:'var(--texto-apagado)', fontFamily:'Inter,sans-serif', textAlign:'center', maxWidth:'320px' }}>
            Buscando dados de endereço, sócios e atividade de cada empresa. Isso pode levar alguns segundos.
          </p>
        </div>
      )}

      {/* Etapa: resultado */}
      {etapa === 'resultado' && resultado && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px' }}>
          {resultado.importados > 0 ? <Icone.CheckCircle size={48} style={{color:'var(--verde)'}}/> : <Icone.AlertTriangle size={48} style={{color:'#fbbf24'}}/>}
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:'1.2rem', fontWeight:'700', color:'var(--texto)', fontFamily:'Inter,sans-serif', margin:'0 0 8px' }}>Importação concluída!</p>
            <p style={{ fontSize:'0.875rem', color:'var(--texto-apagado)', fontFamily:'Inter,sans-serif', margin:0 }}>
              <strong style={{ color:'#00b141' }}>{resultado.importados}</strong> importado(s)
              {resultado.atualizados > 0 && <> · <strong style={{ color:'#3b82f6' }}>{resultado.atualizados}</strong> atualizado(s) (CNPJ já existia)</>}
              {' '}· <strong style={{ color: resultado.ignorados>0?'#fbbf24':'var(--texto-apagado)' }}>{resultado.ignorados}</strong> ignorado(s)
            </p>
          </div>
          {resultado.erros?.length > 0 && (
            <div style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:'10px', padding:'14px 16px', width:'100%', maxWidth:'400px' }}>
              <p style={{ fontSize:'0.75rem', fontWeight:'600', color:'#fbbf24', margin:'0 0 8px', fontFamily:'Inter,sans-serif' }}>Avisos:</p>
              {resultado.erros.map((e,i)=><p key={i} style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:'2px 0', fontFamily:'Inter,sans-serif' }}>• {e}</p>)}
            </div>
          )}
          <button onClick={fechar} style={s.btnVerde}>Fechar</button>
        </div>
      )}
    </div>
  )
}

const s = {
  btnX: { background:'none', border:'1px solid var(--borda)', borderRadius:'6px', color:'var(--texto-apagado)', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', cursor:'pointer' },
  btnVerde: { background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.875rem', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,177,65,0.25)', whiteSpace:'nowrap' },
  btnSec: { background:'none', border:'1px solid var(--borda)', borderRadius:'8px', color:'var(--texto)', padding:'8px 16px', fontFamily:'Inter,sans-serif', fontWeight:'500', fontSize:'0.82rem', cursor:'pointer' },
  btnCanc: { background:'none', border:'1px solid var(--borda)', borderRadius:'10px', color:'var(--texto-apagado)', padding:'10px 20px', fontFamily:'Inter,sans-serif', fontWeight:'500', fontSize:'0.875rem', cursor:'pointer' },
  passo: { display:'flex', gap:'16px', alignItems:'flex-start', padding:'20px', background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px' },
  passoBadge: { width:'28px', height:'28px', borderRadius:'50%', background:'rgba(0,177,65,0.1)', border:'1px solid rgba(0,177,65,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.78rem', fontWeight:'700', color:'var(--verde)', flexShrink:0 },
  passoTit: { fontSize:'0.9rem', fontWeight:'600', color:'var(--texto)', margin:'0 0 4px', fontFamily:'Inter,sans-serif' },
  passoSub: { fontSize:'0.78rem', color:'var(--texto-apagado)', margin:0, fontFamily:'Inter,sans-serif' },
}
