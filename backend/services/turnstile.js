// Verifica o token do Cloudflare Turnstile no endpoint oficial de siteverify.
// Enquanto TURNSTILE_SECRET_KEY não estiver configurada (ex: ambiente ainda não migrado),
// deixa passar sem exigir token — proteção de transição, remover quando a chave
// estiver configurada em todos os ambientes.
const verificarTurnstile = async (token) => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const resposta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const dados = await resposta.json();
    return dados.success === true;
  } catch (err) {
    console.error('Erro ao verificar Turnstile:', err.message);
    return false;
  }
};

module.exports = { verificarTurnstile };
