const fetch = require('node-fetch');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'ClassicEvent';  // Replace with your Airtable base ID
const TABLE_NAME = 'Table 1';         // Use your exact table name from Airtable

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { tokenID, flatNo, day } = JSON.parse(event.body);

    if (!tokenID) {
      return { statusCode: 400, body: 'Missing tokenID' };
    }

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          TokenID: tokenID,
          FlatNo: flatNo || '',
          Day: day || '',
          Redeemed: false
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { statusCode: 500, body: `Failed to add token: ${errorText}` };
    }

    return { statusCode: 200, body: 'Token added successfully' };
  } catch (error) {
    return { statusCode: 500, body: `Server error: ${error.message}` };
  }
};
