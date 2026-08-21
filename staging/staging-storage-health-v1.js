(() => {
  "use strict";
  if (window.__farmStorageHealthV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__farmStorageHealthV1 = true;

  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const SNAPSHOTS = "chickenEggApp2SnapshotsV1";
  let lastCleanup = null;

  const quotaError = error => !!error && (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 || error.code === 1014 ||
    /quota/i.test(String(error?.message || error || ""))
  );
  const testArtifact = key => /^chickenEggStaging/i.test(String(key || "")) && /test/i.test(String(key || ""));
  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };

  function usage() {
    let chars = 0;
    const rows = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const value = localStorage.getItem(key) || "";
        const size = String(key).length + value.length;
        chars += size;
        rows.push({ key:String(key), chars:size });
      }
    } catch {}
    rows.sort((a,b) => b.chars - a.chars);
    return { chars, approxBytes:chars * 2, top:rows.slice(0,12) };
  }

  function compact(reason = "staging-quota") {
    const before = usage();
    let removedReports = 0;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(String(key));
      }
      for (const key of keys) {
        if (!testArtifact(key)) continue;
        try { nativeRemoveItem.call(localStorage, key); removedReports++; } catch {}
      }

      const shots = read(SNAPSHOTS, []);
      if (Array.isArray(shots) && shots.length > 1) {
        try { nativeSetItem.call(localStorage, SNAPSHOTS, JSON.stringify(shots.slice(0,1))); } catch {}
      }
    } catch {}

    const after = usage();
    lastCleanup = {
      reason,
      at:Date.now(),
      removedReports,
      beforeBytes:before.approxBytes,
      afterBytes:after.approxBytes,
      freedBytes:Math.max(0, before.approxBytes - after.approxBytes)
    };
    try { window.dispatchEvent(new CustomEvent("farm-storage-health", { detail:lastCleanup })); } catch {}
    return lastCleanup;
  }

  Storage.prototype.setItem = function(key, value) {
    try {
      return nativeSetItem.call(this, key, value);
    } catch (error) {
      if (this !== window.localStorage || !quotaError(error)) throw error;
      console.warn("🧪 STAGING storage full; clearing disposable test reports and retrying", key);
      compact(`quota:${String(key)}`);
      try {
        return nativeSetItem.call(this, key, value);
      } catch (retryError) {
        if (!quotaError(retryError)) throw retryError;
        const message = `${String(retryError?.message || "Browser storage quota exceeded")}. STAGING could not fit the test write after clearing disposable test reports.`;
        const safe = new Error(message);
        safe.name = String(retryError?.name || "QuotaExceededError");
        throw safe;
      }
    }
  };

  window.FarmStorageHealth = {
    usage,
    compact,
    emergencyCompact:compact,
    getLastCleanup:() => lastCleanup,
    isQuotaError:quotaError,
    stagingOnly:true
  };

  console.log("🧪 STAGING storage health active — quota recovery clears only disposable sandbox test artifacts");
})();
