// chat.js

let currentChatPeerId = null;

function saveMessage(
  peerId,
  from,
  text,
  timestamp = Date.now(),
  status = "envoi",
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

// --- rendu des messages ---

function appendMessage(from, text, timestamp = Date.now()) {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  const div = document.createElement("div");
  div.className = "msg " + (from === "me" ? "me" : "them");

  div.innerHTML = `
    <div class="bubble">${escapeHtml(text)}</div>
    <div class="time">${new Date(timestamp).toLocaleTimeString()}</div>
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

// petite protection pour le texte
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- ouverture d’un chat avec un peer ---

function openChat(peerId, name) {
  currentChatPeerId = peerId;

  const box = document.getElementById("chatMessages");
  if (!box) return;
  box.innerHTML = "";

  appendSystem(`Chat with ${name} <${peerId}>`);

  const history = getMessages(peerId);
  history.forEach((m) => {
    appendMessage(m.from, m.text, m.timestamp);
  });

  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");

  if (sendBtn) {
    sendBtn.onclick = () => {
      sendCurrentMessage();
    };
  }

  if (input) {
    input.onkeydown = (e) => {
      if (e.key === "Enter") sendCurrentMessage();
    };
  }
}

function sendCurrentMessage() {
  const input = document.getElementById("chatInput");
  if (!input || !currentChatPeerId) return;

  const text = input.value.trim();
  if (!text) return;

  try {
    sendToPeer(currentChatPeerId, text);
    saveMessage(currentChatPeerId, "me", text);
    appendMessage("me", text);
    input.value = "";
  } catch (e) {
    console.error(e);
    appendSystem("Failed to send message.");
  }
}

// --- wiring avec peer-client.js ---

onPeerMessage = (peerId, name, msg) => {
  saveMessage(peerId, "them", msg);

  if (currentChatPeerId === peerId) {
    appendMessage("them", msg);
  } else {
    flashContact(peerId);
  }
};
