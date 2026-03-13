// url-handler.js

import { addContact } from "./ui/contacts.js";
import { openChat } from "./ui/chat.js";

export function handleURLParams() {
  const params = new URLSearchParams(window.location.search);

  const peer = params.get("peer");
  const name = params.get("name");

  if (!peer || !name) return;

  // 1) Ajouter le contact
  addContact(peer, name);

  // 2) Ouvrir directement le chat
  openChat(peer, name);

  // 3) Nettoyer l’URL (enlève ?peer=...&name=...)
  window.history.replaceState({}, "", window.location.pathname);
}
