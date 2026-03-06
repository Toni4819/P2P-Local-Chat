let peer = null;
let localPeerId = null;
const connections = new Map(); // peerId -> conn

// callbacks UI (définies dans chatpanel.js)
let onPeerReady = null;
let onPeerMessage = null;
let onPeerIncomingConnection = null;

function initPeer(onReadyCb) {
  onPeerReady = onReadyCb;

  let savedId = localStorage.getItem("peerjs_id");
  peer = new Peer(savedId || undefined);

  peer.on("open", (id) => {
    localStorage.setItem("peerjs_id", id);
    localPeerId = id;
    console.log("My PeerJS ID:", id);
    if (onPeerReady) onPeerReady(id);
  });

  peer.on("open", (id) => {
    localPeerId = id;
    console.log("My PeerJS ID:", id);
    if (onPeerReady) onPeerReady(id);
  });

  peer.on("connection", (conn) => {
    console.log("Incoming connection from", conn.peer);
    setupConnection(conn);
    connections.set(conn.peer, conn);
    if (onPeerIncomingConnection) onPeerIncomingConnection(conn);
  });

  peer.on("error", (err) => {
    console.error("Peer error:", err);
  });
}

function setupConnection(conn) {
  conn.on("open", () => {
    console.log("Connection open with", conn.peer);
  });

  conn.on("data", (msg) => {
    console.log("Data from", conn.peer, ":", msg);
    if (onPeerMessage) onPeerMessage(conn.peer, msg);
  });

  conn.on("close", () => {
    console.log("Connection closed with", conn.peer);
    connections.delete(conn.peer);
  });
}

function connectToPeer(peerId, onOpen) {
  if (connections.has(peerId)) {
    const existing = connections.get(peerId);
    if (existing.open) {
      onOpen && onOpen(existing);
      return existing;
    }
  }

  const conn = peer.connect(peerId);
  setupConnection(conn);

  conn.on("open", () => {
    connections.set(peerId, conn);
    onOpen && onOpen(conn);
  });

  return conn;
}

function sendToPeer(peerId, msg) {
  const conn = connections.get(peerId);
  if (!conn || !conn.open) {
    throw new Error("No open connection to " + peerId);
  }
  conn.send(msg);
}
