// Script único: povoa a empresa de teste (ver criarContaTeste.js) com um volume de clientes
// parecido com o de um escritório real, pra testar performance de carregamento/filtro no
// frontend antes do primeiro cliente de verdade usar o sistema com base grande.
// Roda manualmente: `node scripts/seedClientesTeste.js [quantidade]` (padrão 180).
// Não faz parte do runtime do app. Idempotente no sentido de que só adiciona clientes novos
// a cada execução (não apaga nem reaproveita os anteriores).
require('dotenv').config();
const mongoose = require('mongoose');
const Empresa = require('../models/Empresa');
const Usuario = require('../models/Usuario');
const Setor = require('../models/Setor');
const Cliente = require('../models/Cliente');

const SLUG_TESTE = 'zempofy-conta-teste-interna';
const QUANTIDADE = Number(process.argv[2]) || 180;

const normalizarNome = (str = '') => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const PREFIXOS = ['Alfa','Beta','Prisma','Nexus','Vertice','Horizonte','Cardeal','Bussola','Meridiano','Cedro','Ipe','Aurora','Cristal','Fenix','Atrio','Zenite','Orbita','Marco','Vetor','Base','Trilha','Ancora','Sinal','Elo','Rota','Cume','Onda','Lume','Nascente','Planalto'];
const SUFIXOS = ['Contabilidade','Comercio','Servicos','Industria','Solucoes','Tecnologia','Consultoria','Alimentos','Logistica','Materiais','Construcoes','Confeccoes','Transportes','Distribuidora','Assessoria'];
const RAMOS = ['Ltda','ME','EPP'];
const REGIMES = ['simples_nacional', 'lucro_presumido', 'lucro_real'];
const PORTES = ['mei', 'me', 'epp', 'grande'];

const aleatorio = (arr) => arr[Math.floor(Math.random() * arr.length)];
const cnpjFalso = () => Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join('');
const nomeFalso = (i) => `${aleatorio(PREFIXOS)} ${aleatorio(SUFIXOS)} ${RAMOS[i % 3]}`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const empresa = await Empresa.findOne({ slug: SLUG_TESTE });
  if (!empresa) throw new Error('Empresa de teste não existe — rode scripts/criarContaTeste.js primeiro.');
  const usuario = await Usuario.findOne({ email: 'teste@zempofy.com.br' });
  if (!usuario) throw new Error('Usuário de teste não existe — rode scripts/criarContaTeste.js primeiro.');

  const setores = await Setor.find({ empresa: empresa._id, ativo: true });
  const mapaSetores = {};
  setores.forEach(s => { mapaSetores[normalizarNome(s.nome)] = s });

  const fiscal = mapaSetores['fiscal'];
  const dp = mapaSetores['departamento pessoal'];
  const contabil = mapaSetores['contabil'];
  const comercial = mapaSetores['comercial'];
  const legalizacao = mapaSetores['legalizacao'];
  const financeiro = mapaSetores['financeiro'];

  const docs = [];
  for (let i = 0; i < QUANTIDADE; i++) {
    const setoresCliente = [];
    if (fiscal && Math.random() < 0.75) setoresCliente.push(fiscal._id);
    if (dp && Math.random() < 0.6) setoresCliente.push(dp._id);
    if (contabil && Math.random() < 0.5) setoresCliente.push(contabil._id);
    if (comercial && Math.random() < 0.3) setoresCliente.push(comercial._id);
    if (legalizacao && Math.random() < 0.15) setoresCliente.push(legalizacao._id);
    if (financeiro && Math.random() < 0.2) setoresCliente.push(financeiro._id);
    if (setoresCliente.length === 0 && fiscal) setoresCliente.push(fiscal._id);

    const configSetores = {};
    if (dp && setoresCliente.includes(dp._id) && Math.random() < 0.85) {
      configSetores['departamento pessoal'] = { situacao: aleatorio(['clt', 'pro_labore', 'ambos']), camposExtras: [] };
    }
    if (contabil && setoresCliente.includes(contabil._id) && Math.random() < 0.85) {
      configSetores['contabil'] = { situacao: aleatorio(['mensal', 'trimestral', 'semestral']), camposExtras: [] };
    }

    docs.push({
      empresa: empresa._id,
      criadoPor: usuario._id,
      status: Math.random() < 0.08 ? 'inativo' : 'ativo',
      razaoSocial: `${nomeFalso(i)} ${String(i + 1).padStart(3, '0')}`,
      nomeFantasia: '',
      cnpj: cnpjFalso(),
      tipoPessoa: 'juridica',
      porte: aleatorio(PORTES),
      regime: aleatorio(REGIMES),
      honorario: Math.random() < 0.7 ? Math.round(150 + Math.random() * 1500) : 0,
      setores: setoresCliente,
      origem: 'manual',
      configSetores,
    });
  }

  const criados = await Cliente.insertMany(docs);
  console.log(`Criados ${criados.length} clientes de teste na empresa "${empresa.nome}" (${empresa._id}).`);

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
