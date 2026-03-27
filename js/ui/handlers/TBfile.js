// TBfile.js — overlay + log + envoi chunké pipeline ACK

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { appendSystem, currentChatPeerId, saveMessage } from "../chat.js";

/* ---------------------------------------------------------
   Petit log visuel
--------------------------------------------------------- */
function logFile(name) {
  appendSystem(`📄 ${name}`);
}

/* ---------------------------------------------------------
   Overlay d’envoi stylé
--------------------------------------------------------- */
function createOverlay() {
  let overlay = document.getElementById("tbfile-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "tbfile-overlay";
  overlay.innerHTML = `
    <div class="tbfile-box">
      <div class="tbfile-title">Envoi du fichier…</div>
      <div class="tbfile-name"></div>
      <div class="tbfile-progress">
        <div class="tbfile-bar"></div>
      </div>
      <div class="tbfile-percent">0%</div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function updateOverlay(name, percent) {
  const overlay = createOverlay();
  overlay.querySelector(".tbfile-name").textContent = name;
  overlay.querySelector(".tbfile-bar").style.width = percent + "%";
  overlay.querySelector(".tbfile-percent").textContent = percent + "%";
}

function hideOverlay() {
  const overlay = document.getElementById("tbfile-overlay");
  if (overlay) overlay.remove();
}

/* ---------------------------------------------------------
   Initialisation
--------------------------------------------------------- */
export function initTBfile() {
  /* ---------------------------------------------------------
     Quand on reçoit le META → log + sauvegarde
  --------------------------------------------------------- */
  TBPeerManager.onFileMessage = async (peerId, fileName) => {
    const timestamp = Date.now();

    logFile(fileName);

    await saveMessage(
      peerId,
      "them",
      `📄 ${fileName}`,
      timestamp,
      "received",
      crypto.randomUUID(),
      "file",
    );
  };

  /* ---------------------------------------------------------
     Quand on reçoit le fichier complet → téléchargement auto
  --------------------------------------------------------- */
  TBPeerManager.onFileReceived = (peerId, file) => {
    console.log("[TBfile] Fichier reçu :", file);

    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  /* ---------------------------------------------------------
   Petit menu d’envoi
--------------------------------------------------------- */
  function openFileMenu(x, y) {
    // supprimer ancien menu
    const old = document.getElementById("tbfile-menu");
    if (old) old.remove();

    const menu = document.createElement("div");
    menu.id = "tbfile-menu";
    menu.innerHTML = `
    <div class="tbfile-menu-item" data-action="send-file">
      📄 Envoyer un fichier
    </div>
  `;

    menu.style.left = x + "px";
    menu.style.top = y + "px";

    document.body.appendChild(menu);

    // fermer si on clique ailleurs
    setTimeout(() => {
      document.addEventListener("click", function close(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", close);
        }
      });
    });
  }

  /* ---------------------------------------------------------
     Bouton toolbox → choisir un fichier et l'envoyer
  --------------------------------------------------------- */
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='file']");
    if (btn) {
      const rect = btn.getBoundingClientRect();
      openFileMenu(rect.left, rect.bottom + 6);
      return;
    }

    // clic sur "Envoyer un fichier"
    const item = e.target.closest(".tbfile-menu-item[data-action='send-file']");
    if (item) {
      const peerId = currentChatPeerId;
      if (!peerId) return;

      TBPeerManager.attach(peerId);

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "*/*";
      input.style.display = "none";
      document.body.appendChild(input);

      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const timestamp = Date.now();
        const plainText = `📄 ${file.name}`;

        logFile(file.name);

        await saveMessage(
          peerId,
          "me",
          plainText,
          timestamp,
          "sent",
          crypto.randomUUID(),
          "file",
        );

        updateOverlay(file.name, 0);

        await TBPeerManager.sendFile(peerId, file, (percent) => {
          updateOverlay(file.name, percent);
        });

        hideOverlay();
        input.remove();
      };

      input.click();
    }
  });
}
