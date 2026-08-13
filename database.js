console.log("✅ Database layer loaded");

window.ChickenEggsDB = {
  async waitUntilReady() {
    return new Promise(resolve => {
      const check = () => {
        if (window.FirestoreDB && window.FirebaseUser) resolve(true);
        else setTimeout(check, 100);
      };
      check();
    });
  },

  async saveFarmSettings(settings) {
    const { doc, setDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );
    await this.waitUntilReady();
    await setDoc(doc(window.FirestoreDB, "farm", "settings"), {
      ...settings,
      updatedAt: Date.now(),
      serverUpdatedAt: serverTimestamp()
    });
    console.log("✅ Farm settings saved to Firestore");
  },

  async loadFarmSettings() {
    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );
    await this.waitUntilReady();
    const snap = await getDoc(doc(window.FirestoreDB, "farm", "settings"));
    return snap.exists() ? snap.data() : null;
  },

  async saveEntry(entry) {
    const { doc, setDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );
    await this.waitUntilReady();
    await setDoc(doc(window.FirestoreDB, "entries", String(entry.id)), {
      ...entry,
      updatedAt: Date.now(),
      serverUpdatedAt: serverTimestamp()
    });
    console.log("✅ Entry saved to Firestore:", entry.id);
  },

  async loadEntries() {
    const { collection, getDocs } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );
    await this.waitUntilReady();
    const snap = await getDocs(collection(window.FirestoreDB, "entries"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async subscribeEntries(onChange, onError) {
    const { collection, onSnapshot } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );
    await this.waitUntilReady();
    return onSnapshot(
      collection(window.FirestoreDB, "entries"),
      snap => {
        const rows = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(row => row.type === "eggs" || row.type === "sale");
        onChange(rows);
      },
      error => {
        console.error("Entry listener failed:", error);
        if (onError) onError(error);
      }
    );
  },

  async deleteEntry(id) {
    const { doc, deleteDoc } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );
    await this.waitUntilReady();
    await deleteDoc(doc(window.FirestoreDB, "entries", String(id)));
    console.log("✅ Entry deleted from Firestore:", id);
  }
};

console.log("✅ ChickenEggsDB ready");
