(() => {
  "use strict";
  if (window.__birdPhotoFallbackV3) return;
  window.__birdPhotoFallbackV3 = true;

  const CACHE = "chickenEggLocalBirdPhotosV1";
  const META = "chickenEggBirdPhotoMetaV3";
  const QUEUE = "chickenEggBirdPhotoQueueV3";
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
    catch (error) { console.warn("Photo fallback storage write failed:", error); return false; }
  };
  const fieldKey = id => "p_" + String(id || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
  const photoCache = () => {
    const x = read(CACHE, {});
    return x && typeof x === "object" ? x : {};
  };
  const photoMeta = () => {
    const x = read(META, {});
    return x && typeof x === "object" ? x : {};
  };

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

  function cleanMetadataOnlyState() {
    const c = photoCache();
    const m = photoMeta();
    let metaChanged = false;
    for (const [id, info] of Object.entries(m)) {
      const hasPhoto = typeof c[id] === "string" && c[id].length > 0;
      if (!info?.deleted && !hasPhoto) {
        delete m[id];
        metaChanged = true;
      }
    }
    if (metaChanged) write(META, m);

    const q = read(QUEUE, {});
    let queueChanged = false;
    for (const [id, info] of Object.entries(q || {})) {
      const hasPhoto = typeof c[id] === "string" && c[id].length > 0;
      if (!info?.deleted && !hasPhoto) {
        delete q[id];
        queueChanged = true;
      }
    }
    if (queueChanged) write(QUEUE, q);
  }

  function localRecord(id) {
    id = String(id || "");
    const m = photoMeta()[id] || {};
    const src = photoCache()[id] || "";
    if (m.deleted) {
      return {
        birdId:id,
        dataUrl:"",
        deleted:true,
        updatedAt:Number(m.updatedAt) || Date.now(),
        sourceRank:Number(m.sourceRank) || 3
      };
    }
    if (!src) return null;
    return {
      birdId:id,
      dataUrl:src,
      deleted:false,
      updatedAt:Number(m.updatedAt) || 1,
      sourceRank:Number(m.sourceRank) || 3
    };
  }

  function applyRemote(record) {
    const id = String(record?.birdId || "");
    if (!id) return false;
    const remoteTime = Number(record.updatedAt) || 0;
    if (!remoteTime) return false;

    const c = photoCache();
    const m = photoMeta();
    const localInfo = m[id] || {};
    const localTime = Number(localInfo.updatedAt) || 0;
    const localSrc = typeof c[id] === "string" ? c[id] : "";
    const remoteSrc = typeof record.dataUrl === "string" ? record.dataUrl : "";
    const remoteHasPhoto = !record.deleted && !!remoteSrc;

    if (remoteHasPhoto) {
      if (localInfo.deleted && localTime > remoteTime) return false;
      if (localSrc && localTime > remoteTime) return false;
      c[id] = remoteSrc;
      m[id] = { updatedAt:remoteTime, deleted:false, sourceRank:Number(record.sourceRank) || 3 };
    } else if (record.deleted) {
      if (localTime > remoteTime) return false;
      delete c[id];
      m[id] = { updatedAt:remoteTime, deleted:true, sourceRank:Number(record.sourceRank) || 3 };
    } else {
      return false;
    }

    applyingRemote = true;
    const ok1 = write(CACHE, c);
    const ok2 = write(META, m);
    applyingRemote = false;
    if (!ok1 || !ok2) return false;

    remoteTimes.set(id, Math.max(remoteTimes.get(id) || 0, remoteTime));
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail:{ birdId:id, deleted:!!record.deleted, fallback:true } }));
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ key:"chickenEggApp2V1", photoOnly:true } }));
    return true;
  }

  async function mirror(id, showSuccess = false) {
    id = String(id || "");
    if (!id) return false;
    const record = localRecord(id);
    if (!record) return false;
    if ((remoteTimes.get(id) || 0) >= record.updatedAt) return true;

    const f = await firebaseApi();
    if (!f) return false;
    const ref = f.doc(window.FirestoreDB, "entries", DOC);
    const key = fieldKey(id);
    try {
      const snap = await f.getDoc(ref);
      const old = snap.exists() ? snap.data()?.[FIELD]?.[key] : null;
      const oldValid = !!old && (!!old.deleted || (typeof old.dataUrl === "string" && old.dataUrl.length > 0));
      if (oldValid && Number(old.updatedAt) >= record.updatedAt) {
        applyRemote(old);
        return true;
      }

      if (snap.exists()) await f.updateDoc(ref, { [`${FIELD}.${key}`]:record });
      else await f.setDoc(ref, { [FIELD]:{ [key]:record } }, { merge:true });

      const verify = await f.getDoc(ref);
      const saved = verify.exists() ? verify.data()?.[FIELD]?.[key] : null;
      if (!saved || Number(saved.updatedAt) !== record.updatedAt || String(saved.birdId || "") !== id) {
        throw new Error("Fallback photo verification failed");
      }
      if (!record.deleted && saved.dataUrl !== record.dataUrl) throw new Error("Fallback photo payload verification failed");

      remoteTimes.set(id, record.updatedAt);
      if (showSuccess) status("Photo saved and synced.", "success");
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
    timers.set(id, setTimeout(async () => {
      timers.delete(id);
      const ok = await mirror(id, true);
      if (!ok) status("Photo is saved on this device but is still waiting to sync.", "warning");
    }, 120));
  }

  async function startListener() {
    const f = await firebaseApi();
    if (!f) return false;
    const ref = f.doc(window.FirestoreDB, "entries", DOC);
    unsubscribe?.();
    return new Promise(resolve => {
      let first = true;
      unsubscribe = f.onSnapshot(ref, snap => {
        const map = snap.exists() && snap.data()?.[FIELD] && typeof snap.data()[FIELD] === "object" ? snap.data()[FIELD] : {};
        for (const record of Object.values(map)) applyRemote(record);
        if (first) { first = false; resolve(true); }
      }, error => {
        console.warn("Fallback photo listener failed:", error);
        if (first) { first = false; resolve(false); }
      });
    });
  }

  async function seed() {
    const c = photoCache();
    const m = photoMeta();
    const ids = new Set(Object.keys(c));
    for (const [id, info] of Object.entries(m)) if (info?.deleted) ids.add(id);
    for (const id of ids) await mirror(id, false);
  }

  async function init() {
    try { await window.FarmBirdPhotosV3?.ready?.(); } catch {}
    cleanMetadataOnlyState();
    try { await window.FarmBirdPhotosV3?.flush?.(); } catch {}
    await startListener();
    await seed();
    window.addEventListener("bird-photos-changed", e => {
      if (!e.detail?.fallback && e.detail?.birdId) scheduleMirror(e.detail.birdId);
    });
    window.addEventListener("online", async () => {
      cleanMetadataOnlyState();
      await startListener();
      await seed();
    });
    console.log("✅ Flock photo Firebase fallback v3 active");
  }

  init();
})();
