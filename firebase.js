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
let suppressLocalHook = false;
const datasetTimers = new Map();

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); }
  catch { return null; }
}

function writeLocal(key, value) {
  suppressLocalHook = true;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } finally {
    suppressLocalHook = false;
  }
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

function mergeRecordMap(localObj = {}, remoteObj = {}, preferRemote = false) {
  const out = {};
  const keys = new Set([...Object.keys(localObj || {}), ...Object.keys(remoteObj || {})]);

  for (const key of keys) {
    const local = localObj?.[key];
    const remote = remoteObj?.[key];

    if (local === undefined) { out[key] = remote; continue; }
    if (remote === undefined) { out[key] = local; continue; }

    const lt = recTime(local);
    const rt = recTime(remote);
    if (lt > rt) out[key] = local;
    else if (rt > lt) out[key] = remote;
    else out[key] = preferRemote ? remote : local;
  }

  return out;
}

function mergeApp2(local = {}, remote = {}) {
  const remoteIsNewer = stamp(remote) > stamp(local);
  const newer = remoteIsNewer ? remote : local;
  const older = remoteIsNewer ? local : remote;
  const out = { ...older, ...newer };

  ["customers", "orders", "expenses", "flock", "chores", "activity"].forEach(key => {
    out[key] = mergeArray(local?.[key], remote?.[key]);
  });

  out.saleMeta = mergeRecordMap(local?.saleMeta || {}, remote?.saleMeta || {}, remoteIsNewer);
  out.achievements = mergeRecordMap(local?.achievements || {}, remote?.achievements || {}, remoteIsNewer);
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
    if (localNeedsUpdate || stamp(saved) !== stamp(local)) writeLocal(ds.key, saved);
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

function scheduleDatasetSync(ds) {
  clearTimeout(datasetTimers.get(ds.key));
  const timer = setTimeout(async () => {
    datasetTimers.delete(ds.key);
    if (!auth.currentUser) return;
    try {
      await syncDataset(ds);
      console.log(`✅ ${ds.kind} change synced to Firebase`);
    } catch (error) {
      console.warn(`${ds.kind} immediate sync error:`, error);
    }
  }, 300);
  datasetTimers.set(ds.key, timer);
}

const nativeSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function(key, value) {
  nativeSetItem.call(this, key, value);

  if (suppressLocalHook || this !== window.localStorage) return;
  const ds = DATASETS.find(item => item.key === String(key));
  if (ds) scheduleDatasetSync(ds);
};

function startEntryListener() {
  if (entryListenerStarted) return;
  entryListenerStarted = true;
  let firstSnapshot = true;

  onSnapshot(collection(db, "entries"), snapshot => {
    const changes = snapshot.docChanges();

    const coreChanged = changes.some(change => {
      const data = change.doc.data() || {};
      return data.type === "eggs" || data.type === "sale";
    });

    if (coreChanged) {
      const tryRefresh = () => {
        if (typeof window.cloudLoad === "function") window.cloudLoad();
        else setTimeout(tryRefresh, 250);
      };
      tryRefresh();
    }

    if (!firstSnapshot) {
      for (const change of changes) {
        const ds = DATASETS.find(item => item.id === change.doc.id);
        if (ds) scheduleDatasetSync(ds);
      }
    }

    firstSnapshot = false;
  }, error => {
    console.warn("Firebase change listener error:", error);
  });
}

function calculatedCoreInventory() {
  try {
    const list = JSON.parse(localStorage.getItem("chickenEggEntriesV102") || "[]");
    let collected = 0;
    let sold = 0;
    for (const e of Array.isArray(list) ? list : []) {
      if (e?.type === "eggs") collected += Number(e.eggs) || 0;
      if (e?.type === "sale") sold += (Number(e.dozenSold) || 0) * 12 + (Number(e.packSold) || 0) * 18;
    }
    return Math.max(0, collected - sold);
  } catch {
    return 0;
  }
}

function applyMissingInventoryDelta(delta, reason) {
  delta = Math.round(Number(delta) || 0);
  if (!delta) return;

  if (delta > 0 && typeof window.inventoryAddEggs === "function") {
    const input = document.getElementById("inventoryAddQty");
    if (!input) return;
    const old = input.value;
    input.value = String(delta);
    window.inventoryAddEggs();
    input.value = old;
  } else if (delta < 0 && typeof window.inventoryRemove === "function") {
    const input = document.getElementById("inventoryAdjustQty");
    if (!input) return;
    const old = input.value;
    input.value = String(Math.abs(delta));
    window.inventoryRemove(reason || "Entry correction");
    input.value = old;
  }
}

function installInventoryCorrectionHooks() {
  if (window.__inventoryCorrectionHooksInstalled) return;
  if (typeof window.deleteEntry !== "function" || typeof window.saveEggs !== "function" || typeof window.saveSale !== "function") {
    setTimeout(installInventoryCorrectionHooks, 250);
    return;
  }

  window.__inventoryCorrectionHooksInstalled = true;

  const oldDelete = window.deleteEntry;
  window.deleteEntry = function() {
    const before = calculatedCoreInventory();
    const result = oldDelete.apply(this, arguments);
    const after = calculatedCoreInventory();
    applyMissingInventoryDelta(after - before, "Deleted entry correction");
    return result;
  };

  const oldEggs = window.saveEggs;
  window.saveEggs = function() {
    const before = calculatedCoreInventory();
    const result = oldEggs.apply(this, arguments);
    const after = calculatedCoreInventory();
    const delta = after - before;
    if (delta < 0) applyMissingInventoryDelta(delta, "Egg entry edit correction");
    return result;
  };

  const oldSale = window.saveSale;
  window.saveSale = function() {
    const before = calculatedCoreInventory();
    const result = oldSale.apply(this, arguments);
    const after = calculatedCoreInventory();
    const delta = after - before;
    if (delta > 0) applyMissingInventoryDelta(delta, "Sale edit correction");
    return result;
  };

  console.log("✅ Inventory delete/edit corrections installed");
}

onAuthStateChanged(auth, user => {
  if (!user) return;
  window.FirebaseUser = user;
  console.log("✅ Firebase signed in:", user.uid);
  setTimeout(syncAllFarmData, 1200);
  startEntryListener();
  setTimeout(installInventoryCorrectionHooks, 500);
});

signInAnonymously(auth).catch(error => {
  console.error("❌ Firebase anonymous sign-in failed:", error);
});

window.syncFarmNow = syncAllFarmData;
import("./who-owes.js?v=1").catch(error => console.warn("Who Owes feature load failed:", error));
console.log("✅ Firebase initialized with save-on-change sync");
