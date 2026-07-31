const { z } = require('zod');

// Validações básicas (tipo/formato) pras rotas mais expostas a dado externo — não substitui
// as regras de negócio já existentes em cada rota, só barra lixo óbvio antes de tocar no banco.

const cnpjOpcional = z.string().optional().default('').refine(
  v => !v || v.replace(/\D/g, '').length === 14,
  { message: 'CNPJ deve ter 14 dígitos.' }
);

const emailOpcional = z.string().optional().default('').refine(
  v => !v || z.string().email().safeParse(v).success,
  { message: 'E-mail inválido.' }
);

const clienteSchema = z.object({
  razaoSocial: z.string().trim().min(1, 'Razão social é obrigatória.'),
  cnpj: cnpjOpcional,
  email: emailOpcional,
}).passthrough();

const usuarioSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  email: z.string().trim().min(1, 'E-mail é obrigatório.').email('E-mail inválido.'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
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

module.exports = { clienteSchema, usuarioSchema, validar };
