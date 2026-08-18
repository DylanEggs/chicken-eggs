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

  // First launch takes a read-only copy of the browser's current live app keys.
  // The originals are never modified. Cloud seeding can later refresh the copy.
  if (!native.getItem.call(local, INIT)) {
    const liveKeys = physicalKeys().filter(k => !k.startsWith(PREFIX) && relevantLiveKey(k));
    for (const key of liveKeys) {
      try {
        const value = native.getItem.call(local, key);
        if (value != null) native.setItem.call(local, stageKey(key), stripLargePhotoPayload(key, value));
      } catch {}
    }
    native.setItem.call(local, INIT, JSON.stringify({ at: Date.now(), copiedKeys: liveKeys.length }));
  }

  // Clean up an oversized photo cache left behind by an older staging build.
  // This touches only prefixed staging keys, never the live app keys.
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
    return native.setItem.call(this, stageKey(key), stripLargePhotoPayload(key, value));
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

  console.log("🧪 STAGING storage sandbox active — live localStorage is isolated and oversized copied photo caches are trimmed");
})();
