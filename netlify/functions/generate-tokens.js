// netlify/functions/generate-tokens.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

// Environment variables for Google Sheets API
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/gm, '\n');

async function accessSheet() {
    const doc = new GoogleSpreadsheet(SHEET_ID);
    await doc.useServiceAccountAuth({
        client_email: CLIENT_EMAIL,
        private_key: PRIVATE_KEY,
    });
    await doc.loadInfo();
    return doc.sheetsByIndex[0]; // Access the first sheet
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

        // Connect to the Google Sheet
        const sheet = await accessSheet();

        const attachments = [];
        const qrPreviews = [];

        // Generate tokens, QR codes, and add entries to Google Sheets
        for (const [dayKey, countRaw] of Object.entries(days)) {
            const count = Number(countRaw || 0);
            for (let i = 1; i <= count; i++) {
                // Unique token ID including event, day, flat, token index, and timestamp
                const tokenId = `${eventName.replace(/\s+/g, '')}_Day${dayKey}_${blockNo}-${flatNo}_T${i}_${Date.now()}`;

                // Generate QR code image buffer
                const buffer = await QRCode.toBuffer(tokenId, { type: 'png', width: 300 });
                const filename = `Day${dayKey}_token_${i}.png`;
                const cid = `qr${dayKey}_${i}@${blockNo}${flatNo}`;

                // Include attachments (inline images for email)
                attachments.push({ filename, content: buffer });
                attachments.push({ filename: `inline-${filename}`, content: buffer, cid });

                // Preview data URL (optional, for frontend)
                const dataUrl = 'data:image/png;base64,' + buffer.toString('base64');
                qrPreviews.push({ label: `Day ${dayKey} - Token ${i}`, tokenId, dataUrl });

                // Add a row for this token in Google Sheets
                await sheet.addRow({
                    tokenID: tokenId,
                    flatNo: `${blockNo}-${flatNo}`,
                    day: dayKey,
                    redeemed: false,
                    redeemedAt: '',
                    email: email,
                    donationAmount: Number(baseDonation) + Number(extraDonation)
                });
            }
        }

        // Prepare day-wise tokens HTML list for email
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

        // Generate UPI payment link for inclusion in email
        const upiLink = `upi://pay?pa=swadhinsoft-2@okaxis&pn=${encodeURIComponent('Swadhin Acharya')}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(paymentNote)}`;

        // Setup nodemailer SMTP transporter using environment variables
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

        // HTML email body
        const htmlBody = `
          <p>Dear Organiser and Contributor,</p>
          <p>A new booking has been submitted for <strong>${eventName}</strong>.</p>
          <p><strong>Resident:</strong> ${blockNo}-${flatNo} | ${email}</p>
          <p><strong>Donation:</strong> ₹${baseDonation} (base) + ₹${extraDonation} (extra) = ₹${Number(baseDonation||0) + Number(extraDonation||0)}</p>
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

        // Send email to organizer and user
        await transporter.sendMail({
            from: `"${eventName}" <${process.env.SMTP_USER}>`,
            to: `${organiserEmail}, ${email}`,
            subject,
            html: htmlBody,
            attachments
        });

        // Return success response with token previews (optional)
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
