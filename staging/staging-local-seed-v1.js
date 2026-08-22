(() => {
  "use strict";
  if (window.__ChickenEggsStagingLocalSeedV1) return;
  window.__ChickenEggsStagingLocalSeedV1 = true;

  const PREFIX = "__chicken_eggs_staging__::";
  const local = window.localStorage;
  const proto = Storage.prototype;
  // Capture the native methods BEFORE staging-storage.js patches Storage.prototype.
  // These closures keep reading the real unprefixed LIVE browser state even after
  // the staging sandbox becomes active.
  const native = {
    getItem: proto.getItem,
    setItem: proto.setItem,
    removeItem: proto.removeItem,
    key: proto.key
  };
  const stageKey = key => PREFIX + String(key);
  const PRIVATE_OR_HEAVY = [
    /^chickenEggCustomerRequestsV1$/i,
    /^chickenEggLocalBirdPhotosV1$/i,
    /^chickenEggBirdPhotoMetaV4$/i,
    /^chickenEggApp2SnapshotsV1$/i,
    /ManualStagingBaseline/i,
    /Staging.*Test/i,
    /password|credential|authToken|accessToken|refreshToken/i
  ];
  const relevantLiveKey = key => /^(chickenEgg|farm|bird|core|inventory)/i.test(String(key || ""));
  const excluded = key => PRIVATE_OR_HEAVY.some(rx => rx.test(String(key || "")));

  function physicalKeys() {
    const out = [];
    let len = 0;
    try { len = local.length; } catch {}
    for (let i = 0; i < len; i++) {
      try {
        const key = native.key.call(local, i);
        if (key != null) out.push(String(key));
      } catch {}
    }
    return out;
  }

  function liveKeys() {
    return physicalKeys().filter(key => !key.startsWith(PREFIX) && relevantLiveKey(key) && !excluded(key));
  }

  function compactValue(key, value) {
    const text = String(value ?? "");
    if (!text) return text;
    // The flock/app state may contain old photo URL caches. Keep the farm data but
    // strip those bulky caches from the STAGING mirror so we do not recreate the
    // browser-quota problem that previously knocked the live app offline.
    if (/chickenEggDeluxeV1/i.test(key) && text.includes("birdPhotoUrls")) {
      try {
        const obj = JSON.parse(text);
        if (obj && typeof obj === "object" && obj.birdPhotoUrls && typeof obj.birdPhotoUrls === "object") {
          return JSON.stringify({ ...obj, birdPhotoUrls:{} });
        }
      } catch {}
    }
    return text;
  }

  function hasLiveBrowserData() {
    return liveKeys().some(key => /chickenEgg(App2V1|InventoryV2|EntriesV102|SettingsV102)/i.test(key));
  }

  function hasStagingCore() {
    for (const key of ["chickenEggApp2V1", "chickenEggInventoryV2", "chickenEggEntriesV102", "chickenEggSettingsV102"]) {
      try { if (native.getItem.call(local, stageKey(key))) return true; } catch {}
    }
    return false;
  }

  function syncFromLiveBrowser() {
    const keys = liveKeys();
    let copied = 0, skipped = 0, bytes = 0;
    const copiedKeys = [];
    for (const key of keys) {
      try {
        const raw = native.getItem.call(local, key);
        if (raw == null) continue;
        const value = compactValue(key, raw);
        // Refuse individual monster values. Normal egg/sale history is expected
        // to fit well below this; photos/snapshots were already excluded above.
        if (value.length > 900000) { skipped += 1; continue; }
        native.setItem.call(local, stageKey(key), value);
        copied += 1;
        bytes += value.length;
        copiedKeys.push(key);
      } catch (error) {
        skipped += 1;
        console.warn("STAGING live-browser mirror skipped", key, error);
      }
    }

    const at = Date.now();
    try {
      native.setItem.call(local, stageKey("chickenEggStagingSeedV1"), JSON.stringify({
        completed: copied > 0 || hasStagingCore(),
        importedAt: at,
        coreEntries: (() => {
          try {
            const raw = native.getItem.call(local, stageKey("chickenEggEntriesV102"));
            const rows = raw ? JSON.parse(raw) : [];
            return Array.isArray(rows) ? rows.length : 0;
          } catch { return 0; }
        })(),
        photos:0,
        fullCoreRefresh:false,
        source:"current LIVE app browser mirror; zero Firebase reads",
        localMirror:true,
        copiedKeys:copied,
        skippedKeys:skipped,
        mirroredBytes:bytes
      }));
    } catch {}

    const result = { copied, skipped, bytes, copiedKeys, at, hasLiveBrowserData:keys.length>0 };
    window.dispatchEvent(new CustomEvent("staging-live-browser-mirrored", { detail:result }));
    return result;
  }

  const result = syncFromLiveBrowser();
  window.StagingLocalSeedV1 = {
    version:2,
    prefix:PREFIX,
    hasLiveBrowserData,
    hasStagingCore,
    liveKeys,
    syncFromLiveBrowser,
    result
  };
  console.log(`🪞 STAGING mirrored ${result.copied} current LIVE browser keys (${result.bytes} chars); 0 Firebase reads`);
})();
