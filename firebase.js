import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
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
  { key: "chickenEggApp2V1", id: "farm_app_2_v1", field: "farmApp2", kind: "app2" },
  { key: "chickenEggInventoryV2", id: "farm_inventory_v2", field: "inventory", kind: "inventory" },
  { key: "chickenEggDeluxeV1", id: "farm_deluxe_v1", field: "deluxe", kind: "plain" }
];

let syncing = false;
let entryListenerStarted = false;

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); }
  catch { return null; }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function stamp(value) {
  return Number(value?.updatedAt) || 0;
}

function recTime(value) {
  return Number(value?.updatedAt || value?.createdAt || value?.completedAt || value?.at || 0);
}

function mergeArray(a, b) {
  const map = new Map();
  for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id || JSON.stringify(item));
    const old = map.get(id);
    if (!old || recTime(item) >= recTime(old)) map.set(id, item);
  }
  return [...map.values()].sort((x, y) => String(x.id || "").localeCompare(String(y.id || "")));
}

function mergeApp2(local = {}, remote = {}) {
  const newer = stamp(remote) > stamp(local) ? remote : local;
  const older = newer === remote ? local : remote;
  const out = { ...older, ...newer };
  ["customers", "orders", "expenses", "flock", "chores", "activity"].forEach(key => {
    out[key] = mergeArray(local?.[key], remote?.[key]);
  });
  out.saleMeta = { ...(local?.saleMeta || {}), ...(remote?.saleMeta || {}) };
  out.achievements = { ...(local?.achievements || {}), ...(remote?.achievements || {}) };
  out.goals = { ...(older?.goals || {}), ...(newer?.goals || {}) };
  out.preferences = { ...(older?.preferences || {}), ...(newer?.preferences || {}) };
  out.updatedAt = Math.max(stamp(local), stamp(remote));
  return out;
}

function mergeInventory(local = {}, remote = {}) {
  const newer = stamp(remote) > stamp(local) ? remote : local;
  return {
    ...(newer || {}),
    adjustments: mergeArray(local?.adjustments, remote?.adjustments),
    updatedAt: Math.max(stamp(local), stamp(remote))
  };
}

function mergeDataset(ds, local, remote) {
  if (ds.kind === "app2") return mergeApp2(local || {}, remote || {});
  if (ds.kind === "inventory") return mergeInventory(local || {}, remote || {});
  return stamp(remote) > stamp(local) ? remote : local;
}

function cleanForCompare(value) {
  if (Array.isArray(value)) return value.map(cleanForCompare);
  if (!value || typeof value !== "object") return value;
  const out = {};
  Object.keys(value).sort().forEach(key => {
    if (key === "updatedAt" || key === "serverUpdatedAt") return;
    out[key] = cleanForCompare(value[key]);
  });
  return out;
}

function sameContent(a, b) {
  try { return JSON.stringify(cleanForCompare(a)) === JSON.stringify(cleanForCompare(b)); }
  catch { return false; }
}

async function writeCloud(ds, value) {
  const version = Math.max(Date.now(), stamp(value));
  const payload = { ...value, updatedAt: version };
  await setDoc(doc(db, "entries", ds.id), {
    type: ds.kind,
    [ds.field]: payload,
    updatedAt: version,
    serverUpdatedAt: serverTimestamp()
  }, { merge: true });
  return payload;
}

async function syncDataset(ds) {
  const ref = doc(db, "entries", ds.id);
  const snap = await getDoc(ref);
  const local = readLocal(ds.key);
  const remote = snap.exists() ? (snap.data()?.[ds.field] || null) : null;

  if (!local && !remote) return;

  if (local && !remote) {
    const saved = await writeCloud(ds, local);
    if (stamp(saved) !== stamp(local)) writeLocal(ds.key, saved);
    return;
  }

  if (!local && remote) {
    writeLocal(ds.key, remote);
    return;
  }

  const merged = mergeDataset(ds, local, remote);
  const localNeedsUpdate = !sameContent(local, merged);
  const cloudNeedsUpdate = !sameContent(remote, merged);

  if (cloudNeedsUpdate) {
    const saved = await writeCloud(ds, merged);
    if (localNeedsUpdate) writeLocal(ds.key, saved);
    else if (stamp(saved) !== stamp(local)) writeLocal(ds.key, saved);
    return;
  }

  if (localNeedsUpdate) {
    const incoming = { ...merged, updatedAt: stamp(remote) || stamp(merged) };
    writeLocal(ds.key, incoming);
  }
}

async function syncAllFarmData() {
  if (syncing || !auth.currentUser) return;
  syncing = true;
  try {
    for (const ds of DATASETS) await syncDataset(ds);
  } catch (error) {
    console.warn("Farm cross-device sync error:", error);
  } finally {
    syncing = false;
  }
}

function startCoreEntryListener() {
  if (entryListenerStarted) return;
  entryListenerStarted = true;

  onSnapshot(collection(db, "entries"), snapshot => {
    const coreChanged = snapshot.docChanges().some(change => {
      const data = change.doc.data() || {};
      return data.type === "eggs" || data.type === "sale";
    });

    if (!coreChanged) return;

    const tryRefresh = () => {
      if (typeof window.cloudLoad === "function") {
        window.cloudLoad();
      } else {
        setTimeout(tryRefresh, 250);
      }
    };
    tryRefresh();
  }, error => {
    console.warn("Egg/sale change listener error:", error);
  });
}

onAuthStateChanged(auth, user => {
  if (!user) return;
  window.FirebaseUser = user;
  console.log("✅ Firebase signed in:", user.uid);
  setTimeout(syncAllFarmData, 1200);
  startCoreEntryListener();
});

signInAnonymously(auth).catch(error => {
  console.error("❌ Firebase anonymous sign-in failed:", error);
});

window.syncFarmNow = syncAllFarmData;
console.log("✅ Firebase initialized with change-driven sync only");
