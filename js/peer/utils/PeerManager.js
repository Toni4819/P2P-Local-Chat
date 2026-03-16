import { MessageHandler } from "./MessageHandler.js";

export let localPeerId = null;

export const PeerManager = {
  peer: null,
  connections: new Map(),
  ready: false,
  initialized: false,

  connectionState: "idle", // idle | connecting | connected | failed | cancelled
  onConnectionStateChange: null,
  currentConn: null, // ← pour pouvoir annuler

  init(onReady) {
    if (this.initialized) {
      console.warn("PeerManager.init() ignoré : déjà initialisé");
      if (this.ready && onReady) onReady(localPeerId);
      return;
    }
    this.initialized = true;

    this.peer = new Peer(localStorage.getItem("peerjs_id") || undefined);

    this.peer.on("open", (id) => {
      localPeerId = id;
      this.ready = true;
      onReady && onReady(id);
    });

    this.peer.on("connection", (conn) => {
      conn.on("open", () => {
        this.setupConn(conn);
      });
    });
  },

  setupConn(conn) {
    conn.on("data", (raw) => {
      MessageHandler.receiveRaw(conn.peer, raw);
    });

    const originalReceiveRaw = MessageHandler.receiveRaw;

    MessageHandler.receiveRaw = function (peerId, raw) {
      try {
        const msg = JSON.parse(raw);

        if (msg.type && msg.type.startsWith("file-")) {
          handleIncoming(peerId, msg);
          return;
        }
      } catch {}

      originalReceiveRaw.call(MessageHandler, peerId, raw);
    };

    this.connections.set(conn.peer, conn);
  },

  cancelConnection() {
    if (this.connectionState === "connecting" && this.currentConn) {
      try {
        this.currentConn.close();
      } catch {}
    }
    this.connectionState = "cancelled";
    this.onConnectionStateChange?.("cancelled");
  },

  connect(peerId, onOpen) {
    if (!this.ready) return null;

    if (this.connectionState === "connecting") return;

    this.connectionState = "connecting";
    this.onConnectionStateChange?.("connecting", peerId);

    const conn = this.peer.connect(peerId);
    this.currentConn = conn;

    conn.on("open", () => {
      if (this.connectionState === "cancelled") return;

      this.setupConn(conn);
      this.connectionState = "connected";
      this.onConnectionStateChange?.("connected", peerId);
      onOpen && onOpen(conn);
    });

    conn.on("error", (err) => {
      if (this.connectionState === "cancelled") return;

      this.connectionState = "failed";
      this.onConnectionStateChange?.("failed", peerId, err);
    });

    setTimeout(() => {
      if (this.connectionState === "connecting") {
        this.connectionState = "failed";
        this.onConnectionStateChange?.("failed", peerId, "timeout");
      }
    }, 6000);

    return conn;
  },

  send(peerId, data) {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) {
      // relance la connexion automatiquement
      this.onConnectionStateChange?.("connecting", peerId);
      this.connect(peerId, () => {
        this.send(peerId, data); // renvoi automatique
      });
      return;
    }

    conn.send(JSON.stringify(data));
  },

  getLocalId() {
    return localPeerId;
  },

  isConnectedTo(peerId) {
    const conn = this.connections.get(peerId);
    return conn && conn.open;
  },
};

/* -----------------------------------------------------
   FILE TRANSFER SYSTEM (AirDrop‑like)
----------------------------------------------------- */

// Callbacks (à utiliser dans TBfile.js)
export let onFileRequest = null; // (peerId, name)
export let onFileAccepted = null; // ()
export let onFileDenied = null; // ()
export let onFileProgress = null; // (percent)
export let onFileReceived = null; // (peerId, file)

/* -----------------------------------------------------
   ENVOI D’UNE DEMANDE DE TRANSFERT
----------------------------------------------------- */

export function requestFileTransfer(peerId) {
  const conn = connections.get(peerId);
  if (!conn) return;

  conn.send({
    type: "file-request",
    from: localPeerId,
    name: profile.name,
  });
}

/* -----------------------------------------------------
   ACCEPTATION / REFUS
----------------------------------------------------- */

export function acceptFileTransfer(peerId) {
  const conn = connections.get(peerId);
  if (!conn) return;

  conn.send({
    type: "file-accept",
  });
}

export function denyFileTransfer(peerId) {
  const conn = connections.get(peerId);
  if (!conn) return;

  conn.send({
    type: "file-deny",
  });
}

/* -----------------------------------------------------
   ENVOI DE FICHIER AVEC PROGRESS
----------------------------------------------------- */

export function sendFile(peerId, file, onProgress) {
  const conn = connections.get(peerId);
  if (!conn) return;

  const chunkSize = 16 * 1024; // 16 KB
  const reader = new FileReader();
  let offset = 0;

  reader.onload = () => {
    conn.send({
      type: "file-chunk",
      name: file.name,
      size: file.size,
      offset,
      data: reader.result,
    });

    offset += reader.result.byteLength;

    const percent = Math.floor((offset / file.size) * 100);
    if (onProgress) onProgress(percent);
    if (onFileProgress) onFileProgress(percent);

    if (offset < file.size) {
      readSlice();
    } else {
      conn.send({ type: "file-end" });
    }
  };

  function readSlice() {
    const slice = file.slice(offset, offset + chunkSize);
    reader.readAsArrayBuffer(slice);
  }

  readSlice();
}

/* -----------------------------------------------------
   RÉCEPTION DE FICHIER
----------------------------------------------------- */

let incomingFile = null;

function handleFileChunk(peerId, msg) {
  if (!incomingFile) {
    incomingFile = {
      name: msg.name,
      size: msg.size,
      received: 0,
      chunks: [],
    };
  }

  incomingFile.chunks.push(msg.data);
  incomingFile.received += msg.data.byteLength;

  const percent = Math.floor((incomingFile.received / incomingFile.size) * 100);
  if (onFileProgress) onFileProgress(percent);
}

function finalizeFile(peerId) {
  const blob = new Blob(incomingFile.chunks);
  const file = new File([blob], incomingFile.name);
  incomingFile = null;

  if (onFileReceived) onFileReceived(peerId, file);
}

/* -----------------------------------------------------
   ROUTAGE DES MESSAGES
----------------------------------------------------- */

function handleIncoming(peerId, msg) {
  switch (msg.type) {
    case "file-request":
      if (onFileRequest) onFileRequest(peerId, msg.name);
      break;

    case "file-accept":
      if (onFileAccepted) onFileAccepted();
      break;

    case "file-deny":
      if (onFileDenied) onFileDenied();
      break;

    case "file-chunk":
      handleFileChunk(peerId, msg);
      break;

    case "file-end":
      finalizeFile(peerId);
      break;
  }
}
