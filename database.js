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

  async testFirestoreWrite() {
    const { doc, setDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );

    if (!window.FirestoreDB) {
      console.error("❌ Firestore is not ready");
      return;
    }

    await setDoc(doc(window.FirestoreDB, "test", "connection"), {
      message: "Hello from Chicken Eggs",
      updatedAt: serverTimestamp()
    });

    console.log("✅ Firestore test write successful");
  }
};

console.log("✅ ChickenEggsDB ready");
