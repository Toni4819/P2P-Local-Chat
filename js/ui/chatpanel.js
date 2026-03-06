function validateOfferToken(token) {
  try {
    const obj = JSON.parse(atob(token));
    return obj.type === "offer" && typeof obj.sdp === "string";
  } catch {
    return false;
  }
}

function appendChat(sender, msg) {
  const log = document.getElementById("chatLog");
  if (!log) return;
  const line = document.createElement("div");
  line.textContent = sender + ": " + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function showAddContactPanel() {
  const main = document.getElementById("mainPanel");
  main.innerHTML = `
    <h2>Add contact</h2>
    <label>Name</label>
    <input id="newContactName" placeholder="Contact name">

    <label>Offer token</label>
    <textarea id="newContactToken" placeholder="Paste offer token"></textarea>

    <button id="saveNewContact">Save contact</button>
  `;

  document.getElementById("saveNewContact").onclick = () => {
    const name = document.getElementById("newContactName").value.trim();
    const token = document.getElementById("newContactToken").value.trim();

    if (!name) return alert("Please enter a name");
    if (!token) return alert("Please paste an offer token");
    if (!validateOfferToken(token)) return alert("Invalid offer token");

    const c = addContact(name, token);
    renderSidebar();
    showContactPanel(c.id);
  };
}

function showContactPanel(id) {
  const c = getContact(id);
  const main = document.getElementById("mainPanel");

  main.innerHTML = `
    <h2>${c.name}</h2>

    <button id="connectBtn">Connect to ${c.name}</button>

    <h3>Paste answer from peer</h3>
    <textarea id="answerInput" placeholder="Paste answer token"></textarea>
    <button id="applyAnswerBtn">Apply answer</button>

    <h3>Chat</h3>
    <div id="chatLog"></div>
    <textarea id="chatMsg" placeholder="Message..."></textarea>
    <button id="sendMsgBtn">Send</button>
  `;

  document.getElementById("connectBtn").onclick = async () => {
    const answerToken = await createAnswerToken(c.offerToken);
    alert("Send this answer token to the peer:\n\n" + answerToken);
  };

  document.getElementById("applyAnswerBtn").onclick = async () => {
    const token = document.getElementById("answerInput").value.trim();
    if (!token) return alert("Paste an answer token");
    await applyAnswerToken(token);
  };

  document.getElementById("sendMsgBtn").onclick = () => {
    const msg = document.getElementById("chatMsg").value.trim();
    if (!msg) return;

    if (!channel || channel.readyState !== "open") {
      appendChat("System", "Channel not open");
      return;
    }

    channel.send(profile.name + ": " + msg);
    appendChat(profile.name, msg);
    document.getElementById("chatMsg").value = "";
  };
}
