// TBfile.js — envoi direct + overlay + log pipeline ACK

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { appendSystem, currentChatPeerId, saveMessage } from "../chat.js";

/* ---------------------------------------------------------
   Petit log visuel
--------------------------------------------------------- */
function logFile(name) {
  appendSystem(`📄 ${name}`);
}

/* ---------------------------------------------------------
   Overlay d'envoi stylé
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  /* ---------------------------------------------------------
     Gestion des clics — le bouton ouvre directement le sélecteur
  --------------------------------------------------------- */
  const clickHandler = async (e) => {
    const btn =
      e.target.closest && e.target.closest(".toolBtn[data-tool='file']");
    if (!btn) return;

    // Empêche la propagation pour éviter tout conflit
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const peerId = currentChatPeerId;
    if (!peerId) return;

    TBPeerManager.attach(peerId);

    // input file invisible
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "*/*";
    input.style.display = "none";
    document.body.appendChild(input);

    // Nettoyage si l'utilisateur annule sans choisir
    const cleanup = () => {
      input.remove();
    };

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) {
        cleanup();
        return;
      }

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
        cleanup();
      }
    };

    // Déclenche le sélecteur
    input.click();
  };

  // capture=true pour passer avant les autres handlers
  document.addEventListener("click", clickHandler, true);
}
