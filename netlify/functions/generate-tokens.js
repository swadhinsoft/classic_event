const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

exports.handler = async (event) => {
  try {
    const { blockNo, flatNo, numTokens, email } = JSON.parse(event.body);
    console.log("Form data received:", { blockNo, flatNo, numTokens, email });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    console.log("Attempting to send email...");

    // Generate QR codes
    let qrImages = [];
    for (let i = 0; i < numTokens; i++) {
      const qrData = `${blockNo}-${flatNo}-${Date.now()}-${i+1}`;
      const qrImage = await QRCode.toDataURL(qrData);
      qrImages.push(qrImage);
    }

    await transporter.sendMail({
      from: `"Society QR" <${process.env.SMTP_USER}>`,
      to: email,
      cc: process.env.SMTP_USER,
      subject: 'Your QR Tokens',
      html: `<p>Here are your QR codes:</p>${qrImages.map(src => `<img src="${src}"/>`).join('')}`
    });

    console.log("Email sent successfully!");
    return { statusCode: 200, body: JSON.stringify({ message: "QR codes sent!" }) };

  } catch (error) {
    console.error("Error occurred:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to send QR codes" }) };
  }
};
