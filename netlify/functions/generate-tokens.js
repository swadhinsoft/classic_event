const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

exports.handler = async (event) => {
  try {
    const { eventName, blockNo, flatNo, numTokens, email } = JSON.parse(event.body);

    if (!eventName || !blockNo || !flatNo || !numTokens || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const qrImages = [];
    const attachments = [];

    for (let i = 0; i < numTokens; i++) {
      const qrData = `${eventName} - Block: ${blockNo}, Flat: ${flatNo}, Token: ${i + 1}`;
      const qrBuffer = await QRCode.toBuffer(qrData);
      const filename = `token-${i + 1}.png`;

      attachments.push({ filename, content: qrBuffer }); // download attachment
      attachments.push({ filename: `inline-${filename}`, content: qrBuffer, cid: `qr${i}@tokens` }); // inline

      qrImages.push(`
        <p><b>Person ${i + 1}:</b></p>
        <img src="cid:qr${i}@tokens" style="margin:5px"/>
      `);
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
      from: `"${eventName}" <${process.env.SMTP_USER}>`,
      to: email,
      cc: process.env.SMTP_USER,
      subject: `Thank you ${blockNo}-${flatNo} for your contribution to ${eventName}`,
      html: `
        <p>Dear Resident,</p>
        <p>Thank you for contributing to <b>${eventName}</b>!</p>
        <p>Here are your food tokens:</p>
        ${qrImages.join('')}
        <br>
        <p>Regards,<br>Oceanus Classic Event Management Team</p>
      `,
      attachments
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'QR codes sent successfully!' }) };
  } catch (error) {
    console.error('Error sending email:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send QR codes' }) };
  }
};
