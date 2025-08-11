// netlify/functions/redeem-token.js
const fetch = require("node-fetch");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = "appYg5jllIXFddGJg";
const TABLE_NAME = "Table 1";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { tokenID } = JSON.parse(event.body);
    if (!tokenID) {
      return { statusCode: 400, body: "Missing tokenID" };
    }

    // Look up token
    const queryUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={tokenID}='${tokenID}'`;
    const queryRes = await fetch(queryUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    const data = await queryRes.json();

    if (!data.records || data.records.length === 0) {
      return { statusCode: 404, body: "Token not found" };
    }

    const record = data.records[0];
    const recordId = record.id;

    // Check if already redeemed
    if (record.fields.RedeemedOn) {
      return { statusCode: 400, body: "Token already redeemed" };
    }

    // Mark as redeemed
    const updateUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}`;
    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          RedeemedOn: new Date().toISOString()
        }
      })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return { statusCode: 500, body: `Failed to update token: ${errText}` };
    }

    return { statusCode: 200, body: "Token redeemed successfully" };

  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
