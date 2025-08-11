document.getElementById("tokenForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = Object.fromEntries(new FormData(e.target).entries());

  const res = await fetch("/.netlify/functions/generate-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  const data = await res.json();
  document.getElementById("result").innerHTML =
    data.qrCodes.map(qr => `<img src="${qr}" alt="QR Code" />`).join("");
});
