// js/peer/utils/TBPeerManager.js
// Protocole de transfert de fichiers basé sur ton ancien code (type:'file', chunk, offset)

import { PeerManager } from "./PeerManager.js";

export const TBPeerManager = {
  // callbacks UI
  onRequest: null, // (peerId, requestId, fromName, meta)
  onResponse: null, // (peerId, requestId, accepted)
  onProgress: null, // (peerId, requestId, percent, direction: 'send'|'recv')
  onComplete: null, // (peerId, requestId, file)
  onCancel: null, // (peerId, requestId),

  // état réception : receivingFiles[peerId][fileName]
  receivingFiles: {},

  // état envoi : sending[requestId] = { file, offset, chunkSize, peerId }
  sending: {},

  // attache un handler sur la connexion du peer (si pas déjà fait)
  attachToPeer(peerId) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) {
      console.debug("[TBPeerManager] attachToPeer: no conn for", peerId);
      return false;
    }
    if (conn.__tbfile_hooked) {
      return true;
    }
    conn.__tbfile_hooked = true;

    conn.on("data", (data) => {
      try {
        // si c'est une string JSON, on parse
        if (typeof data === "string") {
          try {
            const msg = JSON.parse(data);
            this._route(peerId, msg);
            return;
          } catch {
            // pas du JSON, on ignore
            return;
          }
        }

        // si c'est un objet déjà sérialisé par PeerJS
        if (data && typeof data === "object") {
          this._route(peerId, data);
          return;
        }
      } catch (e) {
        console.error("[TBPeerManager] data handler error", e);
      }
    });

    console.debug("[TBPeerManager] attached to peer", peerId);
    return true;
  },

  // envoi d'un message de contrôle via PeerManager (JSON)
  sendControl(peerId, obj) {
    console.debug("[TBPeerManager] sendControl", peerId, obj.type);
    PeerManager.send(peerId, obj);
  },

  // routing des messages
  _route(peerId, msg) {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "file-request":
        // demande d'envoi : le receveur voit "X veut t'envoyer Y"
        this.onRequest?.(peerId, msg.id, msg.from, {
          name: msg.name,
          size: msg.size,
        });
        break;

      case "file-response":
        this.onResponse?.(peerId, msg.id, !!msg.accepted);
        break;

      case "file-cancel":
        this.onCancel?.(peerId, msg.id);
        break;

      case "file":
        // chunk de fichier
        this._receiveFileChunk(peerId, msg);
        break;

      default:
        // autre type, on ignore
        break;
    }
  },

  /* -----------------------------------------------------
     ENVOI : appelé par l'UI après accept côté receveur
  ----------------------------------------------------- */
  async sendFile(peerId, requestId, file) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) throw new Error("No connection for file send");

    const chunkSize = 16384; // 16KB
    const fileReader = new FileReader();
    let offset = 0;

    console.debug(
      "[TBPeerManager] sendFile start",
      peerId,
      file.name,
      file.size,
    );

    return new Promise((resolve, reject) => {
      fileReader.onload = () => {
        const chunk = fileReader.result;
        conn.send({
          type: "file",
          fileName: file.name,
          fileSize: file.size,
          chunk,
          offset,
        });

        offset += chunkSize;
        const percent = Math.min(100, (offset / file.size) * 100);
        this.onProgress?.(peerId, requestId, percent, "send");

        if (offset < file.size) {
          readNextChunk();
        } else {
          console.debug("[TBPeerManager] sendFile complete", peerId, file.name);
          resolve();
        }
      };

      fileReader.onerror = (e) => {
        console.error("[TBPeerManager] sendFile error", e);
        reject(e);
      };

      const readNextChunk = () => {
        const slice = file.slice(offset, offset + chunkSize);
        fileReader.readAsArrayBuffer(slice);
      };

      readNextChunk();
    });
  },

  /* -----------------------------------------------------
     RÉCEPTION : logique inspirée de ton receiveFile(data)
  ----------------------------------------------------- */
  async _receiveFileChunk(peerId, data) {
    if (
      !data.fileName ||
      !data.fileSize ||
      !data.chunk ||
      typeof data.offset !== "number"
    ) {
      console.warn("[TBPeerManager] invalid file chunk", data);
      return;
    }

    if (!this.receivingFiles[peerId]) {
      this.receivingFiles[peerId] = {};
    }

    if (!this.receivingFiles[peerId][data.fileName]) {
      this.receivingFiles[peerId][data.fileName] = {
        chunks: [],
        totalSize: data.fileSize,
        receivedSize: 0,
      };
      console.debug(
        "[TBPeerManager] start receiving",
        peerId,
        data.fileName,
        data.fileSize,
      );
    }

    const fileEntry = this.receivingFiles[peerId][data.fileName];

    if (!fileEntry.chunks[data.offset]) {
      fileEntry.chunks[data.offset] = data.chunk;
      fileEntry.receivedSize += data.chunk.byteLength;
    } else {
      console.warn(
        "[TBPeerManager] duplicate chunk",
        data.fileName,
        data.offset,
      );
    }

    const percent = (fileEntry.receivedSize / fileEntry.totalSize) * 100;
    this.onProgress?.(peerId, data.requestId || null, percent, "recv");

    if (fileEntry.receivedSize === fileEntry.totalSize) {
      console.debug(
        "[TBPeerManager] file fully received",
        peerId,
        data.fileName,
      );

      const allChunks = Object.keys(fileEntry.chunks)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b)
        .map((offset) => fileEntry.chunks[offset]);

      const receivedFile = new Blob(allChunks);
      const file = new File([receivedFile], data.fileName);

      delete this.receivingFiles[peerId][data.fileName];
      if (Object.keys(this.receivingFiles[peerId]).length === 0) {
        delete this.receivingFiles[peerId];
      }

      this.onComplete?.(peerId, data.requestId || null, file);
    }
  },
};
