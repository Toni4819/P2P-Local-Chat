// TBfile.js — menu + overlay + log + envoi chunké pipeline ACK

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
   Menu contextuel (robuste)
   - si le bouton n'a pas de taille, on utilise les coords du clic
   - on installe le listener de fermeture après un petit délai
--------------------------------------------------------- */
function openFileMenu(x, y) {
  const old = document.getElementById("tbfile-menu");
  if (old) old.remove();

  const menu = document.createElement("div");
  menu.id = "tbfile-menu";
  menu.innerHTML = `
    <div class="tbfile-menu-item" data-action="send-file">
      📄 Envoyer un fichier
    </div>
  `;

  // clamp pour éviter overflow hors écran
  const pad = 8;
  const vw = Math.max(
    document.documentElement.clientWidth || 0,
    window.innerWidth || 0,
  );
  const vh = Math.max(
    document.documentElement.clientHeight || 0,
    window.innerHeight || 0,
  );

  let left = x;
  let top = y;
  // si left/top undefined -> centre
  if (left == null) left = Math.floor(vw / 2 - 90);
  if (top == null) top = Math.floor(vh / 2);

  // positionnement simple
  menu.style.position = "absolute";
  menu.style.left = Math.min(Math.max(pad, left), vw - pad - 180) + "px";
  menu.style.top = Math.min(Math.max(pad, top), vh - pad - 40) + "px";

  document.body.appendChild(menu);

  // empêcher fermeture immédiate (évite que le clic d'ouverture ferme le menu)
  setTimeout(() => {
    function close(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    }
    document.addEventListener("click", close);
  }, 10);
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
     Gestion des clics
     - on écoute en capture pour ouvrir le menu avant d'autres handlers
  --------------------------------------------------------- */
  const clickHandler = async (e) => {
    // --- OUVERTURE DU MENU ---
    const btn =
      e.target.closest && e.target.closest(".toolBtn[data-tool='file']");
    if (btn) {
      // si le bouton a une taille, on positionne le menu sous le bouton
      const rect = btn.getBoundingClientRect();
      let left = rect.left;
      let top = rect.bottom + 6;

      // si le bouton est invisible / sans taille, on utilise la position du clic
      if (!rect.width && !rect.height) {
        left = e.clientX;
        top = e.clientY;
      }

      openFileMenu(left, top);
      // stop ici pour ne pas propager le clic
      return;
    }

    // --- CLIC SUR "Envoyer un fichier" ---
    const item =
      e.target.closest &&
      e.target.closest(".tbfile-menu-item[data-action='send-file']");
    if (item) {
      const peerId = currentChatPeerId;
      if (!peerId) return;

      TBPeerManager.attach(peerId);

      // fermer le menu
      const menu = document.getElementById("tbfile-menu");
      if (menu) menu.remove();

      // input file invisible
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

        try {
          await TBPeerManager.sendFile(peerId, file, (percent) => {
            updateOverlay(file.name, percent);
          });
        } catch (err) {
          console.error("[TBfile] erreur envoi fichier", err);
        } finally {
          hideOverlay();
          input.remove();
        }
      };

      // déclenche le sélecteur
      input.click();
      return;
    }
  };

  // écoute en capture pour éviter que d'autres handlers interceptent le clic
  document.addEventListener("click", clickHandler, true);
}
