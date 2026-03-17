// js/ui/handlers/TBfile.js
// UI : demande -> accept/deny -> envoi chunké (principe de ton ancien code)

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { profile } from "../profile.js";

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

/* -------------------- UI states -------------------- */

function showRequesterWaiting(peerId, requestId, meta) {
  const o = createOverlay(
    "File transfer",
    `
    <p>File: ${meta.name} (${Math.round(meta.size / 1024)} KB)</p>
    <p>Status: <span class="tb-status">Waiting…</span></p>
    <button class="tb-cancel">Cancel</button>
    <div class="tb-result"></div>
  `,
  );
  o.dataset.requestId = requestId;

  o.querySelector(".tb-cancel").onclick = () => {
    TBPeerManager.sendControl(peerId, {
      type: "file-cancel",
      id: requestId,
      from: profile.name,
    });
    o.querySelector(".tb-status").textContent = "Cancelled";
  };

  return o;
}

function showRequesterSendUI(peerId, requestId, meta) {
  const o = createOverlay(
    "Send file",
    `
    <p>File: ${meta.name} (${Math.round(meta.size / 1024)} KB)</p>
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

  fileInput.onchange = () => {
    const f = fileInput.files[0];
    sendBtn.disabled = !f || f.name !== meta.name || f.size !== meta.size;
  };

  sendBtn.onclick = async () => {
    const f = fileInput.files[0];
    if (!f) return;

    progressWrap.style.display = "block";
    statusEl.textContent = "Sending…";

    try {
      await TBPeerManager.sendFile(peerId, requestId, f);
      progressBar.style.width = "100%";
      statusEl.textContent = "Transfer complete";
      sys(`📤 File sent: ${f.name}`);
      o.querySelector(".tbfile-body").innerHTML += `
        <div style="margin-top:12px;">
          <button class="tbfile-close-large">Close</button>
        </div>
      `;
      o.querySelector(".tbfile-close-large").onclick = () => o.remove();
    } catch (e) {
      console.error("[TBfile] sendFile error", e);
      statusEl.textContent = "Transfer failed";
    }
  };

  return o;
}

function showReceiverPanel(peerId, requestId, meta) {
  const o = createOverlay(
    "Receiving file",
    `
    <p>Incoming: ${meta.name} (${Math.round(meta.size / 1024)} KB)</p>
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

/* -------------------- INIT -------------------- */

export function initTBfile() {
  // callbacks TBPeerManager -> UI

  TBPeerManager.onRequest = (peerId, requestId, fromName, meta) => {
    sys(`
      ${fromName} wants to send you a file: ${meta.name} (${Math.round(meta.size / 1024)} KB)<br>
      <button class="tb-accept" data-id="${requestId}" data-peer="${peerId}" data-name="${meta.name}" data-size="${meta.size}">Accept</button>
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
        `<button onclick="this.closest('.tbfile-overlay').remove()">Close</button>`;
      sys(`❌ File request refused by ${peerId}`);
      return;
    }

    const name =
      o.querySelector("p").textContent.match(/File: (.+) \(/)?.[1] || "file";
    const sizeMatch = o.querySelector("p").textContent.match(/\((\d+) KB\)/);
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) * 1024 : 0;

    o.remove();
    showRequesterSendUI(peerId, requestId, { name, size });
  };

  TBPeerManager.onProgress = (peerId, requestId, percent, direction) => {
    const o =
      document.querySelector(
        `.tbfile-overlay[data-request-id="${requestId}"]`,
      ) || document.querySelector(".tbfile-overlay");
    if (!o) return;
    const bar = o.querySelector(".tb-progress-bar");
    if (bar) bar.style.width = `${percent}%`;
  };

  TBPeerManager.onComplete = (peerId, requestId, file) => {
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

  TBPeerManager.onCancel = (peerId, requestId) => {
    const o = document.querySelector(
      `.tbfile-overlay[data-request-id="${requestId}"]`,
    );
    if (o) o.remove();
    sys(`⚠️ File request cancelled`);
  };

  // Accept / Deny dans le chat
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("tb-accept")) {
      const peerId = e.target.dataset.peer;
      const requestId = e.target.dataset.id;
      const name = e.target.dataset.name;
      const size = parseInt(e.target.dataset.size, 10);

      TBPeerManager.attachToPeer(peerId);

      TBPeerManager.sendControl(peerId, {
        type: "file-response",
        id: requestId,
        accepted: true,
        from: profile.name,
      });

      showReceiverPanel(peerId, requestId, { name, size });
    }

    if (e.target.classList.contains("tb-deny")) {
      const peerId = e.target.dataset.peer;
      const requestId = e.target.dataset.id;

      TBPeerManager.sendControl(peerId, {
        type: "file-response",
        id: requestId,
        accepted: false,
        from: profile.name,
      });
    }
  });

  // Bouton toolbox
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

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.onchange = () => {
      const f = fileInput.files[0];
      if (!f) return;

      const requestId = crypto.randomUUID();
      TBPeerManager.attachToPeer(peerId);

      showRequesterWaiting(peerId, requestId, { name: f.name, size: f.size });

      TBPeerManager.sendControl(peerId, {
        type: "file-request",
        id: requestId,
        from: profile.name,
        name: f.name,
        size: f.size,
      });
    };
    fileInput.click();
  });
}
