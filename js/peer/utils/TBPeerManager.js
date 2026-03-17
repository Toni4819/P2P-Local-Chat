// peer/utils/TBPeerManager.js
import { PeerManager } from "./PeerManager.js";

export const TBPeerManager = {
  onRequest: null,   // (peerId, requestId, fromName)
  onResponse: null,  // (peerId, requestId, accepted)
  onMeta: null,      // (peerId, requestId, meta)
  onCancel: null,    // (peerId, requestId)
  onFile: null,      // (peerId, blob, requestId)

  init() {
    this.attachToConnections();

    if (typeof PeerManager.onConnectionsChanged === "function") {
      PeerManager.onConnectionsChanged(() => this.attachToConnections());
    }
  },

  send(peerId, obj) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) return;
    conn.send(JSON.stringify(obj));
  },

  attachToConnections() {
    for (const [peerId, conn] of PeerManager.connections.entries()) {
      if (conn.__tbfile_hooked) continue;
      conn.__tbfile_hooked = true;

      conn.on("data", (raw) => {
        try {
          // JSON control message
          if (typeof raw === "string") {
            try {
              const msg = JSON.parse(raw);
              if (msg.type && msg.type.startsWith("file-")) {
                this.route(peerId, msg);
                return;
              }
            } catch {}
          }

          // Blob (file)
          if (raw instanceof Blob) {
            this.onFile?.(peerId, raw, null);
            return;
          }

        } catch (err) {
          console.error("TBPeerManager error", err);
        }
      });
    }
  },

  route(peerId, msg) {
    switch (msg.type) {
      case "file-request":
        this.onRequest?.(peerId, msg.id, msg.from);
        break;

      case "file-response":
        this.onResponse?.(peerId, msg.id, msg.accepted);
        break;

      case "file-meta":
        this.onMeta?.(peerId, msg.id, msg);
        break;

      case "file-request-cancel":
        this.onCancel?.(peerId, msg.id);
        break;
    }
  }
};
