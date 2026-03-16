// chatpanel.js

import { localPeerId, PeerManager } from "../peer/utils/PeerManager.js";
import { openChat } from "./chat.js";
import { addContact, getContact } from "./contacts.js";
import { profile, saveProfile } from "./profile.js";
import { renderSidebar } from "./sidebar.js";

/* -----------------------------------------------------
   INJECTION OVERLAY
----------------------------------------------------- */

function injectConnectionOverlay() {
  if (document.getElementById("connectingOverlay")) return;

  const div = document.createElement("div");
  div.id = "connectingOverlay";
  div.style = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    color: white;
    font-size: 20px;
    text-align: center;
    cursor: pointer;
  `;

  div.innerHTML = `
    <div>
      <div id="connTitle">Connecting…</div>
      <div id="connPeer"></div>
    </div>
  `;

  // Clic = annulation
  div.onclick = () => {
    PeerManager.cancelConnection();
  };

  document.body.appendChild(div);
}

injectConnectionOverlay();

/* -----------------------------------------------------
   UI HELPERS
----------------------------------------------------- */

const UI = {
  showConnectingOverlay(name) {
    const o = document.getElementById("connectingOverlay");
    document.getElementById("connTitle").textContent = "Connecting to " + name;
    document.getElementById("connPeer").textContent = "";
    o.style.display = "flex";
  },

  hideConnectingOverlay() {
    document.getElementById("connectingOverlay").style.display = "none";
  },

  showConnectionFailed() {
    const o = document.getElementById("connectingOverlay");
    document.getElementById("connTitle").textContent = "Connection failed";
    document.getElementById("connPeer").textContent = "Click to close";
    o.style.display = "flex";
  }
};

/* -----------------------------------------------------
   CONNECT UI ↔ PEERMANAGER
----------------------------------------------------- */

PeerManager.onConnectionStateChange = (state, peerId, err) => {
  if (state === "connecting") UI.showConnectingOverlay(peerId);
  if (state === "connected") UI.hideConnectingOverlay();
  if (state === "failed") UI.showConnectionFailed();
  if (state === "cancelled") UI.hideConnectingOverlay();
};

/* -----------------------------------------------------
   PANELS
----------------------------------------------------- */

export function showProfilePanel() {
  const main = document.getElementById("mainPanel");

  const link = `${location.origin}/P2P-Chat/?peer=${localPeerId || ""}&name=${encodeURIComponent(profile.name)}`;

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
      dotsOptions: { color: "#000", type: "rounded" },
      backgroundOptions: { color: "transparent" },
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
  }

  document.getElementById("saveName").onclick = () => {
    profile.name = document.getElementById("myName").value.trim();
    saveProfile(profile);
    alert("Name updated");
  };
}

document.addEventListener("click", (e) => {
  const qr = document.getElementById("qrcode");
  if (!qr) return;

  if (e.target === qr) {
    qr.classList.toggle("expanded");
  }
});

export function showAddContactPanel() {
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
    const peerid = document.getElementById("newPeerId").value.trim();

    if (!name || !peerid) return alert("Missing fields");

    const c = addContact(name, peerid);
    renderSidebar();

    UI.showConnectingOverlay(c.name);

    PeerManager.connect(c.peerid, () => {
      UI.hideConnectingOverlay();
      openChat(c.peerid, c.name);
    });
  };
}

export function showContactPanel(id) {
  const c = getContact(id);
  if (!c) return;

  UI.showConnectingOverlay(c.name);

  PeerManager.connect(c.peerid, () => {
    UI.hideConnectingOverlay();
    openChat(c.peerid, c.name);
  });
}
