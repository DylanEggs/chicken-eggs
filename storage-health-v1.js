(() => {
  "use strict";
  if (window.__farmStorageHealthV1) return;
  window.__farmStorageHealthV1 = true;

  const PHOTO_CACHE = "chickenEggLocalBirdPhotosV1";
  const PHOTO_META4 = "chickenEggBirdPhotoMetaV4";
  const PHOTO_META3 = "chickenEggBirdPhotoMetaV3";
  const DELUXE = "chickenEggDeluxeV1";
  const SNAPSHOTS = "chickenEggApp2SnapshotsV1";
  const STAGING_PREFIX = "__chicken_eggs_staging__::";
  const CRITICAL = new Set([
    "chickenEggInventoryV2",
    "chickenEggEntriesV102",
    "chickenEggSettingsV102",
    "chickenEggApp2V1",
    "chickenEggBusinessV1",
    "chickenEggDeluxeV1"
  ]);

  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  let cleaning = false;
  let lastCleanup = null;

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };
  const image = v => typeof v === "string" && v.startsWith("data:image/");
  const quotaError = error => !!error && (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 || error.code === 1014 ||
    /quota/i.test(String(error.message || ""))
  );
  const bytes = text => String(text ?? "").length * 2;

  function usage() {
    const rows = [];
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const value = localStorage.getItem(key) || "";
        const size = bytes(key) + bytes(value);
        total += size;
        rows.push({ key, bytes:size, hasImage:value.includes("data:image/") });
      }
    } catch {}
    rows.sort((a,b) => b.bytes - a.bytes);
    return { bytes:total, kb:Math.round(total/1024), top:rows.slice(0,12) };
  }

  function recovery() {
    try {
      const service = window.FarmBirdPhotoRecoveryV2;
      const stats = service?.stats?.();
      return {
        ready:!!stats?.initialScanDone,
        stats:stats || null,
        get:id => service?.getCloudRecord?.(String(id || "")) || null
      };
    } catch {
      return { ready:false, stats:null, get:()=>null };
    }
  }

  function localPhotoTime(id) {
    const m4 = read(PHOTO_META4, {});
    const m3 = read(PHOTO_META3, {});
    return Number(m4?.[id]?.updatedAt ?? m3?.[id]?.updatedAt) || 0;
  }

  function cloudSafelyOwns(id, src, cloud) {
    const r = cloud.get(id);
    if (!r || r.deleted || !image(r.dataUrl)) return false;
    if (r.dataUrl === src) return true;
    const localAt = localPhotoTime(id);
    return localAt > 0 && Number(r.updatedAt || 0) >= localAt;
  }

  function pruneVerifiedPhotoCache() {
    const cloud = recovery();
    if (!cloud.ready) return { changed:false, removed:0, kept:0, reason:"cloud-photo-scan-not-ready" };

    const cache = read(PHOTO_CACHE, {});
    if (!cache || typeof cache !== "object") return { changed:false, removed:0, kept:0, reason:"no-photo-cache" };

    const kept = {};
    let removed = 0;
    for (const [id, src] of Object.entries(cache)) {
      if (image(src) && cloudSafelyOwns(id, src, cloud)) removed++;
      else kept[id] = src;
    }

    if (!removed) return { changed:false, removed:0, kept:Object.keys(kept).length, reason:"no-verified-cache-copies" };
    if (Object.keys(kept).length) nativeSetItem.call(localStorage, PHOTO_CACHE, JSON.stringify(kept));
    else nativeRemoveItem.call(localStorage, PHOTO_CACHE);
    return { changed:true, removed, kept:Object.keys(kept).length, reason:"verified-firebase-photo-copies" };
  }

  function pruneVerifiedDeluxePhotos() {
    const cloud = recovery();
    if (!cloud.ready) return { changed:false, removed:0 };
    const deluxe = read(DELUXE, null);
    if (!deluxe || typeof deluxe !== "object" || !deluxe.birdPhotoUrls || typeof deluxe.birdPhotoUrls !== "object") return { changed:false, removed:0 };

    const kept = {};
    let removed = 0;
    for (const [id, src] of Object.entries(deluxe.birdPhotoUrls)) {
      if (image(src) && cloudSafelyOwns(id, src, cloud)) removed++;
      else kept[id] = src;
    }
    if (!removed) return { changed:false, removed:0 };
    const next = { ...deluxe, birdPhotoUrls:kept };
    nativeSetItem.call(localStorage, DELUXE, JSON.stringify(next));
    return { changed:true, removed };
  }

  function pruneStagingSandbox() {
    if (window.__ChickenEggsStagingMode) return { changed:false, removed:0, freedBytes:0, reason:"staging-page" };
    const doomed = [];
    let freedBytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !String(key).startsWith(STAGING_PREFIX)) continue;
        const value = localStorage.getItem(key) || "";
        doomed.push(key);
        freedBytes += bytes(key) + bytes(value);
      }
      doomed.forEach(key => nativeRemoveItem.call(localStorage, key));
      return { changed:doomed.length>0, removed:doomed.length, freedBytes, reason:"discarded-staging-only-sandbox" };
    } catch (error) {
      return { changed:false, removed:0, freedBytes:0, reason:"staging-cleanup-failed", error:String(error?.message || error) };
    }
  }

  function trimSafetySnapshots() {
    const shots = read(SNAPSHOTS, []);
    if (!Array.isArray(shots) || shots.length <= 1) return { changed:false, before:Array.isArray(shots)?shots.length:0, after:Array.isArray(shots)?shots.length:0 };
    const one = shots.slice(0,1);
    nativeSetItem.call(localStorage, SNAPSHOTS, JSON.stringify(one));
    return { changed:true, before:shots.length, after:one.length };
  }

  function compact(reason = "background") {
    if (cleaning) return lastCleanup;
    cleaning = true;
    const before = usage();
    const actions = [];
    try {
      actions.push({ type:"photo-cache", ...pruneVerifiedPhotoCache() });
      actions.push({ type:"deluxe-photo-cache", ...pruneVerifiedDeluxePhotos() });
      const after = usage();
      lastCleanup = {
        reason,
        at:Date.now(),
        beforeBytes:before.bytes,
        afterBytes:after.bytes,
        freedBytes:Math.max(0,before.bytes-after.bytes),
        actions
      };
      window.dispatchEvent(new CustomEvent("farm-storage-health", { detail:lastCleanup }));
      return lastCleanup;
    } catch (error) {
      console.warn("Farm storage compaction skipped:", error);
      lastCleanup = { reason, at:Date.now(), error:String(error?.message || error), actions };
      return lastCleanup;
    } finally {
      cleaning = false;
    }
  }

  function emergencyCompact(reason = "quota") {
    const before = usage();
    const actions = [];
    // TEST/STAGING uses the same origin/quota as the live app. These prefixed
    // keys are disposable sandbox copies, never live farm data, so remove them
    // first when a critical live save cannot fit.
    try { actions.push({ type:"staging-sandbox", ...pruneStagingSandbox() }); } catch {}
    try {
      const normal = compact(reason);
      if (Array.isArray(normal?.actions)) actions.push(...normal.actions);
    } catch {}
    try { actions.push({ type:"snapshots", ...trimSafetySnapshots() }); } catch {}
    const after = usage();
    lastCleanup = {
      reason,
      at:Date.now(),
      beforeBytes:before.bytes,
      afterBytes:after.bytes,
      freedBytes:Math.max(0,before.bytes-after.bytes),
      actions
    };
    window.dispatchEvent(new CustomEvent("farm-storage-health", { detail:lastCleanup }));
    return lastCleanup;
  }

  Storage.prototype.setItem = function(key, value) {
    try {
      return nativeSetItem.call(this, key, value);
    } catch (error) {
      if (this !== window.localStorage || !quotaError(error) || !CRITICAL.has(String(key))) throw error;
      console.warn("🧹 Browser storage full during critical farm save; freeing staging-only/verified cache and retrying", key);
      emergencyCompact(`quota:${String(key)}`);
      try {
        const result = nativeSetItem.call(this, key, value);
        window.dispatchEvent(new CustomEvent("farm-storage-recovered", { detail:{ key:String(key), at:Date.now(), cleanup:lastCleanup } }));
        return result;
      } catch (retryError) {
        if (!quotaError(retryError)) throw retryError;
        // DOMException.message can be read-only in browsers. Never mutate it.
        const wrapped = new Error(`${retryError?.message || "Browser storage quota exceeded"}. Critical farm save still could not fit after safe cache cleanup.`);
        wrapped.name = String(retryError?.name || "QuotaExceededError");
        try { wrapped.code = retryError?.code; } catch {}
        throw wrapped;
      }
    }
  };

  async function compactWhenCloudReady() {
    for (let i=0;i<80;i++) {
      const r = recovery();
      if (r.ready) {
        compact("cloud-photo-ready");
        return;
      }
      await new Promise(resolve => setTimeout(resolve,250));
    }
  }

  window.FarmStorageHealth = {
    usage,
    compact,
    emergencyCompact,
    pruneStagingSandbox,
    getLastCleanup:() => lastCleanup,
    isQuotaError:quotaError
  };

  setTimeout(() => void compactWhenCloudReady(), 700);
  window.addEventListener("farm-data-synced", event => {
    if (event.detail?.photoOnly) setTimeout(() => compact("photo-sync"), 250);
  });

  console.log("✅ Farm storage health v1.1 active — critical saves can reclaim staging-only and verified cloud-backed cache safely");
})();
