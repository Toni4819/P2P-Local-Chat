// startup.js
import "./app.js";
import { Database } from "./core/db.js";
import { PeerManager } from "./peer/utils/PeerManager.js";
import { loadContacts } from "./ui/contacts.js";
import { loadProfile } from "./ui/profile.js";

// 0) Charger IndexedDB + contacts + profil AVANT PeerJS
await Database.init();
await loadContacts();
await loadProfile();

// 1) Vérifier si PeerJS tourne déjà (rare mais possible)
const peerAlreadyRunning =
  window.Peer &&
  Array.isArray(window.Peer._instances) &&
  window.Peer._instances.length > 0;

if (peerAlreadyRunning) {
  console.log("PeerJS déjà actif → lancement UI");
  window.appStart();
  // Pas besoin d’overlay ni d’auto-start
  return;
}

// 2) Assurer un peerjs_id simple
let peerId = localStorage.getItem("peerjs_id");
if (!peerId) {
  peerId = crypto.randomUUID();
  localStorage.setItem("peerjs_id", peerId);
}

// 3) Overlay (utile pour iOS, neutre ailleurs)
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

let started = false;
const finishStart = (id) => {
  if (started) return;
  started = true;
  overlay.remove();
  if (id) localStorage.setItem("peerjs_id", id);
  window.appStart();
};

// 4) Auto-start PeerJS (si autorisé par le navigateur)
try {
  PeerManager.init((id) => {
    console.log("PeerJS prêt (auto-start) avec ID :", id);
    finishStart(id);
  });
} catch (e) {
  console.warn("Auto-start PeerJS failed:", e);
}

// 5) Tap obligatoire (iOS / cas où l’auto-start ne passe pas)
overlay.onclick = () => {
  PeerManager.init((id) => {
    console.log("PeerJS prêt (tap) avec ID :", id);
    finishStart(id);
  });
};
