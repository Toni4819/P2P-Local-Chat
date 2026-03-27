// TBPeerManager.js — transfert chunké pipeline ACK

import { PeerManager } from "./PeerManager.js";

export const TBPeerManager = {
  onFileMessage: null,
  onFileReceived: null,

  receiving: {},

  WINDOW_SIZE: 4, // fenêtre glissante (4 chunks simultanés)
  CHUNK_SIZE: 16384,

  attach(peerId) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) return false;
    if (conn.__tbfile_hooked) return true;

    conn.__tbfile_hooked = true;

    conn.on("data", (data) => {
      try {
        if (typeof data === "string") {
          const msg = JSON.parse(data);

          if (msg.type === "file-meta") {
            this.onFileMessage?.(peerId, msg.name);

            // ACK META
            conn.send(
              JSON.stringify({
                type: "ack-meta",
                name: msg.name,
              }),
            );
            return;
          }

          if (
            msg.type === "ack-meta" ||
            msg.type === "ack-chunk" ||
            msg.type === "ack-end"
          ) {
            this._handleAck(peerId, msg);
            return;
          }
        }

        if (data && typeof data === "object" && data.type === "file-chunk") {
          this._receiveChunk(peerId, data);

          // ACK CHUNK
          conn.send({
            type: "ack-chunk",
            fileName: data.fileName,
            index: data.index,
          });
          return;
        }
      } catch (e) {
        console.error("[TBPeerManager] erreur data", e);
      }
    });

    return true;
  },

  /* ---------------------------------------------------------
     Envoi pipeline ACK
  --------------------------------------------------------- */
  async sendFile(peerId, file, onProgress) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) throw new Error("Pas de connexion PeerJS");

    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

    // état d’envoi
    const state = {
      file,
      conn,
      nextToSend: 0,
      acks: new Set(),
      resolve: null,
      onProgress,
      totalChunks,
    };

    this._sending = state;

    // envoyer META
    conn.send(
      JSON.stringify({
        type: "file-meta",
        name: file.name,
        size: file.size,
        mime: file.type,
      }),
    );

    // attendre ack-meta
    await this._waitAck("ack-meta");

    // pipeline
    return new Promise((resolve) => {
      state.resolve = resolve;
      this._pumpWindow();
    });
  },

  async _pumpWindow() {
    const s = this._sending;
    if (!s) return;

    while (
      s.nextToSend < s.totalChunks &&
      s.nextToSend - s.acks.size < this.WINDOW_SIZE
    ) {
      this._sendChunk(s.nextToSend);
      s.nextToSend++;
    }

    // terminé ?
    if (s.acks.size >= s.totalChunks) {
      s.conn.send(JSON.stringify({ type: "file-end" }));
      await this._waitAck("ack-end");
      s.resolve();
      this._sending = null;
    }
  },

  _sendChunk(index) {
    const s = this._sending;
    const start = index * this.CHUNK_SIZE;
    const slice = s.file.slice(start, start + this.CHUNK_SIZE);

    const reader = new FileReader();
    reader.onload = () => {
      s.conn.send({
        type: "file-chunk",
        fileName: s.file.name,
        fileSize: s.file.size,
        chunk: reader.result,
        index,
      });
    };
    reader.readAsArrayBuffer(slice);
  },

  /* ---------------------------------------------------------
     Gestion des ACK
  --------------------------------------------------------- */
  _handleAck(peerId, msg) {
    const s = this._sending;
    if (!s) return;

    if (msg.type === "ack-chunk") {
      s.acks.add(msg.index);

      const percent = Math.floor((s.acks.size / s.totalChunks) * 100);
      s.onProgress?.(percent);

      this._pumpWindow();
    }

    if (msg.type === "ack-end") {
      // fin confirmée
    }
  },

  _waitAck(type) {
    return new Promise((resolve) => {
      const handler = (data) => {
        if (typeof data === "string") {
          const msg = JSON.parse(data);
          if (msg.type === type) {
            conn.off("data", handler);
            resolve();
          }
        }
      };

      const conn = this._sending.conn;
      conn.on("data", handler);
    });
  },

  /* ---------------------------------------------------------
     Réception des chunks
  --------------------------------------------------------- */
  _receiveChunk(peerId, data) {
    if (!this.receiving[peerId]) this.receiving[peerId] = {};
    if (!this.receiving[peerId][data.fileName]) {
      this.receiving[peerId][data.fileName] = {
        chunks: [],
        totalSize: data.fileSize,
        received: 0,
      };
    }

    const entry = this.receiving[peerId][data.fileName];

    if (!entry.chunks[data.index]) {
      entry.chunks[data.index] = data.chunk;
      entry.received++;
    }

    const totalChunks = Math.ceil(entry.totalSize / this.CHUNK_SIZE);

    if (entry.received >= totalChunks) {
      const blob = new Blob(entry.chunks);
      const file = new File([blob], data.fileName);

      delete this.receiving[peerId][data.fileName];
      if (Object.keys(this.receiving[peerId]).length === 0)
        delete this.receiving[peerId];

      this.onFileReceived?.(peerId, file);
    }
  },
};
