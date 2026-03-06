/* -------- MESSAGE HISTORY -------- */

function saveMessage(peerId, from, text, timestamp = Date.now()) {
  const all = JSON.parse(localStorage.getItem("messages") || "{}");
  if (!all[peerId]) all[peerId] = [];
  all[peerId].push({ from, text, timestamp });
  localStorage.setItem("messages", JSON.stringify(all));
}

function getMessages(peerId) {
  const all = JSON.parse(localStorage.getItem("messages") || "{}");
  return all[peerId] || [];
}

function appendChat(sender, msg, timestamp = Date.now()) {
  const log = document.getElementById("chatLog");
  if (!log) return;

  const div = document.createElement("div");

  if (sender === "System") {
    div.className = "systemMsg";
    div.textContent = msg;
  } else {
    div.className = "msg " + (sender === profile.name ? "me" : "them");
    div.innerHTML = `
      <div class="bubble">${renderMessageContent(msg)}</div>
      <div class="time">${new Date(timestamp).toLocaleTimeString()}</div>
    `;
  }

  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function renderMessageContent(text) {
  // On découpe le message en mots pour analyser chaque segment
  const parts = text.split(/\s+/);

  const htmlParts = parts.map((part) => {
    // GIF / PNG / JPG
    if (part.match(/^https?:\/\/.*\.(gif|png|jpg|jpeg)$/i)) {
      return `<img src="${part}" class="chatImage">`;
    }

    // Lien normal
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return `<a href="${part}" target="_blank">${part}</a>`;
    }

    // Texte normal
    return escapeHtml(part);
  });

  // On recompose le message avec des espaces
  return htmlParts.join(" ");
}

function escapeHtml(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* -------- PROFILE PANEL -------- */

function showProfilePanel() {
  const main = document.getElementById("mainPanel");

  const link = `${location.origin}/?peer=${localPeerId || ""}&name=${encodeURIComponent(profile.name)}`;

  main.innerHTML = `
    <h2>My profile</h2>

    <label>Your name</label>
    <input id="myName" value="${profile.name}">
    <button id="saveName">Save</button>

    <h3>Share your link</h3>
    <div id="myQR"></div>
    <pre>${link}</pre>
  `;

  if (localPeerId) {
    const qr = new QRCodeStyling({
      width: 200,
      height: 200,
      type: "svg",
      data: link,
      dotsOptions: {
        color: "#000",
        type: "rounded",
      },
      backgroundOptions: {
        color: "transparent",
      },
    });

    qr.append(document.getElementById("myQR"));

    setTimeout(() => {
      const svg = document.querySelector("#myQR svg");
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const base64 = "data:image/svg+xml;base64," + btoa(svgData);

      document.getElementById("myQR").innerHTML = `
        <img id="qrcode" src="${base64}" alt="QR Code">
      `;
    }, 20);
  } else {
    document.getElementById("myQR").textContent = "PeerID not ready yet.";
  }

  document.getElementById("saveName").onclick = () => {
    profile.name = document.getElementById("myName").value.trim();
    saveProfile(profile);
    alert("Name updated");
  };
}

/* -------- ADD CONTACT PANEL -------- */

function showAddContactPanel() {
  const main = document.getElementById("mainPanel");

  main.innerHTML = `
    <h2>Add contact</h2>

    <label>Name</label>
    <input id="newName">

    <label>PeerJS ID</label>
    <input id="newPeerId">

    <button id="saveContact">Save</button>
  `;

  document.getElementById("saveContact").onclick = () => {
    const name = document.getElementById("newName").value.trim();
    const peerId = document.getElementById("newPeerId").value.trim();

    if (!name || !peerId) return alert("Missing fields");

    const c = addContact(name, peerId);
    renderSidebar();
    showContactPanel(c.id);
  };
}

/* -------- CONTACT PANEL -------- */

let currentContact = null;

function showContactPanel(id) {
  const c = getContact(id);
  if (!c) return;
  currentContact = c;

  const main = document.getElementById("mainPanel");
  main.innerHTML = `
    <h2>Chat with ${c.name}</h2>
    <p>PeerID: ${c.peerId}</p>

    <div id="chatLog"></div>
    <textarea id="chatMsg"></textarea>
    <button id="sendMsgBtn">Send</button>
  `;

  // Charger l’historique
  const history = getMessages(c.peerId);
  history.forEach((m) => {
    appendChat(m.from === "me" ? profile.name : c.name, m.text, m.timestamp);
  });

  document.getElementById("sendMsgBtn").onclick = () => {
    ensurePeerReady(() => {
      sendMessageFlow();
    });
  };
}

let lastSentTime = 0;
const SEND_COOLDOWN = 800;

function sendMessageFlow() {
  const now = Date.now();
  if (now - lastSentTime < SEND_COOLDOWN) {
    return;
  }
  lastSentTime = now;

  const msgEl = document.getElementById("chatMsg");
  const sendBtn = document.getElementById("sendMsgBtn");

  if (!msgEl) return;
  const msg = msgEl.value.trim();
  if (!msg) return;

  if (sendBtn) sendBtn.disabled = true;
  setTimeout(() => {
    if (sendBtn) sendBtn.disabled = false;
  }, SEND_COOLDOWN);

  const peerId = currentContact.peerId;

  if (!isPeerConnected(peerId)) {
    appendChat("System", "Connecting…");

    connectToPeer(peerId, () => {
      appendChat("System", "Connected");
      try {
        sendToPeer(peerId, msg);
        saveMessage(peerId, "me", msg);
        appendChat(profile.name, msg);
        msgEl.value = "";
      } catch {
        appendChat("System", "Failed to send");
      }
    });

    return;
  }

  try {
    sendToPeer(peerId, msg);
    saveMessage(peerId, "me", msg);
    appendChat(profile.name, msg);
    msgEl.value = "";
  } catch {
    appendChat("System", "Failed to send");
  }
}

/* -------- PEER MESSAGE HANDLER -------- */

onPeerMessage = (peerId, name, msg) => {
  saveMessage(peerId, "them", msg);
  if (currentContact && currentContact.peerId === peerId) {
    appendChat(name, msg);
  } else {
    console.log("Message reçu hors chat actif:", msg);
  }
};
