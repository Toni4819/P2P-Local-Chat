function appendChat(sender, msg) {
  const log = document.getElementById("chatLog");
  if (!log) return;
  const line = document.createElement("div");
  line.textContent = sender + ": " + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
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

  document.getElementById("sendMsgBtn").onclick = () => {
    ensurePeerReady(() => {
      sendMessageFlow();
    });
  };
}

function sendMessageFlow() {
  const msgEl = document.getElementById("chatMsg");
  if (!msgEl) return;
  const msg = msgEl.value.trim();
  if (!msg) return;

  const peerId = currentContact.peerId;

  if (!isPeerConnected(peerId)) {
    appendChat("System", "Connecting…");

    connectToPeer(peerId, () => {
      appendChat("System", "Connected");
      try {
        sendToPeer(peerId, msg);
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
    appendChat(profile.name, msg);
    msgEl.value = "";
  } catch {
    appendChat("System", "Failed to send");
  }
}

/* -------- PEER MESSAGE HANDLER -------- */

onPeerMessage = (peerId, name, msg) => {
  if (!currentContact) return;
  if (currentContact.peerId !== peerId) return;
  appendChat(name, msg);
};
