// js/peer/utils/TBPeerManager.js
// Gestion du protocole file-transfer (simple, BLOB direct)

import { PeerManager } from "./PeerManager.js";

export const TBPeerManager = {
  onRequest: null, // (peerId, requestId, fromName)
  onResponse: null, // (peerId, requestId, accepted)
  onMeta: null, // (peerId, requestId, meta)
  onCancel: null, // (peerId, requestId)
  onFile: null, // (peerId, file, requestId)
  onProgress: null, // (peerId, percent)

  _hooked: new Map(), // peerId -> handler
  _incoming: new Map(), // peerId -> { requestId, meta }

  /* -----------------------------------------------------
     Attacher une connexion spécifique
  ----------------------------------------------------- */
  attachToPeer(peerId) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) return false;
    if (this._hooked.has(peerId)) return true;

    const handler = (raw) => {
      try {
        // JSON control messages
        if (typeof raw === "string") {
          try {
            const msg = JSON.parse(raw);
            if (msg.type && msg.type.startsWith("file-")) {
              this._route(peerId, msg);
              return;
            }
          } catch {}
        }

        // BLOB = fichier complet
        if (raw instanceof Blob) {
          const incoming = this._incoming.get(peerId);
          const requestId = incoming?.requestId || null;
          this._incoming.delete(peerId);
          this.onFile?.(peerId, raw, requestId);
          return;
        }
      } catch (e) {
        console.error("TBPeerManager handler error", e);
      }
    };

    conn.on("data", handler);
    this._hooked.set(peerId, handler);
    return true;
  },

  detachFromPeer(peerId) {
    const conn = PeerManager.connections.get(peerId);
    const handler = this._hooked.get(peerId);
    if (conn && handler) {
      try {
        conn.off("data", handler);
      } catch {}
    }
    this._hooked.delete(peerId);
    this._incoming.delete(peerId);
  },

  /* -----------------------------------------------------
     Envoi JSON
  ----------------------------------------------------- */
  send(peerId, obj) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) return false;
    try {
      conn.send(JSON.stringify(obj));
      return true;
    } catch (e) {
      console.warn("TBPeerManager.send failed", e);
      return false;
    }
  },

  /* -----------------------------------------------------
     Routing des messages de contrôle
  ----------------------------------------------------- */
  _route(peerId, msg) {
    switch (msg.type) {
      case "file-request":
        this.onRequest?.(peerId, msg.id, msg.from);
        break;

      case "file-response":
        this.onResponse?.(peerId, msg.id, !!msg.accepted);
        break;

      case "file-meta":
        this._incoming.set(peerId, {
          requestId: msg.id,
          meta: msg,
        });
        this.onMeta?.(peerId, msg.id, msg);
        break;

      case "file-request-cancel":
        this._incoming.delete(peerId);
        this.onCancel?.(peerId, msg.id);
        break;
    }
  },

  /* -----------------------------------------------------
     Envoi du fichier (BLOB direct)
  ----------------------------------------------------- */
  async sendFile(peerId, file, onProgress) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) throw new Error("No connection");

    // envoyer meta
    const requestId = crypto.randomUUID();
    this.send(peerId, {
      type: "file-meta",
      id: requestId,
      name: file.name,
      size: file.size,
      mime: file.type,
    });

    // envoyer fichier entier
    conn.send(file);

    // progress instantané
    onProgress?.(100);
    this.onProgress?.(peerId, 100);

    return requestId;
  },
};
