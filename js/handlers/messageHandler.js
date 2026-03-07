const messageHandler = {
  receive(peerId, name, rawMsg, id) {
    const timestamp = Date.now();
    saveMessage(peerId, "them", rawMsg, timestamp, "received", id);

    const parts = parser.parse(rawMsg);

    const htmlParts = parts.map((p) => {
      switch (p.type) {
        case "text":
          return textHandler.render(p.value);
        case "link":
          return linkHandler.render(p.value);
        case "gif":
          return gifHandler.render(p.value);
        case "file":
          return fileHandler.renderIncoming(p);
        default:
          return textHandler.render(p.value);
      }
    });

    const finalHtml = htmlParts.join(" ");

    if (currentChatPeerId === peerId) {
      appendMessage("them", finalHtml, timestamp, "received");
    } else {
      flashContact(peerId);
    }

    ackHandler.onReceive(peerId, id);
  },

  send(peerId, rawMsg) {
    const id = sendToPeer(peerId, rawMsg);
    ackHandler.track(peerId, id);
    return id;
  },
};
