// js/ui/handlers/TBfile.js
// UI complète + retry + BLOB direct

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { profile } from "../profile.js";

/* -----------------------------------------------------
   Helpers UI
----------------------------------------------------- */

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
  o.onclick = (e) => {
    if (e.target === o) o.remove();
  };
  document.body.appendChild(o);
  return o;
}

function sys(msg) {
  document.dispatchEvent(new CustomEvent("tbfile-system", { detail: msg }));
}

/* -----------------------------------------------------
   UI states
----------------------------------------------------- */

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

    progressWrap.style.display = "block";
    statusEl.textContent = "Sending…";

    await TBPeerManager.sendFile(peerId, f, (percent) => {
      progressBar.style.width = percent + "%";
    });

    statusEl.textContent = "Transfer complete";
    sys(`📤 File sent: ${f.name}`);

    o.querySelector(".tbfile-body").innerHTML += `
      <div style="margin-top:12px;">
        <button class="tbfile-close-large">Close</button>
      </div>
    `;
    o.querySelector(".tbfile-close-large").onclick = () => o.remove();
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

/* -----------------------------------------------------
   INIT
----------------------------------------------------- */

export function initTBfile() {
  /* --- Incoming request --- */
  TBPeerManager.onRequest = (peerId, requestId, fromName) => {
    sys(`
      ${fromName} wants to send you a file<br>
      <button class="tb-accept" data-id="${requestId}" data-peer="${peerId}">Accept</button>
      <button class="tb-deny" data-id="${requestId}" data-peer="${peerId}">Deny</button>
    `);
  };

  /* --- Accept / Deny --- */
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("tb-accept")) {
      const peerId = e.target.dataset.peer;
      const requestId = e.target.dataset.id;

      TBPeerManager.attachToPeer(peerId);

      TBPeerManager.send(peerId, {
        type: "file-response",
        id: requestId,
        accepted: true,
        from: profile.name,
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
        from: profile.name,
      });
    }
  });

  /* --- Response from peer --- */
  TBPeerManager.onResponse = (peerId, requestId, accepted) => {
    const o = document.querySelector(
      `.tbfile-overlay[data-request-id="${requestId}"]`,
    );
    if (!o) return;

    if (!accepted) {
      o.querySelector(".tb-status").textContent = "Refused";
      o.querySelector(".tb-result").innerHTML =
        `<button onclick="this.closest('.tbfile-overlay').remove()">Close</button>`;
      return;
    }

    o.remove();
    showRequesterSendUI(peerId, requestId);
  };

  /* --- Meta incoming --- */
  TBPeerManager.onMeta = (peerId, requestId, meta) => {
    const o = document.querySelector(
      `.tbfile-overlay[data-request-id="${requestId}"]`,
    );
    if (o) {
      o.querySelector(".tb-status-text").textContent = `Incoming: ${meta.name}`;
    }
  };

  /* --- Cancel --- */
  TBPeerManager.onCancel = (peerId, requestId) => {
    const o = document.querySelector(
      `.tbfile-overlay[data-request-id="${requestId}"]`,
    );
    if (o) o.remove();
  };

  /* --- File received --- */
  TBPeerManager.onFile = (peerId, file, requestId) => {
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
    sys(`📥 Received file: ${file.name}`);
  };

  /* --- Toolbox button --- */
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='file']");
    if (!btn) return;

    const chatMod = await import("../chat.js");
    const getPeer =
      chatMod.getCurrentChatPeerId || (() => chatMod.currentChatPeerId);
    const peerId = getPeer();

    if (!peerId) {
      createOverlay("File transfer", "<p>Open a chat first.</p>");
      return;
    }

    const requestId = crypto.randomUUID();
    showRequesterWaiting(peerId, requestId);

    /* --- Retry attach tant que le menu est ouvert --- */
    let tries = 0;
    const retry = setInterval(() => {
      const overlay = document.querySelector(
        `.tbfile-overlay[data-request-id="${requestId}"]`,
      );
      if (!overlay) {
        clearInterval(retry);
        return;
      }

      const ok = TBPeerManager.attachToPeer(peerId);
      if (ok) clearInterval(retry);

      if (++tries > 40) clearInterval(retry);
    }, 300);

    TBPeerManager.send(peerId, {
      type: "file-request",
      id: requestId,
      from: profile.name,
    });
  });
}
