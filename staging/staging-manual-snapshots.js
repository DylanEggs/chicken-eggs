(() => {
  "use strict";
  if (window.__ChickenEggsStagingManualSnapshots) return;
  window.__ChickenEggsStagingManualSnapshots = true;
  if (!window.__ChickenEggsStagingMode) return;

  const BASELINE_KEY = "chickenEggManualStagingBaselineV1";
  const HEAVY_CACHE_KEYS = new Set([
    "chickenEggLocalBirdPhotosV1",
    "chickenEggBirdPhotoMetaV4",
    "chickenEggApp2SnapshotsV1"
  ]);
  const testArtifact = key => window.StagingStorageSandbox?.isTestArtifactKey?.(key) || (/^chickenEggStaging/i.test(String(key || "")) && /test/i.test(String(key || "")));
  const excluded = key => String(key) === BASELINE_KEY || HEAVY_CACHE_KEYS.has(String(key)) || testArtifact(key);

  function snapshot() {
    const out = {};
    const keys = window.StagingStorageSandbox?.listKeys?.() || [];
    for (const key of keys) {
      if (excluded(key)) continue;
      try {
        const value = localStorage.getItem(key);
        if (value !== null) out[key] = value;
      } catch {}
    }
    return out;
  }

  function reloadMemory(reason) {
    try { window.loadLocal?.(); } catch {}
    try { window.loadFarmSettings?.(); } catch {}
    try { window.__reloadFarm2Memory?.(); } catch {}
    try { window.updateApp?.(); } catch {}
    try { window.InventorySystemV6?.render?.(); } catch {}
    window.dispatchEvent(new CustomEvent("core-data-synced", { detail:{ staging:true, manualSnapshot:true, reason } }));
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ staging:true, manualSnapshot:true, reason, key:"manual-snapshot" } }));
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail:{ staging:true, manualSnapshot:true, reason } }));
  }

  function baselineInfo() {
    try {
      const raw = localStorage.getItem(BASELINE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }

  async function saveBaseline(label = "Manual test baseline") {
    await window.FarmSyncSafety?.ready?.();
    const data = snapshot();
    const seed = window.StagingSandbox?.seedInfo?.() || null;
    const record = {
      version: 1,
      label: String(label || "Manual test baseline"),
      savedAt: Date.now(),
      sourceSeedAt: Number(seed?.importedAt) || 0,
      sourceCoreEntries: Number(seed?.coreEntries) || 0,
      sourcePhotos: Number(seed?.photos) || 0,
      keys: Object.keys(data).length,
      excludedHeavyCaches: Array.from(HEAVY_CACHE_KEYS),
      data
    };
    try {
      localStorage.setItem(BASELINE_KEY, JSON.stringify(record));
    } catch (error) {
      throw new Error(`Test baseline could not be saved in browser storage: ${String(error?.message || error)}`);
    }
    window.dispatchEvent(new CustomEvent("staging-baseline-saved", { detail:{ ...record, data:undefined } }));
    return { saved:true, ...record, data:undefined };
  }

  async function restoreBaseline() {
    const record = baselineInfo();
    if (!record?.data || typeof record.data !== "object") throw new Error("No saved staging baseline exists yet.");
    const oldRemote = window.__farmApplyingRemote;
    window.__farmApplyingRemote = true;
    try {
      for (const key of window.StagingStorageSandbox?.listKeys?.() || []) {
        if (excluded(key)) continue;
        try { localStorage.removeItem(key); } catch {}
      }
      for (const [key, value] of Object.entries(record.data)) {
        if (excluded(key)) continue;
        localStorage.setItem(key, String(value));
      }
    } finally { window.__farmApplyingRemote = oldRemote; }
    reloadMemory("restore-baseline");
    window.dispatchEvent(new CustomEvent("staging-baseline-restored", { detail:{ savedAt:record.savedAt, keys:record.keys } }));
    return { restored:true, savedAt:record.savedAt, keys:record.keys };
  }

  async function refreshFromLiveAndSaveBaseline() {
    const ok = await window.StagingSandbox?.resetFromLive?.();
    if (ok === false) throw new Error("Live snapshot refresh was unavailable.");
    const mirror = window.StagingLocalSeedV1?.result;
    if (!mirror?.verified) {
      throw new Error(`LIVE mirror did not verify (copied ${Number(mirror?.copied)||0}/${Number(mirror?.eligible)||0}, skipped ${Number(mirror?.skipped)||0}, mismatches ${Array.isArray(mirror?.mismatchedKeys)?mirror.mismatchedKeys.length:Number(mirror?.mismatchedKeys)||0}).`);
    }
    const saved = await saveBaseline("Fresh live-data baseline");
    reloadMemory("refresh-live-baseline");
    return saved;
  }

  window.StagingManualSnapshots = {
    version: 3,
    baselineKey: BASELINE_KEY,
    snapshot,
    info: baselineInfo,
    saveBaseline,
    restoreBaseline,
    refreshFromLiveAndSaveBaseline
  };

  console.log("🧪 Manual staging baseline controls ready — large photo/snapshot caches excluded");
})();