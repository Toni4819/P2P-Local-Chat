function truncateId(id, len = 10) {
  return id.length <= len ? id : id.slice(0, len) + "...";
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

/* -------- Add contact -------- */

function showAddContactPanel() {
  const main = document.getElementById("mainPanel");

  main.innerHTML = `
    <h2>Add contact</h2>

    <h3>Your PeerJS ID</h3>
    <div>
      <span class="tokenShort" id="myPeerShort"></span>
    </div>
    <pre id="myPeerFull"></pre>

    <h3>New contact</h3>
    <input id="newContactName" placeholder="Contact name">
    <input id="newContactPeerId" placeholder="Contact PeerJS ID">

    <button id="saveNewContact">Save contact</button>
  `;

  const shortSpan = document.getElementById("myPeerShort");
  const fullPre = document.getElementById("myPeerFull");

  if (localPeerId) {
    shortSpan.textContent = truncateId(localPeerId);
    shortSpan.title = "Click to copy full ID";
    shortSpan.onclick = () => copyToClipboard(localPeerId);
    fullPre.textContent = localPeerId;
  } else {
    shortSpan.textContent = "(waiting for PeerJS ID…)";
    fullPre.textContent = "";
  }

  document.getElementById("saveNewContact").onclick = () => {
    const name = document.getElementById("newContactName").value.trim();
    const peerId = document.getElementById("newContactPeerId").value.trim();

    if (!name) return alert("Enter a name");
    if (!peerId) return alert("Enter a PeerJS ID");

    const c = addContact(name, peerId);
    renderSidebar();
    showContactPanel(c.id);
  };
}

/* -------- Contact panel (connect + chat) -------- */

let currentContact = null;

function showContactPanel(id) {
  const c = getContact(id);
  if (!c) return;
  currentContact = c;

  const main = document.getElementById("mainPanel");
  main.innerHTML = `
    <h2>Chat with ${c.name}</h2>
    <p>PeerJS ID: ${c.peerId}</p>
    <button id="connectBtn">Connect</button>
    <span id="connStatus"></span>

    <h3>Chat</h3>
    <div id="chatLog"></div>
    <textarea id="chatMsg" placeholder="Message..."></textarea>
    <button id="sendMsgBtn">Send</button>
  `;

  document.getElementById("connectBtn").onclick = () => {
    const status = document.getElementById("connStatus");
    status.textContent = " Connecting…";

    connectToPeer(c.peerId, () => {
      status.textContent = " Connected";
    });
  };

  document.getElementById("sendMsgBtn").onclick = () => {
    const msg = document.getElementById("chatMsg").value.trim();
    if (!msg) return;

    try {
      sendToPeer(c.peerId, profile.name + ": " + msg);
      appendChat(profile.name, msg);
      document.getElementById("chatMsg").value = "";
    } catch (e) {
      appendChat("System", "Not connected to " + c.name);
    }
  };
}

/* -------- Brancher les callbacks PeerJS -------- */

onPeerMessage = (peerId, msg) => {
  if (!currentContact) return;
  if (currentContact.peerId !== peerId) return;
  appendChat("Peer", msg);
};

onPeerIncomingConnection = (conn) => {
  // Si on a un contact avec ce peerId, on peut afficher un petit message
  const contact = contacts.find((c) => c.peerId === conn.peer);
  if (contact && currentContact && currentContact.peerId === conn.peer) {
    const status = document.getElementById("connStatus");
    if (status) status.textContent = " Connected (incoming)";
  }
};
