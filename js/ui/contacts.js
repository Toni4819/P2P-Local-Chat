// contacts.js
import { Database } from "../core/db.js";

export let contacts = [];

// Chargement initial depuis IndexedDB
export async function loadContacts() {
  const tx = Database.db.transaction("contacts", "readonly");
  const store = tx.objectStore("contacts");

  return new Promise((resolve, reject) => {
    const result = [];
    const cursor = store.openCursor();

    cursor.onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) {
        result.push(cur.value);
        cur.continue();
      } else {
        contacts = result;
        resolve(result);
      }
    };

    cursor.onerror = () => reject(cursor.error);
  });
}

// Ajout d’un contact
export async function addContact(name, peerId) {
  const contact = {
    id: crypto.randomUUID(),
    name,
    peerid: peerId,
    lastonline: null,
    isonline: false
  };

  await Database.addContact(
    contact.id,
    contact.peerid,
    contact.name,
    contact.lastonline,
    contact.isonline
  );

  contacts.push(contact);
  return contact;
}

// Récupération par ID interne
export function getContact(id) {
  return contacts.find((c) => c.id === id);
}

// Flash visuel dans la sidebar
export function flashContact(peerId) {
  const el = document.querySelector(`[data-peerid="${peerId}"]`);
  if (!el) return;
  el.classList.add("unread");
}
