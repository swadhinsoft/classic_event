const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");

const UPI_PA = "swadhinsoft-2@okaxis";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,       // your Gmail user, e.g. swadhinsoft@gmail.com
    pass: process.env.SMTP_PASS,       // app password or OAuth token
  },
});

exports.handler = async function (event) {
  try {
    const data = JSON.parse(event.body);

    const { block, flat, email, donation, day1Tokens, day2Tokens } = data;
    if (!block || !flat || !email) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: "Missing required fields" }) };
    }

    // Generate tokens array (for each token per day)
    const tokensList = [];

    for (let i = 1; i <= day1Tokens; i++) {
      tokensList.push({ day: "Day 1 (27th Aug)", tokenNo: i });
    }
    for (let i = 1; i <= day2Tokens; i++) {
      tokensList.push({ day: "Day 2 (28th Aug)", tokenNo: i });
    }

    // Generate QR code images (base64)
    const qrImages = await Promise.all(tokensList.map(async ({ day, tokenNo }) => {
      const text = `Flat: ${block}-${flat} | ${day} Token-${tokenNo} | UPI: ${UPI_PA}`;
      const dataUrl = await QRCode.toDataURL(text);
      return { day, tokenNo, dataUrl };
    }));

    // Compose HTML email content
    let htmlContent = `<h2>Thank you for your contribution!</h2>`;
    htmlContent += `<p>Flat: <b>${block}-${flat}</b></p>`;
    htmlContent += `<p>Donation Amount: ₹${donation}</p>`;
    htmlContent += `<p>Your tokens are below:</p>`;

    // Group tokens by day
    const grouped = {};
    qrImages.forEach(({ day, tokenNo, dataUrl }) => {
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({ tokenNo, dataUrl });
    });

    for (const day in grouped) {
      htmlContent += `<h3>${day}</h3><div style="display:flex;flex-wrap:wrap;">`;
      grouped[day].forEach(({ tokenNo, dataUrl }) => {
        htmlContent += `
          <div style="margin:10px; text-align:center;">
            <p>Token ${tokenNo}</p>
            <img src="${dataUrl}" alt="QR Token ${tokenNo}" width="150" height="150"/>
          </div>`;
      });
      htmlContent += `</div>`;
    }

    htmlContent += `<hr/><p>With regards,<br/>Oceanus Classic Event Management Team</p>`;

    // Send email
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      cc: process.env.SMTP_USER,
      subject: `Thank you ${block}-${flat} for your contribution to Ganesh Puja 2025`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error sending tokens email:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
