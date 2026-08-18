import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

if (!window.__ChickenEggsStagingFirebase) {
  window.__ChickenEggsStagingFirebase = true;
  window.__STAGING_FIREBASE_READONLY__ = true;

  const firebaseConfig = {
    apiKey: "AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
    authDomain: "chicken-eggs-53358.firebaseapp.com",
    projectId: "chicken-eggs-53358",
    storageBucket: "chicken-eggs-53358.firebasestorage.app",
    messagingSenderId: "461720066101",
    appId: "1:461720066101:web:6b19a7c4d245f399cf797c"
  };

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  const SEED_META = "chickenEggStagingSeedV1";
  const APP2 = "chickenEggApp2V1";
  const INVENTORY = "chickenEggInventoryV2";
  const DELUXE = "chickenEggDeluxeV1";
  const BUSINESS = "chickenEggBusinessV1";
  const ENTRIES = "chickenEggEntriesV102";
  const SETTINGS = "chickenEggSettingsV102";
  const PHOTO_CACHE = "chickenEggLocalBirdPhotosV1";
  const PHOTO_META = "chickenEggBirdPhotoMetaV4";
  const PHOTO_TYPES = ["birdPhotoV2", "birdPhotoV3", "birdPhotoV4"];
  let readyState = false;
  let importPromise = null;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const setStatus = text => {
    try {
      if (typeof window.setSyncStatus === "function") window.setSyncStatus(text);
      else {
        const el = document.getElementById("syncStatus");
        if (el) el.textContent = text;
      }
    } catch {}
  };
  const isImage = v => typeof v === "string" && (v.startsWith("data:image/") || /^https?:\/\//i.test(v));

  async function ensureAuth() {
    if (auth.currentUser) return auth.currentUser;
    const result = await signInAnonymously(auth);
    return result?.user || auth.currentUser;
  }

  function betterPhoto(a, b) {
    if (!a) return b;
    if (!b) return a;
    const at = Number(a.updatedAt) || 0;
    const bt = Number(b.updatedAt) || 0;
    if (at !== bt) return bt > at ? b : a;
    const ar = a.deleted ? 1 : (isImage(a.dataUrl) ? 3 : 0);
    const br = b.deleted ? 1 : (isImage(b.dataUrl) ? 3 : 0);
    return br >= ar ? b : a;
  }

  async function importLive(force = false) {
    if (importPromise) return importPromise;
    if (!force && read(SEED_META, null)?.completed) {
      readyState = true;
      return true;
    }

    importPromise = (async () => {
      setStatus("STAGING • copying read-only live snapshot…");
      await ensureAuth();

      const [app2Snap, invSnap, deluxeSnap, businessSnap, settingsSnap, coreSnap, photoSnap] = await Promise.all([
        getDoc(doc(db, "entries", "farm_app_2_v1")),
        getDoc(doc(db, "entries", "farm_inventory_v2")),
        getDoc(doc(db, "entries", "farm_deluxe_v1")),
        getDoc(doc(db, "entries", "farm_business_v1")),
        getDoc(doc(db, "farm", "settings")),
        getDocs(query(collection(db, "entries"), where("type", "in", ["eggs", "sale"]))),
        getDocs(query(collection(db, "entries"), where("type", "in", PHOTO_TYPES)))
      ]);

      const app2 = app2Snap.exists() ? app2Snap.data()?.farmApp2 : null;
      const inventory = invSnap.exists() ? invSnap.data()?.inventory : null;
      const deluxeDoc = deluxeSnap.exists() ? deluxeSnap.data() : {};
      const deluxe = deluxeDoc?.deluxe || null;
      const business = businessSnap.exists() ? businessSnap.data()?.business : null;
      const settings = settingsSnap.exists() ? settingsSnap.data() : null;
      const entries = coreSnap.docs
        .map(d => ({ id:d.id, ...d.data() }))
        .filter(x => x && (x.type === "eggs" || x.type === "sale"));

      if (app2) write(APP2, app2);
      if (inventory) write(INVENTORY, inventory);
      if (deluxe) write(DELUXE, deluxe);
      if (business) write(BUSINESS, business);
      if (settings) write(SETTINGS, settings);
      write(ENTRIES, entries);

      const photos = new Map();
      const take = data => {
        const birdId = String(data?.birdId || "");
        if (!birdId) return;
        const record = {
          birdId,
          dataUrl: typeof data?.dataUrl === "string" ? data.dataUrl : "",
          deleted: !!data?.deleted,
          updatedAt: Number(data?.updatedAt) || 1,
          sourceRank: Number(data?.sourceRank) || 3
        };
        if (!record.deleted && !isImage(record.dataUrl)) return;
        photos.set(birdId, betterPhoto(photos.get(birdId), record));
      };
      for (const d of photoSnap.docs) take(d.data() || {});
      const fallback = deluxeDoc?.birdPhotosV3Fallback;
      if (fallback && typeof fallback === "object") {
        for (const data of Object.values(fallback)) take(data);
      }

      const cache = {};
      const meta = {};
      for (const [birdId, record] of photos) {
        if (!record.deleted && isImage(record.dataUrl)) cache[birdId] = record.dataUrl;
        meta[birdId] = {
          updatedAt: record.updatedAt,
          deleted: record.deleted,
          sourceRank: record.sourceRank,
          stagingSnapshot: true
        };
      }
      write(PHOTO_CACHE, cache);
      write(PHOTO_META, meta);
      write(SEED_META, {
        completed: true,
        importedAt: Date.now(),
        coreEntries: entries.length,
        photos: Object.keys(cache).length,
        source: "live Firebase read-only snapshot"
      });

      readyState = true;
      setStatus("STAGING • isolated sandbox ready");
      window.dispatchEvent(new CustomEvent("core-data-synced", { detail:{ staging:true, imported:true } }));
      window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ staging:true, imported:true } }));
      window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail:{ staging:true, imported:true } }));
      window.dispatchEvent(new CustomEvent("farm-sync-ready", { detail:{ staging:true } }));
      return true;
    })().catch(error => {
      console.error("STAGING live snapshot import failed; using isolated browser copy:", error);
      readyState = true;
      setStatus("STAGING • local sandbox ready (live refresh unavailable)");
      window.dispatchEvent(new CustomEvent("farm-sync-ready", { detail:{ staging:true, localOnly:true } }));
      return false;
    }).finally(() => { importPromise = null; });

    return importPromise;
  }

  async function localSync() {
    readyState = true;
    setStatus("STAGING • isolated sandbox saved");
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ staging:true, localOnly:true } }));
    return true;
  }

  window.FarmSyncSafety = {
    ready: () => importLive(false),
    isReady: () => readyState,
    refresh: localSync,
    getDirtyKeys: () => [],
    version: "STAGING-READONLY-1"
  };
  window.EggSyncAuthorityReady = () => importLive(false);
  window.syncFarmNow = localSync;
  window.refreshCoreFromFirebase = localSync;
  window.StagingSandbox = {
    environment: "staging",
    liveFirebaseAccess: "READ ONLY",
    resetFromLive: () => importLive(true),
    seedInfo: () => read(SEED_META, null)
  };

  // Deliberately DO NOT expose FirestoreDB/FirebaseUser. Any legacy module that
  // tries a direct cloud write therefore cannot reach the real database here.
  void importLive(false);
}
