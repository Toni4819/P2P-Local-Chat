// TBfile.js
// Système complet de transfert de fichiers façon AirDrop, sans import cyclique.

import { PeerManager } from "../peer/utils/PeerManager.js";

/* -----------------------------------------------------
   ÉTAT LOCAL
----------------------------------------------------- */

let currentMode = null; // "waiting", "select", "sending", "done", "denied"
let currentPeer = null;
let selectedFile = null;

/* -----------------------------------------------------
   OVERLAY + MENU
----------------------------------------------------- */

function createOverlay() {
  let ov = document.getElementById("tbfileOverlay");
  if (ov) return ov;

  ov = document.createElement("div");
  ov.id = "tbfileOverlay";
  ov.style = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 999999;
  `;
  ov.onclick = (e) => {
    if (e.target === ov) closeMenu();
  };

  document.body.appendChild(ov);
  return ov;
}

function renderMenu(html) {
  const ov = createOverlay();
  ov.innerHTML = `
    <div id="tbfileMenu" style="
      background: #fff;
      padding: 20px;
      border-radius: 12px;
      width: 320px;
      text-align: center;
      position: relative;
    ">
      <button id="tbfileClose" style="
        position:absolute; top:10px; right:10px;
        background:none; border:none; font-size:20px; cursor:pointer;
      ">×</button>
      ${html}
    </div>
  `;

  document.getElementById("tbfileClose").onclick = closeMenu;
  ov.style.display = "flex";
}

function closeMenu() {
  const ov = document.getElementById("tbfileOverlay");
  if (ov) ov.style.display = "none";
  currentMode = null;
  currentPeer = null;
  selectedFile = null;
}

/* -----------------------------------------------------
   DEMANDEUR : OUVERTURE DU MENU
----------------------------------------------------- */

async function openRequestMenu() {
  const { getCurrentChatPeerId } = await import("../ui/chat.js");
  const peerId = getCurrentChatPeerId();
  if (!peerId) return;

  currentPeer = peerId;
  currentMode = "waiting";

  renderMenu(`
    <h2>Waiting…</h2>
    <p>Sending request to peer…</p>
  `);

  PeerManager.requestFileTransfer(peerId);
}

/* -----------------------------------------------------
   RECEVEUR : NOTIFICATION
----------------------------------------------------- */

PeerManager.onFileRequest = (peerId, name) => {
  const notif = document.createElement("div");
  notif.style = `
    position: fixed;
    top: 20px; right: 20px;
    background: #fff;
    padding: 15px;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 999999;
  `;
  notif.innerHTML = `
    <p><b>${name}</b> wants to send you a file.</p>
    <button id="tbfileAccept">Accept</button>
    <button id="tbfileDeny">Deny</button>
  `;

  document.body.appendChild(notif);

  document.getElementById("tbfileAccept").onclick = () => {
    PeerManager.acceptFileTransfer(peerId);
    notif.remove();
    openReceiverMenu(peerId);
  };

  document.getElementById("tbfileDeny").onclick = () => {
    PeerManager.denyFileTransfer(peerId);
    notif.remove();
  };
};

/* -----------------------------------------------------
   DEMANDEUR : REFUS
----------------------------------------------------- */

PeerManager.onFileDenied = () => {
  currentMode = "denied";
  renderMenu(`
    <h2>Request denied</h2>
    <button onclick="document.getElementById('tbfileClose').click()">Close</button>
  `);
};

/* -----------------------------------------------------
   RECEVEUR : MENU D’ATTENTE
----------------------------------------------------- */

function openReceiverMenu(peerId) {
  currentPeer = peerId;
  currentMode = "select";

  renderMenu(`
    <h2>Waiting for sender…</h2>
    <p>The sender will choose a file.</p>
  `);
}

/* -----------------------------------------------------
   DEMANDEUR : MENU DE SÉLECTION
----------------------------------------------------- */

PeerManager.onFileAccepted = () => {
  currentMode = "select";

  renderMenu(`
    <h2>Select a file</h2>
    <input type="file" id="tbfileInput"><br><br>
    <button id="tbfileSendBtn" disabled>Send</button>
  `);

  const input = document.getElementById("tbfileInput");
  const sendBtn = document.getElementById("tbfileSendBtn");

  input.onchange = () => {
    selectedFile = input.files?.[0] || null;
    sendBtn.disabled = !selectedFile;
  };

  sendBtn.onclick = () => {
    if (!selectedFile) return;
    startSending(selectedFile);
  };
};

/* -----------------------------------------------------
   ENVOI AVEC PROGRESS BAR
----------------------------------------------------- */

function startSending(file) {
  currentMode = "sending";

  renderMenu(`
    <h2>Sending…</h2>
    <p>${file.name}</p>
    <progress id="tbfileProgress" value="0" max="100" style="width:100%"></progress>
  `);

  PeerManager.sendFile(currentPeer, file, (percent) => {
    const bar = document.getElementById("tbfileProgress");
    if (bar) bar.value = percent;
  });
}

/* -----------------------------------------------------
   RÉCEPTION AVEC PROGRESS BAR
----------------------------------------------------- */

PeerManager.onFileProgress = (percent) => {
  const bar = document.getElementById("tbfileProgress");
  if (bar) bar.value = percent;
};

/* -----------------------------------------------------
   FIN DE TRANSFERT
----------------------------------------------------- */

PeerManager.onFileReceived = (peerId, file) => {
  currentMode = "done";

  renderMenu(`
    <h2>Transfer complete</h2>
    <p>${file.name}</p>
    <button onclick="document.getElementById('tbfileClose').click()">Close</button>
  `);

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
};

/* -----------------------------------------------------
   BOUTON TOOLBOX
----------------------------------------------------- */

export function initTBfile() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-tool="file"]');
    if (!btn) return;
    openRequestMenu();
  });
}
