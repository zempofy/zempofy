const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Zempofy <noreply@zempofy.com.br>';

// Template base
const template = (titulo, corpo) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body { margin:0; padding:0; background:#09090b; font-family:'Segoe UI',Arial,sans-serif; }
  .wrap { max-width:560px; margin:40px auto; background:#18181b; border:1px solid #27272a; border-radius:16px; overflow:hidden; }
  .top { background:#00b141; padding:22px 32px; }
  .top h1 { color:#fff; margin:0; font-size:1.3rem; letter-spacing:-0.02em; }
  .body { padding:28px 32px; }
  .body p { color:#a1a1aa; font-size:0.9rem; line-height:1.7; margin:0 0 16px; }
  .body strong { color:#fafafa; }
  .card { background:#09090b; border:1px solid #27272a; border-radius:10px; padding:16px 20px; margin:20px 0; }
  .card p { margin:0; color:#fafafa; font-size:0.95rem; font-weight:600; }
  .card span { color:#71717a; font-size:0.8rem; }
  .btn { display:inline-block; background:#00b141; color:#fff !important; text-decoration:none; padding:12px 28px; border-radius:10px; font-weight:600; font-size:0.9rem; margin:8px 0; }
  .foot { padding:20px 32px; border-top:1px solid #27272a; }
  .foot p { color:#52525b; font-size:0.75rem; margin:0; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="top"><h1>Zempofy</h1></div>
    <div class="body">
      <p style="color:#fafafa;font-size:1.1rem;font-weight:700;margin-bottom:20px;">${titulo}</p>
      ${corpo}
    </div>
    <div class="foot"><p>Este é um e-mail automático do sistema Zempofy. Por favor, não responda.</p></div>
  </div>
</body>
</html>
`;

// 1. Onboarding criado — envia pra todos os colaboradores envolvidos
const enviarOnboardingCriado = async ({ destinatarios, nomeCliente, criadoPor, empresa }) => {
  if (!destinatarios?.length) return;
  const corpo = `
    <p>Um novo processo de entrada de cliente foi iniciado no escritório <strong>${empresa}</strong>.</p>
    <div class="card">
      <p>${nomeCliente}</p>
      <span>Criado por ${criadoPor}</span>
    </div>
    <p>Você faz parte deste processo. Quando chegar a sua vez de agir, você receberá um novo e-mail avisando. Fique atento!</p>
    <p>Acesse o sistema para acompanhar o progresso:</p>
    <a class="btn" href="https://app.zempofy.com.br">Acessar o sistema</a>
  `;
  try {
    await resend.emails.send({
      from: FROM,
      to: destinatarios,
      subject: `Novo onboarding: ${nomeCliente}`,
      html: template(`Novo cliente chegou!`, corpo),
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail onboarding criado:', err);
  }
};

// 2. Chegou a vez do colaborador — etapa desbloqueada
const enviarEtapaDesbloqueada = async ({ destinatarios, nomeCliente, setor, empresa }) => {
  if (!destinatarios?.length) return;
  const corpo = `
    <p>Chegou a sua vez de agir no processo de entrada do cliente <strong>${nomeCliente}</strong> em <strong>${empresa}</strong>.</p>
    <div class="card">
      <p>Setor: ${setor}</p>
      <span>As atividades do seu setor estão liberadas e aguardando conclusão</span>
    </div>
    <p>Acesse o sistema, veja as tarefas atribuídas a você e conclua as atividades assim que possível.</p>
    <a class="btn" href="https://app.zempofy.com.br">Ver minhas tarefas</a>
  `;
  try {
    await resend.emails.send({
      from: FROM,
      to: destinatarios,
      subject: `Chegou sua vez! Onboarding de ${nomeCliente}`,
      html: template(`É a sua vez!`, corpo),
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail etapa desbloqueada:', err);
  }
};

// 3. Tarefa atribuída a outro colaborador
const enviarTarefaAtribuida = async ({ destinatario, descricao, criadoPor, data, empresa }) => {
  if (!destinatario) return;
  const corpo = `
    <p><strong>${criadoPor}</strong> criou uma nova tarefa para você em <strong>${empresa}</strong>.</p>
    <div class="card">
      <p>${descricao}</p>
      ${data ? `<span>Prazo: ${new Date(data).toLocaleDateString('pt-BR')}</span>` : '<span>Sem prazo definido</span>'}
    </div>
    <p>Acesse o sistema para ver os detalhes e marcar como concluída quando finalizar.</p>
    <a class="btn" href="https://app.zempofy.com.br">Ver minha tarefa</a>
  `;
  try {
    await resend.emails.send({
      from: FROM,
      to: [destinatario],
      subject: `Nova tarefa: ${descricao.slice(0, 50)}${descricao.length > 50 ? '...' : ''}`,
      html: template(`Você recebeu uma nova tarefa`, corpo),
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail tarefa atribuída:', err);
  }
};

module.exports = { enviarOnboardingCriado, enviarEtapaDesbloqueada, enviarTarefaAtribuida };
