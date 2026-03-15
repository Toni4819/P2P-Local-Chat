// chatpanel.js

import { localPeerId } from "../peer/utils/PeerManager.js";
import { openChat } from "./chat.js";
import { addContact, getContact } from "./contacts.js";
import { profile, saveProfile } from "./profile.js";
import { renderSidebar } from "./sidebar.js";

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
    openChat(c.peerid, c.name);
  };
}

export function showContactPanel(id) {
  const c = getContact(id);
  if (!c) return;
  openChat(c.peerid, c.name);
}
