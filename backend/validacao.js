const { z } = require('zod');

// Validações básicas (tipo/formato) pras rotas mais expostas a dado externo — não substitui
// as regras de negócio já existentes em cada rota, só barra lixo óbvio antes de tocar no banco.

// Aceita CNPJ (14 dígitos, pessoa jurídica) ou CPF (11 dígitos, pessoa física)
const cnpjOpcional = z.string().optional().default('').refine(
  v => !v || [11, 14].includes(v.replace(/\D/g, '').length),
  { message: 'CNPJ deve ter 14 dígitos ou CPF deve ter 11 dígitos.' }
);

const emailOpcional = z.string().optional().default('').refine(
  v => !v || z.string().email().safeParse(v).success,
  { message: 'E-mail inválido.' }
);

const clienteCreateSchema = z.object({
  razaoSocial: z.string().trim().min(1, 'Razão social é obrigatória.'),
  cnpj: cnpjOpcional,
  email: emailOpcional,
}).passthrough();

// Atualização parcial (edição, inativar, reativar etc.) — mesmas regras de formato,
// mas nenhum campo é obrigatório porque o payload pode mandar só o que mudou.
const clienteUpdateSchema = clienteCreateSchema.partial();

// Colaborador é convidado por link — sem campo de senha no cadastro (define depois, pelo convite)
const usuarioSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  email: z.string().trim().min(1, 'E-mail é obrigatório.').email('E-mail inválido.'),
}).passthrough();

// ── Auth ──
const authCadastroSchema = z.object({
  nomeEmpresa: z.string().trim().min(1, 'Nome da empresa é obrigatório.'),
  cnpj: z.string().trim().min(1, 'CNPJ é obrigatório.'),
  nomeAdmin: z.string().trim().min(1, 'Nome é obrigatório.'),
  email: z.string().trim().min(1, 'E-mail é obrigatório.').email('E-mail inválido.'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
}).passthrough();

const authLoginSchema = z.object({
  email: z.string().trim().min(1, 'Informe e-mail e senha.'),
  senha: z.string().min(1, 'Informe e-mail e senha.'),
}).passthrough();

const authEsqueciSenhaSchema = z.object({
  email: z.string().trim().min(1, 'E-mail obrigatório.'),
}).passthrough();

const authRedefinirSenhaSchema = z.object({
  token: z.string().trim().min(1, 'Dados inválidos.'),
  novaSenha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
}).passthrough();

// ── Tarefa ──
const tarefaCreateSchema = z.object({
  descricao: z.string().trim().min(1, 'Descrição é obrigatória.'),
  data: z.string().optional(),
  hora: z.string().optional(),
  local: z.string().optional(),
  cor: z.string().optional(),
  responsavelId: z.string().nullable().optional(),
  etiquetas: z.array(z.string()).optional(),
  prioridade: z.enum(['alta', 'media', 'baixa', '']).optional(),
  tarefaMaeId: z.string().optional(),
}).passthrough();

const tarefaUpdateSchema = tarefaCreateSchema.partial();

const tarefaEtiquetasSchema = z.object({
  etiquetas: z.array(z.string()).optional(),
}).passthrough();

const tarefaPrioridadeSchema = z.object({
  prioridade: z.enum(['alta', 'media', 'baixa', '']).optional(),
}).passthrough();

// ── Implantação ──
const implantacaoCreateSchema = z.object({
  nomeCliente: z.string().trim().min(1, 'Nome do cliente é obrigatório.'),
  cnpj: z.string().optional(),
  modeloId: z.string().optional(),
  inicioServicos: z.string().min(1, 'Data de início dos serviços é obrigatória.'),
  clienteId: z.string().optional(),
}).passthrough();

// ── Evento (Agenda) ──
const eventoCreateSchema = z.object({
  titulo: z.string().trim().min(1, 'Título e data são obrigatórios.'),
  descricao: z.string().optional(),
  data: z.string().min(1, 'Título e data são obrigatórios.'),
  horaInicio: z.string().optional(),
  horaFim: z.string().optional(),
  cor: z.string().optional(),
}).passthrough();

const eventoUpdateSchema = eventoCreateSchema.partial();

// ── Anotação ──
const anotacaoCreateSchema = z.object({
  titulo: z.string().trim().min(1, 'Título obrigatório.'),
  texto: z.string().optional(),
  cor: z.string().optional(),
  fixada: z.boolean().optional(),
}).passthrough();

const anotacaoUpdateSchema = anotacaoCreateSchema.partial();

// ── Chat ──
const chatMensagemSchema = z.object({
  texto: z.string().trim().min(1, 'Mensagem vazia.'),
}).passthrough();

// ── Checklist (Banco de atividades) ──
const checklistCreateSchema = z.object({
  descricao: z.string().trim().min(1, 'Descrição é obrigatória.'),
  observacoes: z.string().optional(),
  setor: z.string().min(1, 'Setor é obrigatório.'),
  responsavelId: z.string().nullable().optional(),
}).passthrough();

const checklistUpdateSchema = z.object({
  descricao: z.string().optional(),
  observacoes: z.string().optional(),
  responsavelId: z.string().nullable().optional(),
}).passthrough();

// ── Empresa ──
const FUSOS_BRASIL = ['America/Noronha', 'America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco'];

const empresaUpdateSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  cnpj: cnpjOpcional,
  fusoHorario: z.enum(FUSOS_BRASIL).optional(),
  colaboradoresPodeAtribuirTitular: z.boolean().optional(),
}).passthrough();

const empresaConfiguracoesSchema = z.object({
  alertaOnboardingDias: z.number().int().positive().optional(),
  resumoFrequencia: z.enum(['semanal', 'quinzenal', 'mensal', 'nunca']).optional(),
}).passthrough();

// ── Feedback (Suporte) ──
const feedbackSchema = z.object({
  assunto: z.string().trim().min(1, 'Assunto é obrigatório.'),
  mensagem: z.string().trim().min(1, 'Descrição é obrigatória.'),
  nome: z.string().optional(),
  email: z.string().optional(),
  empresa: z.string().optional(),
}).passthrough();

// ── Lead (CRM) ── etapa não entra no schema — a rota já valida/faz fallback pra 'prospeccao'
// manualmente (ETAPAS_VALIDAS), comportamento que este schema não deve alterar.
const leadCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome do contato é obrigatório.'),
  nomeEmpresa: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  valor: z.number().optional(),
  origem: z.string().optional(),
  tipoServico: z.string().optional(),
  obs: z.string().optional(),
}).passthrough();

const leadUpdateSchema = leadCreateSchema.partial();

// ── Modelo de onboarding ──
const modeloSetorSchema = z.object({
  setor: z.string(),
  ordem: z.number().optional(),
  tarefas: z.array(z.string()).optional(),
}).passthrough();

const modeloOnboardingCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  descricao: z.string().optional(),
  setores: z.array(modeloSetorSchema).optional(),
}).passthrough();

const modeloOnboardingUpdateSchema = modeloOnboardingCreateSchema.partial();

// ── Mural ──
const muralAvisoSchema = z.object({
  titulo: z.string().trim().min(1, 'Título e texto são obrigatórios.'),
  texto: z.string().trim().min(1, 'Título e texto são obrigatórios.'),
  imagem: z.string().optional(),
  fixado: z.boolean().optional(),
}).passthrough();

const muralAvisoUpdateSchema = muralAvisoSchema.partial();

const muralReagirSchema = z.object({
  emoji: z.string().trim().min(1, 'Emoji obrigatório.'),
}).passthrough();

// ── Setor ──
const setorCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  cor: z.string().optional(),
  membros: z.array(z.string()).optional(),
  responsavel: z.string().optional().nullable(),
}).passthrough();

const setorUpdateSchema = setorCreateSchema.partial();

const setorMembroSchema = z.object({
  usuarioId: z.string().min(1, 'usuarioId é obrigatório.'),
  acao: z.enum(['adicionar', 'remover']).optional(),
}).passthrough();

const setorMembroRemoverSchema = z.object({
  usuarioId: z.string().min(1, 'usuarioId é obrigatório.'),
}).passthrough();

// ── Contábil › Retiradas de sócios ──
const COMPETENCIA_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const competenciaValida = (v) => COMPETENCIA_REGEX.test(v || '');

const valorReais = (msg) => z.number({ error: msg }).min(0, msg);

const socioRetiradaSchema = z.object({
  _id: z.string().optional(),
  nome: z.string({ error: 'Nome do sócio é obrigatório.' }).trim().min(1, 'Nome do sócio é obrigatório.'),
  cpf: z.string().optional().default('').transform(v => v.replace(/\D/g, '')).refine(
    v => !v || v.length === 11,
    { message: 'CPF do sócio deve ter 11 dígitos.' }
  ),
  percentual: z.number({ error: 'Percentual inválido.' }).min(0, 'Percentual deve ficar entre 0 e 100.').max(100, 'Percentual deve ficar entre 0 e 100.').nullable().optional().default(null),
  ativo: z.boolean().optional(),
}).passthrough();

// CPF repetido só conta entre sócios ativos da mesma lista — um sócio inativo pode ter o mesmo CPF
// de alguém que voltou a ser cadastrado. Exportado porque a rota de edição revalida depois de
// mesclar com os sócios que não vieram no payload.
const cpfDuplicadoEntreAtivos = (socios) => {
  const vistos = new Set();
  for (const s of socios) {
    if (s.ativo === false || !s.cpf) continue;
    if (vistos.has(s.cpf)) return s.cpf;
    vistos.add(s.cpf);
  }
  return null;
};

const listaSociosRetirada = z.array(socioRetiradaSchema).max(100, 'Sócios demais.').refine(
  socios => !cpfDuplicadoEntreAtivos(socios),
  { message: 'Há CPF repetido entre os sócios.' }
);

const retiradasControleCreateSchema = z.object({
  clienteId: z.string({ error: 'Escolha a empresa.' }).min(1, 'Escolha a empresa.'),
  socios: listaSociosRetirada,
  sincronizarCadastro: z.boolean().optional().default(false),
}).passthrough();

const retiradasSociosUpdateSchema = z.object({
  socios: listaSociosRetirada,
  sincronizarCadastro: z.boolean().optional().default(false),
}).passthrough();

// A regra "data dentro do mês da competência" depende do parâmetro da URL — fica na rota.
const retiradaMesSchema = z.object({
  modo: z.enum(['total', 'detalhado'], { error: 'Modo inválido.' }),
  valorTotal: valorReais('Valor inválido.').optional().default(0),
  lancamentos: z.array(z.object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do lançamento inválida.'),
    valor: valorReais('Valor do lançamento inválido.'),
    obs: z.string().max(300, 'Observação muito longa.').optional().default(''),
  })).max(200, 'Máximo de 200 lançamentos no mês.').optional().default([]),
}).passthrough();

const apuracaoTrimestreSchema = z.object({
  lucroApurado: valorReais('Lucro apurado inválido.').nullable(),
  saldoAnterior: valorReais('Lucros acumulados inválidos.').optional().default(0),
  tratamentoExcedente: z.enum(['', 'adiantamento', 'a_regularizar', 'rendimento_tributavel', 'outro'], { error: 'Tratamento do excedente inválido.' }).optional().default(''),
  obsExcedente: z.string().max(1000, 'Observação muito longa.').optional().default(''),
}).passthrough();

// Middleware: valida req.body contra um schema Zod, retorna 400 com a primeira mensagem de erro
const validar = (schema) => (req, res, next) => {
  const resultado = schema.safeParse(req.body);
  if (!resultado.success) {
    const primeiro = resultado.error.issues[0];
    return res.status(400).json({ erro: primeiro?.message || 'Dados inválidos.' });
  }
  next();
};

// Igual ao validar, mas troca req.body pelo resultado já tratado (defaults, CPF só com dígitos etc.).
// Separado de propósito: aplicar isso no validar mudaria o body das rotas antigas (ex: o default ''
// do cnpj apagaria o CNPJ numa edição parcial de cliente).
const validarECorrigir = (schema) => (req, res, next) => {
  const resultado = schema.safeParse(req.body);
  if (!resultado.success) {
    const primeiro = resultado.error.issues[0];
    return res.status(400).json({ erro: primeiro?.message || 'Dados inválidos.' });
  }
  req.body = resultado.data;
  next();
};

module.exports = {
  clienteCreateSchema, clienteUpdateSchema, usuarioSchema,
  authCadastroSchema, authLoginSchema, authEsqueciSenhaSchema, authRedefinirSenhaSchema,
  tarefaCreateSchema, tarefaUpdateSchema, tarefaEtiquetasSchema, tarefaPrioridadeSchema,
  implantacaoCreateSchema,
  eventoCreateSchema, eventoUpdateSchema,
  anotacaoCreateSchema, anotacaoUpdateSchema,
  chatMensagemSchema,
  checklistCreateSchema, checklistUpdateSchema,
  empresaUpdateSchema, empresaConfiguracoesSchema,
  feedbackSchema,
  leadCreateSchema, leadUpdateSchema,
  modeloOnboardingCreateSchema, modeloOnboardingUpdateSchema,
  muralAvisoSchema, muralAvisoUpdateSchema, muralReagirSchema,
  setorCreateSchema, setorUpdateSchema, setorMembroSchema, setorMembroRemoverSchema,
  retiradasControleCreateSchema, retiradasSociosUpdateSchema, retiradaMesSchema, apuracaoTrimestreSchema,
  competenciaValida, cpfDuplicadoEntreAtivos,
  validar, validarECorrigir,
};
