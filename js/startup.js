// startup.js
import { Database } from "./core/db.js";
import { PeerManager } from "./peer/utils/PeerManager.js";
import { attachPeerManagerCallbacks } from "./ui/chatpanel.js";
import { loadContacts } from "./ui/contacts.js";
import { loadProfile } from "./ui/profile.js";
import { applyTranslations, i18nReady } from "./i18n.js";

// 1) Enregistrer les handlers PeerJS
import "./peer/handlers/audio.js";
import "./peer/handlers/file.js";
import "./peer/handlers/gif.js";
import "./peer/handlers/image.js";
import "./peer/handlers/link.js";
import "./peer/handlers/parser.js";
import "./peer/handlers/text.js";

// chat handlers
import { initTBcall } from "./ui/handlers/TBcall.js";
import { initTBfile } from "./ui/handlers/TBfile.js";
import { initTBvideo } from "./ui/handlers/TBvideo.js";

// 2) Importer l’UI
import { initChat } from "./ui/chat.js";
import { showProfilePanel } from "./ui/chatpanel.js";
import { renderSidebar } from "./ui/sidebar.js";

import { handleURLParams } from "./url-handler.js";
// 3) Fonction de démarrage UI
function appStart() {
  handleURLParams();
  renderSidebar();
  showProfilePanel();
  initChat();
  initTBfile();
  initTBcall();
  initTBvideo();
  i18nReady.then(applyTranslations);
}

// 4) On l’expose globalement
window.appStart = appStart;

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
  window.appStart();
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
    console.log("PeerJS loaded (auto-start) with ID :", id);
    finishStart(id);
  });
  attachPeerManagerCallbacks();
} catch (e) {
  console.warn("Auto-start PeerJS failed:", e);
}

// 5) Tap obligatoire (iOS / cas où l’auto-start ne passe pas)
overlay.onclick = () => {
  PeerManager.init((id) => {
    console.log("PeerJS loaded (tap) with ID :", id);
    finishStart(id);
  });
};
