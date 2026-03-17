// TBfile.js — envoi direct + log visuel + chunking

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { PeerManager } from "../../peer/utils/PeerManager.js";
import { saveMessage, appendSystem, currentChatPeerId } from "../chat.js";
import { SendManager } from "../../peer/utils/SendManager.js";

/* Petit log visuel */
function logFile(name) {
  appendSystem(`📄 ${name}`); // texte brut, affiché au milieu
}

export function initTBfile() {
  /* ---------------------------------------------------------
     Quand on reçoit le META → log + sauvegarde
     (c’est ici que le peer voit le log)
  --------------------------------------------------------- */
  TBPeerManager.onFileMessage = async (peerId, fileName) => {
    const timestamp = Date.now();

    // 1) log visuel
    logFile(fileName);

    // 2) sauvegarde dans IndexedDB (texte brut)
    await saveMessage(peerId, "them", `📄 ${fileName}`, timestamp, "received");
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

      // 1) log visuel local
      logFile(file.name);

      // 2) sauvegarde locale
      const id = await saveMessage(
        peerId,
        "me",
        plainText,
        timestamp,
        "sending",
      );

      // 3) envoi du message texte au peer
      SendManager.send(peerId, plainText, id);

      // 4) envoi du fichier chunké
      await TBPeerManager.sendFile(peerId, file);

      input.remove();
    };

    input.click();
  });
}
