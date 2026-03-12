// sidebar.js

import { contacts, getContact, saveContacts } from "./contacts.js";
import {
  showAddContactPanel,
  showProfilePanel,
  showContactPanel,
} from "./chatpanel.js";

export function renderSidebar() {
  const sb = document.getElementById("sidebar");

  sb.innerHTML = `
    <!-- HAMBURGER -->
    <button id="hamburger" class="hamburger" aria-label="Toggle sidebar">
      <span class="bar top"></span>
      <span class="bar middle"></span>
      <span class="bar bottom"></span>
    </button>

    <!-- ACTION BUTTONS -->
    <div id="sidebarActions">
      <img src="img/svg/add.svg" id="addContactIcon" class="iconOnly" title="Add contact">
      <img src="img/svg/profile.svg" id="myProfileIcon" class="iconOnly" title="My profile">
    </div>

    <hr class="separator">

    <!-- CONTACT LIST -->
    <div id="contactList"></div>
  `;

  // === ACTION BUTTONS ===
  document.getElementById("addContactIcon").onclick = showAddContactPanel;
  document.getElementById("myProfileIcon").onclick = showProfilePanel;

  // === HAMBURGER TOGGLE ===
  const hamburger = document.getElementById("hamburger");
  hamburger.onclick = () => {
    sb.classList.toggle("closed");
    hamburger.classList.toggle("open");
  };

  // === AUTO-CLOSE ON SMALL SCREENS ===
  function autoSidebar() {
    if (window.innerWidth < 700) {
      sb.classList.add("closed");
      hamburger.classList.remove("open");
    } else {
      sb.classList.remove("closed");
      hamburger.classList.remove("open");
    }
  }

  window.addEventListener("resize", autoSidebar);
  autoSidebar();

  // === CONTACTS ===
  renderContactList();
}

function renderContactList() {
  const list = document.getElementById("contactList");
  list.innerHTML = "";

  contacts.forEach((c) => {
    const div = document.createElement("div");
    div.className = "contactItem";
    div.dataset.peerid = c.peerId;

    div.innerHTML = `
      <span class="contactName">${c.name} (${c.peerId.slice(0, 6)}…)</span>
      <img src="img/svg/trash-alt.svg" class="deleteBtn" data-id="${c.id}">
    `;

    div.querySelector(".contactName").onclick = () => showContactPanel(c.id);

    div.querySelector(".deleteBtn").onclick = (e) => {
      e.stopPropagation();
      confirmDeleteContact(c);
    };

    list.appendChild(div);
  });
}

function confirmDeleteContact(contact) {
  const overlay = document.createElement("div");
  overlay.id = "confirmOverlay";
  overlay.style.display = "flex";

  const box = document.createElement("div");
  box.id = "confirmBox";

  box.innerHTML = `
    <h3>Delete contact?</h3>
    <p>Are you sure you want to delete "${contact.name}"?</p>
    <div class="confirmButtons">
      <button id="confirmYes">Delete</button>
      <button id="confirmNo">Cancel</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("confirmYes").onclick = () => {
    deleteContact(contact.id);
    overlay.remove();
  };

  document.getElementById("confirmNo").onclick = () => overlay.remove();
}

function deleteContact(id) {
  const newList = contacts.filter((c) => c.id !== id);
  saveContacts(newList);
  location.reload(); // simple et propre
}
