(() => {
  "use strict";
  if (window.__ChickenEggsStagingStorage) return;
  window.__ChickenEggsStagingStorage = true;
  window.__ChickenEggsEnvironment = "staging";
  window.__ChickenEggsStagingMode = true;

  const PREFIX = "__chicken_eggs_staging__::";
  const INIT = PREFIX + "__initialized__";
  const PHOTO_CACHE = "chickenEggLocalBirdPhotosV1";
  const DELUXE = "chickenEggDeluxeV1";
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

  function stripLargePhotoPayload(key, value) {
    const k = String(key || "");
    const text = String(value ?? "");
    if (k === PHOTO_CACHE && text.length > LARGE_CACHE_LIMIT) return "{}";
    if (k === DELUXE && text.length > LARGE_CACHE_LIMIT && text.includes("birdPhotoUrls")) {
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
          at:Number(obj.at)||Date.now(),
          startedAt:Number(obj.startedAt)||0,
          durationMs:Number(obj.durationMs)||0,
          total:Number(obj.total)||0,
          passed:Number(obj.passed)||0,
          failed:Number(obj.failed)||failures.length,
          suite:String(obj.suite||"staging-test"),
          results:failures,
          compactedForStagingStorage:true
        });
      }
    } catch {}
    return JSON.stringify({compactedForStagingStorage:true,originalChars:text.length});
  }

  function normalizeValue(key, value) {
    return compactTestReport(key, stripLargePhotoPayload(key, value));
  }

  if (!native.getItem.call(local, INIT)) {
    const liveKeys = physicalKeys().filter(k => !k.startsWith(PREFIX) && relevantLiveKey(k));
    for (const key of liveKeys) {
      try {
        const value = native.getItem.call(local, key);
        if (value != null) native.setItem.call(local, stageKey(key), normalizeValue(key, value));
      } catch {}
    }
    native.setItem.call(local, INIT, JSON.stringify({ at: Date.now(), copiedKeys: liveKeys.length }));
  }

  // Disposable staging test reports from older runs can consume a surprising
  // amount of localStorage. Delete those on startup; they are not farm data.
  for (const physicalKey of physicalKeys()) {
    if (!physicalKey.startsWith(PREFIX) || physicalKey === INIT) continue;
    const virtualKey = physicalKey.slice(PREFIX.length);
    if (!testArtifactKey(virtualKey)) continue;
    try { native.removeItem.call(local, physicalKey); } catch {}
  }

  try {
    const cached = native.getItem.call(local, stageKey(PHOTO_CACHE));
    if (cached && cached.length > LARGE_CACHE_LIMIT) native.setItem.call(local, stageKey(PHOTO_CACHE), "{}");
    const deluxeRaw = native.getItem.call(local, stageKey(DELUXE));
    if (deluxeRaw) {
      const compacted = stripLargePhotoPayload(DELUXE, deluxeRaw);
      if (compacted !== deluxeRaw) native.setItem.call(local, stageKey(DELUXE), compacted);
    }
  } catch {}

  function isStagingLocal(self) {
    return self === local && window.__ChickenEggsStagingMode === true;
  }
  function stagingKeys() {
    return physicalKeys()
      .filter(k => k.startsWith(PREFIX) && k !== INIT)
      .map(k => k.slice(PREFIX.length));
  }

  proto.getItem = function(key) {
    if (!isStagingLocal(this)) return native.getItem.call(this, key);
    return native.getItem.call(this, stageKey(key));
  };
  proto.setItem = function(key, value) {
    if (!isStagingLocal(this)) return native.setItem.call(this, key, value);
    return native.setItem.call(this, stageKey(key), normalizeValue(key, value));
  };
  proto.removeItem = function(key) {
    if (!isStagingLocal(this)) return native.removeItem.call(this, key);
    return native.removeItem.call(this, stageKey(key));
  };
  proto.clear = function() {
    if (!isStagingLocal(this)) return native.clear.call(this);
    for (const key of physicalKeys()) {
      if (key.startsWith(PREFIX) && key !== INIT) {
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
    resetVirtualStorage() {
      for (const key of physicalKeys()) {
        if (key.startsWith(PREFIX) && key !== INIT) {
          try { native.removeItem.call(local, key); } catch {}
        }
      }
    },
    diagnostics() {
      return {
        environment: "staging",
        stagedKeys: stagingKeys().length,
        liveKeysUntouched: physicalKeys().filter(k => !k.startsWith(PREFIX)).length,
        initialized: !!native.getItem.call(local, INIT)
      };
    }
  };

  console.log("🧪 STAGING storage sandbox active — live localStorage isolated; photo caches trimmed and disposable test reports compacted");
})();
