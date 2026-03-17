// TBPeerManager.js
// Manager léger pour le protocole file-transfer (attaché par peerId uniquement)

import { PeerManager } from "./PeerManager.js";

export const TBPeerManager = {
  // callbacks que TBfile.js va assigner
  onRequest: null, // (peerId, requestId, fromName)
  onResponse: null, // (peerId, requestId, accepted)
  onMeta: null, // (peerId, requestId, meta)
  onCancel: null, // (peerId, requestId)
  onChunkProgress: null, // (peerId, percent)
  onFile: null, // (peerId, file, requestId)

  // état local
  _hookedConns: new Map(), // peerId -> { conn, handler }
  _incoming: new Map(), // peerId -> { requestId, meta, chunks, received }

  /* -----------------------------------------------------
     Attacher / détacher une connexion spécifique (appelé depuis l'UI)
  ----------------------------------------------------- */
  attachToPeer(peerId) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) return false;
    if (this._hookedConns.has(peerId)) return true;

    const self = this;

    const handler = (raw) => {
      try {
        // JSON control messages (string)
        if (typeof raw === "string") {
          try {
            const msg = JSON.parse(raw);
            if (msg && msg.type && msg.type.startsWith("file-")) {
              self._route(peerId, msg);
              return;
            }
          } catch {}
        }

        // Binary chunk (ArrayBuffer or Blob)
        if (raw instanceof ArrayBuffer || raw instanceof Blob) {
          self._handleChunk(peerId, raw);
          return;
        }
      } catch (err) {
        console.error("TBPeerManager handler error", err);
      }
    };

    conn.on("data", handler);
    this._hookedConns.set(peerId, { conn, handler });
    return true;
  },

  detachFromPeer(peerId) {
    const entry = this._hookedConns.get(peerId);
    if (!entry) return;
    try {
      entry.conn.off && entry.conn.off("data", entry.handler);
    } catch {}
    this._hookedConns.delete(peerId);
    this._incoming.delete(peerId);
  },

  /* -----------------------------------------------------
     Envoi d'un message de contrôle (JSON)
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
     Protocole : routing des messages de contrôle
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
        // préparer réception
        this._incoming.set(peerId, {
          requestId: msg.id,
          meta: { name: msg.name, size: msg.size, mime: msg.mime },
          chunks: [],
          received: 0,
        });
        this.onMeta?.(peerId, msg.id, msg);
        break;

      case "file-request-cancel":
        this._incoming.delete(peerId);
        this.onCancel?.(peerId, msg.id);
        break;

      default:
        // ignore
        break;
    }
  },

  /* -----------------------------------------------------
     Réception de chunks binaires
     - raw peut être ArrayBuffer ou Blob
     - on accumule dans _incoming[peerId]
  ----------------------------------------------------- */
  _handleChunk(peerId, raw) {
    const incoming = this._incoming.get(peerId);
    if (!incoming) {
      // pas d'info meta : on ignore
      return;
    }

    // normaliser ArrayBuffer
    const bufferPromise =
      raw instanceof Blob ? raw.arrayBuffer() : Promise.resolve(raw);

    bufferPromise
      .then((ab) => {
        incoming.chunks.push(ab);
        incoming.received += ab.byteLength;

        const percent = Math.floor(
          (incoming.received / incoming.meta.size) * 100,
        );
        this.onChunkProgress?.(peerId, percent);

        // si reçu complet, finaliser
        if (incoming.received >= incoming.meta.size) {
          const blob = new Blob(incoming.chunks, {
            type: incoming.meta.mime || "",
          });
          const file = new File([blob], incoming.meta.name || "file");
          const requestId = incoming.requestId;
          this._incoming.delete(peerId);
          this.onFile?.(peerId, file, requestId);
        }
      })
      .catch((e) => {
        console.error("TBPeerManager chunk handling error", e);
      });
  },

  /* -----------------------------------------------------
     Envoi de fichier (chunké) — utilisé par l'UI demandeur
     callbackProgress(percent) optionnel
  ----------------------------------------------------- */
  async sendFile(peerId, file, callbackProgress) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) throw new Error("no-conn");

    // envoyer meta d'abord
    const requestId = crypto.randomUUID();
    this.send(peerId, {
      type: "file-meta",
      id: requestId,
      name: file.name,
      size: file.size,
      mime: file.type || "",
    });

    const chunkSize = 64 * 1024; // 64KB
    let offset = 0;

    while (offset < file.size) {
      const slice = file.slice(offset, offset + chunkSize);
      const ab = await slice.arrayBuffer();
      try {
        conn.send(ab); // envoi binaire
      } catch (e) {
        console.error("TBPeerManager send chunk failed", e);
        throw e;
      }

      offset += ab.byteLength;
      const percent = Math.floor((offset / file.size) * 100);
      callbackProgress?.(percent);
      this.onChunkProgress?.(peerId, percent);
    }

    // signal de fin (contrôle)
    this.send(peerId, { type: "file-end", id: requestId });
    return requestId;
  },
};
