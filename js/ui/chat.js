// chat.js

import { PeerManager } from "../peer/utils/PeerManager.js";
import { SendManager } from "../peer/utils/SendManager.js";
import { showProfilePanel } from "./chatpanel.js";

export let currentChatPeerId = null;

/* ============================
   MESSAGE STORAGE
============================ */

export function saveMessage(
  peerId,
  from,
  text,
  timestamp = Date.now(),
  status = "sending",
  id = crypto.randomUUID(),
) {
  const all = JSON.parse(localStorage.getItem("messages") || "{}");
  if (!all[peerId]) all[peerId] = [];

  all[peerId].push({ id, from, text, timestamp, status });
  localStorage.setItem("messages", JSON.stringify(all));
  return id;
}

export function getMessages(peerId) {
  const all = JSON.parse(localStorage.getItem("messages") || "{}");
  return all[peerId] || [];
}

export function updateMessageStatus(peerId, id, status) {
  const all = JSON.parse(localStorage.getItem("messages") || "{}");
  const messages = all[peerId] || [];

  const msg = messages.find((m) => m.id === id);
  if (msg) msg.status = status;

  all[peerId] = messages;
  localStorage.setItem("messages", JSON.stringify(all));

  if (currentChatPeerId === peerId) {
    const el = document.querySelector(`[data-msg-id="${id}"] .status`);
    if (el) el.textContent = renderStatus(status);
  }
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
    <h2>Chat with ${name}</h2>
    <p>PeerID: ${peerId}</p>

    <div id="chatMessages"></div>

    <div id="chatInputRow">
      <input id="chatInput" placeholder="Type a message…">
      <button id="chatSend">Send</button>
    </div>
  `;

  // Load history
  const history = getMessages(peerId);
  history.forEach((m) =>
    appendMessage(m.from, m.text, m.timestamp, m.status, m.id),
  );

  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");

  // XOR lock
  let lock = false;
  const safeSend = () => {
    if (lock) return;
    lock = true;
    sendCurrentMessage();
    setTimeout(() => (lock = false), 0);
  };

  // Handlers
  if (sendBtn) sendBtn.onclick = safeSend;
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === "Enter") safeSend();
    };
  }
}

/* ============================
   SEND MESSAGE
============================ */

function sendCurrentMessage() {
  if (!PeerManager.ready) {
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

  appendMessage("me", text, timestamp, "sending", id);
  input.value = "";

  const newId = SendManager.send(peerId, text);

  if (newId !== id) {
    updateMessageStatus(peerId, id, "sent");
  }
}

/* ============================
   INIT CHAT (optional)
============================ */

export function initChat() {
  // Nothing special for now
}
