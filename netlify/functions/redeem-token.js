// netlify/functions/redeem-token.js

// WARNING: This stores redeemed tokens in memory only.
// For real usage, replace with persistent DB storage (Firebase, Airtable, etc.)
let redeemedTokens = new Set();

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {
    const { token } = JSON.parse(event.body);

    if (!token) {
      return {
        statusCode: 400,
        body: "Missing token"
      };
    }

    if (redeemedTokens.has(token)) {
      return {
        statusCode: 400,
        body: "Token already redeemed"
      };
    }

    redeemedTokens.add(token);

    return {
      statusCode: 200,
      body: "Token redeemed successfully"
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: "Internal server error: " + error.message
    };
  }
};
