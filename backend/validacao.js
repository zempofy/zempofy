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

// Middleware: valida req.body contra um schema Zod, retorna 400 com a primeira mensagem de erro
const validar = (schema) => (req, res, next) => {
  const resultado = schema.safeParse(req.body);
  if (!resultado.success) {
    const primeiro = resultado.error.issues[0];
    return res.status(400).json({ erro: primeiro?.message || 'Dados inválidos.' });
  }
  next();
};

module.exports = { clienteCreateSchema, clienteUpdateSchema, usuarioSchema, validar };
