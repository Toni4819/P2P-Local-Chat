import { PeerManager } from "./utils/PeerManager.js";

export const SendManager = {
  pending: {},

  send(peerId, rawMsg) {
    const id = crypto.randomUUID();

    const packet = {
      type: "msg",
      id,
      peerId: PeerManager.getLocalId(),
      name: profile.name,
      msg: rawMsg,
    };

    try {
      PeerManager.send(peerId, packet);
      AckManager.track(peerId, id);
    } catch {
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
              id,
              peerId: PeerManager.getLocalId(),
              name: profile.name,
              msg: p.rawMsg,
            });

            updateMessageStatus(p.peerId, id, "sent");
            AckManager.track(p.peerId, id);
            delete this.pending[id];
          } catch {
            updateMessageStatus(p.peerId, id, "failure");
          }
        }
      }
    }, 1000);
  },
};

SendManager.retryLoop();
