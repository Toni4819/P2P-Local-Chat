let currentChatPeerId = null;
let pendingRetries = {};

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
      <div class="time">
        ${formatTimestamp(timestamp)} · ${renderStatus(status)}
      </div>
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
  const msgEl = document.getElementById("chatMsg");
  const sendBtn = document.getElementById("sendMsgBtn");
  const msg = msgEl.value.trim();
  if (!msg) return;

  const peerId = currentContact.peerId;

  sendBtn.disabled = true;

  const timestamp = Date.now();
  const id = crypto.randomUUID();

  // statut initial
  saveMessage(peerId, "me", msg, timestamp, "envoi", id);
  appendChat(profile.name, msg, timestamp, "envoi");

  msgEl.value = "";

  const trySend = () => {
    try {
      const newId = sendToPeer(peerId, msg);

      updateMessageStatus(peerId, id, "envoyé");

      onPeerAck = (fromPeer, ackId) => {
        if (ackId === newId) {
          updateMessageStatus(peerId, id, "reçu");
          delete pendingRetries[id];
        }
      };
    } catch {
      updateMessageStatus(peerId, id, "echec");

      pendingRetries[id] = {
        peerId,
        text: msg,
        lastTry: Date.now(),
      };
    }
  };

  if (!isPeerConnected(peerId)) {
    connectToPeer(peerId, () => {
      trySend();
      sendBtn.disabled = false;
    });
  } else {
    trySend();
    sendBtn.disabled = false;
  }
}

/* -------- PEER MESSAGE HANDLER -------- */

onPeerMessage = (peerId, name, msg, id) => {
  // sauvegarde du message reçu
  saveMessage(peerId, "them", msg, Date.now(), "reçu", id);

  // si le chat est ouvert → afficher immédiatement
  if (currentChatPeerId === peerId) {
    appendMessage("them", msg, Date.now(), "reçu");
  }
  // sinon → flash du contact
  else {
    flashContact(peerId);
  }
};

function formatTimestamp(ts) {
  const d = new Date(ts);
  const now = new Date();

  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (sameDay) return time;
  if (isYesterday) return "Yesterday at " + time;

  // Format long : 2 March at 8:34
  const long = `${d.getDate()} ${d.toLocaleString("en", { month: "long" })} at ${time}`;

  // Format court : 2/3/26 at 8:34
  const short = `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)} at ${time}`;

  return long; // ou short si tu préfères
}

function renderStatus(status) {
  switch (status) {
    case "sending":
      return "◌";
    case "sended":
      return "✓";
    case "received":
      return "✓✓"; // bleu via CSS
    case "failure":
      return "⚠️";
    default:
      return "";
  }
}

// --- RETRY LOGIC ---
setInterval(() => {
  const now = Date.now();

  for (const id in pendingRetries) {
    const p = pendingRetries[id];

    if (now - p.lastTry >= 15000) {
      p.lastTry = now;

      try {
        const newId = sendToPeer(p.peerId, p.text);

        updateMessageStatus(p.peerId, id, "envoyé");

        onPeerAck = (fromPeer, ackId) => {
          if (ackId === newId) {
            updateMessageStatus(p.peerId, id, "reçu");
            delete pendingRetries[id];
          }
        };
      } catch {
        updateMessageStatus(p.peerId, id, "echec");
      }
    }
  }
}, 1000);
