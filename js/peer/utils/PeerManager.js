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
