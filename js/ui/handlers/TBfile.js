// ui/handlers/TBfile.js
import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { PeerManager } from "../../peer/utils/PeerManager.js";
import { currentChatPeerId, appendSystem } from "../chat.js";
import { profile } from "../profile.js";

/* -------------------- Overlay helper -------------------- */

function createOverlay(title, html) {
  const o = document.createElement("div");
  o.className = "tbfile-overlay";
  o.innerHTML = `
    <div class="tbfile-panel">
      <div class="tbfile-header">
        <strong>${title}</strong>
        <button class="tbfile-close">✕</button>
      </div>
      <div class="tbfile-body">${html}</div>
    </div>
  `;
  o.querySelector(".tbfile-close").onclick = () => o.remove();
  o.onclick = (e) => { if (e.target === o) o.remove(); };
  document.body.appendChild(o);
  return o;
}

/* -------------------- UI states -------------------- */

function showRequesterWaiting(peerId, requestId) {
  const o = createOverlay("File transfer", `
    <p>Status: <span class="tb-status">Waiting…</span></p>
    <button class="tb-cancel">Cancel</button>
    <div class="tb-result"></div>
  `);
  o.dataset.requestId = requestId;

  o.querySelector(".tb-cancel").onclick = () => {
    TBPeerManager.send(peerId, {
      type: "file-request-cancel",
      id: requestId,
      from: profile.name
    });
    o.querySelector(".tb-status").textContent = "Cancelled";
  };

  return o;
}

function showRequesterSendUI(peerId, requestId) {
  const o = createOverlay("Send file", `
    <input type="file" id="tb-file">
    <button id="tb-send" disabled>Send</button>

    <div class="tb-progress-wrap" style="display:none;">
      <div class="tb-progress"></div>
    </div>

    <div class="tb-status-text"></div>
  `);

  const fileInput = o.querySelector("#tb-file");
  const sendBtn = o.querySelector("#tb-send");
  const progressWrap = o.querySelector(".tb-progress-wrap");
  const progressEl = o.querySelector(".tb-progress");
  const statusEl = o.querySelector(".tb-status-text");

  fileInput.onchange = () => sendBtn.disabled = !fileInput.files.length;

  sendBtn.onclick = () => {
    const f = fileInput.files[0];
    if (!f) return;

    TBPeerManager.send(peerId, {
      type: "file-meta",
      id: requestId,
      name: f.name,
      size: f.size,
      mime: f.type,
      from: profile.name
    });

    const conn = PeerManager.connections.get(peerId);
    conn.send(f);

    progressWrap.style.display = "block";
    progressEl.style.width = "100%";
    statusEl.textContent = "Transfer complete";
    appendSystem(`File sent: ${f.name}`);
  };

  return o;
}

function showReceiverPanel(peerId, requestId) {
  const o = createOverlay("Receiving file", `
    <p class="tb-status-text">Waiting for data…</p>
    <div class="tb-progress-wrap">
      <div class="tb-progress"></div>
    </div>
  `);
  o.dataset.requestId = requestId;
  return o;
}

/* -------------------- INIT -------------------- */

export function initTBfile() {
  TBPeerManager.init();

  /* --- When someone requests a file --- */
  TBPeerManager.onRequest = (peerId, requestId, fromName) => {
    // Aucun message automatique
    // C’est l’utilisateur qui doit écrire en MP :
    // "<fromName> wants to send you a file"

    appendSystem(`
      <button class="tb-accept" data-id="${requestId}" data-peer="${peerId}">Accept</button>
      <button class="tb-deny" data-id="${requestId}" data-peer="${peerId}">Deny</button>
    `);
  };

  /* --- Accept / Deny --- */
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("tb-accept")) {
      const peerId = e.target.dataset.peer;
      const requestId = e.target.dataset.id;

      TBPeerManager.send(peerId, {
        type: "file-response",
        id: requestId,
        accepted: true,
        from: profile.name
      });

      showReceiverPanel(peerId, requestId);
    }

    if (e.target.classList.contains("tb-deny")) {
      const peerId = e.target.dataset.peer;
      const requestId = e.target.dataset.id;

      TBPeerManager.send(peerId, {
        type: "file-response",
        id: requestId,
        accepted: false,
        from: profile.name
      });
    }
  });

  /* --- Response from peer --- */
  TBPeerManager.onResponse = (peerId, requestId, accepted) => {
    const o = document.querySelector(`.tbfile-overlay[data-request-id="${requestId}"]`);
    if (!o) return;

    if (!accepted) {
      o.querySelector(".tb-status").textContent = "Refused";
      o.querySelector(".tb-result").innerHTML = `<button onclick="this.closest('.tbfile-overlay').remove()">Close</button>`;
      return;
    }

    o.remove();
    showRequesterSendUI(peerId, requestId);
  };

  /* --- Meta (filename incoming) --- */
  TBPeerManager.onMeta = (peerId, requestId, meta) => {
    const o = document.querySelector(`.tbfile-overlay[data-request-id="${requestId}"]`);
    if (!o) return;
    o.querySelector(".tb-status-text").textContent = `Incoming: ${meta.name}`;
  };

  /* --- Cancel --- */
  TBPeerManager.onCancel = (peerId, requestId) => {
    const o = document.querySelector(`.tbfile-overlay[data-request-id="${requestId}"]`);
    if (o) o.remove();
  };

  /* --- File received --- */
  TBPeerManager.onFile = (peerId, blob) => {
    const url = URL.createObjectURL(blob);
    const o = document.querySelector(".tbfile-overlay .tbfile-body");
    if (o) {
      o.innerHTML = `
        <p>Received file</p>
        <a href="${url}" download="${blob.name || 'file'}">Download</a>
        <button onclick="this.closest('.tbfile-overlay').remove()">Close</button>
      `;
    }
  };

  /* --- Click on toolbox button --- */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='file']");
    if (!btn) return;

    const peerId = currentChatPeerId;
    if (!peerId) {
      createOverlay("File transfer", "<p>Open a chat first.</p>");
      return;
    }

    const requestId = crypto.randomUUID();
    showRequesterWaiting(peerId, requestId);

    TBPeerManager.send(peerId, {
      type: "file-request",
      id: requestId,
      from: profile.name
    });
  });
}
