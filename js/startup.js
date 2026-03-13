// startup.js
import { PeerManager } from "./peer/utils/PeerManager.js";

window.addEventListener("DOMContentLoaded", async () => {

  // 1) Vérifier si PeerJS tourne déjà (sans créer de Peer)
  const peerAlreadyRunning =
    window.Peer &&
    Array.isArray(window.Peer._instances) &&
    window.Peer._instances.length > 0;

  if (peerAlreadyRunning) {
    console.log("PeerJS déjà actif → pas d'init");
    window.appStart();
    return;
  }

  // 2) Charger ou créer peerjs_id (string simple)
  let peerId = localStorage.getItem("peerjs_id");

  if (!peerId) {
    peerId = crypto.randomUUID();
    localStorage.setItem("peerjs_id", peerId);
  }

  // 3) Overlay pour iOS
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

  // 4) Auto-start
  try {
    await PeerManager.init(peerId);
  } catch {}

  // 5) Auto-start OK
  if (PeerManager.peer?.id) {
    overlay.remove();
    localStorage.setItem("peerjs_id", PeerManager.peer.id);
    window.appStart();
    return;
  }

  // 6) iOS → tap
  overlay.onclick = async () => {
    await PeerManager.init(peerId);

    if (!PeerManager.peer?.id) return;

    overlay.remove();
    localStorage.setItem("peerjs_id", PeerManager.peer.id);
    window.appStart();
  };
});
