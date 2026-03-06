function handleAutoAddFromURL() {
  const params = new URLSearchParams(location.search);
  const peerId = params.get("peer");
  const name = params.get("name");

  if (!peerId) return;

  let c = contacts.find((c) => c.peerId === peerId);
  if (!c) {
    c = addContact(name || "Peer " + peerId.slice(0, 6), peerId);
    saveContacts(contacts);
  }

  renderSidebar();
  showContactPanel(c.id);
}

window.onload = () => {
  renderSidebar();
  handleAutoAddFromURL();
  showProfilePanel();

  if (!isSafariBrowser()) {
    // Desktop / Chrome / Firefox → auto-start PeerJS
    ensurePeerReady(() => {});
  } else {
    // Safari → on attend un tap (Send, etc.)
    console.log("Safari detected: PeerJS will start on first user action.");
  }
};

// Big QRcode view
document.addEventListener("click", (e) => {
  const qr = document.getElementById("qrcode");
  if (!qr) return;

  if (e.target === qr) {
    qr.classList.toggle("expanded");
  }
});
