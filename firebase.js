import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
  authDomain: "chicken-eggs-53358.firebaseapp.com",
  projectId: "chicken-eggs-53358",
  storageBucket: "chicken-eggs-53358.firebasestorage.app",
  messagingSenderId: "461720066101",
  appId: "1:461720066101:web:6b19a7c4d245f399cf797c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.FirebaseApp = app;
window.FirestoreDB = db;
window.FirebaseAuth = auth;

const DATASETS = [
  { key: "chickenEggApp2V1", id: "farm_app_2_v1", field: "farmApp2", type: "app2" },
  { key: "chickenEggInventoryV2", id: "farm_inventory_v2", field: "inventory", type: "inventory2" },
  { key: "chickenEggDeluxeV1", id: "farm_deluxe_v1", field: "deluxe", type: "deluxe1" }
];

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); }
  catch { return null; }
}

function stamp(value) {
  return Number(value?.updatedAt) || 0;
}

function same(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); }
  catch { return false; }
}

function recordTime(x) {
  return Number(x?.updatedAt || x?.createdAt || x?.completedAt || x?.at || 0);
}

function mergeArray(local = [], remote = []) {
  const map = new Map();
  [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])].forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const id = String(item.id || `legacy-${index}-${JSON.stringify(item)}`);
    const old = map.get(id);
    if (!old || recordTime(item) >= recordTime(old)) map.set(id, item);
  });
  return [...map.values()];
}

function mergeApp2(local = {}, remote = {}) {
  const newer = stamp(remote) > stamp(local) ? remote : local;
  const older = newer === remote ? local : remote;
  const out = { ...older, ...newer };
  ["customers", "orders", "expenses", "flock", "chores", "activity"].forEach(k => {
    out[k] = mergeArray(local?.[k], remote?.[k]);
  });
  out.saleMeta = { ...(local?.saleMeta || {}), ...(remote?.saleMeta || {}) };
  out.achievements = { ...(local?.achievements || {}), ...(remote?.achievements || {}) };
  out.goals = { ...(older?.goals || {}), ...(newer?.goals || {}) };
  out.preferences = { ...(older?.preferences || {}), ...(newer?.preferences || {}) };
  out.updatedAt = Math.max(stamp(local), stamp(remote));
  return out;
}

function mergeDataset(ds, local, remote) {
  if (ds.key === "chickenEggApp2V1") return mergeApp2(local || {}, remote || {});
  return stamp(remote) > stamp(local) ? remote : local;
}

async function syncDataset(ds) {
  const ref = doc(db, "entries", ds.id);
  const snap = await getDoc(ref);
  const local = readLocal(ds.key);
  const remote = snap.exists() ? (snap.data()?.[ds.field] || null) : null;

  if (!local && !remote) return false;

  if (!remote && local) {
    await setDoc(ref, {
      type: ds.type,
      [ds.field]: local,
      updatedAt: stamp(local) || Date.now(),
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
    return false;
  }

  if (!local && remote) {
    localStorage.setItem(ds.key, JSON.stringify(remote));
    return true;
  }

  let merged = mergeDataset(ds, local, remote);
  if (!merged) return false;

  const localChanged = !same(local, merged);
  const remoteChanged = !same(remote, merged);

  if (remoteChanged) {
    const now = Date.now();
    merged = { ...merged, updatedAt: Math.max(now, stamp(merged)) };
    await setDoc(ref, {
      type: ds.type,
      [ds.field]: merged,
      updatedAt: merged.updatedAt,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  }

  if (localChanged || remoteChanged) {
    localStorage.setItem(ds.key, JSON.stringify(merged));
    return localChanged;
  }

  return false;
}

let syncing = false;
async function syncAllFarmData({ allowReload = false } = {}) {
  if (syncing || !auth.currentUser) return;
  syncing = true;
  try {
    let receivedCloudData = false;
    for (const ds of DATASETS) {
      if (await syncDataset(ds)) receivedCloudData = true;
    }

    if (receivedCloudData && allowReload) {
      const token = String(Date.now());
      sessionStorage.setItem("farmSyncReloadToken", token);
      setTimeout(() => location.reload(), 300);
    }
  } catch (error) {
    console.warn("Farm cloud sync error:", error);
  } finally {
    syncing = false;
  }
}

onAuthStateChanged(auth, user => {
  if (user) {
    window.FirebaseUser = user;
    console.log("✅ Firebase signed in:", user.uid);
    setTimeout(() => syncAllFarmData({ allowReload: true }), 1200);
    setInterval(() => syncAllFarmData({ allowReload: false }), 5000);
  }
});

signInAnonymously(auth).catch(error => {
  console.error("❌ Firebase anonymous sign-in failed:", error);
});

window.syncFarmNow = () => syncAllFarmData({ allowReload: true });
console.log("✅ Firebase initialized");
