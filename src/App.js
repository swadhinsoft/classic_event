import React, { useState } from "react";

function App() {
  const [form, setForm] = useState({ block: "A1", flat: "", tokens: 1, email: "" });
  const [loading, setLoading] = useState(false);
  const [qrLinks, setQrLinks] = useState([]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setQrLinks([]);

    const res = await fetch("/.netlify/functions/generate-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setQrLinks(data.qrCodes || []);
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: "500px", margin: "auto", padding: "20px" }}>
      <h2>Request Food Tokens</h2>
      <form onSubmit={handleSubmit}>
        <label>Block No:</label>
        <select name="block" value={form.block} onChange={handleChange}>
          {["A1", "A2", "B1", "B2", "C1"].map(b => <option key={b}>{b}</option>)}
        </select>

        <label>Flat No:</label>
        <input type="number" name="flat" value={form.flat} onChange={handleChange} required />

        <label>Number of Tokens:</label>
        <input type="number" name="tokens" value={form.tokens} min={1} max={5} onChange={handleChange} required />

        <label>Email ID:</label>
        <input type="email" name="email" value={form.email} onChange={handleChange} required />

        <button type="submit" disabled={loading}>{loading ? "Generating..." : "Submit"}</button>
      </form>

      {qrLinks.length > 0 && (
        <div>
          <h3>Your QR Tokens:</h3>
          {qrLinks.map((qr, idx) => (
            <img key={idx} src={qr} alt={`QR Token ${idx + 1}`} width="150" />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
