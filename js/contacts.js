const contactsKey = "p2p_contacts_peerjs";

function loadContacts() {
  const raw = localStorage.getItem(contactsKey);
  return raw ? JSON.parse(raw) : [];
}

function saveContacts(list) {
  localStorage.setItem(contactsKey, JSON.stringify(list));
}

let contacts = loadContacts();

function addContact(name, peerId) {
  const c = {
    id: crypto.randomUUID(),
    name,
    peerId,
  };
  contacts.push(c);
  saveContacts(contacts);
  return c;
}

function getContact(id) {
  return contacts.find((c) => c.id === id);
}
