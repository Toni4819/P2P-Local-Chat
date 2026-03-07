let peer = null;
let localPeerId = null;
let connections = new Map();

let onPeerMessage = null;
let onPeerIncoming = null;

let peerInitialized = false;

function isSafariBrowser() {
  const ua = navigator.userAgent;
  return /^((?!chrome|android).)*safari/i.test(ua);
}

function initPeerInternal(onReady) {
  let savedId = localStorage.getItem("peerjs_id");

  peer = new Peer(savedId || undefined);

  peer.on("open", (id) => {
    localPeerId = id;
    localStorage.setItem("peerjs_id", id);
    console.log("PeerJS ID:", id);
    onReady && onReady(id);
  });

  peer.on("connection", (conn) => {
    setupConn(conn);
    connections.set(conn.peer, conn);
    onPeerIncoming && onPeerIncoming(conn);
  });

  peer.on("error", (err) => console.error("PeerJS error:", err));
}

function ensurePeerReady(callback) {
  if (peer && localPeerId) {
    callback();
    return;
  }
  if (peerInitialized) {
    // Peer en cours d'init → attendre un peu
    const check = () => {
      if (peer && localPeerId) callback();
      else setTimeout(check, 50);
    };
    check();
    return;
  }

  peerInitialized = true;
  initPeerInternal(() => {
    callback();
  });
}

function setupConn(conn) {
  conn.on("data", (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn("Invalid data", raw);
      return;
    }

    // --- Auto-add contact ---
    let c = contacts.find((c) => c.peerId === data.peerId);
    if (!c) {
      c = addContact(data.name, data.peerId);
      saveContacts(contacts);
      renderSidebar();
    }

    // --- Auto-update name ---
    if (c.name !== data.name) {
      c.name = data.name;
      saveContacts(contacts);
      renderSidebar();
    }

    // --- PROTOCOL: MESSAGE ---
    if (data.type === "msg") {
      conn.send(
        JSON.stringify({
          type: "ack",
          id: data.id,
          peerId: localPeerId,
        }),
      );

      saveMessage(data.peerId, "them", data.msg, Date.now(), "reçu", data.id);
      if (currentChatPeerId === data.peerId) {
        onPeerMessage &&
          onPeerMessage(data.peerId, data.name, data.msg, data.id);
      } else {
        flashContact(data.peerId);
      }

      return;
    }

    if (data.type === "ack") {
      onPeerAck && onPeerAck(data.peerId, data.id);
      return;
    }
  });

  conn.on("close", () => {
    connections.delete(conn.peer);
  });
}

function connectToPeer(peerId, onOpen) {
  if (connections.has(peerId)) {
    const c = connections.get(peerId);
    if (c.open) {
      onOpen && onOpen(c);
      return c;
    }
  }

  const conn = peer.connect(peerId);
  setupConn(conn);

  conn.on("open", () => {
    connections.set(peerId, conn);
    onOpen && onOpen(conn);
  });

  return conn;
}

function isPeerConnected(peerId) {
  const c = connections.get(peerId);
  return !!(c && c.open);
}

function sendToPeer(peerId, text) {
  const conn = connections.get(peerId);
  if (!conn || !conn.open) throw new Error("Not connected");

  const packet = {
    type: "msg",
    id: crypto.randomUUID(),
    peerId: localPeerId,
    name: profile.name,
    msg: text,
  };

  conn.send(JSON.stringify(packet));
  return packet.id;
}
