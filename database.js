console.log("✅ Database layer loaded");

window.ChickenEggsDB = {
  isReady() {
    return !!window.FirestoreDB && !!window.FirebaseUser;
  },

  getStatus() {
    return {
      firestoreReady: !!window.FirestoreDB,
      userReady: !!window.FirebaseUser
    };
  },

  async waitUntilReady() {
    return new Promise(resolve => {
      const check = () => {
        if (window.FirestoreDB && window.FirebaseUser) {
          resolve(true);
        } else {
          setTimeout(check, 100);
        }
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

    if (snap.exists()) {
      console.log("✅ Farm settings loaded from Firestore:", snap.data());
      return snap.data();
    }

    console.log("ℹ️ No farm settings found in Firestore yet");
    return null;
  },

  async testFirestoreWrite() {
    const { doc, setDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );

    await this.waitUntilReady();

    await setDoc(doc(window.FirestoreDB, "test", "connection"), {
      message: "Hello from Chicken Eggs",
      updatedAt: serverTimestamp()
    });

    console.log("✅ Firestore test write successful");
  },

  async testFirestoreRead() {
    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );

    await this.waitUntilReady();

    const snap = await getDoc(doc(window.FirestoreDB, "test", "connection"));

    if (snap.exists()) {
      console.log("✅ Firestore read successful:", snap.data());
    } else {
      console.log("❌ Test document not found");
    }
  }
};

console.log("✅ ChickenEggsDB ready");
