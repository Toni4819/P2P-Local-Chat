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

function confirmDeleteContact(contact) {
  showConfirmDialog(
    `Are you sure you want to delete "${contact.name}"?`,
    () => {
      deleteContact(contact.id);
    },
  );
}

function deleteContact(id) {
  contacts = contacts.filter((c) => c.id !== id);
  saveContacts(contacts);
  renderSidebar();

  const main = document.getElementById("mainPanel");
  main.innerHTML = "<h2>Select a contact</h2>";
}

function showConfirmDialog(message, onConfirm) {
  // Overlay
  const overlay = document.createElement("div");
  overlay.id = "confirmOverlay";
  overlay.style.display = "flex";

  // Box
  const box = document.createElement("div");
  box.id = "confirmBox";

  box.innerHTML = `
    <h3>Delete contact?</h3>
    <p>${message}</p>
    <div class="confirmButtons">
      <button id="confirmYes">Delete</button>
      <button id="confirmNo">Cancel</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Events
  document.getElementById("confirmYes").onclick = () => {
    onConfirm();
    overlay.remove();
  };

  document.getElementById("confirmNo").onclick = () => {
    overlay.remove();
  };
}
