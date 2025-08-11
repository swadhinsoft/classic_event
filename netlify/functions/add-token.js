const fetch = require("node-fetch");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY; // in Netlify env
const BASE_ID = "appYg5jllIXFddGJg"; // Airtable Base ID
const TABLE_NAME = "Table 1"; // Your Airtable table name

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { tokenID, flatNo, day } = JSON.parse(event.body);
    if (!tokenID || !flatNo || !day) {
      return { statusCode: 400, body: "Missing tokenID, flatNo or day" };
    }

    // ✅ Prevent same token from being created twice
    const checkUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={tokenID}='${tokenID}'`;
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    const checkData = await checkRes.json();

    if (checkData.records && checkData.records.length > 0) {
      return { statusCode: 409, body: "Token already exists" };
    }

    // ✅ Add new record
    const url = `https://api.airtable.com/v0/${BASE_ID
