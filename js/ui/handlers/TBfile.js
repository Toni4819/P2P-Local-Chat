// TBfile.js — envoi direct + message bleu dans le chat + chunking

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { PeerManager } from "../../peer/utils/PeerManager.js";
import { saveMessage, appendSystem, currentChatPeerId } from "../chat.js";
import { SendManager } from "../../peer/utils/SendManager.js";

/* Message bleu souligné */
function fileMessageHTML(name) {
  return `<span style="color:#1e90ff; text-decoration:underline; cursor:default;">${name}</span>`;
}

export function initTBfile() {
  /* ---------------------------------------------------------
     Quand on reçoit le META → message bleu dans le chat
  --------------------------------------------------------- */
  TBPeerManager.onFileMessage = async (peerId, fileName) => {
    const timestamp = Date.now();
    const html = `📄 ${fileMessageHTML(fileName)}`;

    // sauvegarde en texte brut (sécurisé)
    const id = await saveMessage(
      peerId,
      "them",
      `📄 ${fileName}`,
      timestamp,
      "received",
    );

    // affichage HTML (sécurisé)
    appendSystem(html, true);
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

      // message texte brut pour stockage + envoi
      const plainText = `📄 ${file.name}`;

      // message HTML pour affichage local
      const html = `📄 ${fileMessageHTML(file.name)}`;

      // 1) sauvegarde locale (texte brut)
      const id = await saveMessage(
        peerId,
        "me",
        plainText,
        timestamp,
        "sending",
      );

      // 2) affichage local (HTML)
      appendSystem(html, true);

      // 3) envoi du message au peer (texte brut)
      SendManager.send(peerId, plainText, id);

      // 4) envoi du fichier chunké
      await TBPeerManager.sendFile(peerId, file);

      input.remove();
    };

    input.click();
  });
}
