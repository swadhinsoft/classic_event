// netlify/functions/generate-tokens.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY
  });
  await doc.loadInfo();
  return doc.sheetsByIndex[0];
}

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}');
    const { eventName, blockNo, flatNo, email, baseDonation = 0, extraDonation = 0, days = {}, totalAmount, paymentNote } = body;

    if (!eventName || !blockNo || !flatNo || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const sheet = await accessSheet().catch(err => {
      console.error('Google Sheets connection failed:', err);
      throw new Error('Google Sheets connection failed: ' + err.message);
    });

    const attachments = [];
    const qrPreviews = [];

    for (const [dayKey, countRaw] of Object.entries(days)) {
      const count = Number(countRaw || 0);
      for (let i = 1; i <= count; i++) {
        const tokenId = `${eventName.replace(/\s+/g,'')}_Day${dayKey}_${blockNo}-${flatNo}_T${i}_${Date.now()}`;
        const buffer = await QRCode.toBuffer(tokenId, { type: 'png', width: 300 });

        const filename = `Day${dayKey}_token_${i}.png`;
        const cid = `qr${dayKey}_${i}@${blockNo}${flatNo}`;
        attachments.push({ filename, content: buffer });
        attachments.push({ filename: `inline-${filename}`, content: buffer, cid });

        const dataUrl = 'data:image/png;base64,' + buffer.toString('base64');
        qrPreviews.push({ label: `Day ${dayKey} - Token ${i}`, tokenId, dataUrl });

        // Save to Google Sheets
        try {
          await sheet.addRow({
            tokenID: tokenId,
            flatNo: `${blockNo}-${flatNo}`,
            day: dayKey,
            redeemed: false,
            redeemedAt: '',
            email: email,
            donationAmount: Number(baseDonation) + Number(extraDonation)
          });
        } catch (sheetErr) {
          console.error(`Google Sheets addRow failed for token ${tokenId}:`, sheetErr);
        }
      }
    }

    let dayListHtml = '';
    for (const [dayKey, countRaw] of Object.entries(days)) {
      const count = Number(countRaw || 0);
      if (count > 0) {
        dayListHtml += `<h4>Day ${dayKey}</h4><p>Number of tokens: ${count}</p><ul>`;
        for (let i = 1; i <= count; i++) {
          const cid = `qr${dayKey}_${i}@${blockNo}${flatNo}`;
          dayListHtml += `<li>Day${dayKey} token ${i} - <img src="cid:${cid}" width="120"></li>`;
        }
        dayListHtml += '</ul>';
      }
    }

    const upiLink = `upi://pay?pa=swadhinsoft-2@okaxis&pn=${encodeURIComponent('Swadhin Acharya')}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(paymentNote)}`;

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
      <p>Dear Organiser and Contributor,</p>
      <p>A new booking has been submitted for <strong>${eventName}</strong>.</p>
      <p><strong>Resident:</strong> ${blockNo}-${flatNo} | ${email}</p>
      <p><strong>Donation:</strong> ₹${baseDonation} + ₹${extraDonation} = ₹${Number(baseDonation)+Number(extraDonation)}</p>
      <p><strong>Total (including tokens):</strong> ₹${totalAmount}</p>
      <p><strong>Payment Note:</strong> <code>${paymentNote}</code></p>
      <p><strong>UPI Payment Link:</strong> <a href="${upiLink}">${upiLink}</a></p>
      <hr/>
      <h3>Tokens</h3>
      ${dayListHtml}
    `;

    try {
      await transporter.sendMail({
        from: `"${eventName}" <${process.env.SMTP_USER}>`,
        to: `${organiserEmail}, ${email}`,
        subject,
        html: htmlBody,
        attachments
      });
    } catch (mailErr) {
      console.error('Email sending error:', mailErr);
      return { statusCode: 500, body: JSON.stringify({ error: 'Email sending failed: ' + mailErr.message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Tokens generated and emails sent', qrPreviews })
    };

  } catch (err) {
    console.error('generate-tokens general error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
