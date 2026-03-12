// startup.js
import { PeerManager, localPeerId } from "./peer/utils/PeerManager.js";

window.addEventListener("DOMContentLoaded", async () => {
  const url = new URL(location.href);
  const invitedPeer = url.searchParams.get("peer");
  const invitedName = url.searchParams.get("name");

  // === Overlay Start (affiché seulement si auto-start échoue) ===
  const overlay = document.createElement("div");
  overlay.id = "startOverlay";
  overlay.style = `
    position: fixed;
    inset: 0;
    background: #111;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    z-index: 999999;
    flex-direction: column;
  `;
  overlay.innerHTML = `
    <p>Tap to start</p>
    <button id="startButton" style="
      padding: 12px 24px;
      font-size: 20px;
      border-radius: 8px;
      border: none;
      background: #4caf50;
      color: white;
    ">Start</button>
  `;
  document.body.appendChild(overlay);

  // === 1) AUTO-START PeerJS ===
  try {
    console.log("Trying auto-start PeerJS…");

    await PeerManager.init(); // doit throw si fail
    console.log("Auto-start OK:", localPeerId);

    overlay.remove();
    window.appStart();

    if (invitedPeer) {
      console.log("Auto-connecting to peer:", invitedPeer);
      PeerManager.connect(invitedPeer, () => {
        window.openChat(invitedPeer, invitedName || "Unknown");
      });
    }

    // Nettoyage de l’URL
    url.searchParams.delete("peer");
    url.searchParams.delete("name");
    history.replaceState({}, "", url.pathname);

    return; // FIN → pas besoin du bouton
  } catch (err) {
    console.warn("Auto-start failed → user interaction required", err);
  }

  // === 2) AUTO-START FAIL → bouton Start ===
  document.getElementById("startButton").onclick = async () => {
    console.log("User clicked Start → starting PeerJS");

    try {
      await PeerManager.init();
      console.log("PeerJS started:", localPeerId);

      overlay.remove();
      window.appStart();

      if (invitedPeer) {
        console.log("Connecting to invited peer:", invitedPeer);
        PeerManager.connect(invitedPeer, () => {
          window.openChat(invitedPeer, invitedName || "Unknown");
        });
      }

      // Nettoyage de l’URL
      url.searchParams.delete("peer");
      url.searchParams.delete("name");
      history.replaceState({}, "", url.pathname);

    } catch (err) {
      alert("Impossible de démarrer PeerJS.");
      console.error(err);
    }
  };
});
