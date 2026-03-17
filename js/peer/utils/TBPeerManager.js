// TBPeerManager.js — transfert chunké fiable

import { PeerManager } from "./PeerManager.js";

export const TBPeerManager = {
  onFileMessage: null,
  onFileReceived: null,

  receiving: {},

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
            return;
          }
        }

        if (data && typeof data === "object" && data.type === "file-chunk") {
          this._receiveChunk(peerId, data);
          return;
        }
      } catch (e) {
        console.error("[TBPeerManager] erreur data", e);
      }
    });

    return true;
  },

  async sendFile(peerId, file) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) throw new Error("Pas de connexion PeerJS");

    // META
    conn.send(
      JSON.stringify({
        type: "file-meta",
        name: file.name,
        size: file.size,
        mime: file.type,
      }),
    );

    const chunkSize = 16384;
    let index = 0;
    let offset = 0;

    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = () => {
        const chunk = reader.result;

        conn.send({
          type: "file-chunk",
          fileName: file.name,
          fileSize: file.size,
          chunk,
          index, // IMPORTANT : index séquentiel
        });

        index++;
        offset += chunkSize;

        if (offset < file.size) {
          readNext();
        } else {
          resolve();
        }
      };

      reader.onerror = reject;

      function readNext() {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
      }

      readNext();
    });
  },

  _receiveChunk(peerId, data) {
    if (!this.receiving[peerId]) this.receiving[peerId] = {};
    if (!this.receiving[peerId][data.fileName]) {
      this.receiving[peerId][data.fileName] = {
        chunks: [],
        totalSize: data.fileSize,
        receivedChunks: 0,
      };
    }

    const entry = this.receiving[peerId][data.fileName];

    if (!entry.chunks[data.index]) {
      entry.chunks[data.index] = data.chunk;
      entry.receivedChunks++;
    }

    // FINI ?
    const totalChunks = Math.ceil(entry.totalSize / 16384);

    if (entry.receivedChunks >= totalChunks) {
      const blob = new Blob(entry.chunks);
      const file = new File([blob], data.fileName);

      delete this.receiving[peerId][data.fileName];
      if (Object.keys(this.receiving[peerId]).length === 0)
        delete this.receiving[peerId];

      this.onFileReceived?.(peerId, file);
    }
  },
};
