// chat.js — logique de chat + rendu

let currentChatPeerId = null;
let pendingRetries = {};
let onPeerAck = null;

/* -------- MESSAGE STORAGE -------- */

function saveMessage(
  peerId,
  from,
  text,
  timestamp = Date.now(),
  status = "sending",
  id = crypto.randomUUID(),
) {
  const all = JSON.parse(localStorage.getItem("messages") || "{}");
  if (!all[peerId]) all[peerId] = [];

  all[peerId].push({
    id,
    from,
    text,
    timestamp,
    status,
  });

  localStorage.setItem("messages", JSON.stringify(all));
  return id;
}

function getMessages(peerId) {
  const all = JSON.parse(localStorage.getItem("messages") || "{}");
  return all[peerId] || [];
}

function updateMessageStatus(peerId, id, newStatus) {
  const all = JSON.parse(localStorage.getItem("messages") || "{}");
  if (!all[peerId]) return;

  const msg = all[peerId].find((m) => m.id === id);
  if (!msg) return;

  msg.status = newStatus;
  localStorage.setItem("messages", JSON.stringify(all));
}

/* -------- RENDER HELPERS -------- */

function renderMessageContent(text) {
  const parts = text.split(/\s+/);

  const htmlParts = parts.map((part) => {
    if (part.match(/^https?:\/\/.*\.(gif|png|jpg|jpeg)$/i)) {
      return `<img src="${part}" class="chatImage">`;
    }

    if (part.startsWith("http://") || part.startsWith("https://")) {
      return `<a href="${part}" target="_blank">${part}</a>`;
    }

    return escapeHtml(part);
  });

  return htmlParts.join(" ");
}

function escapeHtml(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

  const long = `${d.getDate()} ${d.toLocaleString("en", { month: "long" })} at ${time}`;
  return long;
}

function renderStatus(status) {
  switch (status) {
    case "sending":
      return "◌";
    case "sent":
      return "✓";
    case "received":
      return "✓✓";
    case "failure":
      return "⚠️";
    default:
      return "";
  }
}

/* -------- RENDER MESSAGES -------- */

function appendMessage(from, text, timestamp, status) {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  const div = document.createElement("div");
  div.className = "msg " + (from === "me" ? "me" : "them");

  div.innerHTML = `
    <div class="bubble">${renderMessageContent(text)}</div>
    <div class="time">${formatTimestamp(timestamp)} · ${renderStatus(status)}</div>
  `;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function appendSystem(text) {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  const div = document.createElement("div");
  div.className = "systemMsg";
  div.textContent = text;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

/* -------- OPEN CHAT -------- */

function openChat(peerId, name) {
  currentChatPeerId = peerId;

  const el = document.querySelector(`[data-peerid="${peerId}"]`);
  if (el) el.classList.remove("unread");

  const main = document.getElementById("mainPanel");
  if (!main) return;

  main.innerHTML = `
    <h2>Chat with ${name}</h2>
    <p>PeerID: ${peerId}</p>

    <div id="chatMessages"></div>

    <div id="chatInputRow">
      <input id="chatInput" placeholder="Type a message…">
      <button id="chatSend">Send</button>
    </div>
  `;

  const history = getMessages(peerId);
  history.forEach((m) => {
    appendMessage(m.from, m.text, m.timestamp, m.status);
  });

  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");

  if (sendBtn) sendBtn.onclick = sendCurrentMessage;

  if (input) {
    input.onkeydown = (e) => {
      if (e.key === "Enter") sendCurrentMessage();
    };
  }
}

/* -------- SEND MESSAGE -------- */

function sendCurrentMessage() {
  if (!peer || !localPeerId) {
    showProfilePanel(true);
    return;
  }
  const input = document.getElementById("chatInput");
  if (!input || !currentChatPeerId) return;

  const text = input.value.trim();
  if (!text) return;

  const peerId = currentChatPeerId;
  const timestamp = Date.now();
  const id = saveMessage(peerId, "me", text, timestamp, "sending");

  appendMessage("me", text, timestamp, "sending");
  input.value = "";

  const trySend = () => {
    try {
      const newId = sendToPeer(peerId, text);

      updateMessageStatus(peerId, id, "sent");

      onPeerAck = (fromPeer, ackId) => {
        if (ackId === newId) {
          updateMessageStatus(peerId, id, "received");
          delete pendingRetries[id];
        }
      };
    } catch {
      updateMessageStatus(peerId, id, "failure");

      pendingRetries[id] = {
        peerId,
        text,
        lastTry: Date.now(),
      };
    }
  };

  if (!isPeerConnected(peerId)) {
    connectToPeer(peerId, () => {
      trySend();
    });
  } else {
    trySend();
  }
}

/* -------- PEER MESSAGE HANDLER -------- */

onPeerMessage = (peerId, name, rawMsg, id) => {
  messageHandler.receive(peerId, name, rawMsg, id);
};

/* -------- RETRY LOGIC -------- */

setInterval(() => {
  const now = Date.now();

  for (const id in pendingRetries) {
    const p = pendingRetries[id];

    if (now - p.lastTry >= 15000) {
      p.lastTry = now;

      try {
        const newId = sendToPeer(p.peerId, p.text);

        updateMessageStatus(p.peerId, id, "sent");

        onPeerAck = (fromPeer, ackId) => {
          if (ackId === newId) {
            updateMessageStatus(p.peerId, id, "received");
            delete pendingRetries[id];
          }
        };
      } catch {
        updateMessageStatus(p.peerId, id, "failure");
      }
    }
  }
}, 1000);
