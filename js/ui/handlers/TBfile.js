// TBfile.js
// UI complet pour demande/accept/send avec TBPeerManager (aucun import cyclique vers chat au top-level)

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { profile } from "../profile.js";

/* -------------------- Helpers UI -------------------- */

function createOverlay(title, html) {
  const o = document.createElement("div");
  o.className = "tbfile-overlay";
  o.innerHTML = `
    <div class="tbfile-panel" role="dialog" aria-modal="true">
      <div class="tbfile-header">
        <strong>${title}</strong>
        <button class="tbfile-close" aria-label="Close">✕</button>
      </div>
      <div class="tbfile-body">${html}</div>
    </div>
  `;
  o.querySelector(".tbfile-close").onclick = () => o.remove();
  o.onclick = (e) => {
    if (e.target === o) o.remove();
  };
  document.body.appendChild(o);
  return o;
}

function dispatchSystem(msgHtml) {
  // évènement que chat.js peut écouter pour afficher un message système
  document.dispatchEvent(new CustomEvent("tbfile-system", { detail: msgHtml }));
}

/* -------------------- UI states -------------------- */

function showRequesterWaiting(peerId, requestId) {
  const o = createOverlay(
    "File transfer",
    `
    <p>Status: <span class="tb-status">Waiting…</span></p>
    <button class="tb-cancel">Cancel</button>
    <div class="tb-result"></div>
  `,
  );
  o.dataset.requestId = requestId;

  o.querySelector(".tb-cancel").onclick = () => {
    TBPeerManager.send(peerId, {
      type: "file-request-cancel",
      id: requestId,
      from: profile.name,
    });
    o.querySelector(".tb-status").textContent = "Cancelled";
  };

  return o;
}

function showRequesterSendUI(peerId, requestId) {
  const o = createOverlay(
    "Send file",
    `
    <input type="file" id="tb-file">
    <button id="tb-send" disabled>Send</button>

    <div class="tb-progress-wrap" style="display:none; margin-top:12px;">
      <div class="tb-progress" style="height:10px; background:#eee; border-radius:6px; overflow:hidden;">
        <div class="tb-progress-bar" style="width:0%; height:100%; background:#4caf50;"></div>
      </div>
    </div>

    <div class="tb-status-text" style="margin-top:10px;"></div>
  `,
  );

  const fileInput = o.querySelector("#tb-file");
  const sendBtn = o.querySelector("#tb-send");
  const progressWrap = o.querySelector(".tb-progress-wrap");
  const progressBar = o.querySelector(".tb-progress-bar");
  const statusEl = o.querySelector(".tb-status-text");

  fileInput.onchange = () => (sendBtn.disabled = !fileInput.files.length);

  sendBtn.onclick = async () => {
    const f = fileInput.files[0];
    if (!f) return;

    // envoyer meta via control message (TBPeerManager gère meta en interne)
    try {
      progressWrap.style.display = "block";
      statusEl.textContent = "Sending…";

      await TBPeerManager.sendFile(peerId, f, (percent) => {
        progressBar.style.width = percent + "%";
      });

      statusEl.textContent = "Transfer complete";
      dispatchSystem(`📤 File sent: ${f.name}`);
      // gros bouton fermer
      o.querySelector(".tbfile-body").innerHTML +=
        `<div style="margin-top:12px;"><button class="tbfile-close-large">Close</button></div>`;
      o.querySelector(".tbfile-close-large").onclick = () => o.remove();
    } catch (e) {
      statusEl.textContent = "Transfer failed";
      console.error(e);
    }
  };

  return o;
}

function showReceiverPanel(peerId, requestId) {
  const o = createOverlay(
    "Receiving file",
    `
    <p class="tb-status-text">Waiting for data…</p>
    <div class="tb-progress-wrap" style="margin-top:12px;">
      <div class="tb-progress" style="height:10px; background:#eee; border-radius:6px; overflow:hidden;">
        <div class="tb-progress-bar" style="width:0%; height:100%; background:#2196F3;"></div>
      </div>
    </div>
  `,
  );
  o.dataset.requestId = requestId;
  return o;
}

/* -------------------- INIT and event wiring -------------------- */

export function initTBfile() {
  // TBPeerManager ready (ne pas attacher globalement)
  // onRequest: afficher boutons accept/deny dans le chat via event
  TBPeerManager.onRequest = (peerId, requestId, fromName) => {
    dispatchSystem(`
      <span>${fromName} wants to send you a file</span>
      <button class="tb-accept" data-id="${requestId}" data-peer="${peerId}">Accept</button>
      <button class="tb-deny" data-id="${requestId}" data-peer="${peerId}">Deny</button>
    `);
  };

  TBPeerManager.onResponse = (peerId, requestId, accepted) => {
    const o = document.querySelector(
      `.tbfile-overlay[data-request-id="${requestId}"]`,
    );
    if (!o) return;

    if (!accepted) {
      o.querySelector(".tb-status").textContent = "Refused";
      o.querySelector(".tb-result").innerHTML =
        `<button class="tbfile-close-large">Close</button>`;
      o.querySelector(".tbfile-close-large").onclick = () => o.remove();
      dispatchSystem(`❌ File request refused by ${peerId}`);
      return;
    }

    // accepted -> show send UI for requester
    o.remove();
    showRequesterSendUI(peerId, requestId);
  };

  TBPeerManager.onMeta = (peerId, requestId, meta) => {
    const o = document.querySelector(
      `.tbfile-overlay[data-request-id="${requestId}"]`,
    );
    if (o) {
      const statusText = o.querySelector(".tb-status-text");
      if (statusText)
        statusText.textContent = `Incoming: ${meta.name} (${Math.round(meta.size / 1024)} KB)`;
    }
  };

  TBPeerManager.onCancel = (peerId, requestId) => {
    const o = document.querySelector(
      `.tbfile-overlay[data-request-id="${requestId}"]`,
    );
    if (o) o.remove();
    dispatchSystem(`⚠️ File request cancelled`);
  };

  TBPeerManager.onChunkProgress = (peerId, percent) => {
    const o = document.querySelector(".tbfile-overlay");
    if (!o) return;
    const bar = o.querySelector(".tb-progress-bar");
    if (bar) bar.style.width = percent + "%";
  };

  TBPeerManager.onFile = (peerId, file, requestId) => {
    // afficher download + close
    const o =
      document.querySelector(
        `.tbfile-overlay[data-request-id="${requestId}"]`,
      ) || document.querySelector(".tbfile-overlay");
    if (o) {
      const url = URL.createObjectURL(file);
      o.querySelector(".tbfile-body").innerHTML = `
        <p>Received file</p>
        <a href="${url}" download="${file.name}">Download ${file.name}</a>
        <div style="margin-top:12px;"><button class="tbfile-close-large">Close</button></div>
      `;
      o.querySelector(".tbfile-close-large").onclick = () => o.remove();
    }
    dispatchSystem(`📥 Received file: ${file.name}`);
  };

  /* --- Accept / Deny buttons in chat (dispatched via dispatchSystem) --- */
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("tb-accept")) {
      const peerId = e.target.dataset.peer;
      const requestId = e.target.dataset.id;

      // Attacher TBPeerManager à la connexion du peer (on commence à écouter)
      TBPeerManager.attachToPeer(peerId);

      TBPeerManager.send(peerId, {
        type: "file-response",
        id: requestId,
        accepted: true,
        from: profile.name,
      });

      // ouvrir UI receveur
      showReceiverPanel(peerId, requestId);
    }

    if (e.target.classList.contains("tb-deny")) {
      const peerId = e.target.dataset.peer;
      const requestId = e.target.dataset.id;

      TBPeerManager.send(peerId, {
        type: "file-response",
        id: requestId,
        accepted: false,
        from: profile.name,
      });
    }
  });

  /* --- Click on toolbox button --- */
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='file']");
    if (!btn) return;

    // récupérer peerId dynamiquement pour éviter cycle
    const { getLocalId } = await import("../chat.js");
    const peerId = getLocalId();
    if (!peerId) {
      createOverlay("File transfer", "<p>Open a chat first.</p>");
      return;
    }

    // ATTACHER TBPeerManager à cette connexion maintenant (on veut écouter réponses)
    TBPeerManager.attachToPeer(peerId);

    const requestId = crypto.randomUUID();
    showRequesterWaiting(peerId, requestId);

    TBPeerManager.send(peerId, {
      type: "file-request",
      id: requestId,
      from: profile.name,
    });
  });
}
