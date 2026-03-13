// app.js

// 1) Enregistrer les handlers PeerJS
import "./peer/handlers/audio.js";
import "./peer/handlers/file.js";
import "./peer/handlers/gif.js";
import "./peer/handlers/image.js";
import "./peer/handlers/link.js";
import "./peer/handlers/parser.js";
import "./peer/handlers/text.js";

// 2) Importer l’UI
import { renderSidebar } from "./ui/sidebar.js";
import { showProfilePanel } from "./ui/chatpanel.js";
import { initChat } from "./ui/chat.js";

import { handleURLParams } from "./url-handler.js";
// 3) Fonction de démarrage UI
function appStart() {
  handleURLParams();
  renderSidebar();
  showProfilePanel();
  initChat();
}

// 4) On l’expose globalement
window.appStart = appStart;
