// api/sumup-webhook.js
import nodemailer from 'nodemailer';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function sendAdminMail(subject, html) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject,
    html
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    let event = req.body;
    if (typeof event === 'string') { try { event = JSON.parse(event); } catch {} }

    const status     = event?.status || event?.transaction_status || 'unknown';
    const amount     = event?.amount || event?.transaction_amount || '—';
    const currency   = event?.currency || 'EUR';
    const checkoutId = event?.checkout_id || event?.id || '—';

    const html = `
      <h2>BOOKING PAID</h2>
      <p><b>Status:</b> ${status}</p>
      <p><b>Amount:</b> ${amount} ${currency}</p>
      <p><b>Checkout ID:</b> ${checkoutId}</p>
      <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px;">
${JSON.stringify(event, null, 2)}
      </pre>
    `;
    try { await sendAdminMail('BOOKING PAID', html); } catch(e) { console.error('Mail error:', e); }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
