// TBfile.js — envoi direct + log visuel + chunking

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { appendSystem, currentChatPeerId, saveMessage } from "../chat.js";

/* Petit log visuel */
function logFile(name) {
  appendSystem(`📄 ${name}`);
}

export function initTBfile() {
  /* ---------------------------------------------------------
     Quand on reçoit le META → log + sauvegarde
  --------------------------------------------------------- */
  TBPeerManager.onFileMessage = async (peerId, fileName) => {
    const timestamp = Date.now();

    // log visuel
    logFile(fileName);

    // sauvegarde
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
     Bouton toolbox → choisir un fichier et l'envoyer
  --------------------------------------------------------- */
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='file']");
    if (!btn) return;

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

      // log local
      logFile(file.name);

      // sauvegarde locale
      await saveMessage(
        peerId,
        "me",
        plainText,
        timestamp,
        "sent",
        crypto.randomUUID(),
        "file",
      );

      // envoi chunké
      await TBPeerManager.sendFile(peerId, file);

      input.remove();
    };

    input.click();
  });
}
