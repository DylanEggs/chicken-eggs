import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

if (!window.__farmSafeFirebaseV9) {
  window.__farmSafeFirebaseV9 = true;

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
  window.FirebaseApp = app;
  window.FirestoreDB = db;
  window.FirebaseAuth = auth;

  const DATASETS = [
    { key: "chickenEggApp2V1", id: "farm_app_2_v1", field: "farmApp2", kind: "app2" },
    { key: "chickenEggInventoryV2", id: "farm_inventory_v2", field: "inventory", kind: "inventory" },
    { key: "chickenEggDeluxeV1", id: "farm_deluxe_v1", field: "deluxe", kind: "deluxe" },
    { key: "chickenEggBusinessV1", id: "farm_business_v1", field: "business", kind: "business" }
  ];
  const CORE_ENTRIES_KEY = "chickenEggEntriesV102";
  const CORE_SETTINGS_KEY = "chickenEggSettingsV102";
  const SNAPSHOT_KEY = "chickenEggApp2SnapshotsV1";
  const LEGACY_APP2_DOC = "__farm_app_2__";
  const SAFETY_SLOTS = 5;

  let bootstrapComplete = false;
  let bootstrapPromise = null;
  let bootstrapAttempts = 0;
  let retryTimer = null;
  let listenerStarted = false;
  let settingsUnsub = null;
  let suppressLocalHook = false;
  let farmSyncing = false;
  let coreSyncing = false;
  let lastCloudRefresh = 0;
  let backupCursor = 0;

  const dirty = new Set();
  const timers = new Map();
  const baseline = new Map();
  const startupLocal = new Map(DATASETS.map(ds => [ds.key, readLocal(ds.key)]));
  const startupSnapshots = readLocal(SNAPSHOT_KEY) || [];

  function readLocal(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
  }
  function clone(v) {
    try { return v == null ? v : JSON.parse(JSON.stringify(v)); }
    catch { return v; }
  }
  function number(v) { return Number(v) || 0; }
  function clean(v) {
    if (Array.isArray(v)) return v.map(clean);
    if (!v || typeof v !== "object") return v;
    const out = {};
    Object.keys(v).sort().forEach(k => {
      if (k !== "updatedAt" && k !== "serverUpdatedAt") out[k] = clean(v[k]);
    });
    return out;
  }
  function same(a, b) {
    try { return JSON.stringify(clean(a)) === JSON.stringify(clean(b)); }
    catch { return false; }
  }
  function setStatus(text) {
    try {
      if (typeof window.setSyncStatus === "function") window.setSyncStatus(text);
      else {
        const el = document.getElementById("syncStatus");
        if (el) el.textContent = text;
      }
    } catch {}
  }
  function setLoading(on) {
    document.documentElement.classList.toggle("farm-sync-loading", !!on);
    let style = document.getElementById("farmSyncSafetyCss");
    if (!style) {
      style = document.createElement("style");
      style.id = "farmSyncSafetyCss";
      style.textContent = `.farm-sync-loading #syncStatus{opacity:.85}`;
      document.head.appendChild(style);
    }
  }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function rawSetItem(key, value) {
    const doWrite = () => localStorage.setItem(key, JSON.stringify(value));
    const pre = window.FarmBootstrapSafety;
    if (pre?.runBypass) pre.runBypass(doWrite);
    else doWrite();
  }
  function writeLocal(key, value, detail = {}) {
    suppressLocalHook = true;
    window.__farmApplyingRemote = true;
    try { rawSetItem(key, value); }
    finally {
      window.__farmApplyingRemote = false;
      suppressLocalHook = false;
    }
    window.dispatchEvent(new CustomEvent("farm-data-synced", {
      detail: { key, authoritative: true, ...detail }
    }));
  }

  function sanitizeApp2(x) {
    const a = x && typeof x === "object" ? clone(x) : {};
    return {
      ...a,
      customers: Array.isArray(a.customers) ? a.customers : [],
      orders: Array.isArray(a.orders) ? a.orders : [],
      expenses: Array.isArray(a.expenses) ? a.expenses : [],
      flock: Array.isArray(a.flock) ? a.flock : [],
      chores: Array.isArray(a.chores) ? a.chores : [],
      activity: Array.isArray(a.activity) ? a.activity : [],
      saleMeta: a.saleMeta && typeof a.saleMeta === "object" ? a.saleMeta : {},
      achievements: a.achievements && typeof a.achievements === "object" ? a.achievements : {},
      goals: a.goals && typeof a.goals === "object" ? a.goals : {},
      preferences: a.preferences && typeof a.preferences === "object" ? a.preferences : {}
    };
  }
  function itemId(item) {
    if (!item || typeof item !== "object") return "";
    return String(item.id || item.birdId || item.customerId || "");
  }
  function mapById(list) {
    const m = new Map();
    for (const item of Array.isArray(list) ? list : []) {
      const id = itemId(item);
      if (id) m.set(id, clone(item));
    }
    return m;
  }
  function applyArrayDelta(baseList, localList, remoteList) {
    const b = mapById(baseList), l = mapById(localList), r = mapById(remoteList);
    for (const [id, baseItem] of b) {
      if (!l.has(id)) r.delete(id);
      else if (!same(baseItem, l.get(id))) r.set(id, clone(l.get(id)));
    }
    for (const [id, localItem] of l) {
      if (!b.has(id)) r.set(id, clone(localItem));
    }
    return [...r.values()];
  }
  function applyMapDelta(baseObj, localObj, remoteObj) {
    const b = baseObj && typeof baseObj === "object" ? baseObj : {};
    const l = localObj && typeof localObj === "object" ? localObj : {};
    const r = { ...(remoteObj && typeof remoteObj === "object" ? clone(remoteObj) : {}) };
    for (const key of Object.keys(b)) {
      if (!(key in l)) delete r[key];
      else if (!same(b[key], l[key])) r[key] = clone(l[key]);
    }
    for (const key of Object.keys(l)) {
      if (!(key in b)) r[key] = clone(l[key]);
    }
    return r;
  }
  function applyScalarDelta(baseObj, localObj, remoteObj, skip = new Set()) {
    const b = baseObj && typeof baseObj === "object" ? baseObj : {};
    const l = localObj && typeof localObj === "object" ? localObj : {};
    const r = remoteObj && typeof remoteObj === "object" ? clone(remoteObj) : {};
    const keys = new Set([...Object.keys(b), ...Object.keys(l)]);
    for (const key of keys) {
      if (skip.has(key) || key === "updatedAt" || key === "serverUpdatedAt") continue;
      if (!(key in l) && key in b) delete r[key];
      else if (!(key in b) || !same(b[key], l[key])) r[key] = clone(l[key]);
    }
    return r;
  }
  function mergeDelta(ds, baseValue, localValue, remoteValue) {
    const base = baseValue && typeof baseValue === "object" ? clone(baseValue) : {};
    const local = localValue && typeof localValue === "object" ? clone(localValue) : {};
    const remote = remoteValue && typeof remoteValue === "object" ? clone(remoteValue) : {};
    let out;

    if (ds.kind === "app2") {
      const b = sanitizeApp2(base), l = sanitizeApp2(local), r = sanitizeApp2(remote);
      const arrays = ["customers", "orders", "expenses", "flock", "chores", "activity"];
      const maps = ["saleMeta", "achievements", "goals", "preferences"];
      out = applyScalarDelta(b, l, r, new Set([...arrays, ...maps]));
      arrays.forEach(k => { out[k] = applyArrayDelta(b[k], l[k], r[k]); });
      maps.forEach(k => { out[k] = applyMapDelta(b[k], l[k], r[k]); });
      delete out.goldenEggs;
      if (out.achievements) delete out.achievements.gold1;
      out.activity = (out.activity || [])
        .filter(x => !/golden egg/i.test(String(x?.text || "")))
        .slice(0, 100);
    } else if (ds.kind === "business") {
      out = applyScalarDelta(base, local, remote, new Set(["chickenSales", "calc"]));
      out.chickenSales = applyArrayDelta(base.chickenSales, local.chickenSales, remote.chickenSales);
      out.calc = applyMapDelta(base.calc, local.calc, remote.calc);
    } else if (ds.kind === "inventory") {
      out = applyScalarDelta(base, local, remote, new Set(["adjustments"]));
      out.adjustments = applyArrayDelta(base.adjustments, local.adjustments, remote.adjustments).slice(0, 100);
    } else if (ds.kind === "deluxe") {
      out = applyScalarDelta(base, local, remote, new Set(["weatherCache", "birdPhotoUrls"]));
      out.weatherCache = applyMapDelta(base.weatherCache, local.weatherCache, remote.weatherCache);
      out.birdPhotoUrls = applyMapDelta(base.birdPhotoUrls, local.birdPhotoUrls, remote.birdPhotoUrls);
    } else {
      out = applyScalarDelta(base, local, remote);
    }

    out.updatedAt = Date.now();
    return out;
  }

  function catastrophicDrop(ds, baseValue, localValue) {
    if (!baseValue || !localValue) return false;

    if (ds.kind === "app2") {
      const b = sanitizeApp2(baseValue), l = sanitizeApp2(localValue);
      const fields = ["flock", "expenses", "customers", "orders", "chores"];
      let severe = 0;
      for (const k of fields) {
        const before = b[k].length, after = l[k].length;
        if (before >= 3 && after === 0) severe++;
        else if (before >= 8 && after < before * 0.35) severe++;
      }
      if (b.flock.length >= 3 && l.flock.length === 0) return true;
      if (severe >= 2) return true;
    }

    if (ds.kind === "business") {
      const b = Array.isArray(baseValue.chickenSales) ? baseValue.chickenSales.length : 0;
      const l = Array.isArray(localValue.chickenSales) ? localValue.chickenSales.length : 0;
      if (b >= 4 && l === 0) return true;
    }

    if (ds.kind === "inventory") {
      const bAdj = Array.isArray(baseValue.adjustments) ? baseValue.adjustments.length : 0;
      const lAdj = Array.isArray(localValue.adjustments) ? localValue.adjustments.length : 0;
      const bTotal = number(baseValue.dozens) * 12 + number(baseValue.packs18) * 18 + number(baseValue.loose);
      const lTotal = number(localValue.dozens) * 12 + number(localValue.packs18) * 18 + number(localValue.loose);
      if (bAdj >= 4 && lAdj === 0 && bTotal > 0 && lTotal === 0) return true;
    }

    return false;
  }

  function app2Score(v) {
    const a = sanitizeApp2(v);
    return a.flock.length * 10
      + a.expenses.length * 5
      + a.customers.length * 4
      + a.orders.length * 3
      + a.chores.length * 2
      + Object.keys(a.saleMeta).length
      + Math.min(10, a.activity.length) * 0.2;
  }
  function mergeRecovery(remoteValue, candidateValue) {
    const r = sanitizeApp2(remoteValue), c = sanitizeApp2(candidateValue);
    const out = { ...c, ...r };
    ["customers", "orders", "expenses", "flock", "chores", "activity"].forEach(k => {
      const m = mapById(c[k]);
      for (const [id, item] of mapById(r[k])) m.set(id, item);
      out[k] = [...m.values()];
    });
    out.saleMeta = { ...c.saleMeta, ...r.saleMeta };
    out.achievements = { ...c.achievements, ...r.achievements };
    out.goals = { ...c.goals, ...r.goals };
    out.preferences = { ...c.preferences, ...r.preferences };
    delete out.goldenEggs;
    if (out.achievements) delete out.achievements.gold1;
    out.activity = (out.activity || [])
      .filter(x => !/golden egg/i.test(String(x?.text || "")))
      .slice(0, 100);
    out.updatedAt = Date.now();
    return out;
  }

  async function safetyCandidates() {
    const candidates = [];
    const local = startupLocal.get("chickenEggApp2V1");
    if (local) candidates.push({ source: "this phone before sync", value: local });

    for (const shot of Array.isArray(startupSnapshots) ? startupSnapshots : []) {
      if (shot?.farmApp2) {
        candidates.push({
          source: `local safety snapshot ${shot.date || ""}`.trim(),
          value: shot.farmApp2
        });
      }
    }

    const jobs = [
      withTimeout(getDoc(doc(db, "entries", LEGACY_APP2_DOC)), 4500, "legacy recovery read")
        .then(snap => snap.exists() && snap.data()?.farmApp2
          ? { source: "older Firebase Farm App 2 copy", value: snap.data().farmApp2 }
          : null)
        .catch(() => null)
    ];

    for (let i = 0; i < SAFETY_SLOTS; i++) {
      jobs.push(
        withTimeout(getDoc(doc(db, "entries", `farm_safety_app2_${i}`)), 4500, "safety backup read")
          .then(snap => snap.exists() && snap.data()?.farmApp2
            ? { source: `Firebase safety backup ${i + 1}`, value: snap.data().farmApp2 }
            : null)
          .catch(() => null)
      );
    }

    const cloudCandidates = await Promise.all(jobs);
    candidates.push(...cloudCandidates.filter(Boolean));
    return candidates;
  }

  async function maybeRecoverApp2(remoteValue) {
    const remote = sanitizeApp2(remoteValue);
    const startup = sanitizeApp2(startupLocal.get("chickenEggApp2V1") || {});
    const rs = app2Score(remote);
    const ss = app2Score(startup);

    const suspicious =
      rs < 10 ||
      (remote.flock.length === 0 && startup.flock.length >= 3) ||
      (remote.expenses.length === 0 && startup.expenses.length >= 2 && ss >= rs + 10) ||
      (rs > 0 && ss >= Math.max(rs + 20, rs * 2.25));

    if (!suspicious) return null;

    const candidates = await safetyCandidates();
    if (!candidates.length) return null;

    candidates.sort((a, b) => app2Score(b.value) - app2Score(a.value));
    const best = candidates[0];
    const bs = app2Score(best.value);
    const bestA = sanitizeApp2(best.value);
    const catastrophic =
      (remote.flock.length === 0 && bestA.flock.length >= 3) ||
      (remote.expenses.length === 0 && bestA.expenses.length >= 2 && bs >= rs + 10) ||
      (rs === 0 && bs >= 15) ||
      (rs > 0 && bs >= Math.max(rs + 20, rs * 2.25));

    if (!catastrophic || bs <= rs) return null;

    const merged = mergeRecovery(remote, best.value);
    console.warn(`🛟 Farm recovery candidate selected: ${best.source}`);
    return { value: merged, source: best.source };
  }

  async function backupRemote(ds, remoteValue) {
    if (!remoteValue || typeof remoteValue !== "object") return;
    if (!["app2", "inventory", "business"].includes(ds.kind)) return;

    const slot = backupCursor++ % SAFETY_SLOTS;
    try {
      await setDoc(doc(db, "entries", `farm_safety_${ds.kind}_${slot}`), {
        type: "farmSafetyBackup",
        dataset: ds.id,
        [ds.field]: remoteValue,
        sourceUpdatedAt: number(remoteValue.updatedAt),
        backedUpAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Safety backup skipped:", ds.kind, e);
    }
  }

  async function readRemote(ds) {
    const snap = await withTimeout(
      getDoc(doc(db, "entries", ds.id)),
      12000,
      `${ds.kind} cloud read`
    );
    return snap.exists() ? (snap.data()?.[ds.field] || null) : null;
  }

  async function pullInitial(ds) {
    const remote = await readRemote(ds);
    if (remote) {
      writeLocal(ds.key, remote, { startup: true });
      baseline.set(ds.key, clone(remote));
    } else {
      baseline.set(ds.key, clone(startupLocal.get(ds.key) || null));
    }
    return remote;
  }

  async function pullCurrent(ds) {
    const remote = await readRemote(ds);
    if (!remote) return null;
    if (dirty.has(ds.key)) return pushDataset(ds);
    writeLocal(ds.key, remote, { pull: true });
    baseline.set(ds.key, clone(remote));
    return remote;
  }

  async function restoreAfterBlockedWrite(ds, fallbackRemote) {
    const restore = fallbackRemote || baseline.get(ds.key) || null;
    if (restore && typeof restore === "object") {
      writeLocal(ds.key, restore, { protected: true });
      baseline.set(ds.key, clone(restore));
    }
    dirty.delete(ds.key);
    setStatus("Protected farm data from a stale-device overwrite");
    window.dispatchEvent(new CustomEvent("farm-sync-protected", {
      detail: { dataset: ds.kind }
    }));
  }

  async function pushDataset(ds, options = {}) {
    if (!bootstrapComplete && !options.recovery) return false;

    const local = readLocal(ds.key);
    if (!local || typeof local !== "object") return false;

    const base = baseline.get(ds.key) || {};
    let remoteUsed = null;
    let payload = null;
    let blocked = false;

    try {
      await runTransaction(db, async tx => {
        const ref = doc(db, "entries", ds.id);
        const snap = await tx.get(ref);
        const remote = snap.exists() ? (snap.data()?.[ds.field] || null) : null;
        remoteUsed = clone(remote || {});

        if (!options.recovery && catastrophicDrop(ds, base, local)) {
          blocked = true;
          throw new Error("__FARM_STALE_WRITE_BLOCKED__");
        }

        payload = options.recovery
          ? clone(local)
          : mergeDelta(ds, base, local, remote || base);

        const version = Date.now();
        payload.updatedAt = version;
        tx.set(ref, {
          type: ds.kind,
          [ds.field]: payload,
          updatedAt: version,
          serverUpdatedAt: serverTimestamp()
        }, { merge: true });
      });
    } catch (e) {
      if (blocked || String(e?.message || "").includes("__FARM_STALE_WRITE_BLOCKED__")) {
        console.error(`🛡️ Blocked destructive stale-device write for ${ds.kind}`);
        await restoreAfterBlockedWrite(ds, remoteUsed);
        return false;
      }
      throw e;
    }

    if (remoteUsed && Object.keys(remoteUsed).length && !same(remoteUsed, payload)) {
      void backupRemote(ds, remoteUsed);
    }

    const verify = await readRemote(ds);
    if (!verify) throw new Error(`${ds.kind} Firebase verification failed`);

    writeLocal(ds.key, verify, { saved: true, recovery: !!options.recovery });
    baseline.set(ds.key, clone(verify));
    dirty.delete(ds.key);
    setStatus("Saved to Firebase " + new Date().toLocaleTimeString());
    return true;
  }

  async function syncDataset(ds) {
    if (!bootstrapComplete) return safeReady();
    return dirty.has(ds.key) ? pushDataset(ds) : pullCurrent(ds);
  }

  async function syncAllFarmData() {
    if (farmSyncing) return;
    await safeReady();
    farmSyncing = true;
    try {
      for (const ds of DATASETS) await syncDataset(ds);
      lastCloudRefresh = Date.now();
      if (!dirty.size) setStatus("Firebase synced " + new Date().toLocaleTimeString());
    } catch (e) {
      console.warn("Safe farm sync error:", e);
      setStatus("Saved on this device — waiting for Firebase");
      throw e;
    } finally {
      farmSyncing = false;
    }
  }

  function scheduleDatasetSync(ds, delay = 300) {
    if (!bootstrapComplete) return;
    clearTimeout(timers.get(ds.key));
    timers.set(ds.key, setTimeout(async () => {
      timers.delete(ds.key);
      try {
        await pushDataset(ds);
      } catch (e) {
        console.warn(`${ds.kind} safe sync waiting:`, e);
        setStatus("Saved on this device — waiting for Firebase");
      }
    }, delay));
  }

  const previousSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    previousSetItem.call(this, key, value);

    if (suppressLocalHook || this !== window.localStorage) return;
    const ds = DATASETS.find(x => x.key === String(key));
    if (!ds) return;

    if (!bootstrapComplete) {
      console.log(`🔒 Ignored pre-bootstrap ${ds.kind} write; Firebase gets first authority`);
      return;
    }

    dirty.add(ds.key);
    window.dispatchEvent(new CustomEvent("farm-local-data-changed", {
      detail: { key: ds.key }
    }));
    scheduleDatasetSync(ds);
  };

  async function waitForDatabaseLayer(timeoutMs = 5000) {
    const start = Date.now();
    while (!window.ChickenEggsDB && Date.now() - start < timeoutMs) await wait(50);
    return !!window.ChickenEggsDB;
  }

  async function loadCoreFromCloud({ quiet = false } = {}) {
    if (coreSyncing) return false;
    if (!(await waitForDatabaseLayer())) return false;

    coreSyncing = true;
    try {
      const [settings, allRows] = await withTimeout(Promise.all([
        window.ChickenEggsDB.loadFarmSettings(),
        window.ChickenEggsDB.loadEntries()
      ]), 15000, "egg history refresh");

      const rows = (Array.isArray(allRows) ? allRows : [])
        .filter(r => r && (r.type === "eggs" || r.type === "sale"));

      const pre = window.FarmBootstrapSafety;
      const write = () => {
        localStorage.setItem(CORE_ENTRIES_KEY, JSON.stringify(rows));
        if (settings) localStorage.setItem(CORE_SETTINGS_KEY, JSON.stringify(settings));
      };
      if (pre?.runBypass) pre.runBypass(write);
      else write();

      if (typeof window.loadLocal === "function") window.loadLocal();
      if (typeof window.loadFarmSettings === "function") window.loadFarmSettings();
      if (typeof window.updateApp === "function") window.updateApp();
      window.dispatchEvent(new CustomEvent("core-data-synced"));
      return true;
    } catch (e) {
      console.warn("Core Firebase refresh failed:", e);
      if (!quiet && bootstrapComplete) setStatus("Farm synced; egg history refresh pending");
      return false;
    } finally {
      coreSyncing = false;
    }
  }

  function installCoreAuthority() {
    if (typeof window.cloudLoad === "function") window.cloudLoad = () => loadCoreFromCloud();
    if (typeof window.startEntryListener === "function") window.startEntryListener = async () => null;
    if (window.ChickenEggsDB?.subscribeEntries) {
      window.ChickenEggsDB.subscribeEntries = async () => () => {};
    }
  }

  function applySettings(settings) {
    if (!settings || typeof settings !== "object") return;
    const pre = window.FarmBootstrapSafety;
    const write = () => localStorage.setItem(CORE_SETTINGS_KEY, JSON.stringify(settings));
    if (pre?.runBypass) pre.runBypass(write);
    else write();

    if (typeof window.loadLocal === "function") window.loadLocal();
    if (typeof window.loadFarmSettings === "function") window.loadFarmSettings();
    if (typeof window.updateApp === "function") window.updateApp();
    window.dispatchEvent(new CustomEvent("core-data-synced", {
      detail: { settingsOnly: true }
    }));
  }

  function startListeners() {
    if (listenerStarted) return;
    listenerStarted = true;

    onSnapshot(collection(db, "entries"), snap => {
      const changes = snap.docChanges();

      if (changes.some(c => {
        const d = c.doc.data() || {};
        return d.type === "eggs" || d.type === "sale";
      })) {
        void loadCoreFromCloud({ quiet: true });
      }

      for (const change of changes) {
        const ds = DATASETS.find(x => x.id === change.doc.id);
        if (!ds || change.type === "removed") continue;
        const remote = change.doc.data()?.[ds.field] || null;
        if (!remote) continue;

        if (dirty.has(ds.key)) {
          scheduleDatasetSync(ds, 100);
        } else {
          writeLocal(ds.key, remote, { live: true });
          baseline.set(ds.key, clone(remote));
        }
      }
    }, e => {
      console.warn("Firebase change listener error:", e);
      setStatus("Live sync paused — changes will retry");
    });

    settingsUnsub?.();
    settingsUnsub = onSnapshot(doc(db, "farm", "settings"), snap => {
      if (snap.exists()) applySettings(snap.data());
    }, e => console.warn("Farm settings listener failed:", e));
  }

  async function ensureAuth() {
    if (auth.currentUser) return auth.currentUser;
    const result = await withTimeout(signInAnonymously(auth), 12000, "Firebase sign-in");
    if (!result?.user && !auth.currentUser) throw new Error("Firebase sign-in did not finish");
    return result?.user || auth.currentUser;
  }

  function scheduleBootstrapRetry() {
    clearTimeout(retryTimer);
    if (bootstrapComplete || !navigator.onLine) return;
    bootstrapAttempts += 1;
    const delay = Math.min(15000, 1500 * Math.pow(2, Math.min(bootstrapAttempts - 1, 3)));
    retryTimer = setTimeout(() => {
      if (!bootstrapComplete && navigator.onLine) {
        void bootstrap().catch(() => {});
      }
    }, delay);
  }

  async function bootstrap() {
    if (bootstrapComplete) return true;
    if (bootstrapPromise) return bootstrapPromise;

    bootstrapPromise = (async () => {
      setLoading(true);
      setStatus("Loading farm safely from Firebase...");

      const user = await ensureAuth();
      window.FirebaseUser = user;
      installCoreAuthority();

      let remoteApp2 = null;
      for (const ds of DATASETS) {
        const remote = await pullInitial(ds);
        if (ds.kind === "app2") remoteApp2 = remote;
      }

      const recovery = await maybeRecoverApp2(remoteApp2 || {});
      if (recovery) {
        writeLocal("chickenEggApp2V1", recovery.value, {
          recovered: true,
          source: recovery.source
        });
        baseline.set("chickenEggApp2V1", clone(remoteApp2 || {}));
        dirty.add("chickenEggApp2V1");
      }

      const coreLoaded = await loadCoreFromCloud({ quiet: true });

      bootstrapComplete = true;
      bootstrapAttempts = 0;
      clearTimeout(retryTimer);
      window.FarmBootstrapSafety?.unlock?.();
      startListeners();

      if (recovery) {
        const app2ds = DATASETS.find(x => x.kind === "app2");
        await pushDataset(app2ds, { recovery: true });
        setStatus(`Recovered farm data from ${recovery.source}`);
        window.dispatchEvent(new CustomEvent("farm-data-recovered", {
          detail: { source: recovery.source }
        }));
      } else {
        setStatus((coreLoaded ? "Firebase synced " : "Farm synced; egg history refresh pending • ")
          + new Date().toLocaleTimeString());
      }

      lastCloudRefresh = Date.now();
      setLoading(false);
      window.dispatchEvent(new CustomEvent("farm-sync-ready"));
      console.log("✅ Safe Firebase v9 ready — transactional multi-device sync active");
      return true;
    })();

    try {
      return await bootstrapPromise;
    } catch (err) {
      console.error("Safe Firebase v9 bootstrap failed:", err);
      setLoading(false);
      setStatus(navigator.onLine
        ? "Firebase sync paused — retrying safely; changes are not lost"
        : "Offline — viewing is safe; cloud changes wait for internet");
      scheduleBootstrapRetry();
      throw err;
    } finally {
      if (!bootstrapComplete) bootstrapPromise = null;
    }
  }

  function safeReady() { return bootstrap(); }

  window.FarmSyncSafety = {
    ready: safeReady,
    isReady: () => bootstrapComplete,
    refresh: syncAllFarmData,
    getDirtyKeys: () => [...dirty],
    version: "9"
  };
  window.EggSyncAuthorityReady = safeReady;
  window.syncFarmNow = syncAllFarmData;
  window.refreshCoreFromFirebase = async () => {
    await safeReady();
    return loadCoreFromCloud();
  };

  onAuthStateChanged(auth, user => {
    if (!user) return;
    window.FirebaseUser = user;
    if (!bootstrapComplete) void bootstrap().catch(() => {});
  });

  window.addEventListener("online", () => {
    if (!bootstrapComplete) {
      void bootstrap().catch(() => {});
      return;
    }
    void syncAllFarmData()
      .then(() => loadCoreFromCloud({ quiet: true }))
      .catch(() => {});
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (!bootstrapComplete) {
      void bootstrap().catch(() => {});
      return;
    }
    if (Date.now() - lastCloudRefresh > 15000) {
      void syncAllFarmData().catch(() => {});
    }
  });

  void bootstrap().catch(() => {});

  import("./farm-consistency-v2.js?v=7")
    .then(() => import("./app-audit-v1.js?v=3"))
    .then(() => import("./audit-finish-v1.js?v=3"))
    .catch(e => console.warn("Farm audit layer failed to load:", e));
  import("./dom-loop-guard-v3.js?v=3")
    .catch(e => console.warn("Current redraw guard failed to load:", e));
  import("./flock-photo-fix-v2.js?v=6")
    .catch(e => console.warn("Shared flock photo system failed to load:", e));

  console.log("✅ Firebase v9 initialized in protected cloud-first mode");
}
