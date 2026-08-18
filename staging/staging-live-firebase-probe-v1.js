(() => {
  "use strict";
  if (window.StagingLiveFirebaseProbeV1) return;
  if (!window.__ChickenEggsStagingMode) return;

  const APP_NAME = "chicken-eggs-staging-anon-read-probe";
  const firebaseConfig = {
    apiKey: "AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
    authDomain:"chicken-eggs-53358.firebaseapp.com",
    projectId:"chicken-eggs-53358",
    storageBucket:"chicken-eggs-53358.firebasestorage.app",
    messagingSenderId:"461720066101",
    appId:"1:461720066101:web:6b19a7c4d245f399cf797c"
  };

  let running = null;

  async function run() {
    if (running) return running;
    running = (async () => {
      const started = Date.now();
      try {
        const appSdk = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js");
        const authSdk = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js");
        const fsSdk = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
        const app = appSdk.getApps().find(x => x.name === APP_NAME) || appSdk.initializeApp(firebaseConfig, APP_NAME);
        const auth = authSdk.getAuth(app);
        let user = auth.currentUser;
        if (!user) user = (await authSdk.signInAnonymously(auth))?.user || auth.currentUser;
        if (!user) throw new Error("Anonymous Firebase sign-in returned no user");
        const db = fsSdk.getFirestore(app);

        // Read only. Never import or call a Firestore write API in this probe.
        const [inventorySnap, app2Snap] = await Promise.all([
          fsSdk.getDoc(fsSdk.doc(db, "entries", "farm_inventory_v2")),
          fsSdk.getDoc(fsSdk.doc(db, "entries", "farm_app_2_v1"))
        ]);

        return {
          ok: true,
          anonymous: !!user.isAnonymous,
          uidPresent: !!String(user.uid || ""),
          inventoryReadable: inventorySnap.exists(),
          app2Readable: app2Snap.exists(),
          elapsedMs: Date.now() - started
        };
      } catch (error) {
        return {
          ok: false,
          anonymous: false,
          code: String(error?.code || ""),
          message: String(error?.message || error || "Firebase probe failed"),
          elapsedMs: Date.now() - started
        };
      }
    })().finally(() => { running = null; });
    return running;
  }

  window.StagingLiveFirebaseProbeV1 = { version: 1, run };

  // Keep the isolated torture-test copy small enough that Chrome storage quota
  // does not hide the Firebase result behind copied full-resolution flock photos.
  // This loads only inside staging and never removes anything from the live app.
  try {
    const current = document.currentScript?.src || location.href;
    const trimUrl = new URL("staging-test-storage-trim-v1.js", current);
    if (!document.querySelector('script[data-staging-storage-trim="1"]')) {
      const script = document.createElement("script");
      script.src = trimUrl.href;
      script.dataset.stagingStorageTrim = "1";
      document.head.appendChild(script);
    }
  } catch (error) {
    console.warn("STAGING storage trim helper did not load:", error);
  }

  console.log("🧪 STAGING live Firebase anonymous read probe ready — read-only");
})();
