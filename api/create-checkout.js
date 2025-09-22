// api/create-checkout.js
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

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }

    const { amount, currency = 'EUR', description = 'VIP Transfer', meta = {} } = body || {};
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    const token    = process.env.SUMUP_ACCESS_TOKEN;
    const merchant = process.env.SUMUP_MERCHANT_CODE;
    if (!token || !merchant) return res.status(500).json({ error: 'Server is not configured (token/merchant)' });

    const checkout_reference = 'UKVIP-' + Date.now();

    const resp = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(amount),
        currency,
        description,
        merchant_code: merchant,
        checkout_reference
      })
    });

    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data });

    const html = `
      <h2>NEW BOOKING – pending payment</h2>
      <p><b>Amount:</b> ${amount} ${currency}</p>
      <p><b>Route:</b> ${meta.route || ''}</p>
      <p><b>Name:</b> ${meta.name || ''}</p>
      <p><b>Email:</b> ${meta.email || ''}</p>
      <p><b>Phone:</b> ${meta.phone || ''}</p>
      <p><b>Pickup:</b> ${meta.pickup || ''}</p>
      <p><b>Drop-off:</b> ${meta.dropoff || ''}</p>
      <p><b>Date/Time:</b> ${meta.date || ''} ${meta.time || ''}</p>
      <p><b>Car:</b> ${meta.carClass || ''} ${meta.carModel || ''}</p>
      <p><b>Checkout ID:</b> ${data.id}</p>
      <p><i>Status:</i> awaiting payment</p>
    `;
    try { await sendAdminMail('NEW BOOKING – pending payment', html); } catch (e) { console.error('Mail error:', e); }

    return res.status(200).json({ checkoutId: data.id, meta });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
