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
  }
};

console.log("✅ ChickenEggsDB ready");
