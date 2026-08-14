(() => {
  "use strict";
  if (window.__birdPhotoServiceV3) return;
  window.__birdPhotoServiceV3 = true;

  const APP = "chickenEggApp2V1";
  const DELUXE = "chickenEggDeluxeV1";
  const CACHE = "chickenEggLocalBirdPhotosV1";
  const META = "chickenEggBirdPhotoMetaV3";
  const QUEUE = "chickenEggBirdPhotoQueueV3";
  const OLD_META = "chickenEggBirdPhotoMetaV2";
  const OLD_QUEUE = "chickenEggBirdPhotoQueueV2";
  const TYPE = "birdPhotoV3";
  const OLD_TYPE = "birdPhotoV2";
  const listeners = new Set();
  const remoteTimes = new Map();
  let api = null;
  let unsubscribe = null;
  let initPromise = null;
  let flushing = false;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { console.warn("Photo storage write failed:", key, error); return false; }
  };
  const now = () => Date.now();
  const isData = v => typeof v === "string" && v.startsWith("data:image/");
  const birdIds = () => new Set((read(APP, {}).flock || []).map(b => String(b?.id || "")).filter(Boolean));
  const docId = id => "bird_photo_v3_" + String(id || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);

  function notify(detail = {}) {
    for (const fn of listeners) { try { fn(detail); } catch {} }
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail }));
  }
  function status(message, kind = "info") {
    window.dispatchEvent(new CustomEvent("bird-photo-status", { detail:{ message, kind } }));
  }
  function cache() { const x = read(CACHE, {}); return x && typeof x === "object" ? x : {}; }
  function meta() { const x = read(META, {}); return x && typeof x === "object" ? x : {}; }
  function queue() { const x = read(QUEUE, {}); return x && typeof x === "object" ? x : {}; }

  function get(id) {
    const value = cache()[String(id || "")];
    return typeof value === "string" ? value : "";
  }

  function imageToJpeg(source, size = 176, quality = 0.5) {
    return new Promise(resolve => {
      const image = new Image();
      let objectUrl = "";
      const done = value => {
        try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch {}
        resolve(value || "");
      };
      image.onload = () => {
        try {
          const w = image.naturalWidth || image.width;
          const h = image.naturalHeight || image.height;
          const side = Math.min(w, h);
          const sx = Math.max(0, (w - side) / 2);
          const sy = Math.max(0, (h - side) / 2);
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d", { alpha:false });
          ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
          let out = canvas.toDataURL("image/jpeg", quality);
          if (out.length > 70000) out = canvas.toDataURL("image/jpeg", 0.38);
          done(out);
        } catch (error) {
          console.warn("Photo conversion failed:", error);
          done("");
        }
      };
      image.onerror = () => done("");
      try {
        if (source instanceof Blob) {
          objectUrl = URL.createObjectURL(source);
          image.src = objectUrl;
        } else image.src = String(source || "");
      } catch { done(""); }
    });
  }

  async function prepareFile(file) {
    if (!file) return "";
    let out = await imageToJpeg(file, 176, 0.5);
    if (out) return out;
    const raw = await new Promise(resolve => {
      try {
        const reader = new FileReader();
        reader.onload = e => resolve(String(e.target?.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      } catch { resolve(""); }
    });
    return raw ? await imageToJpeg(raw, 160, 0.44) : "";
  }

  async function compactLegacyBeforeFirebase() {
    const ids = birdIds();
    const oldCache = cache();
    const deluxe = read(DELUXE, {});
    const deluxePhotos = deluxe?.birdPhotoUrls && typeof deluxe.birdPhotoUrls === "object" ? deluxe.birdPhotoUrls : {};
    const oldQueue = read(OLD_QUEUE, {});
    const oldMeta = read(OLD_META, {});
    const newMeta = meta();
    const candidates = new Map();

    const take = (id, src, updatedAt = 0, rank = 1, deleted = false) => {
      id = String(id || "");
      if (!id || !ids.has(id)) return;
      const current = candidates.get(id);
      const score = Number(updatedAt) * 10 + Number(rank || 0);
      const currentScore = current ? Number(current.updatedAt) * 10 + Number(current.rank || 0) : -1;
      if (!current || score >= currentScore) candidates.set(id, { src, updatedAt:Number(updatedAt)||0, rank:Number(rank)||1, deleted:!!deleted });
    };

    for (const [id, src] of Object.entries(deluxePhotos)) if (typeof src === "string" && src) take(id, src, 0, 1, false);
    for (const [id, src] of Object.entries(oldCache)) if (typeof src === "string" && src) take(id, src, Number(oldMeta?.[id]?.updatedAt)||0, Number(oldMeta?.[id]?.sourceRank)||2, false);
    for (const [id, rec] of Object.entries(oldQueue || {})) {
      if (!rec) continue;
      take(id, rec.dataUrl || oldCache[id] || "", Number(rec.updatedAt)||0, Number(rec.sourceRank)||3, !!rec.deleted);
    }

    const compact = {};
    for (const [id, c] of candidates) {
      if (c.deleted) {
        newMeta[id] = { updatedAt:c.updatedAt || now(), deleted:true, sourceRank:Math.max(3,c.rank) };
        continue;
      }
      let src = c.src;
      if (isData(src)) src = await imageToJpeg(src, 176, 0.5) || src;
      if (!src) continue;
      compact[id] = src;
      const prior = newMeta[id] || {};
      newMeta[id] = {
        updatedAt:Math.max(Number(prior.updatedAt)||0, c.updatedAt || 1),
        deleted:false,
        sourceRank:Math.max(Number(prior.sourceRank)||0, c.rank || 1)
      };
    }

    if (!write(CACHE, compact)) {
      try { localStorage.removeItem(OLD_QUEUE); localStorage.removeItem(OLD_META); } catch {}
      if (!write(CACHE, compact)) status("The iPhone browser storage is full. I could not compact the old chicken photos.", "error");
    }
    write(META, newMeta);
    try { localStorage.removeItem(OLD_QUEUE); localStorage.removeItem(OLD_META); } catch {}

    if (Object.values(deluxePhotos).some(isData)) {
      try {
        const clean = { ...deluxe, birdPhotoUrls:{}, updatedAt:now() };
        for (const [id, src] of Object.entries(deluxePhotos)) if (typeof src === "string" && src && !isData(src)) clean.birdPhotoUrls[id] = src;
        localStorage.setItem(DELUXE, JSON.stringify(clean));
      } catch {}
    }
  }

  function installDeluxeGuard() {
    if (window.__birdPhotoDeluxeGuardV3) return;
    window.__birdPhotoDeluxeGuardV3 = true;
    const previous = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === window.localStorage && String(key) === DELUXE) {
        try {
          const parsed = JSON.parse(String(value));
          if (parsed?.birdPhotoUrls && typeof parsed.birdPhotoUrls === "object") {
            const kept = {};
            for (const [id, src] of Object.entries(parsed.birdPhotoUrls)) if (typeof src === "string" && src && !isData(src)) kept[id] = src;
            parsed.birdPhotoUrls = kept;
            value = JSON.stringify(parsed);
          }
        } catch {}
      }
      return previous.call(this, key, value);
    };
  }

  async function firebaseApi() {
    if (api) return api;
    const start = now();
    while (now() - start < 15000) {
      if (window.FirestoreDB && window.FirebaseUser) break;
      await new Promise(r => setTimeout(r, 100));
    }
    if (!window.FirestoreDB || !window.FirebaseUser) return null;
    api = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return api;
  }

  function setLocal(id, src, record) {
    id = String(id || "");
    const c = cache();
    if (record.deleted || !src) delete c[id]; else c[id] = src;
    if (!write(CACHE, c)) return false;
    const m = meta();
    m[id] = { updatedAt:Number(record.updatedAt)||now(), deleted:!!record.deleted, sourceRank:Number(record.sourceRank)||3 };
    if (!write(META, m)) return false;
    notify({ birdId:id, deleted:!!record.deleted });
    return true;
  }

  function enqueue(id, record) {
    const q = queue();
    q[String(id)] = { birdId:String(id), updatedAt:Number(record.updatedAt)||now(), deleted:!!record.deleted, sourceRank:Number(record.sourceRank)||3 };
    return write(QUEUE, q);
  }

  function applyRemote(data) {
    const id = String(data?.birdId || "");
    if (!id) return;
    const remoteTime = Number(data.updatedAt) || 0;
    remoteTimes.set(id, Math.max(remoteTimes.get(id)||0, remoteTime));
    const local = meta()[id] || {};
    const localTime = Number(local.updatedAt) || 0;
    if (localTime > remoteTime) return;
    setLocal(id, data.dataUrl || "", { updatedAt:remoteTime, deleted:!!data.deleted, sourceRank:Number(data.sourceRank)||3 });
    const q = queue();
    if (q[id] && Number(q[id].updatedAt) <= remoteTime) { delete q[id]; write(QUEUE, q); }
  }

  async function writeCloud(record) {
    const f = await firebaseApi();
    if (!f) throw new Error("Firebase not ready");
    const id = String(record.birdId || "");
    const ref = f.doc(window.FirestoreDB, "entries", docId(id));
    const snap = await f.getDoc(ref);
    const current = snap.exists() ? snap.data() : null;
    if (current && Number(current.updatedAt) > Number(record.updatedAt)) {
      applyRemote(current);
      return "remote-newer";
    }
    const src = record.deleted ? "" : get(id);
    if (!record.deleted && !src) throw new Error("Local photo missing");
    await f.setDoc(ref, {
      type:TYPE,
      birdId:id,
      dataUrl:src,
      deleted:!!record.deleted,
      updatedAt:Number(record.updatedAt)||now(),
      sourceRank:Number(record.sourceRank)||3,
      serverUpdatedAt:f.serverTimestamp()
    }, { merge:true });
    const verify = await f.getDoc(ref);
    const saved = verify.exists() ? verify.data() : null;
    if (!saved || Number(saved.updatedAt) !== Number(record.updatedAt) || !!saved.deleted !== !!record.deleted) throw new Error("Firebase photo verification failed");
    remoteTimes.set(id, Number(record.updatedAt)||0);
    return "written";
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      const q = queue();
      for (const id of Object.keys(q)) {
        const record = q[id];
        try {
          await writeCloud(record);
          const latest = queue();
          if (latest[id] && Number(latest[id].updatedAt) === Number(record.updatedAt)) {
            delete latest[id];
            write(QUEUE, latest);
          }
        } catch (error) {
          console.warn("Bird photo sync waiting:", error);
          break;
        }
      }
    } finally { flushing = false; }
  }

  async function savePrepared(id, src, sourceRank = 3) {
    id = String(id || "");
    if (!id || !src) return { saved:false, synced:false };
    const updatedAt = now();
    if (!setLocal(id, src, { updatedAt, deleted:false, sourceRank })) {
      status("Photo could not be saved because Safari storage is full.", "error");
      return { saved:false, synced:false };
    }
    const queued = enqueue(id, { updatedAt, deleted:false, sourceRank });
    if (!queued) {
      try {
        await writeCloud({ birdId:id, updatedAt, deleted:false, sourceRank });
        status("Photo saved and synced.", "success");
        return { saved:true, synced:true };
      } catch (error) {
        status("Photo saved on this iPhone but Firebase could not accept it yet.", "error");
        return { saved:true, synced:false };
      }
    }
    await flush();
    const synced = !queue()[id];
    status(synced ? "Photo saved and synced." : "Photo saved; waiting for Firebase sync.", synced ? "success" : "warning");
    return { saved:true, synced };
  }

  async function saveFile(id, file) {
    status("Preparing photo…", "info");
    const src = await prepareFile(file);
    if (!src) {
      status("Safari could not read that image. Try another photo.", "error");
      return { saved:false, synced:false };
    }
    return savePrepared(id, src, 3);
  }

  async function saveUrl(id, url) {
    url = String(url || "").trim();
    if (!/^https?:\/\//i.test(url)) return { saved:false, synced:false };
    return savePrepared(id, url, 3);
  }

  async function remove(id) {
    id = String(id || "");
    if (!id) return;
    const updatedAt = now();
    setLocal(id, "", { updatedAt, deleted:true, sourceRank:3 });
    enqueue(id, { updatedAt, deleted:true, sourceRank:3 });
    await flush();
    status(queue()[id] ? "Photo removal is waiting for Firebase." : "Photo removed and synced.", queue()[id] ? "warning" : "success");
  }

  async function seedLocalToQueue() {
    const c = cache();
    const m = meta();
    for (const id of Object.keys(c)) {
      const info = m[id] || { updatedAt:1, deleted:false, sourceRank:2 };
      if ((remoteTimes.get(id)||0) < Number(info.updatedAt||0)) enqueue(id, info);
    }
    for (const [id, info] of Object.entries(m)) if (info?.deleted && (remoteTimes.get(id)||0) < Number(info.updatedAt||0)) enqueue(id, info);
  }

  async function startListener() {
    const f = await firebaseApi();
    if (!f) return false;
    return new Promise(resolve => {
      try {
        unsubscribe?.();
        let first = true;
        unsubscribe = f.onSnapshot(f.collection(window.FirestoreDB, "entries"), snap => {
          for (const change of snap.docChanges()) {
            if (change.type === "removed") continue;
            const data = change.doc.data() || {};
            if (data.type === TYPE || data.type === OLD_TYPE) applyRemote(data);
          }
          if (first) { first = false; resolve(true); }
        }, error => {
          console.warn("Bird photo listener failed:", error);
          resolve(false);
        });
      } catch (error) {
        console.warn("Bird photo listener setup failed:", error);
        resolve(false);
      }
    });
  }

  function installLegacyOverrides() {
    const apply = () => {
      window.xUpload = id => {
        const birdId = String(id || "");
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.style.cssText = "position:fixed;inset:0;width:1px;height:1px;opacity:.01;z-index:-1";
        input.onchange = async () => {
          const file = input.files?.[0];
          input.remove();
          if (file) await saveFile(birdId, file);
        };
        document.body.appendChild(input);
        input.click();
      };
      window.xClear = id => remove(String(id || ""));
      window.xUrl = async id => {
        const current = get(id);
        const value = prompt("Paste a photo URL:", /^https?:/i.test(current) ? current : "");
        if (value === null) return;
        if (!value.trim()) return remove(String(id || ""));
        const result = await saveUrl(String(id || ""), value);
        if (!result.saved) alert("Please use a full http:// or https:// image URL.");
      };
    };
    apply();
    setTimeout(apply, 1400);
  }

  async function initWork() {
    installDeluxeGuard();
    await compactLegacyBeforeFirebase();
    installLegacyOverrides();
    await startListener();
    await seedLocalToQueue();
    await flush();
    window.addEventListener("online", async () => { await startListener(); await seedLocalToQueue(); await flush(); });
    console.log("✅ Bird photo service v3 active");
  }
  function ready() {
    if (!initPromise) initPromise = initWork();
    return initPromise;
  }

  window.FarmBirdPhotosV3 = { get, prepareFile, saveFile, savePrepared, saveUrl, remove, flush, ready, subscribe(fn){ if (typeof fn === "function") listeners.add(fn); return () => listeners.delete(fn); } };
  window.FarmBirdPhotosV2 = window.FarmBirdPhotosV3;
  ready();
})();