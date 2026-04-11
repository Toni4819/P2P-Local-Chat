// TBPeerManager.js — transfert chunké pipeline ACK (robuste)

import { PeerManager } from "./PeerManager.js";

export const TBPeerManager = {
  onFileMessage: null,
  onFileReceived: null,

  receiving: {},

  WINDOW_SIZE: 4, // chunks en vol simultanés
  CHUNK_SIZE: 16384,

  attach(peerId) {
    const conn = PeerManager.connections.get(peerId);
    if (!conn) return false;
    if (conn.__tbfile_hooked) return true;

    conn.__tbfile_hooked = true;

    conn.on("data", (data) => {
      try {
        // --- Messages JSON (string) ---
        if (typeof data === "string") {
          const msg = JSON.parse(data);

          if (msg.type === "file-meta") {
            this.onFileMessage?.(peerId, msg.name);

            // init réception
            if (!this.receiving[peerId]) this.receiving[peerId] = {};
            this.receiving[peerId][msg.name] = {
              chunks: [],
              totalSize: msg.size,
              mime: msg.mime,
              received: 0,
            };

            conn.send(JSON.stringify({ type: "ack-meta", name: msg.name }));
            return;
          }

          if (msg.type === "file-end") {
            conn.send(JSON.stringify({ type: "ack-end" }));
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

          return;
        }

        // --- Chunks binaires (objet avec ArrayBuffer) ---
        if (data && typeof data === "object" && data.type === "file-chunk") {
          this._receiveChunk(peerId, data);

          // ACK chunk — envoyé en string JSON pour cohérence
          conn.send(
            JSON.stringify({
              type: "ack-chunk",
              fileName: data.fileName,
              index: data.index,
            }),
          );
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

    // Cas fichier vide
    if (file.size === 0) {
      conn.send(
        JSON.stringify({
          type: "file-meta",
          name: file.name,
          size: 0,
          mime: file.type,
        }),
      );
      await this._waitAck(conn, "ack-meta");
      conn.send(JSON.stringify({ type: "file-end" }));
      await this._waitAck(conn, "ack-end");
      onProgress?.(100);
      return;
    }

    const state = {
      file,
      conn,
      nextToSend: 0, // prochain index à envoyer
      acks: new Set(), // chunks confirmés
      resolve: null,
      reject: null,
      onProgress,
      totalChunks,
    };

    this._sending = state;

    // 1. Envoyer META
    conn.send(
      JSON.stringify({
        type: "file-meta",
        name: file.name,
        size: file.size,
        mime: file.type,
      }),
    );

    // 2. Attendre ack-meta
    await this._waitAck(conn, "ack-meta");

    // 3. Pipeline
    return new Promise((resolve, reject) => {
      state.resolve = resolve;
      state.reject = reject;
      this._pumpWindow();
    });
  },

  _pumpWindow() {
    const s = this._sending;
    if (!s) return;

    // Envoyer jusqu'à remplir la fenêtre glissante
    while (
      s.nextToSend < s.totalChunks &&
      s.nextToSend - s.acks.size < this.WINDOW_SIZE
    ) {
      this._sendChunk(s.nextToSend);
      s.nextToSend++;
    }

    // Tous les chunks ont été ACKés → fin
    if (s.acks.size >= s.totalChunks) {
      s.conn.send(JSON.stringify({ type: "file-end" }));
      this._waitAck(s.conn, "ack-end").then(() => {
        s.resolve();
        this._sending = null;
      });
    }
  },

  _sendChunk(index) {
    const s = this._sending;
    const start = index * this.CHUNK_SIZE;
    const slice = s.file.slice(start, start + this.CHUNK_SIZE);

    const reader = new FileReader();
    reader.onload = () => {
      // Vérifier que l'envoi est toujours en cours (pas annulé)
      if (this._sending !== s) return;

      s.conn.send({
        type: "file-chunk",
        fileName: s.file.name,
        fileSize: s.file.size,
        chunk: reader.result, // ArrayBuffer
        index,
      });
    };
    reader.onerror = () => {
      console.error(`[TBPeerManager] Erreur lecture chunk ${index}`);
      s.reject?.(new Error(`Lecture chunk ${index} échouée`));
    };
    reader.readAsArrayBuffer(slice);
  },

  /* ---------------------------------------------------------
     Gestion des ACK reçus
  --------------------------------------------------------- */
  _handleAck(peerId, msg) {
    const s = this._sending;
    if (!s) return;

    if (msg.type === "ack-chunk") {
      const idx = msg.index;
      if (typeof idx !== "number") return;

      if (!s.acks.has(idx)) {
        s.acks.add(idx);

        const percent = Math.floor((s.acks.size / s.totalChunks) * 100);
        s.onProgress?.(percent);

        // Tenter d'envoyer les chunks suivants
        this._pumpWindow();
      }
    }
    // ack-end est géré par _waitAck dans _pumpWindow
  },

  /* ---------------------------------------------------------
     Attente d'un ACK spécifique (one-shot)
  --------------------------------------------------------- */
  _waitAck(conn, type) {
    return new Promise((resolve) => {
      const handler = (data) => {
        try {
          if (typeof data === "string") {
            const msg = JSON.parse(data);
            if (msg.type === type) {
              // Retirer le listener après réception
              if (conn.off) {
                conn.off("data", handler);
              } else if (conn._events?.data) {
                // Fallback si off() non disponible
                const listeners = conn._events.data;
                if (Array.isArray(listeners)) {
                  const i = listeners.indexOf(handler);
                  if (i !== -1) listeners.splice(i, 1);
                }
              }
              resolve(msg);
            }
          }
        } catch (e) {
          // ignorer les erreurs de parse
        }
      };

      conn.on("data", handler);
    });
  },

  /* ---------------------------------------------------------
     Réception des chunks
  --------------------------------------------------------- */
  _receiveChunk(peerId, data) {
    // S'assurer que la structure existe (au cas où file-meta n'est pas arrivé avant)
    if (!this.receiving[peerId]) this.receiving[peerId] = {};
    if (!this.receiving[peerId][data.fileName]) {
      this.receiving[peerId][data.fileName] = {
        chunks: [],
        totalSize: data.fileSize,
        mime: "",
        received: 0,
      };
    }

    const entry = this.receiving[peerId][data.fileName];

    // Déduplication : ignorer les chunks déjà reçus
    if (entry.chunks[data.index] !== undefined) return;

    entry.chunks[data.index] = data.chunk; // ArrayBuffer
    entry.received++;

    const totalChunks = Math.ceil(entry.totalSize / this.CHUNK_SIZE);

    if (entry.received >= totalChunks) {
      // Reconstruire le fichier dans l'ordre
      const orderedChunks = [];
      for (let i = 0; i < totalChunks; i++) {
        if (entry.chunks[i] === undefined) {
          console.error(
            `[TBPeerManager] chunk ${i} manquant pour ${data.fileName}`,
          );
          return; // Attendre que tous les chunks arrivent
        }
        orderedChunks.push(entry.chunks[i]);
      }

      const blob = new Blob(orderedChunks, { type: entry.mime || "" });
      const file = new File([blob], data.fileName, { type: entry.mime || "" });

      delete this.receiving[peerId][data.fileName];
      if (Object.keys(this.receiving[peerId]).length === 0)
        delete this.receiving[peerId];

      this.onFileReceived?.(peerId, file);
    }
  },
};
