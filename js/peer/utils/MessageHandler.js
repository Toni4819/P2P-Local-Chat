import {
  appendMessage,
  currentChatPeerId,
  saveMessage,
} from "../../ui/chat.js";

import { flashContact, addContact } from "../../ui/contacts.js";
import { renderSidebar } from "../../ui/sidebar.js";

import { Database } from "../../core/db.js"; // 🔥 nécessaire
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

    // 2) Lire le contact dans IndexedDB (🔥 correct)
    let contact = await Database.getContact(null, peerid);

    // 3) AUTO‑ADD si inconnu
    if (!contact) {
      const autoName = data.name || "Unknown " + peerid.slice(0, 6);
      contact = await addContact(autoName, peerid);
      renderSidebar();
    }

    // 4) AUTO‑UPDATE du nom
    if (data.name && contact.name !== data.name) {
      contact.name = data.name;
      await Database.addContact(
        contact.id,
        contact.peerid,
        contact.name,
        contact.lastonline,
        contact.isonline,
      );
      renderSidebar();
    }

    // 5) Save message
    await saveMessage(peerid, "them", data.msg, timestamp, "received", data.id);

    // 6) HTML render
    const parts = Parser.parse(data.msg);
    const html = Renderer.render(parts);

    // 7) Display
    if (currentChatPeerId === peerid) {
      appendMessage("them", html, timestamp, "received", data.id);
    } else {
      flashContact(peerid);
    }
  },
};
