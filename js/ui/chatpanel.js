/* Utils */

function validateOfferToken(token) {
  try {
    const obj = JSON.parse(atob(token));
    return obj.type === "offer" && typeof obj.sdp === "string";
  } catch {
    return false;
  }
}

function truncateToken(token, len = 12) {
  if (token.length <= len) return token;
  return token.slice(0, len) + "...";
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function appendChat(sender, msg) {
  const log = document.getElementById("chatLog");
  if (!log) return;
  const line = document.createElement("div");
  line.textContent = sender + ": " + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

/* Panneau Add contact */

async function showAddContactPanel() {
  const main = document.getElementById("mainPanel");

  // Générer ton offer
  const myOfferToken = await createOfferToken();

  main.innerHTML = `
    <h2>Add contact</h2>

    <h3>Your offer (share this)</h3>
    <div class="qrContainer" id="myOfferQR"></div>
    <div>
      <span class="tokenShort" id="myOfferShort"></span>
    </div>
    <pre id="myOfferFull"></pre>

    <h3>Partner offer</h3>
    <textarea id="partnerOffer" placeholder="Paste partner's offer token"></textarea>

    <button id="linkBtn">Link devices</button>

    <div id="linkStatus"></div>
  `;

  // QR code pour ton offer
  if (window.QRCode) {
    new QRCode(document.getElementById("myOfferQR"), {
      text: myOfferToken,
      width: 200,
      height: 200
    });
  }

  // Token tronqué + copie
  const shortSpan = document.getElementById("myOfferShort");
  shortSpan.textContent = truncateToken(myOfferToken);
  shortSpan.title = "Click to copy full token";
  shortSpan.onclick = () => copyToClipboard(myOfferToken);

  document.getElementById("myOfferFull").textContent = myOfferToken;

  document.getElementById("linkBtn").onclick = async () => {
    const partnerToken = document.getElementById("partnerOffer").value.trim();
    const status = document.getElementById("linkStatus");

    if (!partnerToken) {
      alert("Paste partner's offer token");
      return;
    }
    if (!validateOfferToken(partnerToken)) {
      alert("Invalid partner offer token");
      return;
    }

    status.textContent = `Testing connection to ${truncateToken(partnerToken)}…`;

    // Créer une answer pour l'offre du partenaire
    let answerToken;
    try {
      answerToken = await createAnswerToken(partnerToken);
    } catch (e) {
      status.textContent = "Error while creating answer (invalid offer?)";
      return;
    }

    // Afficher l'answer à envoyer
    status.innerHTML = `
      <p>Send this answer token to your partner and ask them to apply it.</p>
      <div class="qrContainer" id="answerQR"></div>
      <div>
        <span class="tokenShort" id="answerShort"></span>
      </div>
      <pre id="answerFull"></pre>
      <p>Waiting for connection (10s timeout)…</p>
    `;

    // QR pour l'answer
    if (window.QRCode) {
      new QRCode(document.getElementById("answerQR"), {
        text: answerToken,
        width: 200,
        height: 200
      });
    }

    const answerShort = document.getElementById("answerShort");
    answerShort.textContent = truncateToken(answerToken);
    answerShort.title = "Click to copy full token";
    answerShort.onclick = () => copyToClipboard(answerToken);

    document.getElementById("answerFull").textContent = answerToken;

    // Attendre la connexion
    const connected = await waitForConnectionOrTimeout(10000);

    if (!connected) {
      status.innerHTML += `<p><b>Result:</b> timeout or unreachable.</p>`;
      return;
    }

    status.innerHTML += `<p><b>Result:</b> connection established.</p>`;

    // Demander le nom du contact
    const name = prompt("Enter contact name:");
    if (!name) {
      status.innerHTML += `<p>Contact not saved (no name).</p>`;
      return;
    }

    const c = addContact(name, partnerToken);
    renderSidebar();
    showContactPanel(c.id);
  };
}

/* Panneau contact : une fois lié → juste le chat */

function showContactPanel(id) {
  const c = getContact(id);
  if (!c) return;

  const main = document.getElementById("mainPanel");
  main.innerHTML = `
    <h2>Chat with ${c.name}</h2>

    <div id="chatLog"></div>
    <textarea id="chatMsg" placeholder="Message..."></textarea>
    <button id="sendMsgBtn">Send</button>
  `;

  document.getElementById("sendMsgBtn").onclick = () => {
    const msg = document.getElementById("chatMsg").value.trim();
    if (!msg) return;

    if (!channel || channel.readyState !== "open") {
      appendChat("System", "Channel not open");
      return;
    }

    const full = profile.name + ": " + msg;
    channel.send(full);
    appendChat(profile.name, msg);
    document.getElementById("chatMsg").value = "";
  };
}
