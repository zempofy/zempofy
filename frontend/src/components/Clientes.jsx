import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import { useToast } from './Toast'
import Icone from './Icones'
import ImportarClientes from './ImportarClientes'
import { useAuth } from '../contexts/AuthContext'

// ── Máscaras ──
const mascaraCNPJ = (v) => v.replace(/\D/g,'').slice(0,14)
  .replace(/^(\d{2})(\d)/,'$1.$2')
  .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
  .replace(/\.(\d{3})(\d)/,'.$1/$2')
  .replace(/(\d{4})(\d)/,'$1-$2')
const mascaraCPF = (v) => v.replace(/\D/g,'').slice(0,11)
  .replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})/,'$1-$2')
const mascaraCEP = (v) => v.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d)/,'$1-$2')
const mascaraTel = (v) => { const d=v.replace(/\D/g,'').slice(0,11); return d.length<=10?d.replace(/(\d{2})(\d{4})(\d)/,'($1) $2-$3'):d.replace(/(\d{2})(\d{5})(\d)/,'($1) $2-$3') }
const mascaraCNAE = (v) => { const d=v.replace(/\D/g,'').slice(0,7); return d.replace(/(\d{4})(\d)(\d{2})/,'$1-$2/$3').replace(/(\d{4})(\d)/,'$1-$2') }

// ── Constantes ──
const REGIMES = [
  { value:'simples_nacional', label:'Simples Nacional' },
  { value:'lucro_presumido', label:'Lucro Presumido' },
  { value:'lucro_real', label:'Lucro Real' },
  { value:'mei', label:'MEI' },
  { value:'outro', label:'Outro' },
]
const PORTES = [
  { value:'mei', label:'MEI' },
  { value:'me', label:'ME' },
  { value:'epp', label:'EPP' },
  { value:'grande', label:'Grande' },
]
const STATUS_OPTS = [
  { value:'ativo', label:'Ativo', cor:'#00b141', bg:'rgba(0,177,65,0.12)' },
  { value:'inativo', label:'Inativo', cor:'#f87171', bg:'rgba(248,113,113,0.12)' },
  { value:'encerramento', label:'Em encerramento', cor:'#fbbf24', bg:'rgba(251,191,36,0.12)' },
]
const ATIVIDADES = [
  { value:'servico', label:'Prestação de serviço' },
  { value:'comercio', label:'Comércio' },
  { value:'industria', label:'Indústria' },
  { value:'servico_comercio', label:'Serviço e Comércio' },
  { value:'servico_industria', label:'Serviço e Indústria' },
  { value:'comercio_industria', label:'Comércio e Indústria' },
  { value:'todos', label:'Serviço, Comércio e Indústria' },
]
const PERIODICIDADES = [
  { value:'mensal', label:'Mensal' },
  { value:'trimestral', label:'Trimestral' },
  { value:'semestral', label:'Semestral' },
  { value:'anual', label:'Anual' },
  { value:'esporadico', label:'Esporádico' },
]

const normalizarNome = (str='') => str.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim()

// ── Subfiltros por setor (tela de Clientes) ──
// `campo` extrai o valor do cliente pra comparar; `opcoesFixas` é só a fonte de label —
// as pílulas exibidas são calculadas em cima de quem realmente aparece nos clientes do setor.
const SUBFILTROS_POR_SETOR = {
  fiscal: {
    campo: (cliente) => cliente.regime,
    opcoesFixas: REGIMES.filter(r=>r.value!=='outro'),
  },
  'departamento pessoal': {
    campo: (cliente) => cliente.configSetores?.['departamento pessoal']?.situacao || null,
    opcoesFixas: [
      { value:'pro_labore', label:'Só pró-labore' },
      { value:'clt', label:'Somente CLT' },
      { value:'ambos', label:'CLT + Pró-labore' },
      { value:null, label:'Não configurado' },
    ],
  },
  // contabil: entra depois que a "situação" (periodicidade) desse setor for fechada
}

// ── Config de campos da Demanda mensal por setor/regime ──
const CONFIG_DEMANDA = {
  fiscal: {
    porRegime: {
      simples_nacional: [
        { id:'totalVendas', label:'Total de vendas no mês', tipo:'moeda' },
        { id:'totalServicos', label:'Total de serviços prestados', tipo:'moeda' },
        { id:'das', label:'Valor do DAS', tipo:'moeda' },
        { id:'issRetido', label:'ISS Retido', tipo:'moeda' },
        { id:'icmsAntecipado', label:'ICMS Antecipado', tipo:'moeda' },
      ],
      lucro_presumido: [
        { id:'totalVendas', label:'Total de vendas no mês', tipo:'moeda' },
        { id:'totalServicos', label:'Total de serviços prestados', tipo:'moeda' },
        { id:'pis', label:'PIS', tipo:'moeda' },
        { id:'cofins', label:'COFINS', tipo:'moeda' },
        { id:'irpj', label:'IRPJ', tipo:'moeda' },
        { id:'csll', label:'CSLL', tipo:'moeda' },
        { id:'iss', label:'ISS', tipo:'moeda' },
        { id:'issProprio', label:'ISS Próprio', tipo:'moeda' },
        { id:'icmsAntecipado', label:'ICMS Antecipado', tipo:'moeda' },
        { id:'icmsProprio', label:'ICMS Próprio', tipo:'moeda' },
      ],
      lucro_real: [
        { id:'totalVendas', label:'Total de vendas no mês', tipo:'moeda' },
        { id:'totalServicos', label:'Total de serviços prestados', tipo:'moeda' },
        { id:'pis', label:'PIS', tipo:'moeda' },
        { id:'cofins', label:'COFINS', tipo:'moeda' },
        { id:'irpj', label:'IRPJ', tipo:'moeda' },
        { id:'csll', label:'CSLL', tipo:'moeda' },
        { id:'iss', label:'ISS', tipo:'moeda' },
        { id:'issProprio', label:'ISS Próprio', tipo:'moeda' },
        { id:'icmsAntecipado', label:'ICMS Antecipado', tipo:'moeda' },
        { id:'icmsProprio', label:'ICMS Próprio', tipo:'moeda' },
      ],
      // mei: definir campos quando for a vez
    }
  },

  'departamento pessoal': {
    perguntaInicial: {
      pergunta: 'Em qual situação essa empresa se encaixa?',
      opcoes: [
        { valor:'pro_labore', label:'Só pró-labore' },
        { valor:'clt', label:'Somente CLT' },
        { valor:'ambos', label:'CLT + Pró-labore' },
      ]
    },
    modulos: {
      clt: {
        ativoQuando: ['clt','ambos'],
        campos: [
          { id:'funcionariosAtivos', label:'Funcionários ativos no mês', tipo:'numero' },
          { id:'folhaProcessada', label:'Folha de pagamento processada', tipo:'booleano' },
          { id:'admissoes', label:'Nº de admissões no mês', tipo:'numero' },
          { id:'rescisoes', label:'Nº de rescisões no mês', tipo:'numero' },
          { id:'ferias', label:'Nº de férias programadas/pagas no mês', tipo:'numero' },
          { id:'esocialEnviado', label:'eSocial enviado', tipo:'booleano' },
          { id:'fgtsInssRecolhidos', label:'FGTS/INSS recolhidos', tipo:'booleano' },
        ],
        camposSazonais: {
          meses: [11,12],
          campos: [
            { id:'decimoTerceiroParcela1', label:'13º salário — 1ª parcela', tipo:'moeda' },
            { id:'decimoTerceiroParcela2', label:'13º salário — 2ª parcela', tipo:'moeda' },
          ]
        }
      },
      proLabore: {
        ativoQuando: ['pro_labore','ambos'],
        campos: [
          { id:'valorProLabore', label:'Valor do pró-labore', tipo:'moeda' },
          { id:'inssProLabore', label:'INSS (11%)', tipo:'moeda' },
          { id:'irrfProLabore', label:'IRRF', tipo:'moeda' },
          // campo 'guiaPaga' removido (27/07/2026) — vencimento é fixo dia 20, não há o que rastrear
        ]
      }
    },
    observacoesCompartilhadas: true
  }
  // contabil, financeiro: adicionar aqui quando escopo fechar
}

// Monta os blocos (cartões com título) de campos fixos pra um setor, dado o contexto
// (regime do cliente, situação respondida, competência sendo vista). Suporta os dois
// formatos de config: porRegime (Fiscal, um bloco só) e modulos com
// ativoQuando/camposSazonais (DP e futuros setores, um bloco por módulo ativo).
const ICONE_BLOCO = { fiscal: 'BarChart', clt: 'UsersThree', proLabore: 'CreditCard' }
const TITULO_MODULO = { clt: 'CLT', proLabore: 'Pró-labore' }

const blocosFixosDoSetor = (config, { regime, situacao, competencia }) => {
  if (!config) return []
  if (config.porRegime) {
    const campos = config.porRegime[regime] || []
    return campos.length ? [{ chave:'fiscal', titulo:`Faturamento e imposto — ${labelRegime(regime)}`, campos }] : []
  }
  if (config.modulos) {
    const blocos = []
    Object.entries(config.modulos).forEach(([chave, mod]) => {
      if (!mod.ativoQuando.includes(situacao)) return
      const campos = [...mod.campos]
      if (mod.camposSazonais) {
        const mes = Number(competencia.slice(5,7))
        if (mod.camposSazonais.meses.includes(mes)) campos.push(...mod.camposSazonais.campos)
      }
      blocos.push({ chave, titulo: TITULO_MODULO[chave] || chave, campos })
    })
    return blocos
  }
  return []
}

const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const nomeMes = (competencia) => MESES_NOME[Number(competencia.slice(5,7))-1]

const labelRegime = (v) => REGIMES.find(r=>r.value===v)?.label || v
const labelPorte = (v) => PORTES.find(r=>r.value===v)?.label || v
const labelPeriodicidade = (v) => PERIODICIDADES.find(p=>p.value===v)?.label || v
const statusInfo = (v) => STATUS_OPTS.find(s=>s.value===v) || STATUS_OPTS[0]
const formatMoeda = (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '—'
const formatData = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '—'
const isoData = (v) => v ? new Date(v).toISOString().split('T')[0] : ''

// ── Seção visual ──
function Secao({ titulo, children }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <p style={{ fontSize:'0.72rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'1.2px', margin:0, whiteSpace:'nowrap', fontFamily:'Inter,sans-serif' }}>{titulo}</p>
        <div style={{ flex:1, height:'1px', background:'var(--borda)' }} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, obrigatorio, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
      <label style={{ fontSize:'0.7rem', fontWeight:'600', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'Inter,sans-serif', lineHeight:'1.3', minHeight:'2.6em', display:'flex', alignItems:'flex-end' }}>
        {label}{obrigatorio && <span style={{ color:'#f87171', marginLeft:'3px' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function InfoLinha({ label, valor }) {
  return (
    <div style={{ marginBottom:'10px' }}>
      <span style={{ fontSize:'0.65rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:'2px' }}>{label}</span>
      <span style={{ fontSize:'0.875rem', color:'var(--texto)' }}>{valor}</span>
    </div>
  )
}

// ── Formulário (página única com scroll) ──
function FormCliente({ cliente, fechar, onSalvo }) {
  const { mostrar } = useToast()
  const [carregando, setCarregando] = useState(false)
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const [cidadesSugestoes, setCidadesSugestoes] = useState([])
  const [erro, setErro] = useState('')
  const [camposComErro, setCamposComErro] = useState([])
  const [setoresList, setSetoresList] = useState([])
  const [servicosCadastrados, setServicosCadastrados] = useState([])
  const [mostrarListaServicos, setMostrarListaServicos] = useState(false)

  const [form, setForm] = useState({
    razaoSocial: cliente?.razaoSocial || '',
    nomeFantasia: cliente?.nomeFantasia || '',
    cnpj: cliente?.cnpj || '',
    porte: cliente?.porte || '',
    regime: cliente?.regime || '',
    atividade: cliente?.atividade || '',
    dataAbertura: isoData(cliente?.dataAbertura),
    cnaePrincipal: cliente?.cnaePrincipal || '',
    status: cliente?.status || 'ativo',
    setores: cliente?.setores?.map(s => s._id || s) || [],
    telefone: cliente?.telefone || '',
    email: cliente?.email || '',
    endereco: {
      logradouro: cliente?.endereco?.logradouro||'',
      numero: cliente?.endereco?.numero||'',
      complemento: cliente?.endereco?.complemento||'',
      bairro: cliente?.endereco?.bairro||'',
      cidade: cliente?.endereco?.cidade||'',
      estado: cliente?.endereco?.estado||'',
      cep: cliente?.endereco?.cep||'',
    },
    socios: cliente?.socios?.length ? cliente.socios : (cliente?.socio?.nome ? [{ nome: cliente.socio.nome, cpf: cliente.socio.cpf||'', telefone: cliente.socio.telefone||'', email: cliente.socio.email||'', qualificacao:'' }] : [{ nome:'', cpf:'', telefone:'', email:'', qualificacao:'' }]),
    servicosContratados: cliente?.servicosContratados?.length
      ? cliente.servicosContratados.map(sv => ({ ...sv, dataInicio: isoData(sv.dataInicio), honorarioMensal: sv.honorarioMensal ? Math.round(Number(sv.honorarioMensal)*100) : '' }))
      : [{ nome:'', dataInicio:'', honorarioMensal:'', diaVencimento:'', periodicidade:'mensal' }],
    observacoes: cliente?.observacoes || '',
  })

  useEffect(() => {
    api.get('/setores').then(r => setSetoresList(r.data)).catch(()=>{})
    api.get('/servicos').then(r => setServicosCadastrados(r.data)).catch(()=>{})
  }, [])

  const set = (k,v) => { setForm(f=>({...f,[k]:v})); if(camposComErro.includes(k)) setCamposComErro(c=>c.filter(e=>e!==k)) }
  const inpErro = (campo) => camposComErro.includes(campo) ? { ...s.inp, borderColor:'#f87171', background:'rgba(248,113,113,0.05)' } : s.inp
  const setEnd = (k,v) => setForm(f=>({...f,endereco:{...f.endereco,[k]:v}}))
  const setSocio = (i,k,v) => setForm(f=>({...f,socios:f.socios.map((s,j)=>j===i?{...s,[k]:v}:s)}))
  const addSocio = () => setForm(f=>({...f,socios:[...f.socios,{nome:'',cpf:'',telefone:'',email:'',qualificacao:''}]}))
  const removeSocio = (i) => setForm(f=>({...f,socios:f.socios.filter((_,j)=>j!==i)}))
  const setSv = (i,k,v) => setForm(f=>({...f,servicosContratados:f.servicosContratados.map((s,j)=>j===i?{...s,[k]:v}:s)}))
  const addSv = () => setForm(f=>({...f,servicosContratados:[...f.servicosContratados,{nome:'',dataInicio:'',honorarioMensal:'',diaVencimento:'',periodicidade:'mensal'}]}))
  const removeSv = (i) => setForm(f=>({...f,servicosContratados:f.servicosContratados.filter((_,j)=>j!==i)}))

  const toggleSetor = (id) => setForm(f=>({
    ...f,
    setores: f.setores.includes(id) ? f.setores.filter(s=>s!==id) : [...f.setores, id]
  }))

  const usarServicoExistente = (sv) => {
    const honorario = sv.honorarioPadrao ? Math.round(Number(sv.honorarioPadrao)*100) : ''
    const novoSv = { nome:sv.nome, dataInicio:'', honorarioMensal:honorario, diaVencimento:'', periodicidade:sv.periodicidade||'mensal' }
    const semVazios = form.servicosContratados.filter(s=>s.nome.trim())
    setForm(f=>({...f,servicosContratados:[...semVazios,novoSv]}))
    setMostrarListaServicos(false)
  }

  // ── Busca CNPJ ──
  const buscarCNPJ = async () => {
    const cnpjLimpo = form.cnpj.replace(/\D/g,'')
    if (cnpjLimpo.length !== 14) return mostrar('Digite um CNPJ completo.', 'aviso')
    setBuscandoCNPJ(true)
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
      if (!r.ok) throw new Error('CNPJ não encontrado')
      const data = await r.json()
      setForm(f => ({
        ...f,
        razaoSocial: data.razao_social || f.razaoSocial,
        nomeFantasia: data.nome_fantasia || data.razao_social || f.nomeFantasia,
        dataAbertura: data.data_inicio_atividade ? data.data_inicio_atividade : f.dataAbertura,
        cnaePrincipal: data.cnae_fiscal ? String(data.cnae_fiscal) : f.cnaePrincipal,
        // atividade: não preenchida automaticamente — usuário deve selecionar
        porte: (() => {
          const p = data.porte?.toUpperCase() || ''
          if (p.includes('MEI')) return 'mei'
          if (p.includes('MICRO')) return 'me'
          if (p.includes('PEQUENO')) return 'epp'
          if (p.includes('MÉDIO') || p.includes('MEDIO') || p.includes('GRANDE')) return 'grande'
          return f.porte
        })(),
        socios: data.qsa?.length
          ? data.qsa.map(s => ({ nome: s.nome_socio||'', cpf:'', telefone:'', email:'', qualificacao: s.qualificacao_socio||'' }))
          : f.socios,
        endereco: {
          ...f.endereco,
          logradouro: data.logradouro || f.endereco.logradouro,
          numero: data.numero || f.endereco.numero,
          complemento: data.complemento || f.endereco.complemento,
          bairro: data.bairro || f.endereco.bairro,
          cidade: data.municipio || f.endereco.cidade,
          estado: data.uf || f.endereco.estado,
          cep: data.cep ? mascaraCEP(data.cep) : f.endereco.cep,
        }
      }))
      mostrar('Dados da empresa importados!', 'sucesso')
    } catch { mostrar('Não foi possível buscar o CNPJ. Verifique e tente novamente.', 'erro') }
    finally { setBuscandoCNPJ(false) }
  }

  // ── Busca CEP ──
  const buscarCidadesIBGE = async (uf, termoCidade) => {
    if (!uf || uf.length !== 2 || !termoCidade || termoCidade.length < 2) { setCidadesSugestoes([]); return }
    try {
      const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.toUpperCase()}/municipios`)
      const data = await r.json()
      const filtradas = data
        .filter(c => c.nome.toLowerCase().includes(termoCidade.toLowerCase()))
        .slice(0, 6)
        .map(c => c.nome)
      setCidadesSugestoes(filtradas)
    } catch {}
  }

  const buscarCEP = async (cep) => {
    const limpo = cep.replace(/\D/g,'')
    if (limpo.length !== 8) return
    setBuscandoCEP(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const data = await r.json()
      if (data.erro) throw new Error()
      setEnd('logradouro', data.logradouro || '')
      setEnd('bairro', data.bairro || '')
      setEnd('cidade', data.localidade || '')
      setEnd('estado', data.uf || '')
    } catch { mostrar('CEP não encontrado.', 'aviso') }
    finally { setBuscandoCEP(false) }
  }

  const salvar = async () => {
    const erros = []
    const campos = []
    if (!form.razaoSocial.trim()) { erros.push('Razão social'); campos.push('razaoSocial') }
    if (!form.porte) { erros.push('Porte'); campos.push('porte') }
    if (!form.regime) { erros.push('Regime tributário'); campos.push('regime') }
    // Serviço não é mais obrigatório
    if (form.email && !form.email.includes('@')) { erros.push('E-mail inválido'); campos.push('email') }
    if (erros.length) {
      setErro(`Preencha os campos obrigatórios: ${erros.join(', ')}.`)
      setCamposComErro(campos)
      return
    }
    setErro(''); setCamposComErro([]); setCarregando(true)
    const payload = {
      ...form,
      socios: form.socios.filter(s=>s.nome.trim()),
      servicosContratados: form.servicosContratados
        .filter(s=>s.nome.trim())
        .map(sv=>({...sv, honorarioMensal: sv.honorarioMensal ? (parseInt(sv.honorarioMensal,10)/100).toFixed(2) : 0}))
    }
    try {
      if (cliente?._id) { await api.put(`/clientes/${cliente._id}`, payload); mostrar('Cliente atualizado!','sucesso') }
      else { await api.post('/clientes', payload); mostrar('Cliente cadastrado!','sucesso') }
      onSalvo(); fechar()
    } catch(e) { setErro(e.response?.data?.erro || 'Erro ao salvar.') }
    finally { setCarregando(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'28px', flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:'700', color:'var(--texto)', margin:0, letterSpacing:'-0.03em', fontFamily:'Inter,sans-serif' }}>{cliente ? 'Editar cliente' : 'Novo cliente'}</h1>
          <p style={{ fontSize:'0.82rem', color:'var(--texto-apagado)', marginTop:'4px', fontFamily:'Inter,sans-serif' }}>Preencha as informações abaixo</p>
        </div>
        <button style={s.btnX} onClick={fechar} title="Cancelar">✕</button>
      </div>

      {/* Formulário com scroll */}
      <div style={{ flex:1, overflowY:'auto', paddingRight:'4px', paddingBottom:'24px' }}>

        {/* ── DADOS BÁSICOS ── */}
        <Secao titulo="Dados básicos">
          {/* CNPJ vem primeiro — com botão de busca */}
          <div style={{ display:'flex', gap:'10px', alignItems:'flex-end' }}>
            <Campo label="CNPJ">
              <input style={s.inp} value={form.cnpj} onChange={e=>set('cnpj',mascaraCNPJ(e.target.value))} placeholder="00.000.000/0000-00" onKeyDown={e=>e.key==='Enter'&&buscarCNPJ()} />
            </Campo>
            <button onClick={buscarCNPJ} disabled={buscandoCNPJ} style={{ ...s.btnSecundario, flexShrink:0, height:'38px', alignSelf:'flex-end', display:'flex', alignItems:'center', gap:'6px' }}>
              <Icone.Search size={13}/>{buscandoCNPJ ? 'Buscando...' : 'Buscar na Receita'}
            </button>
          </div>

          {/* Razão social */}
          <Campo label="Razão social" obrigatorio>
            <input style={camposComErro.includes('razaoSocial') ? { ...s.inp, fontSize:'1rem', borderColor:'#f87171', background:'rgba(248,113,113,0.05)' } : { ...s.inp, fontSize:'1rem' }} value={form.razaoSocial} onChange={e=>set('razaoSocial',e.target.value)} placeholder="Nome oficial da empresa" />
          </Campo>

          {/* Nome fantasia com botão copiar */}
          <Campo label="Nome fantasia">
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <input style={{ ...s.inp, flex:1 }} value={form.nomeFantasia} onChange={e=>set('nomeFantasia',e.target.value)} placeholder="Como é conhecido" />
              <button onClick={()=>set('nomeFantasia',form.razaoSocial)} title="Copiar razão social" style={{ background:'none', border:'1px solid var(--borda)', borderRadius:'8px', color:'var(--texto-apagado)', padding:'0 10px', height:'38px', cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0 }}>
                <Icone.Copy size={14}/>
              </button>
            </div>
          </Campo>

          {/* Porte + Regime + Status */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
            <Campo label="Porte" obrigatorio>
              <select style={inpErro('porte')} value={form.porte} onChange={e=>{
                const p=e.target.value; set('porte',p); if(p==='mei') set('regime','mei')
              }}>
                <option value="">Selecione</option>
                {PORTES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Campo>
            <Campo label="Regime tributário" obrigatorio>
              {form.porte==='mei'
                ? <div style={{...s.inp,color:'var(--texto-apagado)',background:'rgba(255,255,255,0.03)',display:'flex',alignItems:'center'}}>MEI</div>
                : <select style={inpErro('regime')} value={form.regime} onChange={e=>set('regime',e.target.value)}>
                    <option value="">Selecione</option>
                    {REGIMES.filter(r=>r.value!=='mei').map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
              }
            </Campo>
            <Campo label="Status">
              <select style={s.inp} value={form.status} onChange={e=>set('status',e.target.value)}>
                {STATUS_OPTS.map(st=><option key={st.value} value={st.value}>{st.label}</option>)}
              </select>
            </Campo>
          </div>

          {/* Atividade + CNAE + Data abertura */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 140px 160px', gap:'12px' }}>
            <Campo label="Atividade principal">
              <select style={s.inp} value={form.atividade} onChange={e=>set('atividade',e.target.value)}>
                <option value="">Selecione</option>
                {ATIVIDADES.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Campo>
            <Campo label="CNAE">
              <input style={s.inp} value={form.cnaePrincipal} onChange={e=>set('cnaePrincipal',mascaraCNAE(e.target.value))} placeholder="0000-0/00" />
            </Campo>
            <Campo label="Data de abertura">
              <input style={s.inp} type="date" value={form.dataAbertura} onChange={e=>set('dataAbertura',e.target.value)} />
            </Campo>
          </div>
        </Secao>

        {/* ── SETORES ── */}
        {setoresList.length > 0 && (
          <Secao titulo="Setores">
            <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
              {setoresList.map(setor => {
                const marcado = form.setores.includes(setor._id)
                return (
                  <button key={setor._id} onClick={()=>toggleSetor(setor._id)} style={{
                    display:'flex', alignItems:'center', gap:'8px', padding:'7px 14px',
                    borderRadius:'8px', cursor:'pointer', fontFamily:'Inter,sans-serif',
                    fontSize:'0.82rem', fontWeight:'500', transition:'all 0.12s',
                    background: marcado ? 'rgba(0,177,65,0.1)' : 'var(--input)',
                    border: `1px solid ${marcado ? 'rgba(0,177,65,0.3)' : 'var(--borda)'}`,
                    color: marcado ? 'var(--verde)' : 'var(--texto-apagado)',
                  }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: setor.cor || 'var(--verde)', flexShrink:0 }} />
                    {setor.nome}
                    {marcado && <Icone.Check size={11}/>}
                  </button>
                )
              })}
            </div>
          </Secao>
        )}

        {/* ── CONTATO ── */}
        <Secao titulo="Contato">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Campo label="Telefone">
              <input style={s.inp} value={form.telefone} onChange={e=>set('telefone',mascaraTel(e.target.value))} placeholder="(31) 99999-9999" />
            </Campo>
            <Campo label="E-mail">
              <input style={inpErro('email')} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="contato@empresa.com" />
            </Campo>
          </div>
          {/* CEP com busca automática */}
          <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:'12px' }}>
            <Campo label="CEP">
              <input style={s.inp} value={form.endereco.cep}
                onChange={e=>{ const v=mascaraCEP(e.target.value); setEnd('cep',v); if(v.replace(/\D/g,'').length===8) buscarCEP(v) }}
                placeholder="00000-000" />
            </Campo>
            <Campo label="Estado">
              <input style={s.inp} value={form.endereco.estado} onChange={e=>setEnd('estado',e.target.value.toUpperCase().slice(0,2))} placeholder="MG" />
            </Campo>
          </div>
          {buscandoCEP && <p style={{ fontSize:'0.75rem', color:'var(--texto-apagado)' }}>Buscando endereço...</p>}
          <Campo label="Logradouro">
            <input style={s.inp} value={form.endereco.logradouro} onChange={e=>setEnd('logradouro',e.target.value)} placeholder="Rua, Avenida..." />
          </Campo>
          <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:'12px' }}>
            <Campo label="Número">
              <input style={s.inp} value={form.endereco.numero} onChange={e=>setEnd('numero',e.target.value)} />
            </Campo>
            <Campo label="Complemento">
              <input style={s.inp} value={form.endereco.complemento} onChange={e=>setEnd('complemento',e.target.value)} placeholder="Sala, andar..." />
            </Campo>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Campo label="Bairro">
              <input style={s.inp} value={form.endereco.bairro} onChange={e=>setEnd('bairro',e.target.value)} />
            </Campo>
            <Campo label="Cidade">
              <div style={{ position:'relative' }}>
                <input style={s.inp} value={form.endereco.cidade}
                  onChange={e=>{ setEnd('cidade',e.target.value); buscarCidadesIBGE(form.endereco.estado, e.target.value) }}
                  onBlur={()=>setTimeout(()=>setCidadesSugestoes([]),150)}
                  autoComplete="off"
                />
                {cidadesSugestoes.length>0 && (
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.4)', zIndex:10, overflow:'hidden' }}>
                    {cidadesSugestoes.map(c=>(
                      <button key={c} onMouseDown={()=>{ setEnd('cidade',c); setCidadesSugestoes([]) }}
                        style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', borderBottom:'1px solid var(--borda)', color:'var(--texto)', fontSize:'0.82rem', cursor:'pointer', textAlign:'left', fontFamily:'Inter,sans-serif' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--input)'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}
                      >{c}</button>
                    ))}
                  </div>
                )}
              </div>
            </Campo>
          </div>
        </Secao>

        {/* ── SÓCIOS ── */}
        <Secao titulo="Sócios / Responsáveis">
          {form.socios.map((sc, i) => (
            <div key={i} style={{ border:'1px solid var(--borda)', borderRadius:'10px', padding:'14px', display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ fontSize:'0.78rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif' }}>Sócio {i+1}{sc.qualificacao ? ` — ${sc.qualificacao}` : ''}</p>
                {form.socios.length > 1 && <button onClick={()=>removeSocio(i)} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', fontSize:'11px', fontFamily:'Inter,sans-serif' }}>Remover</button>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <Campo label="Nome"><input style={s.inp} value={sc.nome} onChange={e=>setSocio(i,'nome',e.target.value)} /></Campo>
                <Campo label="CPF"><input style={s.inp} value={sc.cpf} onChange={e=>setSocio(i,'cpf',mascaraCPF(e.target.value))} placeholder="000.000.000-00" /></Campo>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <Campo label="Telefone"><input style={s.inp} value={sc.telefone} onChange={e=>setSocio(i,'telefone',mascaraTel(e.target.value))} /></Campo>
                <Campo label="E-mail"><input style={s.inp} value={sc.email} onChange={e=>setSocio(i,'email',e.target.value)} /></Campo>
              </div>
            </div>
          ))}
          <button onClick={addSocio} style={{ background:'none', border:'1px dashed var(--borda)', borderRadius:'10px', color:'var(--texto-apagado)', padding:'8px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.8rem', width:'100%' }}>
            + Adicionar sócio
          </button>
        </Secao>

        {/* ── SERVIÇOS ── */}
        <Secao titulo="Serviços contratados">
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            {servicosCadastrados.length > 0 && (
              <div style={{ position:'relative' }}>
                <button onClick={()=>setMostrarListaServicos(v=>!v)} style={{ ...s.btnSecundario }}>
                  📋 Usar serviço existente ▾
                </button>
                {mostrarListaServicos && (
                  <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'10px', boxShadow:'0 8px 24px rgba(0,0,0,0.4)', zIndex:10, minWidth:'220px', overflow:'hidden' }}>
                    {servicosCadastrados.map(sv=>(
                      <button key={sv._id} onClick={()=>usarServicoExistente(sv)} style={{ display:'flex', flexDirection:'column', width:'100%', padding:'10px 14px', background:'none', border:'none', borderBottom:'1px solid var(--borda)', cursor:'pointer', textAlign:'left' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--input)'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <span style={{ fontSize:'0.85rem', fontWeight:'600', color:'var(--texto)', fontFamily:'Inter,sans-serif' }}>{sv.nome}</span>
                        <span style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', fontFamily:'Inter,sans-serif' }}>{labelPeriodicidade(sv.periodicidade)}{sv.honorarioPadrao>0?` · R$ ${Number(sv.honorarioPadrao).toLocaleString('pt-BR',{minimumFractionDigits:2})}`:''}  </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {form.servicosContratados.map((sv,i)=>(
            <div key={i} style={{ border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)', margin:0, fontFamily:'Inter,sans-serif' }}>Serviço {i+1}</p>
                {form.servicosContratados.length>1 && <button onClick={()=>removeSv(i)} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', fontSize:'12px', fontFamily:'Inter,sans-serif' }}>Remover</button>}
              </div>
              <Campo label="Nome do serviço" obrigatorio>
                <input style={s.inp} value={sv.nome} onChange={e=>setSv(i,'nome',e.target.value)} placeholder="Ex: Contabilidade, Fiscal, DP..." />
              </Campo>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <Campo label="Periodicidade">
                  <select style={s.inp} value={sv.periodicidade||'mensal'} onChange={e=>setSv(i,'periodicidade',e.target.value)}>
                    {PERIODICIDADES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Campo>
                <Campo label="Honorário (R$)">
                  <input style={s.inp}
                    value={sv.honorarioMensal ? (parseInt(String(sv.honorarioMensal).replace(/\D/g,''),10)/100).toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''}
                    onChange={e=>{ const nums=e.target.value.replace(/\D/g,''); setSv(i,'honorarioMensal',nums?parseInt(nums,10):'') }}
                    placeholder="0,00" />
                </Campo>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <Campo label="Data início">
                  <input style={s.inp} type="date" value={sv.dataInicio} onChange={e=>setSv(i,'dataInicio',e.target.value)} />
                </Campo>
                <Campo label="Dia de vencimento">
                  <input style={s.inp} type="number" min="1" max="31" value={sv.diaVencimento} onChange={e=>setSv(i,'diaVencimento',e.target.value)} placeholder="Ex: 10" />
                </Campo>
              </div>
            </div>
          ))}
          <button onClick={addSv} style={{ background:'none', border:'1px dashed var(--borda)', borderRadius:'10px', color:'var(--texto-apagado)', padding:'10px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.82rem', width:'100%' }}>
            + Adicionar serviço
          </button>
        </Secao>

        {/* ── OBSERVAÇÕES ── */}
        <Secao titulo="Observações">
          <Campo label="Notas internas">
            <textarea style={{ ...s.inp, minHeight:'100px', resize:'vertical' }} value={form.observacoes} onChange={e=>set('observacoes',e.target.value)} placeholder="Particularidades do cliente, notas internas..." />
          </Campo>
        </Secao>
      </div>

      {/* Rodapé */}
      {erro && <p style={{ ...s.erro, marginBottom:'8px', flexShrink:0 }}>{erro}</p>}
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', paddingTop:'16px', borderTop:'1px solid var(--borda)', flexShrink:0 }}>
        <button style={s.btnCanc} onClick={fechar}>Cancelar</button>
        <button style={s.btnSalv} onClick={salvar} disabled={carregando}>{carregando?'Salvando...':cliente?'Salvar alterações':'Cadastrar cliente'}</button>
      </div>
    </div>
  )
}

// ── Barra de navegação de setores (segmented control com highlight deslizante) ──
function BarraSetoresCliente({ setores, setorAtivo, setorClicavel, onInformacoes, onSetor }) {
  const containerRef = useRef(null)
  const itemRefs = useRef({})
  const [highlight, setHighlight] = useState({ left:0, width:0, opacity:0, cor:'var(--texto-apagado)' })

  const itens = [{ chave:'__info__', label:'Informações', setor:null }, ...setores.map(s=>({ chave:s._id, label:s.nome, setor:s }))]
  const chaveAtiva = setorAtivo ? setorAtivo._id : '__info__'

  useEffect(() => {
    const container = containerRef.current
    const ativo = itemRefs.current[chaveAtiva]
    if (!container || !ativo) return
    const cRect = container.getBoundingClientRect()
    const aRect = ativo.getBoundingClientRect()
    const item = itens.find(i=>i.chave===chaveAtiva)
    setHighlight({ left: aRect.left - cRect.left, width: aRect.width, opacity: 1, cor: item?.setor?.cor || 'var(--texto-apagado)' })
  }, [chaveAtiva, setores.length])

  return (
    <div ref={containerRef} style={{ position:'relative', display:'inline-flex', maxWidth:'100%', background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'4px', marginBottom:'16px', overflowX:'auto' }}>
      <div style={{
        position:'absolute', top:'4px', bottom:'4px', left:`${highlight.left}px`, width:`${highlight.width}px`,
        background:'var(--card)', border:`1px solid ${highlight.cor}`, borderRadius:'9px', opacity:highlight.opacity,
        transition:'left 0.28s cubic-bezier(.4,0,.2,1), width 0.28s cubic-bezier(.4,0,.2,1), opacity 0.15s, border-color 0.2s',
      }}/>
      {itens.map(item => {
        const ehAtivo = item.chave === chaveAtiva
        const clicavel = !item.setor || setorClicavel(item.setor)
        return (
          <button key={item.chave}
            ref={el => { itemRefs.current[item.chave] = el }}
            onClick={() => item.setor ? onSetor(item.setor) : onInformacoes()}
            style={{
              position:'relative', zIndex:1, width:'104px', flexShrink:0, padding:'8px 10px', border:'none', background:'none',
              display:'flex', alignItems:'center', justifyContent:'center', minHeight:'36px',
              cursor: clicavel ? 'pointer' : 'default', fontFamily:'Inter,sans-serif', fontSize:'0.74rem', fontWeight:'600', lineHeight:'1.25',
              whiteSpace:'normal', textAlign:'center', color: ehAtivo ? (item.setor?.cor || 'var(--texto)') : 'var(--texto-apagado)',
              transition:'color 0.2s',
            }}>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Tela de detalhe ──
function TelaDetalhe({ clienteId, voltar, onAtualizado, abaInicial = 'info' }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [confirmInativar, setConfirmInativar] = useState(false)
  const [mudandoStatus, setMudandoStatus] = useState(false)
  const [aba, setAba] = useState(abaInicial)
  const [setorAtivo, setSetorAtivo] = useState(null)
  const { mostrar } = useToast()
  const { usuario, temPermissao } = useAuth()

  // Só tem acesso à Demanda/Histórico do setor quem está naquele setor (ou é titular) — e o setor precisa ter escopo fechado (CONFIG_DEMANDA)
  const setorTemDemanda = (setor) => {
    if (!CONFIG_DEMANDA[normalizarNome(setor?.nome||'')]) return false
    return usuario?.cargo === 'admin' || usuario?.setores?.includes(setor._id)
  }

  const clicarSetor = (setor) => {
    if (!setorTemDemanda(setor)) return
    if (setorAtivo?._id === setor._id) {
      setSetorAtivo(null)
      setAba('info')
    } else {
      setSetorAtivo(setor)
      setAba('particularidades')
    }
  }

  const buscar = async () => {
    setCarregando(true)
    try { const r=await api.get(`/clientes/${clienteId}`); setDados(r.data) }
    catch { mostrar('Erro ao carregar cliente.','erro') }
    finally { setCarregando(false) }
  }
  useEffect(()=>{buscar()},[clienteId])

  const inativar = async () => {
    setMudandoStatus(true)
    try {
      await api.put(`/clientes/${clienteId}`, { status: 'inativo' })
      mostrar('Cliente inativado.', 'aviso')
      setConfirmInativar(false)
      buscar(); onAtualizado()
    } catch { mostrar('Erro ao inativar.', 'erro') }
    finally { setMudandoStatus(false) }
  }

  const reativar = async () => {
    setMudandoStatus(true)
    try {
      await api.put(`/clientes/${clienteId}`, { status: 'ativo' })
      mostrar('Cliente reativado!', 'sucesso')
      buscar(); onAtualizado()
    } catch { mostrar('Erro ao reativar.', 'erro') }
    finally { setMudandoStatus(false) }
  }

  if (carregando) return <p style={{ color:'var(--texto-apagado)' }}>Carregando...</p>
  if (!dados) return null

  const nomeCliente = dados.razaoSocial||dados.nome||'—'
  const st = statusInfo(dados.status)
  const honorarioTotal = dados.servicosContratados?.reduce((a,sv)=>a+(Number(sv.honorarioMensal)||0),0)
  const abas = (setorAtivo && setorTemDemanda(setorAtivo))
    ? [{id:'particularidades',label:'Particularidades'},{id:'demanda',label:'Demanda'},{id:'historico',label:'Histórico'}]
    : [{id:'info',label:'Informações'},{id:'servicos',label:'Serviços'},{id:'onboardings',label:'Onboardings'},{id:'obs',label:'Observações'}]

  return (
    <div>
      {/* Voltar */}
      <button onClick={voltar} style={{ background:'none', border:'none', color:'var(--texto-apagado)', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.82rem', padding:'0 0 12px', display:'flex', alignItems:'center', gap:'6px' }}>← Voltar para clientes</button>

      {/* Cabeçalho modelo A */}
      <div style={{ marginBottom:'20px' }}>
        {/* Linha 1: avatar + nome + botões */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'42px', height:'42px', borderRadius:'10px', background:'var(--verde)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', fontWeight:'700', color:'#fff', flexShrink:0 }}>{nomeCliente.slice(0,2).toUpperCase()}</div>
            <div>
              <h1 style={{ fontSize:'1.3rem', fontWeight:'700', color:'var(--texto)', margin:0, letterSpacing:'-0.02em', fontFamily:'Inter,sans-serif' }}>{nomeCliente}</h1>
              {dados.nomeFantasia&&dados.nomeFantasia!==nomeCliente&&<p style={{ fontSize:'0.78rem', color:'var(--texto-apagado)', margin:'2px 0 0', fontFamily:'Inter,sans-serif' }}>{dados.nomeFantasia}</p>}
            </div>
          </div>
          {temPermissao('gerenciarClientes') && (
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              {dados.status!=='inativo' && (
                <button onClick={()=>setEditando(true)} style={{ ...s.btnAcao, display:'flex', alignItems:'center', gap:'5px' }}><Icone.Edit size={13}/>Editar</button>
              )}
              {dados.status==='inativo' ? (
                <button onClick={reativar} disabled={mudandoStatus} style={{ ...s.btnAcao, color:'var(--verde)', borderColor:'rgba(0,177,65,0.3)', display:'flex', alignItems:'center', gap:'5px' }}><Icone.CheckCircle size={13}/>{mudandoStatus?'Reativando...':'Reativar'}</button>
              ) : (
                <button onClick={()=>setConfirmInativar(true)} style={{ ...s.btnAcao, color:'#f87171', borderColor:'rgba(248,113,113,0.3)', display:'flex', alignItems:'center', gap:'5px' }}><Icone.X size={13}/>Inativar</button>
              )}
            </div>
          )}
        </div>

        {dados.setores?.filter(s=>s.nome).length>0 && (
          <BarraSetoresCliente
            setores={dados.setores.filter(s=>s.nome)}
            setorAtivo={setorAtivo}
            setorClicavel={setorTemDemanda}
            onInformacoes={()=>{ setSetorAtivo(null); setAba('info') }}
            onSetor={clicarSetor}
          />
        )}

        {/* Linha 2: status + origem */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 9px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:'600', fontFamily:'Inter,sans-serif', background:st.bg, color:st.cor }}>{st.label}</span>
          {dados.onboardings?.some(o=>o.status!=='concluida') ? (
            <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 9px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:'600', background:'rgba(0,177,65,0.08)', color:'var(--verde)', fontFamily:'Inter,sans-serif' }}>
              <Icone.ClipboardList size={11}/>Em onboarding
            </span>
          ) : dados.origem==='onboarding' ? (
            <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 9px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:'600', background:'var(--input)', color:'var(--texto-apagado)', border:'1px solid var(--borda)', fontFamily:'Inter,sans-serif' }}>
              <Icone.Zap size={11}/>Via onboarding
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ display:'flex', borderBottom:'1px solid var(--borda)', marginBottom:'24px', gap:'4px', overflowX:'auto' }}>
        {abas.map(a=>(
          <button key={a.id} onClick={()=>setAba(a.id)} style={{ background:'none', border:'none', borderBottom:`2px solid ${aba===a.id?'var(--verde)':'transparent'}`, color:aba===a.id?'var(--verde)':'var(--texto-apagado)', padding:'10px 16px', fontFamily:'Inter,sans-serif', fontSize:'0.85rem', fontWeight:aba===a.id?'600':'400', cursor:'pointer', whiteSpace:'nowrap' }}>{a.label}</button>
        ))}
      </div>

      {aba==='info'&&(
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'16px' }}>
          <div style={s.secCard}><p style={s.secTit}>Dados básicos</p><InfoLinha label="CNPJ" valor={dados.cnpj||'—'}/><InfoLinha label="Porte" valor={labelPorte(dados.porte)}/><InfoLinha label="Regime" valor={labelRegime(dados.regime)}/><InfoLinha label="Abertura" valor={formatData(dados.dataAbertura)}/><InfoLinha label="CNAE" valor={dados.cnaePrincipal||'—'}/></div>
          <div style={s.secCard}><p style={s.secTit}>Contato</p><InfoLinha label="Telefone" valor={dados.telefone||'—'}/><InfoLinha label="E-mail" valor={dados.email||'—'}/>{dados.endereco?.logradouro&&<InfoLinha label="Endereço" valor={`${dados.endereco.logradouro}, ${dados.endereco.numero}${dados.endereco.complemento?` - ${dados.endereco.complemento}`:''}, ${dados.endereco.bairro}, ${dados.endereco.cidade}/${dados.endereco.estado}`}/>}</div>
          {dados.socios?.filter(s=>s.nome).map((sc,i)=>(<div key={i} style={s.secCard}><p style={s.secTit}>Sócio {i+1}{sc.qualificacao?` — ${sc.qualificacao}`:''}</p><InfoLinha label="Nome" valor={sc.nome}/><InfoLinha label="CPF" valor={sc.cpf||'—'}/><InfoLinha label="Telefone" valor={sc.telefone||'—'}/><InfoLinha label="E-mail" valor={sc.email||'—'}/></div>))}
        </div>
      )}

      {aba==='servicos'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background:'rgba(0,177,65,0.06)', border:'1px solid rgba(0,177,65,0.15)', borderRadius:'12px' }}>
            <p style={{ fontSize:'0.85rem', color:'var(--texto-apagado)', margin:0 }}>Total de honorários mensais</p>
            <p style={{ fontSize:'1.1rem', fontWeight:'700', color:'var(--verde)', margin:0 }}>{formatMoeda(honorarioTotal)}</p>
          </div>
          {dados.servicosContratados?.map((sv,i)=>(
            <div key={i} style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px 20px' }}>
              <p style={{ fontWeight:'600', color:'var(--texto)', margin:'0 0 10px', fontSize:'0.95rem' }}>{sv.nome}</p>
              <div style={{ display:'flex', gap:'24px', flexWrap:'wrap' }}>
                <InfoLinha label="Periodicidade" valor={labelPeriodicidade(sv.periodicidade)}/>
                <InfoLinha label="Início" valor={formatData(sv.dataInicio)}/>
                <InfoLinha label="Honorário" valor={formatMoeda(sv.honorarioMensal)}/>
                <InfoLinha label="Vencimento" valor={sv.diaVencimento?`Dia ${sv.diaVencimento}`:'—'}/>
              </div>
            </div>
          ))}
          {!dados.servicosContratados?.length&&<p style={{ color:'var(--texto-apagado)', fontSize:'0.875rem' }}>Nenhum serviço cadastrado.</p>}
        </div>
      )}

      {aba==='onboardings'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {dados.onboardings?.length?dados.onboardings.map(o=>{
            const conc=o.etapas?.filter(e=>e.status==='concluida').length||0
            const tot=o.etapas?.length||0
            const pct=tot?Math.round((conc/tot)*100):0
            return(
              <div key={o._id} style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                  <div><p style={{ fontWeight:'600', color:'var(--texto)', margin:'0 0 3px', fontSize:'0.9rem' }}>{o.modelo?.nome||'Modelo removido'}</p><p style={{ fontSize:'0.75rem', color:'var(--texto-apagado)', margin:0 }}>Criado em {formatData(o.criadoEm)}</p></div>
                  <span style={{ fontSize:'0.75rem', fontWeight:'600', padding:'3px 10px', borderRadius:'99px', background:o.status==='concluida'?'rgba(0,177,65,0.1)':'rgba(251,191,36,0.1)', color:o.status==='concluida'?'#00b141':'#fbbf24' }}>{o.status==='concluida'?'Concluído':'Em andamento'}</span>
                </div>
                <div style={{ height:'4px', borderRadius:'99px', background:'var(--borda)', overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:'var(--verde)', borderRadius:'99px' }}/></div>
                <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:'5px 0 0' }}>{pct}% concluído</p>
              </div>
            )
          }):<p style={{ color:'var(--texto-apagado)', fontSize:'0.875rem' }}>Nenhum onboarding vinculado a este cliente.</p>}
        </div>
      )}

      {aba==='obs'&&(
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'20px' }}>
          {dados.observacoes?<p style={{ fontSize:'0.875rem', color:'var(--texto)', lineHeight:'1.6', margin:0, whiteSpace:'pre-wrap' }}>{dados.observacoes}</p>
          :<p style={{ color:'var(--texto-apagado)', fontSize:'0.875rem' }}>Nenhuma observação cadastrada.</p>}
        </div>
      )}

      {aba==='particularidades'&&setorAtivo&&(
        <AbaParticularidades key={setorAtivo._id} clienteId={clienteId} setor={setorAtivo} clienteAtivo={dados.status!=='inativo'}
          particularidades={(dados.particularidadesSetor||[]).filter(p=>p.setor===setorAtivo._id)}
          onSalvo={buscar}/>
      )}

      {aba==='demanda'&&setorAtivo&&(
        <AbaDemanda key={setorAtivo._id} clienteId={clienteId} setor={setorAtivo} clienteRegime={dados.regime}
          configSetor={dados.configSetores?.[normalizarNome(setorAtivo.nome)]}
          onAtualizado={buscar}/>
      )}

      {aba==='historico'&&setorAtivo&&(
        <AbaHistorico key={setorAtivo._id} clienteId={clienteId} setor={setorAtivo} clienteRegime={dados.regime}
          configSetor={dados.configSetores?.[normalizarNome(setorAtivo.nome)]}
          onAtualizado={buscar}/>
      )}

      {editando&&<div style={{ position:'fixed', inset:0, background:'var(--fundo)', zIndex:9999, padding:'32px', overflowY:'auto' }}><FormCliente cliente={dados} fechar={()=>setEditando(false)} onSalvo={()=>{buscar();onAtualizado()}} /></div>}

      {confirmInativar&&createPortal(
        <div style={s.overlay} onClick={()=>setConfirmInativar(false)}>
          <div style={{ ...s.modalPeq }} onClick={e=>e.stopPropagation()}>
            <div style={s.modalTopo}><p style={s.modalTit}>Inativar cliente</p><button style={s.btnX} onClick={()=>setConfirmInativar(false)}>✕</button></div>
            <div style={{ padding:'20px 24px' }}>
              <p style={{ fontSize:'0.875rem', color:'var(--texto)', margin:'0 0 12px', fontFamily:'Inter,sans-serif' }}>Tem certeza que deseja inativar <strong>{nomeCliente}</strong>?</p>
              <p style={{ fontSize:'0.8rem', color:'var(--texto-apagado)', background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'10px 12px', margin:0, fontFamily:'Inter,sans-serif', display:'flex', alignItems:'flex-start', gap:'8px' }}><Icone.AlertTriangle size={14} style={{flexShrink:0,marginTop:'1px'}}/> O cadastro e o histórico do cliente permanecem preservados. A reativação pode ser feita a qualquer momento; enquanto o cliente estiver inativo, a edição dos dados ficará bloqueada.</p>
            </div>
            <div style={s.modalRodape}>
              <button style={s.btnCanc} onClick={()=>setConfirmInativar(false)}>Cancelar</button>
              <button style={{ ...s.btnSalv, background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.3)', color:'#f87171' }} onClick={inativar} disabled={mudandoStatus}>{mudandoStatus?'Inativando...':'Inativar'}</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  )
}

const competenciaAtual = () => new Date().toISOString().slice(0,7)
const INICIO_DEMANDA_ANO = 2026
const MESES_LABEL = ['01 - Janeiro','02 - Fevereiro','03 - Março','04 - Abril','05 - Maio','06 - Junho','07 - Julho','08 - Agosto','09 - Setembro','10 - Outubro','11 - Novembro','12 - Dezembro']

// Renderiza o valor de um campo — editável (input por tipo) ou só leitura
function CampoValor({ tipo, valor, onChange, disabled }) {
  if (disabled) {
    if (tipo === 'moeda') return <div style={{ ...s.inp, background:'var(--card)', color:'var(--texto)' }}>{formatMoeda(valor)}</div>
    if (tipo === 'booleano') return <div style={{ ...s.inp, background:'var(--card)', color:'var(--texto)' }}>{valor===true?'Sim':valor===false?'Não':'—'}</div>
    return <div style={{ ...s.inp, background:'var(--card)', color:'var(--texto)' }}>{(valor===0?'0':valor)||'—'}</div>
  }
  if (tipo === 'moeda') {
    return <input style={s.inp}
      value={valor ? Number(valor).toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''}
      onChange={e => { const nums = e.target.value.replace(/\D/g,''); onChange(nums ? parseInt(nums,10)/100 : '') }}
      placeholder="0,00" />
  }
  if (tipo === 'numero') {
    return <input style={s.inp} type="number" value={valor ?? ''} onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))} />
  }
  if (tipo === 'booleano') {
    return (
      <div style={{ display:'flex', gap:'8px' }}>
        {[{v:true,l:'Sim'},{v:false,l:'Não'}].map(op=>(
          <button key={String(op.v)} type="button" onClick={()=>onChange(op.v)} style={{
            flex:1, padding:'9px', borderRadius:'8px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.85rem', fontWeight:'600',
            border:`1px solid ${valor===op.v?'rgba(0,177,65,0.3)':'var(--borda)'}`,
            background: valor===op.v?'rgba(0,177,65,0.08)':'var(--input)',
            color: valor===op.v?'var(--verde)':'var(--texto-apagado)',
          }}>{op.l}</button>
        ))}
      </div>
    )
  }
  return <input style={s.inp} value={valor||''} onChange={e=>onChange(e.target.value)} />
}

// ── Formulário de uma competência (mês atual ou mês passado, se quem vê tiver permissão) ──
function FormularioCompetencia({ clienteId, setor, clienteRegime, competencia, configSetor, onAtualizado }) {
  const { mostrar } = useToast()
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [lancamento, setLancamento] = useState(null)
  const [valores, setValores] = useState({})
  const [criandoCampo, setCriandoCampo] = useState(false)
  const [novoLabel, setNovoLabel] = useState('')
  const [novoTipo, setNovoTipo] = useState('moeda')
  const [criando, setCriando] = useState(false)
  const [respondendo, setRespondendo] = useState(false)

  const config = CONFIG_DEMANDA[normalizarNome(setor.nome)]
  const situacao = configSetor?.situacao
  const camposExtras = configSetor?.camposExtras || []
  const blocos = blocosFixosDoSetor(config, { regime: clienteRegime, situacao, competencia })

  useEffect(() => {
    setCarregando(true)
    api.get(`/clientes/${clienteId}/lancamentos/${setor._id}/${competencia}`)
      .then(r => { setLancamento(r.data); setValores(r.data?.dados || {}) })
      .catch(() => mostrar('Erro ao carregar dados.', 'erro'))
      .finally(() => setCarregando(false))
  }, [clienteId, setor._id, competencia])

  const setValor = (id, v) => setValores(vs => ({ ...vs, [id]: v }))
  const podeEditar = !!lancamento?.podeEditar

  const salvar = async () => {
    setSalvando(true)
    try {
      const r = await api.post(`/clientes/${clienteId}/lancamentos/${setor._id}/${competencia}`, { dados: valores })
      setLancamento(r.data)
      mostrar('Dados salvos!', 'sucesso')
    } catch (e) { mostrar(e.response?.data?.erro || 'Erro ao salvar.', 'erro') }
    finally { setSalvando(false) }
  }

  const criarCampo = async () => {
    if (!novoLabel.trim()) return
    setCriando(true)
    try {
      await api.post(`/clientes/${clienteId}/campos-extras/${setor._id}`, { label: novoLabel.trim(), tipo: novoTipo })
      setNovoLabel(''); setNovoTipo('moeda'); setCriandoCampo(false)
      mostrar('Campo criado!', 'sucesso')
      onAtualizado && onAtualizado()
    } catch (e) { mostrar(e.response?.data?.erro || 'Erro ao criar campo.', 'erro') }
    finally { setCriando(false) }
  }

  const responderPergunta = async (valor) => {
    setRespondendo(true)
    try {
      await api.patch(`/clientes/${clienteId}/config-setor/${setor._id}`, { situacao: valor })
      onAtualizado && onAtualizado()
    } catch (e) { mostrar(e.response?.data?.erro || 'Erro ao salvar.', 'erro') }
    finally { setRespondendo(false) }
  }

  if (carregando) return <p style={{ color:'var(--texto-apagado)' }}>Carregando...</p>

  if (config?.porRegime && !clienteRegime) return <p style={{ color:'var(--texto-apagado)', fontSize:'0.875rem' }}>Este cliente não tem regime tributário definido — edite o cadastro pra habilitar a demanda deste setor.</p>

  if (config?.perguntaInicial && !situacao && podeEditar) {
    return (
      <div>
        <p style={{ fontSize:'0.95rem', fontWeight:'600', color:'var(--texto)', marginBottom:'14px' }}>{config.perguntaInicial.pergunta}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxWidth:'320px' }}>
          {config.perguntaInicial.opcoes.map(op=>(
            <button key={op.valor} onClick={()=>responderPergunta(op.valor)} disabled={respondendo} style={{
              padding:'12px 16px', borderRadius:'10px', textAlign:'left', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.875rem', fontWeight:'500',
              border:'1px solid var(--borda)', background:'var(--card)', color:'var(--texto)',
            }}>{op.label}</button>
          ))}
        </div>
      </div>
    )
  }
  if (config?.perguntaInicial && !situacao && !podeEditar) {
    return <p style={{ color:'var(--texto-apagado)', fontSize:'0.875rem' }}>Ainda não foi respondida a pergunta inicial deste setor pra este cliente.</p>
  }

  const pillInfo = config?.porRegime
    ? { label:'Regime', valor: labelRegime(clienteRegime), hint: null }
    : (config?.perguntaInicial && situacao
        ? { label:'Situação', valor: config.perguntaInicial.opcoes.find(o=>o.valor===situacao)?.label || situacao, hint: null }
        : null)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px', marginBottom:'18px' }}>
        <p style={{ fontSize:'0.8rem', color:'var(--texto-apagado)', margin:0 }}>
          Competência {competencia}{!podeEditar ? ' · Somente leitura' : ''}
          {lancamento?.preenchidoPor?.nome && ` · Preenchido por ${lancamento.preenchidoPor.nome}`}
        </p>
        {pillInfo && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'99px', padding:'5px 12px' }}>
            <span style={{ fontSize:'0.72rem', color:'var(--texto-apagado)' }}>{pillInfo.label}:</span>
            <span style={{ fontSize:'0.72rem', color:'var(--texto)', fontWeight:'600' }}>{pillInfo.valor}</span>
            {pillInfo.hint && <span style={{ fontSize:'0.65rem', color:'var(--texto-apagado)' }}>· {pillInfo.hint}</span>}
          </div>
        )}
      </div>

      {blocos.length === 0 && camposExtras.length === 0 && (
        <p style={{ color:'var(--texto-apagado)', fontSize:'0.875rem', marginBottom:'16px' }}>Nenhum campo configurado ainda{podeEditar?'. Adicione um campo abaixo.':'.'}</p>
      )}

      {blocos.map(bloco => {
        const IconeBloco = Icone[ICONE_BLOCO[bloco.chave]] || Icone.FileText
        return (
          <div key={bloco.chave} style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'14px', padding:'18px', marginBottom:'14px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
              <div style={{ width:'26px', height:'26px', borderRadius:'7px', background:'rgba(0,177,65,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <IconeBloco size={14} style={{ color:'var(--verde)' }}/>
              </div>
              <p style={{ fontSize:'0.82rem', fontWeight:'700', color:'var(--texto)', margin:0 }}>{bloco.titulo}</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'14px' }}>
              {bloco.campos.map(c => (
                <Campo key={c.id} label={c.label}>
                  <CampoValor tipo={c.tipo} valor={valores[c.id]} onChange={v=>setValor(c.id, v)} disabled={!podeEditar} />
                </Campo>
              ))}
            </div>
          </div>
        )
      })}

      {camposExtras.length > 0 && (
        <div style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'14px', padding:'18px', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
            <div style={{ width:'26px', height:'26px', borderRadius:'7px', background:'rgba(0,177,65,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icone.Plus size={14} style={{ color:'var(--verde)' }}/>
            </div>
            <p style={{ fontSize:'0.82rem', fontWeight:'700', color:'var(--texto)', margin:0 }}>Campos adicionais</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'14px' }}>
            {camposExtras.map(c => (
              <Campo key={c.id} label={c.label}>
                <CampoValor tipo={c.tipo} valor={valores[c.id]} onChange={v=>setValor(c.id, v)} disabled={!podeEditar} />
              </Campo>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom:'20px' }}>
        <Campo label="Observações">
          {podeEditar ? (
            <textarea style={{ ...s.inp, minHeight:'56px', resize:'vertical' }} value={valores.observacoesGerais||''} onChange={e=>setValor('observacoesGerais', e.target.value)} placeholder="Opcional" />
          ) : (
            <div style={{ ...s.inp, background:'var(--card)', color:'var(--texto)', minHeight:'20px' }}>{valores.observacoesGerais || '—'}</div>
          )}
        </Campo>
      </div>

      {podeEditar && (criandoCampo ? (
        <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', marginBottom:'20px', flexWrap:'wrap', border:'1px dashed var(--borda)', borderRadius:'10px', padding:'14px' }}>
          <div style={{ flex:1, minWidth:'180px' }}>
            <Campo label="Nome do campo">
              <input style={s.inp} value={novoLabel} onChange={e=>setNovoLabel(e.target.value)} placeholder="Ex: Diferencial de alíquota" autoFocus onKeyDown={e=>e.key==='Enter'&&criarCampo()} />
            </Campo>
          </div>
          <div style={{ width:'150px' }}>
            <Campo label="Tipo">
              <select style={s.inp} value={novoTipo} onChange={e=>setNovoTipo(e.target.value)}>
                <option value="moeda">Valor (R$)</option>
                <option value="texto">Texto</option>
                <option value="numero">Número</option>
                <option value="booleano">Sim / Não</option>
              </select>
            </Campo>
          </div>
          <button style={s.btnSalv} onClick={criarCampo} disabled={criando}>{criando?'Criando...':'Adicionar'}</button>
          <button style={s.btnCanc} onClick={()=>{setCriandoCampo(false);setNovoLabel('')}}>Cancelar</button>
        </div>
      ) : (
        <button onClick={()=>setCriandoCampo(true)} style={{ background:'none', border:'1px dashed var(--borda)', borderRadius:'10px', color:'var(--texto-apagado)', padding:'10px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.82rem', width:'100%', marginBottom:'20px' }}>
          + Adicionar campo
        </button>
      ))}

      {podeEditar && (
        <button style={s.btnSalv} onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : `Salvar demanda de ${nomeMes(competencia)}`}
        </button>
      )}
    </div>
  )
}

// ── Particularidades: lista de anotações do cliente pra um setor, sem vínculo com competência ──
function AbaParticularidades({ clienteId, setor, clienteAtivo, particularidades=[], onSalvo }) {
  const { mostrar } = useToast()
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  const lista = [...particularidades].sort((a,b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm))

  const salvar = async () => {
    if (!texto.trim()) return
    setSalvando(true)
    try {
      await api.post(`/clientes/${clienteId}/particularidades/${setor._id}`, { texto: texto.trim() })
      mostrar('Particularidade adicionada!', 'sucesso')
      setTexto('')
      onSalvo && onSalvo()
    } catch (e) { mostrar(e.response?.data?.erro || 'Erro ao salvar.', 'erro') }
    finally { setSalvando(false) }
  }

  return (
    <div>
      <p style={{ fontSize:'0.8rem', color:'var(--texto-apagado)', marginBottom:'12px' }}>
        Anotações específicas deste cliente pro setor {setor.nome}
      </p>
      {clienteAtivo && (
        <div style={{ marginBottom:'22px' }}>
          <textarea style={{ ...s.inp, minHeight:'70px', resize:'vertical' }} value={texto} onChange={e=>setTexto(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)) salvar() }}
            placeholder='Ex: "Sem movimento, mas conferir se teve alguma nota fiscal emitida" ou "Tem vantagem X pelo sindicato"...' />
          <button style={{ ...s.btnSalv, marginTop:'10px' }} onClick={salvar} disabled={salvando || !texto.trim()}>{salvando?'Salvando...':'+ Adicionar anotação'}</button>
        </div>
      )}

      {lista.length === 0 ? (
        <p style={{ color:'var(--texto-apagado)', fontSize:'0.875rem' }}>Nenhuma particularidade anotada ainda.</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {lista.map(p => (
            <div key={p._id} style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'14px 16px' }}>
              <p style={{ fontSize:'0.875rem', color:'var(--texto)', margin:'0 0 8px', whiteSpace:'pre-wrap', lineHeight:'1.5' }}>{p.texto}</p>
              <p style={{ fontSize:'0.68rem', color:'var(--texto-apagado)', margin:0 }}>{p.atualizadoPor?.nome||'—'} · {p.atualizadoEm ? new Date(p.atualizadoEm).toLocaleString('pt-BR') : '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Demanda mensal (atalho pro mês corrente) ──
function AbaDemanda({ clienteId, setor, clienteRegime, configSetor, onAtualizado }) {
  return <FormularioCompetencia clienteId={clienteId} setor={setor} clienteRegime={clienteRegime} competencia={competenciaAtual()} configSetor={configSetor} onAtualizado={onAtualizado}/>
}

// ── Histórico: pastas de ano → mês → dados daquele mês ──
function AbaHistorico({ clienteId, setor, clienteRegime, configSetor, onAtualizado }) {
  const { mostrar } = useToast()
  const [carregando, setCarregando] = useState(true)
  const [lancamentos, setLancamentos] = useState([])
  const [anoSelecionado, setAnoSelecionado] = useState(null)
  const [mesSelecionado, setMesSelecionado] = useState(null)

  const carregarLista = () => {
    setCarregando(true)
    api.get(`/clientes/${clienteId}/lancamentos/${setor._id}`)
      .then(r => setLancamentos(r.data))
      .catch(() => mostrar('Erro ao carregar histórico.', 'erro'))
      .finally(() => setCarregando(false))
  }
  useEffect(() => { carregarLista() }, [clienteId, setor._id])

  if (carregando) return <p style={{ color:'var(--texto-apagado)' }}>Carregando...</p>

  const preenchidos = new Set(lancamentos.map(l => l.competencia))
  const atual = competenciaAtual()
  const anoAtual = Number(atual.slice(0,4))
  const mesAtualNum = Number(atual.slice(5,7))

  const btnPasta = { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', padding:'20px 12px', background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.82rem', fontWeight:'600', color:'var(--texto)' }
  const btnVoltar = { background:'none', border:'none', color:'var(--texto-apagado)', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'0.82rem', padding:'0 0 16px', display:'flex', alignItems:'center', gap:'6px' }

  // Nível 3 — dados do mês selecionado
  if (mesSelecionado) {
    const [ano, mes] = mesSelecionado.split('-')
    return (
      <div>
        <button onClick={()=>setMesSelecionado(null)} style={btnVoltar}><Icone.ChevronLeft size={14}/> {MESES_LABEL[Number(mes)-1]} de {ano}</button>
        <FormularioCompetencia clienteId={clienteId} setor={setor} clienteRegime={clienteRegime} competencia={mesSelecionado}
          configSetor={configSetor} onAtualizado={()=>{ onAtualizado&&onAtualizado(); carregarLista() }}/>
      </div>
    )
  }

  // Nível 2 — meses do ano selecionado
  if (anoSelecionado) {
    const ultimoMes = anoSelecionado === anoAtual ? mesAtualNum : 12
    return (
      <div>
        <button onClick={()=>setAnoSelecionado(null)} style={btnVoltar}><Icone.ChevronLeft size={14}/> Anos</button>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'12px' }}>
          {MESES_LABEL.slice(0, ultimoMes).map((label, i) => {
            const mm = String(i+1).padStart(2,'0')
            const competencia = `${anoSelecionado}-${mm}`
            const preenchido = preenchidos.has(competencia)
            return (
              <button key={competencia} onClick={()=>setMesSelecionado(competencia)} style={btnPasta}>
                <Icone.FolderOpen size={22} style={{ color: preenchido?'var(--verde)':'var(--texto-apagado)' }}/>
                <span>{label}</span>
                {preenchido && <span style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'0.65rem', color:'var(--verde)', fontWeight:'700' }}><Icone.Check size={10}/> Preenchido</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Nível 1 — anos
  const anos = []
  for (let a = INICIO_DEMANDA_ANO; a <= anoAtual; a++) anos.push(a)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'12px' }}>
      {anos.map(a => (
        <button key={a} onClick={()=>setAnoSelecionado(a)} style={btnPasta}>
          <Icone.FolderOpen size={24}/>
          <span>{a}</span>
        </button>
      ))}
    </div>
  )
}

// ── Card do cliente ──
function CardCliente({ cliente, onClick }) {
  const st = statusInfo(cliente.status)
  const inativo = cliente.status==='inativo'
  const honorarioTotal = cliente.servicosContratados?.reduce((a,sv)=>a+(Number(sv.honorarioMensal)||0),0)
  const nomeCliente = cliente.razaoSocial||cliente.nome||'—'
  return (
    <div onClick={onClick} style={{ background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'14px', padding:'20px', cursor:'pointer', position:'relative', transition:'border-color 0.15s, transform 0.1s, opacity 0.15s', opacity: inativo?0.55:1 }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=inativo?'var(--borda)':'rgba(0,177,65,0.3)';e.currentTarget.style.transform='translateY(-1px)'}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--borda)';e.currentTarget.style.transform='translateY(0)'}}>
      <div style={{ position:'absolute', top:'14px', right:'14px', width:'10px', height:'10px', borderRadius:'50%', background:st.cor, boxShadow:`0 0 6px ${st.cor}60` }} title={st.label}/>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
        <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'var(--verde)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', fontWeight:'700', color:'#fff', flexShrink:0 }}>{nomeCliente.slice(0,2).toUpperCase()}</div>
        <div style={{ minWidth:0 }}>
          <p style={{ fontWeight:'600', color:'var(--texto)', margin:0, fontSize:'0.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{nomeCliente}</p>
          <p style={{ fontSize:'0.72rem', color:'var(--texto-apagado)', margin:'2px 0 0' }}>{cliente.cnpj||'Sem CNPJ'}</p>
        </div>
      </div>
      <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
        {cliente.regime&&<span style={{ fontSize:'0.68rem', fontWeight:'600', padding:'2px 8px', borderRadius:'5px', background:'var(--input)', color:'var(--texto-apagado)' }}>{labelRegime(cliente.regime)}</span>}
        {cliente.porte&&<span style={{ fontSize:'0.68rem', fontWeight:'600', padding:'2px 8px', borderRadius:'5px', background:'var(--input)', color:'var(--texto-apagado)' }}>{labelPorte(cliente.porte).toUpperCase()}</span>}
      </div>
      {cliente.setores?.length>0&&(
        <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'10px' }}>
          {cliente.setores.slice(0,3).map(setor=>(
            <span key={setor._id||setor} style={{ fontSize:'0.63rem', fontWeight:'600', padding:'2px 7px', borderRadius:'4px', background:'var(--input)', color:'var(--texto-apagado)', border:'1px solid var(--borda)' }}>
              {setor.nome||setor}
            </span>
          ))}
          {cliente.setores.length>3&&<span style={{ fontSize:'0.63rem', color:'var(--texto-apagado)' }}>+{cliente.setores.length-3}</span>}
        </div>
      )}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom: (cliente._emOnboarding || cliente.origem==='onboarding') ? '10px' : '0' }}>
        {cliente._emOnboarding && (
          <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'3px 8px', background:'rgba(0,177,65,0.08)', border:'1px solid rgba(0,177,65,0.2)', borderRadius:'6px' }}>
            <Icone.ClipboardList size={11} style={{ color:'var(--verde)' }}/>
            <span style={{ fontSize:'0.63rem', fontWeight:'700', color:'var(--verde)', fontFamily:'Inter,sans-serif', letterSpacing:'0.3px' }}>
              EM ONBOARDING{cliente._pctOnboarding !== null ? ` · ${cliente._pctOnboarding}%` : ''}
            </span>
          </div>
        )}
        {cliente.origem === 'onboarding' && !cliente._emOnboarding && (
          <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'3px 8px', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'6px' }}>
            <Icone.Zap size={11} style={{ color:'#818cf8' }}/>
            <span style={{ fontSize:'0.63rem', fontWeight:'700', color:'#818cf8', fontFamily:'Inter,sans-serif', letterSpacing:'0.3px' }}>VIA ONBOARDING</span>
          </div>
        )}
      </div>
      {cliente._emOnboarding && cliente._pctOnboarding !== null && (
        <div style={{ marginBottom:'10px' }}>
          <div style={{ height:'3px', background:'var(--borda)', borderRadius:'99px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${cliente._pctOnboarding}%`, background:'var(--verde)', borderRadius:'99px' }}/>
          </div>
        </div>
      )}
      <div style={{ borderTop:'1px solid var(--borda)', paddingTop:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'0.72rem', color:'var(--texto-apagado)' }}>Honorário mensal</span>
        <span style={{ fontSize:'0.9rem', fontWeight:'700', color:honorarioTotal?'var(--verde)':'var(--texto-apagado)' }}>{formatMoeda(honorarioTotal)}</span>
      </div>
    </div>
  )
}

// ── Componente principal ──
export default function Clientes({ detalheInicial = null, abaInicial = 'info', onDetalheAberto }) {
  const [clientes, setClientes] = useState([])
  const [setoresList, setSetoresList] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroSetor, setFiltroSetor] = useState(null)
  // undefined = "Todos" (sem subfiltro ativo) — precisa ser diferente de null porque
  // o DP tem uma opção real de valor null ("Não configurado")
  const [subFiltro, setSubFiltro] = useState(undefined)
  const [formAberto, setFormAberto] = useState(false)
  const [importarAberto, setImportarAberto] = useState(false)
  const [detalheId, setDetalheId] = useState(() => {
    // Verificar localStorage na montagem
    const salvo = localStorage.getItem('zempofy_abrir_cliente')
    if (salvo) {
      localStorage.removeItem('zempofy_abrir_cliente')
      return salvo
    }
    return detalheInicial || null
  })

  useEffect(() => {
    if (detalheInicial && detalheInicial !== detalheId) {
      setDetalheId(detalheInicial)
    }
  }, [detalheInicial])
  const { mostrar } = useToast()
  const { temPermissao } = useAuth()

  const carregar = async () => {
    setCarregando(true)
    try {
      const [rC, rS, rI] = await Promise.all([api.get('/clientes'), api.get('/setores'), api.get('/implantacoes')])
      const impsAtivas = rI.data.filter(i => i.status !== 'concluida')
      const cnpjsEmOnboarding = new Set(impsAtivas.map(i => i.cnpj?.replace(/\D/g,'')).filter(Boolean))
      const clientesComBadge = rC.data.map(c => {
        const cnpjLimpo = c.cnpj?.replace(/\D/g,'')
        const imp = cnpjLimpo ? impsAtivas.find(i => i.cnpj?.replace(/\D/g,'') === cnpjLimpo) : null
        const pct = imp ? (() => {
          const total = imp.etapas?.length || 0
          const conc = imp.etapas?.filter(e => e.status === 'concluida').length || 0
          return total ? Math.round((conc/total)*100) : 0
        })() : null
        return { ...c, _emOnboarding: !!imp, _pctOnboarding: pct }
      })
      setClientes(clientesComBadge)
      setSetoresList(rS.data)
    } catch { mostrar('Erro ao carregar clientes.','erro') }
    finally { setCarregando(false) }
  }
  useEffect(()=>{carregar()},[])
  useEffect(()=>{ setSubFiltro(undefined) }, [filtroSetor])

  const setorFiltroAtivo = filtroSetor ? setoresList.find(x=>x._id===filtroSetor) : null
  const subFiltroConfig = setorFiltroAtivo ? SUBFILTROS_POR_SETOR[normalizarNome(setorFiltroAtivo.nome)] : null

  // Pílulas visíveis = só as opções fixas cujo valor aparece em pelo menos 1 cliente do setor selecionado
  const clientesDoSetorFiltrado = filtroSetor ? clientes.filter(c => c.setores?.some(s=>(s._id||s)===filtroSetor)) : []
  const valoresPresentes = subFiltroConfig ? new Set(clientesDoSetorFiltrado.map(c => subFiltroConfig.campo(c))) : new Set()
  const opcoesVisiveis = subFiltroConfig ? subFiltroConfig.opcoesFixas.filter(op => valoresPresentes.has(op.value)) : []

  const filtrados = clientes.filter(c=>{
    const nome = c.razaoSocial||c.nome||''
    const matchBusca = nome.toLowerCase().includes(busca.toLowerCase()) || c.nomeFantasia?.toLowerCase().includes(busca.toLowerCase()) || c.cnpj?.includes(busca)
    const matchSetor = !filtroSetor || c.setores?.some(s=>(s._id||s)===filtroSetor)
    const matchSubFiltro = !subFiltroConfig || subFiltro===undefined || subFiltroConfig.campo(c)===subFiltro
    return matchBusca && matchSetor && matchSubFiltro
  }).sort((a,b)=>{
    const inativoA = a.status==='inativo' ? 1 : 0
    const inativoB = b.status==='inativo' ? 1 : 0
    if (inativoA !== inativoB) return inativoA - inativoB
    const nomeA = (a.razaoSocial||a.nome||'').toLowerCase().trim()
    const nomeB = (b.razaoSocial||b.nome||'').toLowerCase().trim()
    return nomeA.localeCompare(nomeB, 'pt-BR', { numeric: true })
  })

  if (detalheId) return <TelaDetalhe clienteId={detalheId} abaInicial={detalheInicial===detalheId?abaInicial:'info'} voltar={()=>{ setDetalheId(null); onDetalheAberto&&onDetalheAberto() }} onAtualizado={carregar}/>
  if (formAberto) return <FormCliente fechar={()=>setFormAberto(false)} onSalvo={carregar}/>
  if (importarAberto) return <ImportarClientes fechar={()=>setImportarAberto(false)} onImportado={()=>{ carregar(); setImportarAberto(false) }}/>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:'700', color:'var(--texto)', margin:0, letterSpacing:'-0.03em' }}>Clientes</h1>
          <p style={{ fontSize:'0.82rem', color:'var(--texto-apagado)', marginTop:'5px' }}>{clientes.length} cliente(s) cadastrado(s)</p>
        </div>
        {temPermissao('gerenciarClientes') && (
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={()=>setImportarAberto(true)} style={{ ...s.btnPrimario, background:'none', border:'1px solid var(--borda)', color:'var(--texto)', boxShadow:'none', display:'flex', alignItems:'center', gap:'6px' }}><Icone.Upload size={14}/> Importar</button>
            <button onClick={()=>setFormAberto(true)} style={{ ...s.btnPrimario, display:'flex', alignItems:'center', gap:'6px' }}><Icone.Plus size={14}/> Novo cliente</button>
          </div>
        )}
      </div>

      {/* Busca + filtro por setor */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...s.inp, flex:1, minWidth:'200px' }} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome ou CNPJ..." />
        {setoresList.length>0&&(
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            <button onClick={()=>setFiltroSetor(null)} style={{ padding:'7px 14px', borderRadius:'8px', fontSize:'0.78rem', fontWeight:'600', cursor:'pointer', fontFamily:'Inter,sans-serif', border:`1px solid ${!filtroSetor?'rgba(0,177,65,0.3)':'var(--borda)'}`, background:!filtroSetor?'rgba(0,177,65,0.08)':'var(--input)', color:!filtroSetor?'var(--verde)':'var(--texto-apagado)' }}>
              Todos
            </button>
            {setoresList.map(setor=>(
              <button key={setor._id} onClick={()=>setFiltroSetor(filtroSetor===setor._id?null:setor._id)} style={{ padding:'7px 14px', borderRadius:'8px', fontSize:'0.78rem', fontWeight:'600', cursor:'pointer', fontFamily:'Inter,sans-serif', display:'flex', alignItems:'center', gap:'6px', border:`1px solid ${filtroSetor===setor._id?'rgba(0,177,65,0.3)':'var(--borda)'}`, background:filtroSetor===setor._id?'rgba(0,177,65,0.08)':'var(--input)', color:filtroSetor===setor._id?'var(--verde)':'var(--texto-apagado)' }}>
                <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:setor.cor||'var(--verde)' }}/>
                {setor.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Subfiltro (ex: Regime quando setor Fiscal está selecionado) */}
      {opcoesVisiveis.length > 0 && (
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'20px' }}>
          <button onClick={()=>setSubFiltro(undefined)} style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'0.72rem', fontWeight:'600', cursor:'pointer', fontFamily:'Inter,sans-serif', border:`1px solid ${subFiltro===undefined?'rgba(0,177,65,0.3)':'var(--borda)'}`, background:subFiltro===undefined?'rgba(0,177,65,0.08)':'transparent', color:subFiltro===undefined?'var(--verde)':'var(--texto-apagado)' }}>
            Todos
          </button>
          {opcoesVisiveis.map(op=>(
            <button key={String(op.value)} onClick={()=>setSubFiltro(subFiltro===op.value?undefined:op.value)} style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'0.72rem', fontWeight:'600', cursor:'pointer', fontFamily:'Inter,sans-serif', border:`1px solid ${subFiltro===op.value?'rgba(0,177,65,0.3)':'var(--borda)'}`, background:subFiltro===op.value?'rgba(0,177,65,0.08)':'transparent', color:subFiltro===op.value?'var(--verde)':'var(--texto-apagado)' }}>
              {op.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {carregando?<p style={{ color:'var(--texto-apagado)' }}>Carregando...</p>
      :filtrados.length===0?(
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--texto-apagado)' }}>
          {busca||filtroSetor?<p>Nenhum cliente encontrado.</p>:<>
            <p style={{ marginBottom:'12px', fontSize:'0.9rem' }}>Nenhum cliente cadastrado ainda.</p>
            {temPermissao('gerenciarClientes') && <button onClick={()=>setFormAberto(true)} style={s.btnPrimario}>Cadastrar primeiro cliente</button>}
          </>}
        </div>
      ):(
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'14px' }}>
          {filtrados.map(c=><CardCliente key={c._id} cliente={c} onClick={()=>setDetalheId(c._id)}/>)}
        </div>
      )}
    </div>
  )
}

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  modalPeq: { background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'16px', width:'100%', maxWidth:'400px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)' },
  modalTopo: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid var(--borda)' },
  modalTit: { fontWeight:'700', fontSize:'1rem', color:'var(--texto)', fontFamily:'Inter,sans-serif', margin:0 },
  modalRodape: { display:'flex', gap:'12px', justifyContent:'flex-end', padding:'16px 24px', borderTop:'1px solid var(--borda)' },
  btnX: { background:'none', border:'1px solid var(--borda)', borderRadius:'6px', color:'var(--texto-apagado)', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', cursor:'pointer' },
  btnPrimario: { background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.875rem', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,177,65,0.25)', whiteSpace:'nowrap' },
  btnSecundario: { background:'none', border:'1px solid var(--borda)', borderRadius:'8px', color:'var(--verde)', padding:'8px 14px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.78rem', cursor:'pointer', whiteSpace:'nowrap' },
  btnCanc: { background:'none', border:'1px solid var(--borda)', borderRadius:'10px', color:'var(--texto-apagado)', padding:'10px 20px', fontFamily:'Inter,sans-serif', fontWeight:'500', fontSize:'0.875rem', cursor:'pointer' },
  btnSalv: { background:'var(--gradiente-verde)', color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontFamily:'Inter,sans-serif', fontWeight:'600', fontSize:'0.875rem', cursor:'pointer' },
  btnAcao: { background:'none', border:'1px solid var(--borda)', borderRadius:'6px', color:'var(--texto-apagado)', fontSize:'0.75rem', cursor:'pointer', padding:'5px 12px', fontFamily:'Inter,sans-serif' },
  inp: { background:'var(--input)', border:'1px solid var(--borda)', borderRadius:'8px', padding:'8px 12px', color:'var(--texto)', fontSize:'0.85rem', fontFamily:'Inter,sans-serif', width:'100%', boxSizing:'border-box', colorScheme:'dark' },
  erro: { color:'#FCA5A5', fontSize:'0.8rem', background:'rgba(239,68,68,0.1)', padding:'8px 12px', borderRadius:'8px', fontFamily:'Inter,sans-serif' },
  secCard: { background:'var(--card)', border:'1px solid var(--borda)', borderRadius:'12px', padding:'18px 20px' },
  secTit: { fontSize:'0.75rem', fontWeight:'700', color:'var(--texto-apagado)', textTransform:'uppercase', letterSpacing:'1px', margin:'0 0 14px', fontFamily:'Inter,sans-serif' },
}
