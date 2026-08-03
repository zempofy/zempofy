const express = require('express');
const { autenticar } = require('../middleware/auth');
const { Resend } = require('resend');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/feedback
router.post('/', autenticar, async (req, res) => {
  const { assunto, mensagem, nome, email, empresa } = req.body;
  if (!assunto?.trim()) return res.status(400).json({ erro: 'Assunto é obrigatório.' });
  if (!mensagem?.trim()) return res.status(400).json({ erro: 'Descrição é obrigatória.' });

  try {
    await resend.emails.send({
      from: 'Zempofy <noreply@zempofy.com.br>',
      to: ['suporte@zempofy.com.br'],
      subject: `Suporte: ${assunto} — ${empresa || 'sem empresa'}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;background:#09090b;padding:32px;min-height:100vh;">
          <div style="max-width:520px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
            <div style="background:#00b141;padding:20px 28px;">
              <h1 style="color:#fff;margin:0;font-size:1.1rem;font-weight:700;">Zempofy — Suporte</h1>
            </div>
            <div style="padding:24px 28px;">
              <p style="color:#71717a;font-size:0.8rem;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;">Assunto</p>
              <p style="color:#fafafa;font-size:1rem;margin:0 0 20px;">${assunto}</p>

              <p style="color:#71717a;font-size:0.8rem;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;">Descrição</p>
              <p style="color:#fafafa;font-size:0.95rem;line-height:1.6;margin:0 0 20px;background:#09090b;padding:14px 16px;border-radius:10px;border:1px solid #27272a;">${mensagem}</p>

              <p style="color:#71717a;font-size:0.8rem;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;">Enviado por</p>
              <p style="color:#fafafa;font-size:0.9rem;margin:0 0 4px;">${nome}</p>
              <p style="color:#71717a;font-size:0.82rem;margin:0 0 20px;">${email} · ${empresa || '—'}</p>
            </div>
          </div>
        </div>
      `,
    });

    res.json({ mensagem: 'Mensagem enviada com sucesso!' });
  } catch (err) {
    console.error('Erro ao enviar feedback:', err);
    res.status(500).json({ erro: 'Erro ao enviar mensagem.' });
  }
});

module.exports = router;
