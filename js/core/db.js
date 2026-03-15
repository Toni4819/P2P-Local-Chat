export const Database = {
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("P2P-Chat", 2);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;

        // MESSAGES
        if (!db.objectStoreNames.contains("messages")) {
          const messages = db.createObjectStore("messages", { keyPath: "id" });
          messages.createIndex("peerid", "peerid", { unique: false });
          messages.createIndex("timestamp", "timestamp", { unique: false });
          messages.createIndex("peerid_timestamp", ["peerid", "timestamp"], {
            unique: false,
          });
        }

        // PROFILE
        if (!db.objectStoreNames.contains("profile")) {
          db.createObjectStore("profile", { keyPath: "peerid" });
        }

        // CONTACTS
        if (!db.objectStoreNames.contains("contacts")) {
          const contacts = db.createObjectStore("contacts", { keyPath: "id" });
          contacts.createIndex("peerid", "peerid", { unique: true });
        }
      };

      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };

      req.onerror = () => reject(req.error);
    });
  },

  // ---------------------------------------------------------
  // CONTACTS
  // ---------------------------------------------------------

  async addContact(id, peerid, name, lastonline, isonline) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("contacts", "readwrite");
      const store = tx.objectStore("contacts");

      const contact = { id, peerid, name, lastonline, isonline };

      const req = store.put(contact);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteContact(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("contacts", "readwrite");
      const store = tx.objectStore("contacts");

      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // ---------------------------------------------------------
  // MESSAGES
  // ---------------------------------------------------------

  async saveMessage(msg) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");

      const req = store.put(msg);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // ---------------------------------------------------------
  // PROFILE
  // ---------------------------------------------------------

  async saveProfile(name, id, peerid) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("profile", "readwrite");
      const store = tx.objectStore("profile");

      const profile = { name, id, peerid };

      const req = store.put(profile);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async getProfile() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("profile", "readonly");
      const store = tx.objectStore("profile");

      const cursor = store.openCursor();
      cursor.onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) resolve(cur.value);
        else resolve(null);
      };

      cursor.onerror = () => reject(cursor.error);
    });
  },
};
