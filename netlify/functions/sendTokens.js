const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

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
    console.log("Received event.body:", event.body);

    const data = JSON.parse(event.body);
    console.log("Parsed data:", data);

    const { block, flat, email, donation, day1Tokens, day2Tokens, day3Tokens } = data;
    console.log("Destructured values:", { block, flat, email, donation, day1Tokens, day2Tokens, day3Tokens });

    // Defensive check for empty strings or undefined
    if (!block || block.trim() === "" || !flat || flat.toString().trim() === "" || !email || email.trim() === "") {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: "Missing required fields or empty values for block, flat, or email" }),
      };
    }

    // Rest of your logic...

    // For brevity, just return success here for testing
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error in handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

