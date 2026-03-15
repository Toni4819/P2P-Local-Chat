export const Database = {
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("P2P-Chat", 1);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;

        // PROFILE
        if (!db.objectStoreNames.contains("profile")) {
          db.createObjectStore("profile", { keyPath: "peerid" });
        }

        // CONTACTS
        if (!db.objectStoreNames.contains("contacts")) {
          const contacts = db.createObjectStore("contacts", {
            keyPath: "id",
            autoIncrement: true
          });
          contacts.createIndex("peerid", "peerid", { unique: true });
        }

        // MESSAGES
        if (!db.objectStoreNames.contains("messages")) {
          const messages = db.createObjectStore("messages", {
            keyPath: "id",
            autoIncrement: true
          });
          messages.createIndex("contact_id", "contact_id");
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

      const contact = {
        id,
        peerid,
        name,
        lastonline,
        isonline
      };

      const req = store.put(contact);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async removeContact(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("contacts", "readwrite");
      const store = tx.objectStore("contacts");

      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async getContact(id = null, peerid = null, name = null) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("contacts", "readonly");
      const store = tx.objectStore("contacts");

      // Recherche par ID interne
      if (id !== null) {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
        return;
      }

      // Recherche par peerID
      if (peerid !== null) {
        const index = store.index("peerid");
        const req = index.get(peerid);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
        return;
      }

      // Recherche par nom (scan complet)
      if (name !== null) {
        const results = [];
        const cursor = store.openCursor();

        cursor.onsuccess = (e) => {
          const cur = e.target.result;
          if (cur) {
            if (cur.value.name === name) results.push(cur.value);
            cur.continue();
          } else {
            resolve(results);
          }
        };

        cursor.onerror = () => reject(cursor.error);
        return;
      }

      resolve(null);
    });
  },

  // ---------------------------------------------------------
  // MESSAGES
  // ---------------------------------------------------------

  async saveMessage(msg) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");

      const req = store.add(msg);

      req.onsuccess = () => resolve(req.result);
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
  }
};
