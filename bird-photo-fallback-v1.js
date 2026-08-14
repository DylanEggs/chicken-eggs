(() => {
  "use strict";
  if (window.__birdPhotoFallbackV1) return;
  window.__birdPhotoFallbackV1 = true;

  const CACHE = "chickenEggLocalBirdPhotosV1";
  const META = "chickenEggBirdPhotoMetaV3";
  const DOC = "farm_deluxe_v1";
  const FIELD = "birdPhotosV3Fallback";
  const remoteTimes = new Map();
  const timers = new Map();
  let applyingRemote = false;
  let api = null;
  let unsubscribe = null;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { console.warn("Fallback photo cache write failed:", error); return false; }
  };
  const fieldKey = id => "p_" + String(id || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);

  function status(message, kind = "info") {
    window.dispatchEvent(new CustomEvent("bird-photo-status", { detail:{ message, kind } }));
  }

  async function firebaseApi() {
    if (api) return api;
    const start = Date.now();
    while (Date.now() - start < 15000) {
      if (window.FirestoreDB && window.FirebaseUser) break;
      await new Promise(r => setTimeout(r, 100));
    }
    if (!window.FirestoreDB || !window.FirebaseUser) return null;
    api = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return api;
  }

  function localRecord(id) {
    const m = read(META, {})[id] || {};
    const src = read(CACHE, {})[id] || "";
    return {
      birdId:String(id),
      dataUrl:m.deleted ? "" : src,
      deleted:!!m.deleted,
      updatedAt:Number(m.updatedAt) || 0,
      sourceRank:Number(m.sourceRank) || 3
    };
  }

  function applyRemote(record) {
    const id = String(record?.birdId || "");
    if (!id) return;
    const remoteTime = Number(record.updatedAt) || 0;
    remoteTimes.set(id, Math.max(remoteTimes.get(id)||0, remoteTime));
    const m = read(META, {});
    const localTime = Number(m[id]?.updatedAt) || 0;
    if (localTime > remoteTime) return;
    const c = read(CACHE, {});
    if (record.deleted || !record.dataUrl) delete c[id]; else c[id] = record.dataUrl;
    m[id] = { updatedAt:remoteTime, deleted:!!record.deleted, sourceRank:Number(record.sourceRank)||3 };
    applyingRemote = true;
    write(CACHE, c);
    write(META, m);
    applyingRemote = false;
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail:{ birdId:id, deleted:!!record.deleted, fallback:true } }));
  }

  async function mirror(id) {
    id = String(id || "");
    if (!id) return false;
    const record = localRecord(id);
    if (!record.updatedAt) return false;
    if ((remoteTimes.get(id)||0) >= record.updatedAt) return true;
    const f = await firebaseApi();
    if (!f) return false;
    const ref = f.doc(window.FirestoreDB, "entries", DOC);
    const key = fieldKey(id);
    try {
      const snap = await f.getDoc(ref);
      const old = snap.exists() ? snap.data()?.[FIELD]?.[key] : null;
      if (old && Number(old.updatedAt) > record.updatedAt) {
        applyRemote(old);
        return true;
      }
      await f.setDoc(ref, { [FIELD]:{ [key]:record } }, { merge:true });
      const verify = await f.getDoc(ref);
      const saved = verify.exists() ? verify.data()?.[FIELD]?.[key] : null;
      if (!saved || Number(saved.updatedAt) !== record.updatedAt || String(saved.birdId||"") !== id) throw new Error("Fallback verification failed");
      remoteTimes.set(id, record.updatedAt);
      status("Photo saved and synced.", "success");
      return true;
    } catch (error) {
      console.warn("Fallback photo sync failed:", error);
      return false;
    }
  }

  function scheduleMirror(id) {
    id = String(id || "");
    if (!id || applyingRemote) return;
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => {
      timers.delete(id);
      mirror(id);
    }, 120));
  }

  async function startListener() {
    const f = await firebaseApi();
    if (!f) return;
    const ref = f.doc(window.FirestoreDB, "entries", DOC);
    unsubscribe?.();
    unsubscribe = f.onSnapshot(ref, snap => {
      const map = snap.exists() && snap.data()?.[FIELD] && typeof snap.data()[FIELD] === "object" ? snap.data()[FIELD] : {};
      for (const record of Object.values(map)) applyRemote(record);
    }, error => console.warn("Fallback photo listener failed:", error));
  }

  async function seed() {
    const ids = new Set([...Object.keys(read(CACHE, {})), ...Object.keys(read(META, {}))]);
    for (const id of ids) await mirror(id);
  }

  async function init() {
    await startListener();
    await seed();
    window.addEventListener("bird-photos-changed", e => {
      if (!e.detail?.fallback && e.detail?.birdId) scheduleMirror(e.detail.birdId);
    });
    window.addEventListener("online", async () => { await startListener(); await seed(); });
    console.log("✅ Flock photo Firebase fallback active");
  }

  init();
})();