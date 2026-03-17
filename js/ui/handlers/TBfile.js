// TBfile.js — envoi direct + message bleu dans le chat

import { TBPeerManager } from "../../peer/utils/TBPeerManager.js";
import { PeerManager } from "../../peer/utils/PeerManager.js";
import { profile } from "../profile.js";

/* Message bleu souligné */
function fileMessageHTML(name) {
  return `<span style="color:#1e90ff; text-decoration:underline; cursor:default;">${name}</span>`;
}

/* Envoi d’un message dans le chat */
function sendChatMessage(html) {
  document.dispatchEvent(new CustomEvent("tbfile-system", { detail: html }));
}

export function initTBfile() {
  /* Quand on reçoit le META → on affiche le message dans le chat */
  TBPeerManager.onFileMessage = (peerId, fileName) => {
    sendChatMessage(`📄 ${fileMessageHTML(fileName)}`);
  };

  /* Quand on reçoit le fichier complet */
  TBPeerManager.onFileReceived = (peerId, file) => {
    console.debug("[TBfile] Fichier reçu :", file);

    // tu peux activer le téléchargement automatique :
    // const url = URL.createObjectURL(file);
    // const a = document.createElement("a");
    // a.href = url;
    // a.download = file.name;
    // a.click();
  };

  /* Bouton toolbox */
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='file']");
    if (!btn) return;

    const chatMod = await import("../chat.js");
    const getPeer =
      chatMod.getCurrentChatPeerId || (() => chatMod.currentChatPeerId);
    const peerId = getPeer();

    if (!peerId) {
      sendChatMessage("❗ Ouvre un chat d’abord.");
      return;
    }

    // attacher TBPeerManager
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

      // message dans TON chat
      sendChatMessage(`📄 ${fileMessageHTML(file.name)}`);

      // envoi chunké
      await TBPeerManager.sendFile(peerId, file);

      input.remove();
    };

    input.click();
  });
}
