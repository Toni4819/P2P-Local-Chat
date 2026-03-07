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

function updateMessageStatus(peerId, id, newStatus) {
  const all = JSON.parse(localStorage.getItem("messages") || "{}");
  if (!all[peerId]) return;

  const msg = all[peerId].find((m) => m.id === id);
  if (!msg) return;

  msg.status = newStatus;
  localStorage.setItem("messages", JSON.stringify(all));

  if (currentContact && currentContact.peerId === peerId) {
    showContactPanel(currentContact.id);
  }
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

let isBusySending = false;
let onPeerAck = null;

function sendMessageFlow() {
  const now = Date.now();
  if (now - lastSentTime < SEND_COOLDOWN) return;
  lastSentTime = now;

  if (isBusySending) return;

  const msgEl = document.getElementById("chatMsg");
  const sendBtn = document.getElementById("sendMsgBtn");
  if (!msgEl) return;

  const msg = msgEl.value.trim();
  if (!msg) return;

  const peerId = currentContact.peerId;

  // cooldown bouton
  if (sendBtn) sendBtn.disabled = true;
  setTimeout(() => {
    if (!isBusySending && sendBtn) sendBtn.disabled = false;
  }, SEND_COOLDOWN);

  isBusySending = true;

  const finish = () => {
    isBusySending = false;
    if (sendBtn) sendBtn.disabled = false;
  };

  // --- SI PAS CONNECTÉ ---
  if (!isPeerConnected(peerId)) {
    appendChat("System", "Connecting…");

    connectToPeer(peerId, () => {
      appendChat("System", "Connected");

      const id = sendToPeer(peerId, msg);

      saveMessage(peerId, "me", msg, Date.now(), "envoyé", id);
      appendChat(profile.name, msg, Date.now(), "envoyé");
      msgEl.value = "";

      // attendre ACK
      onPeerAck = (fromPeer, ackId) => {
        if (ackId === id) {
          updateMessageStatus(peerId, id, "reçu");
          finish();
        }
      };
    });

    return;
  }

  // --- SI DÉJÀ CONNECTÉ ---
  const id = sendToPeer(peerId, msg);

  saveMessage(peerId, "me", msg, Date.now(), "envoyé", id);
  appendChat(profile.name, msg, Date.now(), "envoyé");
  msgEl.value = "";

  onPeerAck = (fromPeer, ackId) => {
    if (ackId === id) {
      updateMessageStatus(peerId, id, "reçu");
      finish();
    }
  };
}

/* -------- PEER MESSAGE HANDLER -------- */

onPeerMessage = (peerId, name, msg, id) => {
  if (!currentContact) return;
  if (currentContact.peerId !== peerId) return;

  appendChat(name, msg, Date.now(), ""); // pas de status pour eux
};
