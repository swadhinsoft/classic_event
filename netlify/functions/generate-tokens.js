const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

exports.handler = async (event) => {
  try {
    const { blockNo, flatNo, numTokens, email } = JSON.parse(event.body);

    if (!blockNo || !flatNo || !numTokens || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const qrImages = [];
    const attachments = [];

    for (let i = 0; i < numTokens; i++) {
      const qrData = `Block: ${blockNo}, Flat: ${flatNo}, Token: ${i + 1}`;
      const qrBuffer = await QRCode.toBuffer(qrData); // Get buffer for attachment
      const filename = `token-${i + 1}.png`;

      // Attachment
      attachments.push({
        filename,
        content: qrBuffer
      });

      // For inline display (CID reference)
      attachments.push({
        filename: `inline-${filename}`,
        content: qrBuffer,
        cid: `qr${i}@tokens` // unique content ID
      });

      // Add to HTML with CID
      qrImages.push(`<img src="cid:qr${i}@tokens" style="margin:5px"/>`);
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"Society QR" <${process.env.SMTP_USER}>`,
      to: email,
      cc: process.env.SMTP_USER,
      subject: 'Your QR Tokens',
      html: `<p>Here are your QR codes:</p>${qrImages.join('')}`,
      attachments
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'QR codes sent successfully!' }) };
  } catch (error) {
    console.error('Error sending email:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send QR codes' }) };
  }
};
