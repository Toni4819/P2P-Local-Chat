// TBfile.js — envoi direct + message bleu dans le chat + chunking

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { PeerManager } from "../../peer/utils/PeerManager.js";
import { saveMessage, appendMessage, currentChatPeerId } from "../chat.js";
import { SendManager } from "../../peer/utils/SendManager.js";

/* Message bleu souligné */
function fileMessageHTML(name) {
  return `<span style="color:#1e90ff; text-decoration:underline; cursor:default;">${name}</span>`;
}

export function initTBfile() {
  /* Quand on reçoit le META → on crée un message dans le chat */
  TBPeerManager.onFileMessage = async (peerId, fileName) => {
    const timestamp = Date.now();
    const text = `📄 ${fileMessageHTML(fileName)}`;

    // sauvegarde
    const id = await saveMessage(peerId, "them", text, timestamp, "received");

    // affichage
    appendMessage("them", text, timestamp, "received", id);
  };

  /* Quand on reçoit le fichier complet → téléchargement auto */
  TBPeerManager.onFileReceived = (peerId, file) => {
    console.log("[TBfile] Fichier reçu :", file);

    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
  };

  /* Bouton toolbox */
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='file']");
    if (!btn) return;

    const peerId = currentChatPeerId;
    if (!peerId) return;

    TBPeerManager.attach(peerId);

    // input file
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "*/*";
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      const timestamp = Date.now();
      const text = `📄 ${fileMessageHTML(file.name)}`;

      // 1) sauvegarde locale
      const id = await saveMessage(peerId, "me", text, timestamp, "sending");

      // 2) affichage local
      appendMessage("me", text, timestamp, "sending", id);

      // 3) envoi du message au peer
      SendManager.send(peerId, text, id);

      // 4) envoi du fichier chunké
      await TBPeerManager.sendFile(peerId, file);

      input.remove();
    };

    input.click();
  });
}
