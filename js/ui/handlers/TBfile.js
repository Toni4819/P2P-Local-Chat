// js/ui/handlers/TBfile.js
// Minimal file-transfer handler (simple, single send method via conn.send(file))
// - place ce fichier dans js/ui/handlers/
// - appeler initTBfile() depuis ton main.js ou équivalent

import { PeerManager } from "../../peer/utils/PeerManager.js";
import { appendSystem, currentChatPeerId } from "../chat.js";
import { profile } from "../profile.js";

function findConn(peerId) {
  return PeerManager.connections && PeerManager.connections.get(peerId);
}

function sendControl(peerId, obj) {
  const conn = findConn(peerId);
  if (!conn) throw new Error("No connection to " + peerId);
  try {
    conn.send(JSON.stringify(obj));
  } catch (e) {
    // si la connexion n'accepte pas string, tenter d'envoyer l'objet
    try {
      conn.send(obj);
    } catch (err) {
      throw err;
    }
  }
}

function createOverlay(title, innerHtml) {
  const overlay = document.createElement("div");
  overlay.className = "tbfile-overlay";
  overlay.innerHTML = `
    <div class="tbfile-panel" role="dialog" aria-modal="true">
      <div class="tbfile-header">
        <strong>${title}</strong>
        <button class="tbfile-close" title="Close">✕</button>
      </div>
      <div class="tbfile-body">${innerHtml}</div>
      <div class="tbfile-footer"><button class="tbfile-close-btn">Close</button></div>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay
    .querySelectorAll(".tbfile-close, .tbfile-close-btn")
    .forEach((b) => b.addEventListener("click", () => overlay.remove()));
  return overlay;
}

/* ---------- UI pieces ---------- */

function showRequesterWaiting(peerId, requestId) {
  const html = `
    <p>Status: <span class="tb-status">Waiting for response…</span></p>
    <div class="tb-actions">
      <button class="tb-cancel">Cancel</button>
    </div>
    <div class="tb-result" style="margin-top:12px;"></div>
  `;
  const overlay = createOverlay("File transfer", html);
  overlay.dataset.requestId = requestId;
  document.body.appendChild(overlay);

  overlay.querySelector(".tb-cancel").onclick = () => {
    try {
      sendControl(peerId, {
        type: "file-request-cancel",
        id: requestId,
        from: profile.name,
      });
    } catch (e) {
      console.warn(e);
    }
    const s = overlay.querySelector(".tb-status");
    if (s) s.textContent = "Cancelled";
  };

  return overlay;
}

function showRequesterSendUI(peerId, requestId) {
  const html = `
    <p>Send file to <strong>${peerId}</strong></p>
    <div><input type="file" id="tb-file-input"></div>
    <div style="margin-top:8px;">
      <button id="tb-send-file" disabled>Send</button>
      <button id="tb-cancel-send">Cancel</button>
    </div>
    <div class="tb-progress-wrap" style="margin-top:12px; display:none;">
      <div class="tb-progress" style="width:0%"></div>
    </div>
    <div class="tb-status-text" style="margin-top:8px;"></div>
  `;
  const overlay = createOverlay("Send file", html);
  overlay.dataset.requestId = requestId;
  document.body.appendChild(overlay);

  const fileInput = overlay.querySelector("#tb-file-input");
  const sendBtn = overlay.querySelector("#tb-send-file");
  const cancelBtn = overlay.querySelector("#tb-cancel-send");
  const progressWrap = overlay.querySelector(".tb-progress-wrap");
  const progressEl = overlay.querySelector(".tb-progress");
  const statusEl = overlay.querySelector(".tb-status-text");

  fileInput.onchange = () => (sendBtn.disabled = !fileInput.files.length);
  cancelBtn.onclick = () => overlay.remove();

  sendBtn.onclick = async () => {
    const f = fileInput.files[0];
    if (!f) return;
    sendBtn.disabled = true;
    fileInput.disabled = true;
    progressWrap.style.display = "block";
    statusEl.textContent = "Sending…";

    try {
      const conn = findConn(peerId);
      if (!conn) throw new Error("No connection");

      // envoyer meta control (optionnel mais utile)
      sendControl(peerId, {
        type: "file-meta",
        id: requestId,
        name: f.name,
        size: f.size,
        mime: f.type,
        from: profile.name,
      });

      // envoi direct du Blob (unique méthode d'envoi)
      conn.send(f);

      // on considère l'envoi comme terminé une fois envoyé
      progressEl.style.width = "100%";
      statusEl.textContent = "Transfer succeeded";
      appendSystem(`File sent: ${f.name}`);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Transfer failed";
      appendSystem(`File send failed`);
    }
  };

  return overlay;
}

function showReceiverNotification(peerId, peerName, requestId) {
  const notif = document.createElement("div");
  notif.className = "tbfile-topnotif";
  notif.innerHTML = `
    <div><strong>${peerName}</strong> would like to share a file with you</div>
    <div style="margin-top:8px;">
      <button class="tb-accept">Accept</button>
      <button class="tb-deny">Deny</button>
    </div>
  `;
  document.body.appendChild(notif);

  notif.querySelector(".tb-accept").onclick = () => {
    try {
      sendControl(peerId, {
        type: "file-response",
        id: requestId,
        accepted: true,
        from: profile.name,
      });
    } catch (e) {
      console.error(e);
    }
    notif.remove();
    showReceiverPanel(peerId, requestId);
  };

  notif.querySelector(".tb-deny").onclick = () => {
    try {
      sendControl(peerId, {
        type: "file-response",
        id: requestId,
        accepted: false,
        from: profile.name,
      });
    } catch (e) {
      console.error(e);
    }
    notif.remove();
  };

  // auto remove after 45s
  setTimeout(() => {
    if (document.body.contains(notif)) notif.remove();
  }, 45000);
}

function showReceiverPanel(peerId, requestId) {
  const html = `
    <p>Receiving file from <strong>${peerId}</strong></p>
    <div class="tb-progress-wrap">
      <div class="tb-progress" style="width:0%"></div>
    </div>
    <div class="tb-status-text">Waiting for data…</div>
  `;
  const overlay = createOverlay("Receiving file", html);
  overlay.dataset.requestId = requestId;
  document.body.appendChild(overlay);
  return overlay;
}

/* ---------- Incoming data handling (minimal) ---------- */

function handleControlMessage(peerId, obj) {
  if (!obj || !obj.type) return;

  if (obj.type === "file-request") {
    // incoming request: show top-right notification
    const requestId = obj.id || crypto.randomUUID();
    showReceiverNotification(peerId, obj.from || peerId, requestId);
    return;
  }

  if (obj.type === "file-response") {
    // response to our request
    const requestId = obj.id;
    const accepted = !!obj.accepted;
    // find overlay with this requestId
    const overlay = document.querySelector(
      `.tbfile-overlay[data-request-id="${requestId}"], .tbfile-overlay[data-request-id="${requestId}"]`,
    );
    // simpler: find any overlay with dataset.requestId
    const overlays = document.querySelectorAll(".tbfile-overlay");
    let found = null;
    overlays.forEach((o) => {
      if (o.dataset.requestId === requestId) found = o;
    });
    if (found) {
      if (!accepted) {
        const res = found.querySelector(".tb-result");
        if (res)
          res.innerHTML = `<div class="tb-refused">Refused <button class="tb-close-small">Close</button></div>`;
        const btn = found.querySelector(".tb-close-small");
        if (btn) btn.onclick = () => found.remove();
        const status = found.querySelector(".tb-status");
        if (status) status.textContent = "Refused";
      } else {
        // accepted: replace waiting overlay by send UI
        found.remove();
        showRequesterSendUI(peerId, requestId);
      }
    } else {
      // if no overlay found, still open send UI (defensive)
      if (accepted) showRequesterSendUI(peerId, requestId);
    }
    return;
  }

  if (obj.type === "file-meta") {
    // receiver can display incoming filename
    const requestId = obj.id;
    const overlays = document.querySelectorAll(".tbfile-overlay");
    overlays.forEach((o) => {
      if (o.dataset.requestId === requestId) {
        const st = o.querySelector(".tb-status-text");
        if (st) st.textContent = `Incoming: ${obj.name}`;
      }
    });
    return;
  }

  if (obj.type === "file-request-cancel") {
    const requestId = obj.id;
    // close any overlay for this request
    const overlays = document.querySelectorAll(".tbfile-overlay");
    overlays.forEach((o) => {
      if (o.dataset.requestId === requestId) o.remove();
    });
    return;
  }
}

function attachToConnections() {
  if (!PeerManager || !PeerManager.connections) return;
  for (const [peerId, conn] of PeerManager.connections.entries()) {
    if (conn.__tbfile_hooked) continue;
    conn.__tbfile_hooked = true;
    if (typeof conn.on === "function") {
      conn.on("data", (raw) => {
        try {
          if (typeof raw === "string") {
            try {
              const obj = JSON.parse(raw);
              handleControlMessage(peerId, obj);
              return;
            } catch (e) {
              // not JSON string -> fallthrough
            }
          }
          // if object with type
          if (raw && typeof raw === "object" && raw.type) {
            handleControlMessage(peerId, raw);
            return;
          }
          // if Blob (file)
          if (raw instanceof Blob) {
            // find receiver overlay (the one waiting for incoming)
            const overlays = document.querySelectorAll(".tbfile-overlay");
            let target = null;
            overlays.forEach((o) => {
              const st = o.querySelector(".tb-status-text");
              if (
                st &&
                st.textContent &&
                st.textContent.startsWith("Waiting for data")
              )
                target = o;
              if (st && st.textContent && st.textContent.startsWith("Incoming"))
                target = o;
            });
            if (target) {
              const url = URL.createObjectURL(raw);
              target.querySelector(".tbfile-body").innerHTML = `
                <p>Received file</p>
                <p><strong>${raw.name || "file"}</strong></p>
                <p><a class="tb-download" href="${url}" download="${raw.name || "file"}">Download</a></p>
              `;
              const prog = target.querySelector(".tb-progress");
              if (prog) prog.style.width = "100%";
              const st = target.querySelector(".tb-status-text");
              if (st) st.textContent = "Transfer succeeded";
              appendSystem(`File received: ${raw.name || "file"}`);
            } else {
              // no UI: still create a small notification
              const n = document.createElement("div");
              n.className = "tbfile-topnotif";
              const url = URL.createObjectURL(raw);
              n.innerHTML = `<div>File received</div><div><a href="${url}" download>Download</a></div>`;
              document.body.appendChild(n);
              setTimeout(() => {
                if (document.body.contains(n)) n.remove();
              }, 15000);
            }
            return;
          }
        } catch (err) {
          console.error("TBfile handler error", err);
        }
      });
    }
  }
}

/* ---------- Public init ---------- */

export function initTBfile() {
  // attach to existing connections
  attachToConnections();

  // best-effort: if PeerManager exposes a hook to detect new connections, try to use it
  if (PeerManager && typeof PeerManager.onConnectionsChanged === "function") {
    PeerManager.onConnectionsChanged(() => attachToConnections());
  }

  // click handler for toolbox file button
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='file']");
    if (!btn) return;

    const peerId = currentChatPeerId;
    if (!peerId) {
      const o = createOverlay(
        "File transfer",
        "<p>Please open a chat with a peer to send a file.</p>",
      );
      document.body.appendChild(o);
      return;
    }

    const requestId = crypto.randomUUID();
    const overlay = showRequesterWaiting(peerId, requestId);
    overlay.dataset.requestId = requestId;

    try {
      sendControl(peerId, {
        type: "file-request",
        id: requestId,
        from: profile.name,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("Failed to send file request", err);
      const s = overlay.querySelector(".tb-status");
      if (s) s.textContent = "Failed to send request";
    }
  });
}
