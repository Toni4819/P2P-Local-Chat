// chat.js — système de chat moderne

let currentChatPeerId = null;

/* ---------------- MESSAGE STORAGE ---------------- */

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

/* ---------------- MESSAGE RENDERING ---------------- */

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

/* ---------------- CHAT OPENING ---------------- */

function openChat(peerId, name) {
  currentChatPeerId = peerId;

  const el = document.querySelector(`[data-peerid="${peerId}"]`);
  if (el) el.classList.remove("unread");

  const box = document.getElementById("chatMessages");
  if (!box) return;
  box.innerHTML = "";

  appendSystem(`Chat with ${name} <${peerId}>`);

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

/* ---------------- SEND MESSAGE ---------------- */

function sendCurrentMessage() {
  const input = document.getElementById("chatInput");
  if (!input || !currentChatPeerId) return;

  const text = input.value.trim();
  if (!text) return;

  const timestamp = Date.now();
  const id = saveMessage(currentChatPeerId, "me", text, timestamp, "sending");

  appendMessage("me", text, timestamp, "sending");
  input.value = "";

  try {
    const newId = sendToPeer(currentChatPeerId, text);

    updateMessageStatus(currentChatPeerId, id, "sent");

    onPeerAck = (fromPeer, ackId) => {
      if (ackId === newId) {
        updateMessageStatus(currentChatPeerId, id, "received");
      }
    };
  } catch {
    updateMessageStatus(currentChatPeerId, id, "failure");
  }
}

/* ---------------- RECEIVE MESSAGE ---------------- */

onPeerMessage = (peerId, name, msg, id) => {
  const timestamp = Date.now();
  saveMessage(peerId, "them", msg, timestamp, "received", id);

  if (currentChatPeerId === peerId) {
    appendMessage("them", msg, timestamp, "received");
  } else {
    flashContact(peerId);
  }
};
