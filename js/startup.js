// startup.js
import { PeerManager } from "./peer/utils/PeerManager.js";

window.addEventListener("DOMContentLoaded", async () => {

  // 1) Vérifier si PeerJS tourne déjà
  const peerAlreadyRunning =
    window.Peer &&
    Array.isArray(window.Peer._instances) &&
    window.Peer._instances.length > 0;

  if (peerAlreadyRunning) {
    console.log("PeerJS déjà actif");
    window.appStart();
    return;
  }

  // 2) Charger ou créer peerjs_id
  let peerId = localStorage.getItem("peerjs_id");
  if (!peerId) {
    peerId = crypto.randomUUID();
    localStorage.setItem("peerjs_id", peerId);
  }

  // 3) Overlay iOS
  const overlay = document.createElement("div");
  overlay.style = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    z-index: 999999;
  `;
  overlay.textContent = "Click to start";
  document.body.appendChild(overlay);

  // 4) Auto-start (IMPORTANT : init doit recevoir une fonction)
  try {
    PeerManager.init(() => {});
  } catch (e) {
    console.warn("Auto-start PeerJS failed:", e);
  }

  // 5) Si PeerJS a démarré
  const waitReady = setInterval(() => {
    if (PeerManager.peer?.id) {
      clearInterval(waitReady);
      overlay.remove();
      localStorage.setItem("peerjs_id", PeerManager.peer.id);
      window.appStart();
    }
  }, 50);

  // 6) iOS → tap
  overlay.onclick = () => {
    PeerManager.init(() => {});

    const waitTap = setInterval(() => {
      if (PeerManager.peer?.id) {
        clearInterval(waitTap);
        overlay.remove();
        localStorage.setItem("peerjs_id", PeerManager.peer.id);
        window.appStart();
      }
    }, 50);
  };
});
