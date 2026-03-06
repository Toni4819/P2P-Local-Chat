function renderSidebar() {
  const sb = document.getElementById("sidebar");
  sb.innerHTML = `
    <h2>Contacts</h2>
    <div id="contactList"></div>
    <button id="addContactBtn">Add contact</button>
  `;

  document.getElementById("addContactBtn").onclick = () => {
    showAddContactPanel();
  };

  renderContactList();
}

function renderContactList() {
  const list = document.getElementById("contactList");
  list.innerHTML = "";

  contacts.forEach((c) => {
    const div = document.createElement("div");
    div.className = "contactItem";
    div.textContent = c.name + " (" + c.peerId.slice(0, 6) + "…)";
    div.onclick = () => showContactPanel(c.id);
    list.appendChild(div);
  });
}
