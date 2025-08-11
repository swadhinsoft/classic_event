const QRCode = require("qrcode");
const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  try {
    const { block, flat, tokens, email } = JSON.parse(event.body);
    const qrCodes = [];

    for (let i = 0; i < Number(tokens); i++) {
      const tokenData = `${block}-${flat}-${Date.now()}-${i + 1}`;
      const qr = await QRCode.toDataURL(tokenData);
      qrCodes.push(qr);
    }

    // Gmail SMTP transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER, // swadhinsoft@gmail.com
        pass: process.env.SMTP_PASS  // App-specific password
      }
    });

    // Attach all QR codes
    const attachments = qrCodes.map((qr, index) => ({
      filename: `QR-Token-${index + 1}.png`,
      content: qr.split("base64,")[1],
      encoding: "base64"
    }));

    // Send the email
    await transporter.sendMail({
      from: `"Society QR" <${process.env.SMTP_USER}>`,
      to: email,
      cc: process.env.SMTP_USER, // Send a copy to yourself
      subject: "Your QR Tokens for Oceanus Classic Event",
      text: "Here are your requested QR tokens. please find them attached. You can use these QR codes to claim your food tokens at the event.",
      attachments
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "QR codes sent via Gmail" }),
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
