// app.js
import {applyTranslations} from "./i18n.js";

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
  applyTranslations();
}

// 4) On l’expose globalement
window.appStart = appStart;
