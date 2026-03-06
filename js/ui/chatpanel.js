function validateOfferToken(token) {
  try {
    const obj = JSON.parse(atob(token));
    return obj.type === "offer" && typeof obj.sdp === "string";
  } catch {
    return false;
  }
}

function appendChat(sender, msg) {
  const log = document.getElementById("chatLog");
  if (!log) return;
  const line = document.createElement("div");
  line.textContent = sender + ": " + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
async function showAddContactPanel() {
  const main = document.getElementById("mainPanel");

  // 1) Générer ton offer
  const myOfferToken = await createOfferToken();

  main.innerHTML = `
    <h2>Add contact</h2>

    <h3>Your offer (share this)</h3>
    <div id="myOfferQR"></div>
    <pre>${myOfferToken}</pre>

    <h3>Partner offer</h3>
    <textarea id="partnerOffer" placeholder="Paste partner's offer token"></textarea>

    <button id="linkBtn">Link devices</button>

    <div id="linkStatus"></div>
  `;

  // Générer QR
  new QRCode(document.getElementById("myOfferQR"), {
    text: myOfferToken,
    width: 200,
    height: 200
  });

  document.getElementById("linkBtn").onclick = async () => {
    const partnerToken = document.getElementById("partnerOffer").value.trim();
    if (!partnerToken) {
      alert("Paste partner's offer token");
      return;
    }

    const status = document.getElementById("linkStatus");
    status.textContent = "Linking devices...";

    // 2) Créer une answer pour l'offre du partenaire
    let answerToken;
    try {
      answerToken = await createAnswerToken(partnerToken);
    } catch (e) {
      status.textContent = "Invalid partner token";
      return;
    }

    // 3) Afficher l’answer à envoyer
    status.innerHTML = `
      <p>Send this answer token to your partner:</p>
      <pre>${answerToken}</pre>
      <p>Waiting for connection...</p>
    `;

    // 4) Attendre la connexion (10s max)
    const connected = await waitForConnectionOrTimeout(10000);

    if (!connected) {
      status.textContent = "Failed to link devices (timeout)";
      return;
    }

    // 5) Demander le nom du contact
    const name = prompt("Enter contact name:");
    if (!name) {
      status.textContent = "Cancelled";
      return;
    }

    // 6) Ajouter le contact
    const c = addContact(name, partnerToken);
    renderSidebar();
    showContactPanel(c.id);
  };
}
