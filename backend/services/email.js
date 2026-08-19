const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Zempofy <noreply@zempofy.com.br>';

// Template base
const template = (titulo, corpo) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body { margin:0; padding:0; background:#09090b !important; font-family:'Segoe UI',Arial,sans-serif; }
  .wrap { max-width:560px; margin:40px auto; background:#18181b; border:1px solid #27272a; border-radius:16px; overflow:hidden; }
  .top { background:#00b141; padding:28px 32px; }
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
<body bgcolor="#09090b" style="background:#09090b;margin:0;padding:0;">
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


// 4. E-mail de verificação de conta
const enviarVerificacaoEmail = async ({ destinatario, nome, token }) => {
  if (!destinatario) return;
  const link = `https://app.zempofy.com.br/verificar-email?token=${token}`;
  const corpo = `
    <p>Olá, <strong>${nome}</strong>! Seja bem-vindo ao Zempofy.</p>
    <p>Para garantir que temos o e-mail certo e que você receba todas as notificações do sistema, precisamos verificar seu endereço de e-mail.</p>
    <div class="card">
      <p>Clique no botão abaixo para verificar</p>
      <span>O link expira em 48 horas</span>
    </div>
    <a class="btn" href="${link}">Verificar meu e-mail</a>
    <p style="margin-top:16px;font-size:0.8rem;">Se você não criou uma conta no Zempofy, ignore este e-mail.</p>
  `;
  try {
    await resend.emails.send({
      from: FROM,
      to: [destinatario],
      subject: 'Verifique seu e-mail — Zempofy',
      html: template('Confirme seu e-mail', corpo),
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail de verificação:', err);
  }
};

// 5. Convite ao novo colaborador — sem senha em texto puro, link pra pessoa definir a própria senha
const enviarConvite = async ({ destinatario, nome, nomeEmpresa, nomeConvidadoPor, token }) => {
  const link = `https://app.zempofy.com.br/redefinir-senha?token=${token}`;
  const corpo = `
    <p>Olá, <strong>${nome}</strong>! Seja muito bem-vindo(a) ao <strong>${nomeEmpresa}</strong> no Zempofy.</p>
    <p>${nomeConvidadoPor} adicionou você ao sistema. Pra começar, defina sua senha de acesso clicando no botão abaixo.</p>
    <div class="card">
      <p>E-mail de acesso</p>
      <span>${destinatario}</span>
    </div>
    <p>Este link é válido por <strong>1 hora</strong>.</p>
    <a class="btn" href="${link}">Definir minha senha</a>
    <p style="margin-top:16px;font-size:0.8rem;color:#71717a">Se tiver dúvidas, entre em contato com seu titular ou acesse suporte@zempofy.com.br</p>
  `;
  try {
    await resend.emails.send({
      from: FROM,
      to: destinatario,
      subject: `Você foi convidado(a) para o Zempofy — ${nomeEmpresa}`,
      html: template(`Bem-vindo(a) ao Zempofy!`, corpo),
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail de convite:', err);
  }
};

// 6. Alerta de onboarding parado
const enviarAlertaOnboardingParado = async ({ destinatario, nomeCliente, diasParado, etapaAtual, empresa }) => {
  const corpo = `
    <p>O processo de entrada do cliente <strong>${nomeCliente}</strong> está parado há <strong>${diasParado} dias</strong> sem movimentação.</p>
    <div class="card">
      <p>${nomeCliente}</p>
      <span>Etapa atual: ${etapaAtual} · Parado há ${diasParado} dias</span>
    </div>
    <p>Verifique o que está pendente e dê continuidade ao processo o quanto antes.</p>
    <a class="btn" href="https://app.zempofy.com.br">Ver onboarding</a>
  `;
  try {
    await resend.emails.send({
      from: FROM,
      to: destinatario,
      subject: `⚠️ Onboarding parado: ${nomeCliente}`,
      html: template(`Onboarding sem movimentação`, corpo),
    });
  } catch (err) {
    console.error('Erro ao enviar alerta onboarding parado:', err);
  }
};

// solicitadoPor: quando o titular reseta a senha de outra pessoa (em vez da própria pessoa
// pedindo via "esqueci minha senha"), deixa isso explícito no texto do e-mail.
const enviarRedefinicaoSenha = async ({ destinatario, nome, token, solicitadoPor }) => {
  const link = `https://app.zempofy.com.br/redefinir-senha?token=${token}`;
  const corpo = `
    <p>Olá, <strong>${nome}</strong>!</p>
    <p>${solicitadoPor
      ? `${solicitadoPor} solicitou a redefinição da senha da sua conta no Zempofy.`
      : 'Recebemos uma solicitação para redefinir a senha da sua conta no Zempofy.'}</p>
    <p>Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong>1 hora</strong>.</p>
    <a class="btn" href="${link}">Redefinir minha senha</a>
    <p style="margin-top:16px;font-size:0.8rem;color:#71717a">${solicitadoPor
      ? 'Se você não esperava isso, entre em contato com seu titular.'
      : 'Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.'}</p>
  `;
  try {
    await resend.emails.send({
      from: FROM,
      to: destinatario,
      subject: 'Redefinição de senha — Zempofy',
      html: template('Redefinição de senha', corpo),
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail redefinição:', err);
  }
};

// 8. Resumo periódico pro titular
const enviarResumo = async ({ destinatario, nome, empresa, dados, frequencia }) => {
  const freq = { semanal: 'semanal', quinzenal: 'quinzenal', mensal: 'mensal' }[frequencia] || 'semanal'
  const corpo = `
    <p>Olá, <strong>${nome}</strong>! Aqui está o resumo ${freq} do <strong>${empresa}</strong>.</p>

    <div class="card">
      <p style="font-size:0.8rem;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Onboardings</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div><p style="font-size:1.6rem;font-weight:700;color:#00b141;margin:0">${dados.onboardingsAtivos}</p><p style="font-size:0.78rem;color:#71717a;margin:4px 0 0">em andamento</p></div>
        <div><p style="font-size:1.6rem;font-weight:700;color:#a1a1aa;margin:0">${dados.onboardingsConcluidos}</p><p style="font-size:0.78rem;color:#71717a;margin:4px 0 0">concluídos no período</p></div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <p style="font-size:0.8rem;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Tarefas</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div><p style="font-size:1.6rem;font-weight:700;color:#f59e0b;margin:0">${dados.tarefasPendentes}</p><p style="font-size:0.78rem;color:#71717a;margin:4px 0 0">pendentes</p></div>
        <div><p style="font-size:1.6rem;font-weight:700;color:#00b141;margin:0">${dados.tarefasConcluidas}</p><p style="font-size:0.78rem;color:#71717a;margin:4px 0 0">concluídas no período</p></div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <p style="font-size:0.8rem;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Clientes</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div><p style="font-size:1.6rem;font-weight:700;color:#818cf8;margin:0">${dados.clientesNovos}</p><p style="font-size:0.78rem;color:#71717a;margin:4px 0 0">novos no período</p></div>
        <div><p style="font-size:1.6rem;font-weight:700;color:#a1a1aa;margin:0">${dados.clientesTotal}</p><p style="font-size:0.78rem;color:#71717a;margin:4px 0 0">total na carteira</p></div>
      </div>
    </div>

    <a class="btn" href="https://app.zempofy.com.br" style="margin-top:20px;display:inline-block">Ver sistema completo</a>
  `;
  try {
    await resend.emails.send({
      from: FROM,
      to: destinatario,
      subject: `Resumo ${freq} — ${empresa}`,
      html: template(`Resumo ${freq}`, corpo),
    });
  } catch (err) { console.error('Erro resumo:', err); }
};

// 9. Lembrete de tarefa com prazo próximo
const enviarLembreteTarefa = async ({ destinatario, nome, titulo, prazo, criadoPor, diasRestantes }) => {
  const urgencia = diasRestantes === 0 ? 'vence hoje' : diasRestantes === 1 ? 'vence amanhã' : `vence em ${diasRestantes} dias`
  const corUrgencia = diasRestantes === 0 ? '#f87171' : diasRestantes === 1 ? '#f59e0b' : '#818cf8'
  const corpo = `
    <p>Olá, <strong>${nome}</strong>! Uma tarefa sob sua responsabilidade <strong>${urgencia}</strong>.</p>
    <div class="card">
      <p style="font-size:1rem;font-weight:700;color:#fff;margin:0 0 8px">${titulo}</p>
      <p style="font-size:0.82rem;color:#71717a;margin:0">Prazo: <span style="color:${corUrgencia};font-weight:600">${new Date(prazo).toLocaleDateString('pt-BR')}</span></p>
      ${criadoPor ? `<p style="font-size:0.78rem;color:#71717a;margin:6px 0 0">Atribuída por: ${criadoPor}</p>` : ''}
    </div>
    <a class="btn" href="https://app.zempofy.com.br">Ver tarefa</a>
  `;
  try {
    await resend.emails.send({
      from: FROM,
      to: destinatario,
      subject: `⏰ Tarefa ${urgencia}: ${titulo}`,
      html: template('Lembrete de tarefa', corpo),
    });
  } catch (err) { console.error('Erro lembrete tarefa:', err); }
};

module.exports = { enviarOnboardingCriado, enviarEtapaDesbloqueada, enviarTarefaAtribuida, enviarVerificacaoEmail, enviarConvite, enviarAlertaOnboardingParado, enviarRedefinicaoSenha, enviarResumo, enviarLembreteTarefa };
