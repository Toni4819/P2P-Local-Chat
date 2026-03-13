import { appendMessage, updateMessageStatus } from "../../ui/chat.js";
import { profile } from "../../ui/profile.js";
import { AckManager } from "./AckManager.js";
import { PeerManager } from "./PeerManager.js";

export const SendManager = {
  pending: {},

  send(peerId, rawMsg, id) {
    const timestamp = Date.now();

    // Afficher le message dans l’UI avec le même ID que dans le storage
    appendMessage("me", rawMsg, timestamp, "sending", id);

    const packet = {
      type: "msg",
      id, // même ID partout
      peerId: PeerManager.getLocalId(),
      name: profile.name,
      msg: rawMsg,
    };

    try {
      // Tentative d’envoi
      PeerManager.send(peerId, packet);

      // On attend l’ACK pour marquer "sent"
      AckManager.track(peerId, id);

    } catch {
      // Échec immédiat → marquer failure
      this.pending[id] = { peerId, rawMsg, lastTry: Date.now() };
      updateMessageStatus(peerId, id, "failure");
    }

    return id;
  },

  retryLoop() {
    setInterval(() => {
      const now = Date.now();

      for (const id in this.pending) {
        const p = this.pending[id];

        if (now - p.lastTry > 15000) {
          p.lastTry = now;

          try {
            PeerManager.send(p.peerId, {
              type: "msg",
              id, // même ID
              peerId: PeerManager.getLocalId(),
              name: profile.name,
              msg: p.rawMsg,
            });

            // Succès → statut "sent"
            updateMessageStatus(p.peerId, id, "sent");

            // On attend l’ACK
            AckManager.track(p.peerId, id);

            delete this.pending[id];

          } catch {
            // Nouvel échec
            updateMessageStatus(p.peerId, id, "failure");
          }
        }
      }
    }, 1000);
  },
};

SendManager.retryLoop();
