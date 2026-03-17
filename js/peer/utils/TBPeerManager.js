// TBPeerManager.js — transfert chunké direct (inspiré de ton ancien code)

import { PeerManager } from "./PeerManager.js";

export const TBPeerManager = {
  onFileMessage: null, // (peerId, fileName)
  onFileReceived: null, // (peerId, file)

  receiving: {}, // receiving[peerId][fileName] = { chunks[], totalSize, receivedSize }

  /* ---------------------------------------------------------
     Attacher la connexion PeerJS (une seule fois)
  --------------------------------------------------------- */
  attach(peerId) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) return false;
    if (conn.__tbfile_hooked) return true;

    conn.__tbfile_hooked = true;

    conn.on("data", (data) => {
      try {
        // JSON ?
        if (typeof data === "string") {
          const msg = JSON.parse(data);

          if (msg.type === "file-meta") {
            console.debug("[TBPeerManager] META reçu", msg);
            this.onFileMessage?.(peerId, msg.name);
            return;
          }
        }

        // Chunk binaire ?
        if (data && typeof data === "object" && data.type === "file-chunk") {
          this._receiveChunk(peerId, data);
          return;
        }
      } catch (e) {
        console.error("[TBPeerManager] erreur data", e);
      }
    });

    console.debug("[TBPeerManager] attach OK pour", peerId);
    return true;
  },

  /* ---------------------------------------------------------
     Envoi du fichier chunké
  --------------------------------------------------------- */
  async sendFile(peerId, file) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) throw new Error("Pas de connexion PeerJS");

    // 1) envoyer meta
    conn.send(
      JSON.stringify({
        type: "file-meta",
        name: file.name,
        size: file.size,
        mime: file.type,
      }),
    );

    console.debug("[TBPeerManager] META envoyé", file.name, file.size);

    // 2) envoyer chunks
    const chunkSize = 16384;
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
          offset,
        });

        offset += chunkSize;

        if (offset < file.size) {
          readNext();
        } else {
          console.debug("[TBPeerManager] ENVOI TERMINÉ", file.name);
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

  /* ---------------------------------------------------------
     Réception chunkée
  --------------------------------------------------------- */
  _receiveChunk(peerId, data) {
    if (!this.receiving[peerId]) this.receiving[peerId] = {};
    if (!this.receiving[peerId][data.fileName]) {
      this.receiving[peerId][data.fileName] = {
        chunks: [],
        totalSize: data.fileSize,
        receivedSize: 0,
      };
      console.debug("[TBPeerManager] Début réception", data.fileName);
    }

    const entry = this.receiving[peerId][data.fileName];

    if (!entry.chunks[data.offset]) {
      entry.chunks[data.offset] = data.chunk;
      entry.receivedSize += data.chunk.byteLength;
    }

    if (entry.receivedSize >= entry.totalSize) {
      console.debug("[TBPeerManager] Fichier complet reçu", data.fileName);

      const ordered = Object.keys(entry.chunks)
        .map((k) => parseInt(k))
        .sort((a, b) => a - b)
        .map((k) => entry.chunks[k]);

      const blob = new Blob(ordered);
      const file = new File([blob], data.fileName);

      delete this.receiving[peerId][data.fileName];
      if (Object.keys(this.receiving[peerId]).length === 0)
        delete this.receiving[peerId];

      this.onFileReceived?.(peerId, file);
    }
  },
};
