const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

exports.handler = async function(event, context) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}');
    const { eventName, blockNo, flatNo, email, baseDonation = 0, extraDonation = 0, days = {}, totalAmount, paymentNote } = body;

    if (!eventName || !blockNo || !flatNo || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Prepare tokens and attachments
    const attachments = [];
    const qrPreviews = []; // return for frontend preview

    for (const [dayKey, countRaw] of Object.entries(days)) {
      const count = Number(countRaw || 0);
      for (let i = 1; i <= count; i++) {
        const tokenId = `${eventName.replace(/\s+/g,'')}_Day${dayKey}_${blockNo}-${flatNo}_T${i}_${Date.now()}`;
        // QR as buffer (PNG)
        const buffer = await QRCode.toBuffer(tokenId, { type: 'png', width: 300 });

        const filename = `Day${dayKey}_token_${i}.png`;

        // add as attachment
        attachments.push({ filename, content: buffer });

        // also include inline version with cid for email preview
        const cid = `qr${dayKey}_${i}@${blockNo}${flatNo}`;
        attachments.push({ filename: `inline-${filename}`, content: buffer, cid });

        // preview data URL to return to frontend
        const dataUrl = 'data:image/png;base64,' + buffer.toString('base64');
        qrPreviews.push({ label: `Day ${dayKey} - Token ${i}`, tokenId, dataUrl });
      }
    }

    // Build email body: day-wise list
    let dayListHtml = '';
    for (const [dayKey, countRaw] of Object.entries(days)) {
      const count = Number(countRaw || 0);
      if (count > 0) {
        dayListHtml += `<h4>Day ${dayKey}</h4><p>Number of tokens: ${count}</p><ul>`;
        for (let i = 1; i <= count; i++) {
          const filename = `Day${dayKey}_token_${i}.png`;
          // reference by cid if exists
          const cid = `qr${dayKey}_${i}@${blockNo}${flatNo}`;
          dayListHtml += `<li>Day${dayKey} token ${i} - <img src="cid:${cid}" width="120" style="display:block; margin:6px 0;"></li>`;
        }
        dayListHtml += `</ul>`;
      }
    }

    // Compose email
    // SMTP config from env
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_SECURE === 'true') || true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const organiserEmail = process.env.ORGANISER_EMAIL || process.env.SMTP_USER;
    const subject = `Thank you ${blockNo}-${flatNo} for your contribution to ${eventName}`;

    const htmlBody = `
      <p>Dear Organiser,</p>
      <p>A new booking has been submitted for <strong>${eventName}</strong>.</p>
      <p><strong>Resident:</strong> ${blockNo}-${flatNo} | ${email}</p>
      <p><strong>Donation:</strong> ₹${baseDonation} (base) + ₹${extraDonation} (extra) = ₹${Number(baseDonation||0)+Number(extraDonation||0)}</p>
      <p><strong>Total (including tokens):</strong> ₹${totalAmount}</p>
      <p><strong>Payment Note to match (user will use in UPI app):</strong><br><code>${paymentNote}</code></p>
      <hr/>
      <h3>Tokens (day-wise)</h3>
      ${dayListHtml}
      <hr/>
      <p>Please verify payment in your UPI / bank account against the payment note and forward the token images to the resident after verification.</p>
      <p>Regards,<br/>Oceanus Classic Event Management Team</p>
    `;

    // send email to organiser and CC to SMTP_USER (you)
    await transporter.sendMail({
      from: `"${eventName}" <${process.env.SMTP_USER}>`,
      to: organiserEmail,
      cc: process.env.SMTP_USER,
      subject,
      html: htmlBody,
      attachments
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Tokens generated and emailed to organiser for verification.',
        qrPreviews
      })
    };

  } catch (err) {
    console.error('generate-tokens error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
