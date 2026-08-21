(() => {
  "use strict";
  if (window.__ChickenEggsStagingStorage) return;
  window.__ChickenEggsStagingStorage = true;
  window.__ChickenEggsEnvironment = "staging";
  window.__ChickenEggsStagingMode = true;

  const PREFIX = "__chicken_eggs_staging__::";
  const INIT = PREFIX + "__initialized__";
  const MAINTENANCE = PREFIX + "__storage_v44__";
  const PHOTO_CACHE = "chickenEggLocalBirdPhotosV1";
  const PHOTO_META = "chickenEggBirdPhotoMetaV4";
  const DELUXE = "chickenEggDeluxeV1";
  const BASELINE = "chickenEggManualStagingBaselineV1";
  const SNAPSHOTS = "chickenEggApp2SnapshotsV1";
  const LARGE_CACHE_LIMIT = 250000;
  const TEST_REPORT_LIMIT = 90000;
  const local = window.localStorage;
  const proto = Storage.prototype;
  const native = {
    getItem: proto.getItem,
    setItem: proto.setItem,
    removeItem: proto.removeItem,
    clear: proto.clear,
    key: proto.key
  };
  let memoryOverlay = null;

  function physicalLength() {
    try { return local.length; } catch { return 0; }
  }
  function physicalKeys() {
    const out = [];
    const len = physicalLength();
    for (let i = 0; i < len; i++) {
      try {
        const key = native.key.call(local, i);
        if (key != null) out.push(String(key));
      } catch {}
    }
    return out;
  }
  function relevantLiveKey(key) {
    return /^(chickenEgg|farm|bird|core|inventory)/i.test(String(key || ""));
  }
  function stageKey(key) { return PREFIX + String(key); }
  function testArtifactKey(key) {
    const k = String(key || "");
    return /^chickenEggStaging/i.test(k) && /test/i.test(k);
  }
  function persistentStagingKeys() {
    return physicalKeys()
      .filter(k => k.startsWith(PREFIX) && k !== INIT && k !== MAINTENANCE)
      .map(k => k.slice(PREFIX.length));
  }

  function stripLargePhotoPayload(key, value) {
    const k = String(key || "");
    const text = String(value ?? "");
    if (k === PHOTO_CACHE && text.length > LARGE_CACHE_LIMIT) return "{}";
    if (k === DELUXE && text.includes("birdPhotoUrls")) {
      try {
        const obj = JSON.parse(text);
        if (obj && typeof obj === "object" && obj.birdPhotoUrls && typeof obj.birdPhotoUrls === "object") {
          return JSON.stringify({ ...obj, birdPhotoUrls:{} });
        }
      } catch {}
    }
    return value;
  }

  function compactTestReport(key, value) {
    if (!testArtifactKey(key)) return value;
    const text = String(value ?? "");
    if (text.length <= TEST_REPORT_LIMIT) return value;
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object") {
        const failures = Array.isArray(obj.results)
          ? obj.results.filter(x => !x?.pass).slice(0,40).map(x => ({name:String(x?.name||""),pass:false,detail:String(x?.detail||"").slice(0,400)}))
          : [];
        return JSON.stringify({
          at:Number(obj.at)||Date.now(), startedAt:Number(obj.startedAt)||0,
          durationMs:Number(obj.durationMs)||0, total:Number(obj.total)||0,
          passed:Number(obj.passed)||0, failed:Number(obj.failed)||failures.length,
          suite:String(obj.suite||"staging-test"), results:failures,
          compactedForStagingStorage:true
        });
      }
    } catch {}
    return JSON.stringify({compactedForStagingStorage:true,originalChars:text.length});
  }

  function normalizeValue(key, value) {
    return String(compactTestReport(key, stripLargePhotoPayload(key, value)) ?? "");
  }

  if (!native.getItem.call(local, INIT)) {
    const liveKeys = physicalKeys().filter(k => !k.startsWith(PREFIX) && relevantLiveKey(k));
    for (const key of liveKeys) {
      try {
        const value = native.getItem.call(local, key);
        if (value != null) native.setItem.call(local, stageKey(key), normalizeValue(key, value));
      } catch {}
    }
    try { native.setItem.call(local, INIT, JSON.stringify({ at: Date.now(), copiedKeys: liveKeys.length })); } catch {}
  }

  // One-time Stage 44 cleanup. Older staging builds could duplicate photo payloads,
  // manual baselines and large test reports in the same origin storage as LIVE.
  // Remove only PREFIXED staging data; live/unprefixed farm data is never touched.
  if (!native.getItem.call(local, MAINTENANCE)) {
    for (const physicalKey of physicalKeys()) {
      if (!physicalKey.startsWith(PREFIX) || physicalKey === INIT || physicalKey === MAINTENANCE) continue;
      const virtualKey = physicalKey.slice(PREFIX.length);
      if (testArtifactKey(virtualKey) || [BASELINE, PHOTO_CACHE, PHOTO_META, SNAPSHOTS].includes(virtualKey)) {
        try { native.removeItem.call(local, physicalKey); } catch {}
      }
    }
    try {
      const deluxeRaw = native.getItem.call(local, stageKey(DELUXE));
      if (deluxeRaw) {
        const compacted = stripLargePhotoPayload(DELUXE, deluxeRaw);
        if (compacted !== deluxeRaw) native.setItem.call(local, stageKey(DELUXE), compacted);
      }
    } catch {}
    try { native.setItem.call(local, MAINTENANCE, JSON.stringify({at:Date.now(),version:44})); } catch {}
  }

  // Test reports are disposable and must never accumulate between staging runs.
  for (const physicalKey of physicalKeys()) {
    if (!physicalKey.startsWith(PREFIX) || physicalKey === INIT || physicalKey === MAINTENANCE) continue;
    const virtualKey = physicalKey.slice(PREFIX.length);
    if (!testArtifactKey(virtualKey)) continue;
    try { native.removeItem.call(local, physicalKey); } catch {}
  }

  function isStagingLocal(self) {
    return self === local && window.__ChickenEggsStagingMode === true;
  }
  function stagingKeys() {
    return memoryOverlay ? [...memoryOverlay.keys()] : persistentStagingKeys();
  }

  function beginMemoryOverlay() {
    if (memoryOverlay) return {active:true,keys:memoryOverlay.size};
    const map = new Map();
    for (const key of persistentStagingKeys()) {
      try {
        const value = native.getItem.call(local, stageKey(key));
        if (value !== null) map.set(key, value);
      } catch {}
    }
    memoryOverlay = map;
    window.dispatchEvent(new CustomEvent("staging-storage-overlay", {detail:{active:true,keys:map.size}}));
    return {active:true,keys:map.size};
  }

  function reloadPersistentMemory() {
    try { window.loadLocal?.(); } catch {}
    try { window.loadFarmSettings?.(); } catch {}
    try { window.__reloadFarm2Memory?.(); } catch {}
    try { window.updateApp?.(); } catch {}
    try { window.InventorySystemV6?.render?.(); } catch {}
    try { window.StagingCustomerRequestsV1?.render?.(); } catch {}
    window.dispatchEvent(new CustomEvent("core-data-synced", {detail:{staging:true,memoryOverlayEnded:true}}));
    window.dispatchEvent(new CustomEvent("farm-data-synced", {detail:{staging:true,memoryOverlayEnded:true,key:"memory-overlay"}}));
  }

  function endMemoryOverlay(reload=true) {
    if (!memoryOverlay) return {active:false};
    memoryOverlay = null;
    if (reload) reloadPersistentMemory();
    window.dispatchEvent(new CustomEvent("staging-storage-overlay", {detail:{active:false}}));
    return {active:false};
  }

  proto.getItem = function(key) {
    if (!isStagingLocal(this)) return native.getItem.call(this, key);
    const k = String(key);
    if (memoryOverlay) return memoryOverlay.has(k) ? memoryOverlay.get(k) : null;
    return native.getItem.call(this, stageKey(k));
  };
  proto.setItem = function(key, value) {
    if (!isStagingLocal(this)) return native.setItem.call(this, key, value);
    const k = String(key), v = normalizeValue(k, value);
    if (memoryOverlay) { memoryOverlay.set(k, v); return; }
    return native.setItem.call(this, stageKey(k), v);
  };
  proto.removeItem = function(key) {
    if (!isStagingLocal(this)) return native.removeItem.call(this, key);
    const k = String(key);
    if (memoryOverlay) { memoryOverlay.delete(k); return; }
    return native.removeItem.call(this, stageKey(k));
  };
  proto.clear = function() {
    if (!isStagingLocal(this)) return native.clear.call(this);
    if (memoryOverlay) { memoryOverlay.clear(); return; }
    for (const key of physicalKeys()) {
      if (key.startsWith(PREFIX) && key !== INIT && key !== MAINTENANCE) {
        try { native.removeItem.call(this, key); } catch {}
      }
    }
  };
  proto.key = function(index) {
    if (!isStagingLocal(this)) return native.key.call(this, index);
    return stagingKeys()[Number(index) || 0] ?? null;
  };

  window.StagingStorageSandbox = {
    prefix: PREFIX,
    environment: "staging",
    listKeys: stagingKeys,
    isTestArtifactKey:testArtifactKey,
    beginMemoryOverlay,
    endMemoryOverlay,
    overlayActive:()=>!!memoryOverlay,
    resetVirtualStorage() {
      if (memoryOverlay) { memoryOverlay.clear(); return; }
      for (const key of physicalKeys()) {
        if (key.startsWith(PREFIX) && key !== INIT && key !== MAINTENANCE) {
          try { native.removeItem.call(local, key); } catch {}
        }
      }
    },
    diagnostics() {
      return {
        environment:"staging",
        stagedKeys:stagingKeys().length,
        liveKeysUntouched:physicalKeys().filter(k => !k.startsWith(PREFIX)).length,
        initialized:!!native.getItem.call(local, INIT),
        memoryOverlay:!!memoryOverlay
      };
    }
  };

  console.log("🧪 STAGING storage sandbox active — live localStorage isolated; full torture tests can run entirely in memory");
})();