document.getElementById("tokenForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const data = {
    eventName: document.getElementById("eventName").value,
    blockNo: document.getElementById("blockNo").value,
    flatNo: document.getElementById("flatNo").value,
    numTokens: parseInt(document.getElementById("numTokens").value),
    email: document.getElementById("email").value
  };

  const res = await fetch("/.netlify/functions/generate-tokens", {
    method: "POST",
    body: JSON.stringify(data)
  });

  const result = await res.json();
  alert(result.message || result.error);
});
