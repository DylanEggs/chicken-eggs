(() => {
  "use strict";
  if (window.__birdPhotoServiceV2) return;
  window.__birdPhotoServiceV2 = true;

  const APP = "chickenEggApp2V1";
  const DELUXE = "chickenEggDeluxeV1";
  const LEGACY = "chickenEggLocalBirdPhotosV1";
  const META = "chickenEggBirdPhotoMetaV2";
  const QUEUE = "chickenEggBirdPhotoQueueV2";
  const TYPE = "birdPhotoV2";
  const listeners = new Set();
  let firestoreApi = null;
  let unsubscribe = null;
  let cloudReady = false;
  let flushRunning = false;
  let initialized = false;
  let initPromise = null;
  let legacyCandidates = {};

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const safeSet = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) {
      console.warn("Photo local storage write failed:", key, error);
      return false;
    }
  };
  const now = () => Date.now();
  const flockIds = () => new Set((read(APP, {}).flock || []).map(b => String(b.id || "")).filter(Boolean));
  const legacy = () => read(LEGACY, {});
  const meta = () => read(META, {});
  const queue = () => read(QUEUE, {});
  const isDataImage = value => typeof value === "string" && value.startsWith("data:image/");
  const docId = birdId => "bird_photo_v2_" + String(birdId || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);

  function notify(detail = {}) {
    listeners.forEach(fn => { try { fn(detail); } catch {} });
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail }));
  }

  function status(message, kind = "info") {
    window.dispatchEvent(new CustomEvent("bird-photo-status", { detail:{ message, kind } }));
  }

  function installDeluxeSanitizer() {
    if (window.__birdPhotoDeluxeSanitizerV2) return;
    window.__birdPhotoDeluxeSanitizerV2 = true;
    const previous = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === window.localStorage && String(key) === DELUXE) {
        try {
          const parsed = JSON.parse(String(value));
          if (parsed && parsed.birdPhotoUrls && typeof parsed.birdPhotoUrls === "object") {
            const kept = {};
            for (const [id, src] of Object.entries(parsed.birdPhotoUrls)) {
              if (typeof src === "string" && src && !src.startsWith("data:image/")) kept[id] = src;
            }
            parsed.birdPhotoUrls = kept;
            value = JSON.stringify(parsed);
          }
        } catch {}
      }
      return previous.call(this, key, value);
    };
  }

  function captureAndFreeLegacyDuplicates() {
    const local = legacy();
    const deluxe = read(DELUXE, {});
    const dPhotos = deluxe?.birdPhotoUrls && typeof deluxe.birdPhotoUrls === "object" ? deluxe.birdPhotoUrls : {};
    legacyCandidates = {};
    for (const id of new Set([...Object.keys(dPhotos), ...Object.keys(local)])) {
      const localSrc = local[id];
      const deluxeSrc = dPhotos[id];
      if (typeof localSrc === "string" && localSrc) legacyCandidates[id] = { src:localSrc, sourceRank:2 };
      else if (typeof deluxeSrc === "string" && deluxeSrc) legacyCandidates[id] = { src:deluxeSrc, sourceRank:1 };
    }

    if (Object.values(dPhotos).some(isDataImage)) {
      const cleaned = { ...deluxe, birdPhotoUrls:{}, updatedAt:now() };
      for (const [id, src] of Object.entries(dPhotos)) {
        if (typeof src === "string" && src && !isDataImage(src)) cleaned.birdPhotoUrls[id] = src;
      }
      safeSet(DELUXE, cleaned);
    }
  }

  function getPhoto(id) {
    const src = legacy()[String(id || "")];
    return typeof src === "string" ? src : "";
  }

  function setLocalRecord(id, src, record = {}) {
    id = String(id || "");
    if (!id) return false;
    const p = legacy();
    if (record.deleted || !src) delete p[id]; else p[id] = src;
    const m = meta();
    m[id] = {
      updatedAt:Number(record.updatedAt) || now(),
      deleted:!!record.deleted,
      sourceRank:Number(record.sourceRank) || 3
    };
    const ok1 = safeSet(LEGACY, p);
    const ok2 = safeSet(META, m);
    notify({ birdId:id, deleted:!!record.deleted });
    return ok1 && ok2;
  }

  function enqueue(id, src, record = {}) {
    const q = queue();
    q[id] = {
      birdId:id,
      dataUrl:record.deleted ? "" : (src || ""),
      deleted:!!record.deleted,
      updatedAt:Number(record.updatedAt) || now(),
      sourceRank:Number(record.sourceRank) || 3
    };
    return safeSet(QUEUE, q);
  }

  async function imageToJpeg(source, maxSize = 260, quality = 0.62) {
    return new Promise(resolve => {
      const img = new Image();
      let objectUrl = "";
      const finish = value => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(value || "");
      };
      img.onload = () => {
        try {
          const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          const sx = Math.max(0, (width - side) / 2);
          const sy = Math.max(0, (height - side) / 2);
          const canvas = document.createElement("canvas");
          canvas.width = maxSize;
          canvas.height = maxSize;
          const ctx = canvas.getContext("2d", { alpha:false });
          ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
          let out = canvas.toDataURL("image/jpeg", quality);
          if (out.length > 120000 && maxSize > 210) out = canvas.toDataURL("image/jpeg", 0.48);
          finish(out);
        } catch (error) {
          console.warn("Photo conversion failed:", error);
          finish("");
        }
      };
      img.onerror = () => finish("");
      try {
        if (source instanceof Blob) {
          objectUrl = URL.createObjectURL(source);
          img.src = objectUrl;
        } else img.src = String(source || "");
      } catch { finish(""); }
    });
  }

  async function prepareFile(file) {
    if (!file) return "";
    let out = await imageToJpeg(file, 260, 0.62);
    if (!out) {
      const raw = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(String(e.target?.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });
      if (raw) out = await imageToJpeg(raw, 240, 0.55);
    }
    return out;
  }

  async function normalizeLegacy(src) {
    if (!src || typeof src !== "string") return "";
    if (!isDataImage(src)) return src;
    const reduced = await imageToJpeg(src, 240, 0.56);
    return reduced || src;
  }

  async function waitForFirebase(timeoutMs = 12000) {
    const start = now();
    while (now() - start < timeoutMs) {
      if (window.FirestoreDB && window.FirebaseUser) return true;
      await new Promise(r => setTimeout(r, 120));
    }
    return false;
  }

  async function getFirestoreApi() {
    if (firestoreApi) return firestoreApi;
    const ready = await waitForFirebase();
    if (!ready) return null;
    firestoreApi = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return firestoreApi;
  }

  function applyRemote(data) {
    const id = String(data?.birdId || "");
    if (!id) return;
    const localMeta = meta()[id] || {};
    const remoteTime = Number(data.updatedAt) || 0;
    const localTime = Number(localMeta.updatedAt) || 0;
    const pending = queue()[id];
    if (pending && Number(pending.updatedAt) > remoteTime) return;
    if (localTime > remoteTime && localMeta.sourceRank >= 3) return;
    setLocalRecord(id, data.dataUrl || "", {
      updatedAt:remoteTime,
      deleted:!!data.deleted,
      sourceRank:Number(data.sourceRank) || 3
    });
  }

  async function startCloudListener() {
    const api = await getFirestoreApi();
    if (!api) return false;
    return new Promise(resolve => {
      try {
        const q = api.query(api.collection(window.FirestoreDB, "entries"), api.where("type", "==", TYPE));
        let first = true;
        unsubscribe?.();
        unsubscribe = api.onSnapshot(q, snap => {
          snap.docChanges().forEach(change => {
            if (change.type === "removed") return;
            applyRemote(change.doc.data() || {});
          });
          if (first) {
            first = false;
            cloudReady = true;
            resolve(true);
          }
        }, error => {
          console.warn("Bird photo listener failed:", error);
          cloudReady = false;
          resolve(false);
        });
      } catch (error) {
        console.warn("Bird photo listener setup failed:", error);
        resolve(false);
      }
    });
  }

  async function writeCloudRecord(record) {
    const api = await getFirestoreApi();
    if (!api || !window.FirebaseUser) throw new Error("Firebase not ready");
    await api.setDoc(api.doc(window.FirestoreDB, "entries", docId(record.birdId)), {
      type:TYPE,
      birdId:record.birdId,
      dataUrl:record.deleted ? "" : record.dataUrl,
      deleted:!!record.deleted,
      updatedAt:Number(record.updatedAt) || now(),
      sourceRank:Number(record.sourceRank) || 3,
      serverUpdatedAt:api.serverTimestamp()
    }, { merge:true });
  }

  async function flushQueue() {
    if (flushRunning) return;
    flushRunning = true;
    try {
      const q = queue();
      for (const id of Object.keys(q)) {
        const record = q[id];
        try {
          await writeCloudRecord(record);
          const current = queue();
          if (current[id] && Number(current[id].updatedAt) === Number(record.updatedAt)) {
            delete current[id];
            safeSet(QUEUE, current);
          }
        } catch (error) {
          console.warn("Bird photo sync queued:", error);
          break;
        }
      }
    } finally { flushRunning = false; }
  }

  async function savePrepared(id, src, sourceRank = 3) {
    id = String(id || "");
    if (!id || !src) return { saved:false, synced:false };
    const updatedAt = now();
    const localOk = setLocalRecord(id, src, { updatedAt, sourceRank, deleted:false });
    if (!localOk) {
      status("Photo could not be saved because browser storage is full.", "error");
      return { saved:false, synced:false };
    }
    enqueue(id, src, { updatedAt, sourceRank, deleted:false });
    await flushQueue();
    const synced = !queue()[id];
    status(synced ? "Photo saved and synced." : "Photo saved on this device and queued to sync.", synced ? "success" : "warning");
    return { saved:true, synced };
  }

  async function saveFile(id, file) {
    status("Preparing photo…", "info");
    const src = await prepareFile(file);
    if (!src) {
      status("That photo could not be read. Try choosing it again.", "error");
      return { saved:false, synced:false };
    }
    return savePrepared(String(id || ""), src, 3);
  }

  async function saveUrl(id, url) {
    url = String(url || "").trim();
    if (!/^https?:\/\//i.test(url)) return { saved:false, synced:false };
    return savePrepared(String(id || ""), url, 3);
  }

  async function remove(id) {
    id = String(id || "");
    if (!id) return;
    const updatedAt = now();
    setLocalRecord(id, "", { updatedAt, sourceRank:3, deleted:true });
    enqueue(id, "", { updatedAt, sourceRank:3, deleted:true });
    await flushQueue();
    status(queue()[id] ? "Photo removal queued to sync." : "Photo removed and synced.", queue()[id] ? "warning" : "success");
  }

  async function migrateLegacy() {
    const ids = flockIds();
    const currentMeta = meta();
    const currentPhotos = legacy();
    const compact = {};
    for (const [id, src] of Object.entries(currentPhotos)) {
      if (ids.has(String(id)) && typeof src === "string" && src) compact[id] = src;
    }

    const prepared = [];
    for (const [id, candidate] of Object.entries(legacyCandidates)) {
      if (!ids.has(String(id)) || !candidate?.src) continue;
      const existing = currentMeta[id] || {};
      if (existing.deleted && Number(existing.sourceRank) >= 3) continue;
      if (Number(existing.sourceRank) > Number(candidate.sourceRank)) continue;
      if (Number(existing.sourceRank) === 3) continue;

      const normalized = await normalizeLegacy(candidate.src);
      if (!normalized) continue;
      compact[id] = normalized;
      prepared.push({ id, normalized, sourceRank:Number(candidate.sourceRank) || 1 });
    }

    safeSet(LEGACY, compact);
    let migrated = 0;
    for (const item of prepared) {
      const updatedAt = now() + migrated;
      const m = meta();
      m[item.id] = { updatedAt, deleted:false, sourceRank:item.sourceRank };
      safeSet(META, m);
      if (enqueue(item.id, item.normalized, { updatedAt, deleted:false, sourceRank:item.sourceRank })) migrated++;
    }

    legacyCandidates = {};
    if (migrated) {
      status(`Moving ${migrated} existing flock photo${migrated === 1 ? "" : "s"} into shared photo sync…`, "info");
      await flushQueue();
      notify({ migrated });
    }
  }

  function installLegacyPhotoOverrides() {
    const apply = () => {
      window.xUpload = id => {
        const birdId = String(id || "");
        let input = document.getElementById("sharedChickenPhotoInputV2");
        if (!input) {
          input = document.createElement("input");
          input.id = "sharedChickenPhotoInputV2";
          input.type = "file";
          input.accept = "image/*";
          input.style.cssText = "position:fixed;left:-10000px;width:1px;height:1px;opacity:0";
          document.body.appendChild(input);
        }
        input.onchange = async () => {
          const file = input.files?.[0];
          input.value = "";
          if (file) await saveFile(birdId, file);
        };
        input.click();
      };
      window.xClear = id => remove(String(id || ""));
      window.xUrl = async id => {
        const old = getPhoto(id);
        const value = prompt("Paste a photo URL:", /^https?:/i.test(old) ? old : "");
        if (value === null) return;
        if (!value.trim()) return remove(String(id || ""));
        const result = await saveUrl(String(id || ""), value);
        if (!result.saved) alert("Please use a full http:// or https:// image URL.");
      };
    };
    apply();
    setTimeout(apply, 1200);
  }

  async function initWork() {
    if (initialized) return;
    initialized = true;
    captureAndFreeLegacyDuplicates();
    installDeluxeSanitizer();
    installLegacyPhotoOverrides();
    const cloudStarted = await startCloudListener();
    await migrateLegacy();
    if (cloudStarted) await flushQueue();
    window.addEventListener("online", async () => { await startCloudListener(); await flushQueue(); });
    console.log("✅ Shared bird photo service active");
  }
  function init() {
    if (!initPromise) initPromise = initWork();
    return initPromise;
  }

  window.FarmBirdPhotosV2 = {
    get:getPhoto,
    prepareFile,
    saveFile,
    savePrepared,
    saveUrl,
    remove,
    flush:flushQueue,
    subscribe(fn) { if (typeof fn === "function") listeners.add(fn); return () => listeners.delete(fn); },
    ready:() => init()
  };

  init();
})();