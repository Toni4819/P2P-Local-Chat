// chat.js

import { PeerManager } from "../peer/utils/PeerManager.js";
import { SendManager } from "../peer/utils/SendManager.js";

export let currentChatPeerId = null;

/* ============================
   MESSAGE STORAGE (IndexedDB)
============================ */

import { Database } from "../core/db.js";

export async function saveMessage(
  peerId,
  from,
  text,
  timestamp = Date.now(),
  status = "sending",
  id = crypto.randomUUID(),
) {
  const msg = {
    id,
    peerid: peerId,
    from,
    text,
    timestamp,
    status,
  };

  await Database.saveMessage(msg);
  return id;
}

export async function getMessages(peerId) {
  return new Promise((resolve, reject) => {
    const tx = Database.db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const index = store.index("peerid");

    const req = index.getAll(peerId);

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function updateMessageStatus(peerId, id, status) {
  return new Promise((resolve, reject) => {
    const tx = Database.db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");

    const req = store.get(id);

    req.onsuccess = () => {
      const msg = req.result;
      if (!msg) return resolve(false);

      msg.status = status;

      const updateReq = store.put(msg);

      updateReq.onsuccess = () => {
        if (currentChatPeerId === peerId) {
          const el = document.querySelector(`[data-msg-id="${id}"] .status`);
          if (el) el.textContent = renderStatus(status);
        }
        resolve(true);
      };

      updateReq.onerror = () => reject(updateReq.error);
    };

    req.onerror = () => reject(req.error);
  });
}

/* ============================
   RENDER HELPERS
============================ */

function escapeHtml(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMessageContent(text) {
  const parts = text.split(/\s+/);

  return parts
    .map((part) => {
      if (part.match(/^https?:\/\/.*\.(gif|png|jpg|jpeg)$/i)) {
        return `<img src="${part}" class="chatImage">`;
      }
      if (part.startsWith("http://") || part.startsWith("https://")) {
        return `<a href="${part}" target="_blank">${part}</a>`;
      }
      return escapeHtml(part);
    })
    .join(" ");
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

  return `${d.getDate()} ${d.toLocaleString("en", { month: "long" })} at ${time}`;
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

/* ============================
   RENDER MESSAGES
============================ */

export function appendMessage(from, text, timestamp, status, id) {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  const div = document.createElement("div");
  div.className = "msg " + (from === "me" ? "me" : "them");
  div.dataset.msgId = id;

  div.innerHTML = `
    <div class="bubble">${renderMessageContent(text)}</div>
    <div class="time">
      <time>${formatTimestamp(timestamp)}</time>
      <span class="sep"> · </span>
      <span class="status">${renderStatus(status)}</span>
    </div>
  `;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

export function appendSystem(text) {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  const div = document.createElement("div");
  div.className = "systemMsg";
  div.textContent = text;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

/* ============================
   OPEN CHAT
============================ */

export function openChat(peerId, name) {
  currentChatPeerId = peerId;

  if (!PeerManager.connections.has(peerId)) {
    PeerManager.connect(peerId, () => {
      console.log("Connected to", peerId);
    });
  }

  const el = document.querySelector(`[data-peerid="${peerId}"]`);
  if (el) el.classList.remove("unread");

  const main = document.getElementById("mainPanel");
  if (!main) return;

  main.innerHTML = `
  <div id="chatHeader">
    <h2>Chat with ${name}</h2>

    <div id="chatToolbox">
      <div class="toolBtn" data-tool="call">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72c.12 1.05.37 2.07.73 3.03a2 2 0 0 1-.45 2.11L8.91 10.91a16 16 0 0 0 6 6l1.05-1.05a2 2 0 0 1 2.11-.45c.96.36 1.98.61 3.03.73A2 2 0 0 1 22 16.92z"/>
        </svg>
      </div>

      <div class="toolBtn" data-tool="video">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M23 7l-7 5 7 5V7z"/>
          <rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
      </div>

      <div class="toolBtn" data-tool="file">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6"/>
        </svg>
      </div>
    </div>
  </div>

  <p>PeerID: ${peerId}</p>

  <div id="chatMessages"></div>

  <div id="chatInputRow">
    <input id="chatInput" placeholder="Type a message…">
    <button id="chatSend">Send</button>
  </div>
`;

  // Load history
  getMessages(peerId).then((history) => {
    history
      .sort((a, b) => a.timestamp - b.timestamp) // ← tri chronologique
      .forEach((m) =>
        appendMessage(m.from, m.text, m.timestamp, m.status, m.id),
      );
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

/* ============================
   SEND MESSAGE
============================ */

function sendCurrentMessage() {
  if (!PeerManager.ready) {
    import("./chatpanel.js").then(({ showProfilePanel }) =>
      showProfilePanel(true),
    );
    return;
  }

  const input = document.getElementById("chatInput");
  if (!input || !currentChatPeerId) return;

  const text = input.value.trim();
  if (!text) return;

  const peerId = currentChatPeerId;
  const timestamp = Date.now();

  // 1) Créer le message dans le storage AVEC l’ID
  saveMessage(peerId, "me", text, timestamp, "sending").then((id) => {
    SendManager.send(peerId, text, id);
  });

  // 2) Effacer l’input
  input.value = "";
}

/* ============================
   INIT CHAT (optional)
============================ */

// ui/chat.js (ajouter/modifier)
export function initChat() {
  // importer chatpanel uniquement quand PeerManager est prêt (évite cycle d'import)
  import("./chatpanel.js")
    .then(({ showProfilePanel }) => {
      // afficher le panneau profil au démarrage
      showProfilePanel();
    })
    .catch((err) => {
      console.warn("Impossible de charger chatpanel:", err);
    });

  // initialiser les handlers toolbox après l'affichage du profil
  import("./handlers/TBfile.js")
    .then(({ initTBfile }) => initTBfile())
    .catch(() => {});
  import("./handlers/TBcall.js")
    .then(({ initTBcall }) => initTBcall())
    .catch(() => {});
  import("./handlers/TBvideo.js")
    .then(({ initTBvideo }) => initTBvideo())
    .catch(() => {});
}
