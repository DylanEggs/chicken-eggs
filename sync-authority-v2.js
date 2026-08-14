(() => {
  "use strict";
  if (window.__eggSyncAuthorityV3) return;
  window.__eggSyncAuthorityV3 = true;
  window.__eggSyncAuthorityV2 = true;

  const APP2_KEY = "chickenEggApp2V1";
  const SETTINGS_KEY = "chickenEggSettingsV102";
  const APP2_DOC = "farm_app_2_v1";
  let api = null;
  let settingsUnsub = null;
  let initPromise = null;

  const read = (key, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const stamp = value => Number(value?.updatedAt) || 0;

  async function firebaseApi() {
    if (api) return api;
    const start = Date.now();
    while (Date.now() - start < 15000) {
      if (window.FirestoreDB && window.FirebaseUser) break;
      await new Promise(r => setTimeout(r, 75));
    }
    if (!window.FirestoreDB || !window.FirebaseUser) return null;
    api = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return api;
  }

  function applyApp2IfNewer(remote) {
    if (!remote || typeof remote !== "object") return false;
    const local = read(APP2_KEY, null);
    const localStamp = stamp(local);
    const remoteStamp = stamp(remote);
    if (local && localStamp > remoteStamp) return false;
    if (local && localStamp === remoteStamp) return true;

    try {
      localStorage.setItem(APP2_KEY, JSON.stringify(remote));
      window.dispatchEvent(new CustomEvent("farm-data-synced", {
        detail: { key: APP2_KEY, authoritative: true }
      }));
      return true;
    } catch (error) {
      console.warn("Authoritative App 2 apply failed:", error);
      return false;
    }
  }

  function applySettings(remote) {
    if (!remote || typeof remote !== "object") return false;
    const local = read(SETTINGS_KEY, null);
    if (local && stamp(local) > stamp(remote)) return false;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(remote));
      if (typeof window.loadLocal === "function") window.loadLocal();
      if (typeof window.loadFarmSettings === "function") window.loadFarmSettings();
      if (typeof window.updateApp === "function") window.updateApp();
      window.dispatchEvent(new CustomEvent("core-data-synced", { detail: { settingsOnly: true } }));
      return true;
    } catch (error) {
      console.warn("Farm settings live apply failed:", error);
      return false;
    }
  }

  async function bootstrapApp2() {
    const f = await firebaseApi();
    if (!f) return false;
    try {
      const snap = await f.getDoc(f.doc(window.FirestoreDB, "entries", APP2_DOC));
      const remote = snap.exists() ? snap.data()?.farmApp2 : null;
      if (remote) applyApp2IfNewer(remote);
      if (typeof window.syncFarmNow === "function") await window.syncFarmNow();
      return !!remote;
    } catch (error) {
      console.warn("Authoritative farm startup sync failed:", error);
      return false;
    }
  }

  async function startSettingsListener() {
    const f = await firebaseApi();
    if (!f) return false;
    settingsUnsub?.();
    settingsUnsub = f.onSnapshot(
      f.doc(window.FirestoreDB, "farm", "settings"),
      snap => { if (snap.exists()) applySettings(snap.data()); },
      error => console.warn("Farm settings listener failed:", error)
    );
    return true;
  }

  async function initWork() {
    await bootstrapApp2();
    await startSettingsListener();

    setTimeout(() => {
      bootstrapApp2();
      if (typeof window.refreshCoreFromFirebase === "function") window.refreshCoreFromFirebase();
    }, 1800);

    window.addEventListener("online", async () => {
      await bootstrapApp2();
      await startSettingsListener();
      if (typeof window.refreshCoreFromFirebase === "function") await window.refreshCoreFromFirebase();
    });

    console.log("✅ Firebase source-of-truth authority v3 active");
    return true;
  }

  function ready() {
    if (!initPromise) initPromise = initWork();
    return initPromise;
  }

  window.EggSyncAuthorityReady = ready;
  ready();
})();
