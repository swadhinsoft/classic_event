const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

exports.handler = async (event) => {
  try {
    const { blockNo, flatNo, numTokens, email } = JSON.parse(event.body);

    if (!blockNo || !flatNo || !numTokens || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Generate QR codes
    const qrImages = [];
    for (let i = 0; i < numTokens; i++) {
      const qrData = `Block: ${blockNo}, Flat: ${flatNo}, Token: ${i + 1}`;
      const qrImage = await QRCode.toDataURL(qrData);
      qrImages.push(qrImage);
    }

    // Create transporter using env variables
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Send email to recipient + CC to your Gmail
    await transporter.sendMail({
      from: `"Society QR" <${process.env.SMTP_USER}>`,
      to: email,
      cc: process.env.SMTP_USER,
      subject: 'Your QR Tokens',
      html: `<p>Here are your QR codes:</p>${qrImages.map(src => `<img src="${src}"/>`).join('')}`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'QR codes sent successfully!' })
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send QR codes' })
    };
  }
};
