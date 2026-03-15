import {
  appendMessage,
  currentChatPeerId,
  saveMessage,
} from "../../ui/chat.js";

import { flashContact, addContact, getContact } from "../../ui/contacts.js";
import { renderSidebar } from "../../ui/sidebar.js";

import { AckManager } from "./AckManager.js";
import { Parser } from "./Parser.js";
import { PeerManager, localPeerId } from "./PeerManager.js";
import { Renderer } from "./Renderer.js";

export const MessageHandler = {
  receiveRaw(peerid, raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (data.type === "msg") {
      this.receiveMessage(peerid, data);
      return;
    }

    if (data.type === "ack") {
      AckManager.receiveAck(peerid, data.id);
      return;
    }
  },

  async receiveMessage(peerid, data) {
    const timestamp = Date.now();

    // 1) ACK
    PeerManager.send(peerid, {
      type: "ack",
      id: data.id,
      peerId: localPeerId,
    });

    // 2) AUTO‑ADD
    let contact = getContact(null, peerid);
    if (!contact) {
      const autoName = data.name || "Unknown " + peerid.slice(0, 6);
      contact = await addContact(autoName, peerid);
      renderSidebar();
    }

    // 3) Save message
    await saveMessage(peerid, "them", data.msg, timestamp, "received", data.id);

    // 4) HTML render
    const parts = Parser.parse(data.msg);
    const html = Renderer.render(parts);

    // 5) Display
    if (currentChatPeerId === peerid) {
      appendMessage("them", html, timestamp, "received", data.id);
    } else {
      flashContact(peerid);
    }
  },
};
