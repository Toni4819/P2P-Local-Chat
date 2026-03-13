
import { MessageHandler } from "./MessageHandler.js";

export let localPeerId = null;

export const PeerManager = {
  peer: null,
  connections: new Map(),
  ready: false,
  initialized: false, // ← empêche la réinitialisation

  init(onReady) {
    // Empêche PeerJS d'être recréé (bug iPad / double init)
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

    // Connexions entrantes
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

    this.connections.set(conn.peer, conn);
  },

  connect(peerId, onOpen) {
    if (!this.ready) return null;

    const conn = this.peer.connect(peerId);

    conn.on("open", () => {
      this.setupConn(conn);
      onOpen && onOpen(conn);
    });

    return conn;
  },

  send(peerId, data) {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) throw new Error("Not connected");
    conn.send(JSON.stringify(data));
  },

  getLocalId() {
    return localPeerId;
  },
}
