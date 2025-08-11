const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID; // set in Netlify env
const AIRTABLE_TABLE_NAME = "Table 1"; // your Airtable table name (adjust if needed)

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
    const qrPreviews = []; // to return to frontend preview

    // For each day and token count
    for (const [dayKey, countRaw] of Object.entries(days)) {
      const count = Number(countRaw || 0);
      for (let i = 1; i <= count; i++) {
        // Create unique tokenID
        const tokenId = `${eventName.replace(/\s+/g,'')}_Day${dayKey}_${blockNo}-${flatNo}_T${i}_${Date.now()}`;

        // Generate QR code as PNG buffer
        const buffer = await QRCode.toBuffer(tokenId, { type: 'png', width: 300 });

        const filename = `Day${dayKey}_token_${i}.png`;

        // Add attachment for email (inline for preview)
        const cid = `qr${dayKey}_${i}@${blockNo}${flatNo}`;
        attachments.push({ filename, content: buffer });
        attachments.push({ filename: `inline-${filename}`, content: buffer, cid });

        // Save preview to send back to frontend if desired
        const dataUrl = 'data:image/png;base64,' + buffer.toString('base64');
        qrPreviews.push({ label: `Day ${dayKey} - Token ${i}`, tokenId, dataUrl });

        // ----------- Add token record to Airtable --------------
        try {
          // Check if token already exists (should not, but to be safe)
          const checkUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula={tokenID}='${tokenId}'`;
          const checkRes = await fetch(checkUrl, {
            headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
          });
          const checkData = await checkRes.json();

          if (!checkData.records || checkData.records.length === 0) {
            // Add new token record with RedeemedOn null
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
        // --------------------------------------------------------
      }
    }

    // Build email body with token previews grouped by day
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

    // Setup Nodemailer SMTP transporter from environment variables
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

    // Send email to organiser (and copy yourself if desired)
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
