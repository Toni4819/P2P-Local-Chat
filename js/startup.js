// startup.js
import { PeerManager, localPeerId } from "./peer/utils/PeerManager.js";

window.addEventListener("DOMContentLoaded", async () => {
  const url = new URL(location.href);
  const invitedPeer = url.searchParams.get("peer");
  const invitedName = url.searchParams.get("name");

  // === 0) Vérifier si PeerJS tourne déjà ===
  if (PeerManager.peer && PeerManager.peer.id) {
    console.log("Peer déjà actif → startup ignoré");
    window.appStart();
    return;
  }

  // === Overlay minimaliste ===
  const overlay = document.createElement("div");
  overlay.id = "startOverlay";
  overlay.style = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    z-index: 999999;
    flex-direction: column;
    text-align: center;
    user-select: none;
  `;
  overlay.innerHTML = `<p style="opacity:0.9">Click to start</p>`;
  document.body.appendChild(overlay);

  // === 1) Tentative auto-start ===
  let id = null;
  try {
    id = await PeerManager.init();   // Sur iPad → renvoie null
  } catch (e) {
    id = null;
  }

  // === 2) Auto-start OK (Android/PC) ===
  if (id) {
    overlay.remove();
    window.appStart();

    if (invitedPeer) {
      PeerManager.connect(invitedPeer, () => {
        window.openChat(invitedPeer, invitedName || "Unknown");
      });
    }

    // Nettoyage URL
    url.searchParams.delete("peer");
    url.searchParams.delete("name");
    history.replaceState({}, "", url.pathname);
    return;
  }

  // === 3) Auto-start FAIL → iPad → attendre un tap ===
  overlay.onclick = async () => {
    try {
      const id2 = await PeerManager.init();
      if (!id2) return; // iOS refuse encore → ne rien faire

      overlay.remove();
      window.appStart();

      if (invitedPeer) {
        PeerManager.connect(invitedPeer, () => {
          window.openChat(invitedPeer, invitedName || "Unknown");
        });
      }

      url.searchParams.delete("peer");
      url.searchParams.delete("name");
      history.replaceState({}, "", url.pathname);

    } catch (err) {
      console.error("Impossible de démarrer PeerJS:", err);
    }
  };
});
