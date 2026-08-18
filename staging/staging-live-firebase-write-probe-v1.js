(() => {
  "use strict";
  if (window.StagingLiveFirebaseWriteProbeV1) return;
  if (!window.__ChickenEggsStagingMode) return;

  const APP_NAME = "chicken-eggs-staging-anon-write-probe";
  const firebaseConfig = {
    apiKey:"AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
    authDomain:"chicken-eggs-53358.firebaseapp.com",
    projectId:"chicken-eggs-53358",
    storageBucket:"chicken-eggs-53358.firebasestorage.app",
    messagingSenderId:"461720066101",
    appId:"1:461720066101:web:6b19a7c4d245f399cf797c"
  };

  let running = null;
  const text = error => ({
    code: String(error?.code || ""),
    message: String(error?.message || error || "Firebase diagnostic failed")
  });

  async function run() {
    if (running) return running;
    running = (async () => {
      const started = Date.now();
      let ref = null;
      let fsSdk = null;
      try {
        const appSdk = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js");
        const authSdk = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js");
        fsSdk = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
        const app = appSdk.getApps().find(x => x.name === APP_NAME) || appSdk.initializeApp(firebaseConfig, APP_NAME);
        const auth = authSdk.getAuth(app);
        let user = auth.currentUser;
        if (!user) user = (await authSdk.signInAnonymously(auth))?.user || auth.currentUser;
        if (!user) throw new Error("Anonymous Firebase sign-in returned no user");

        const db = fsSdk.getFirestore(app);
        const id = `probe-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        ref = fsSdk.doc(db, "sync_diagnostics", id);

        await fsSdk.setDoc(ref, {
          kind:"temporary-sync-diagnostic",
          createdAt:Date.now(),
          anonymous:!!user.isAnonymous,
          stage:true,
          value:1
        });
        const first = await fsSdk.getDoc(ref);
        if (!first.exists() || Number(first.data()?.value) !== 1) throw new Error("Diagnostic write verification failed");

        await fsSdk.runTransaction(db, async tx => {
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error("Diagnostic transaction could not read its document");
          tx.update(ref, { value:2, transactionAt:Date.now() });
        });
        const second = await fsSdk.getDoc(ref);
        if (!second.exists() || Number(second.data()?.value) !== 2) throw new Error("Diagnostic transaction verification failed");

        await fsSdk.deleteDoc(ref);
        const gone = await fsSdk.getDoc(ref);
        if (gone.exists()) throw new Error("Diagnostic cleanup verification failed");

        return {
          ok:true,
          anonymous:!!user.isAnonymous,
          uidPresent:!!String(user.uid || ""),
          normalWrite:true,
          transactionWrite:true,
          delete:true,
          cleanedUp:true,
          elapsedMs:Date.now()-started
        };
      } catch (error) {
        const failure = text(error);
        // Best-effort cleanup if the test failed after creating the temporary doc.
        if (ref && fsSdk) {
          try { await fsSdk.deleteDoc(ref); } catch {}
        }
        return {
          ok:false,
          ...failure,
          elapsedMs:Date.now()-started
        };
      }
    })().finally(() => { running = null; });
    return running;
  }

  window.StagingLiveFirebaseWriteProbeV1 = { version:1, run };
  console.log("🔬 STAGING temporary Firebase write diagnostic ready — runs only after explicit user click");
})();
