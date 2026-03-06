let pc = null;
let channel = null;

/* Création de la RTCPeerConnection */

function createPeerConnection() {
  pc = new RTCPeerConnection();

  pc.onicecandidate = e => {
    if (!e.candidate) {
      console.log("ICE gathering completed");
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("Connection state:", pc.connectionState);
  };

  pc.ondatachannel = e => {
    channel = e.channel;
    setupChannel();
  };
}

function setupChannel() {
  channel.onopen = () => {
    console.log("DataChannel opened");
    appendChat("System", "Connection established");
  };

  channel.onmessage = e => {
    appendChat("Peer", e.data);
  };

  channel.onclose = () => {
    appendChat("System", "Connection closed");
  };
}

async function waitForICE() {
  if (pc.iceGatheringState === "complete") return;
  await new Promise(resolve => {
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
  });
}

/* Offer / Answer */

async function createOfferToken() {
  createPeerConnection();
  channel = pc.createDataChannel("chat");
  setupChannel();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForICE();

  return btoa(JSON.stringify(pc.localDescription));
}

async function createAnswerToken(offerToken) {
  createPeerConnection();

  const offer = JSON.parse(atob(offerToken));
  await pc.setRemoteDescription(offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForICE();

  return btoa(JSON.stringify(pc.localDescription));
}

async function applyAnswerToken(answerToken) {
  const answer = JSON.parse(atob(answerToken));
  await pc.setRemoteDescription(answer);
}

/* Attente de connexion + timeout */

function waitForConnection() {
  return new Promise(resolve => {
    const check = () => {
      if (pc && pc.connectionState === "connected") {
        resolve(true);
      } else if (pc && ["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        resolve(false);
      } else {
        setTimeout(check, 150);
      }
    };
    check();
  });
}

function waitForConnectionOrTimeout(ms) {
  return Promise.race([
    waitForConnection(),
    new Promise(resolve => setTimeout(() => resolve(false), ms))
  ]);
}
