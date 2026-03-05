function renderSidebar() {
  const sb = document.getElementById("sidebar");
  sb.innerHTML = `
    <h2>Contacts</h2>
    <div id="contactList"></div>
    <button id="addContactBtn">Add contact</button>
  `;

  const addBtn = document.getElementById("addContactBtn");
  addBtn.onclick = () => {
    console.log("Add contact clicked");
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
    div.textContent = c.name;
    div.onclick = () => showContactPanel(c.id);
    list.appendChild(div);
  });
}
