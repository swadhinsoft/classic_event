// netlify/functions/generate-tokens.js
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = "Table 1"; // Change to your Airtable table name

exports.handler = async function(event, context) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}');
    const {
      eventName,
      blockNo,
      flatNo,
      email,
      baseDonation = 0,
      extraDonation = 0,
      days = {},
      totalAmount,
      paymentNote
    } = body;

    if (!eventName || !blockNo || !flatNo || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Prepare tokens and attachments
    const attachments = [];
    const qrPreviews = [];

    // Generate a unique token ID for each token and save tokens info to Airtable
    for (const [dayKey, countRaw] of Object.entries(days)) {
      const count = Number(countRaw || 0);
      for (let i = 1; i <= count; i++) {
        const tokenId = `${eventName.replace(/\s+/g,'')}_Day${dayKey}_${blockNo}-${flatNo}_T${i}_${Date.now()}`;

        // Generate QR Code as PNG buffer
        const buffer = await QRCode.toBuffer(tokenId, { type: 'png', width: 300 });

        const filename = `Day${dayKey}_token_${i}.png`;
        const cid = `qr${dayKey}_${i}@${blockNo}${flatNo}`;

        // Add attachments (inline for email preview)
        attachments.push({ filename, content: buffer });
        attachments.push({ filename: `inline-${filename}`, content: buffer, cid });

        // Collect preview to send back to frontend (optional)
        const dataUrl = 'data:image/png;base64,' + buffer.toString('base64');
        qrPreviews.push({ label: `Day ${dayKey} - Token ${i}`, tokenId, dataUrl });

        // Store token record in Airtable
        try {
          const checkUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula={tokenID}='${tokenId}'`;
          const checkRes = await fetch(checkUrl, {
            headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
          });
          const checkData = await checkRes.json();

          if (!checkData.records || checkData.records.length === 0) {
            const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
            const createRes = await fetch(createUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fields: {
                  tokenID: tokenId,
                  flatNo: `${blockNo}-${flatNo}`,
                  Day: dayKey,
                  RedeemedOn: null
                }
              })
            });
            if (!createRes.ok) {
              const errText = await createRes.text();
              console.error(`Failed to add token to Airtable: ${errText}`);
            }
          } else {
            console.warn(`Token already exists in Airtable: ${tokenId}`);
          }
        } catch (err) {
          console.error(`Error adding token to Airtable: ${err.message}`);
        }
      }
    }

    // Build day-wise tokens HTML list
    let dayListHtml = '';
    for (const [dayKey, countRaw] of Object.entries(days)) {
      const count = Number(countRaw || 0);
      if (count > 0) {
        dayListHtml += `<h4>Day ${dayKey}</h4><p>Number of tokens: ${count}</p><ul>`;
        for (let i = 1; i <= count; i++) {
          const cid = `qr${dayKey}_${i}@${blockNo}${flatNo}`;
          dayListHtml += `<li>Day${dayKey} token ${i} - <img src="cid:${cid}" width="120" style="display:block; margin:6px 0;"></li>`;
        }
        dayListHtml += `</ul>`;
      }
    }

    // Generate UPI payment link for email (recalculated here)
    const upiLink = `upi://pay?pa=swadhinsoft-2@okaxis&pn=${encodeURIComponent('Swadhin Acharya')}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(paymentNote)}`;

    // Setup email transporter using SMTP env vars
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
      <p><strong>Donation:</strong> ₹${baseDonation} (base) + ₹${extraDonation} (extra) = ₹${Number(baseDonation||0)+Number(extraDonation||0)}</p>
      <p><strong>Total (including tokens):</strong> ₹${totalAmount}</p>
      <p><strong>Payment Note to match (user will use in UPI app):</strong><br><code>${paymentNote}</code></p>
      <p><strong>UPI Payment Link (click or copy to pay later):</strong><br/>
        <a href="${upiLink}" target="_blank">${upiLink}</a>
      </p>
      <hr/>
      <h3>Tokens (day-wise)</h3>
      ${dayListHtml}
      <hr/>
      <p>Please verify payment in your UPI / bank account against the payment note and forward the token images to the resident after verification.</p>
      <p>Regards,<br/>Oceanus Classic Event Management Team</p>
    `;

    // Send email to both organizer and user
    await transporter.sendMail({
      from: `"${eventName}" <${process.env.SMTP_USER}>`,
      to: `${organiserEmail}, ${email}`,
      subject,
      html: htmlBody,
      attachments
    });

    // Return success response with token previews for frontend (if needed)
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Tokens generated and emailed to organiser and contributor for verification.',
        qrPreviews
      })
    };

  } catch (err) {
    console.error('generate-tokens error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
