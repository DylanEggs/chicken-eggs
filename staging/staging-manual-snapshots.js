(() => {
  "use strict";
  if (window.__ChickenEggsStagingManualSnapshots) return;
  window.__ChickenEggsStagingManualSnapshots = true;
  if (!window.__ChickenEggsStagingMode) return;

  const BASELINE_KEY = "chickenEggManualStagingBaselineV1";
  const EXCLUDE = new Set([BASELINE_KEY]);

  function snapshot() {
    const out = {};
    const keys = window.StagingStorageSandbox?.listKeys?.() || [];
    for (const key of keys) {
      if (EXCLUDE.has(key)) continue;
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
      data
    };
    localStorage.setItem(BASELINE_KEY, JSON.stringify(record));
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
        if (EXCLUDE.has(key)) continue;
        try { localStorage.removeItem(key); } catch {}
      }
      for (const [key, value] of Object.entries(record.data)) {
        if (EXCLUDE.has(key)) continue;
        localStorage.setItem(key, String(value));
      }
    } finally {
      window.__farmApplyingRemote = oldRemote;
    }
    reloadMemory("restore-baseline");
    window.dispatchEvent(new CustomEvent("staging-baseline-restored", { detail:{ savedAt:record.savedAt, keys:record.keys } }));
    return { restored:true, savedAt:record.savedAt, keys:record.keys };
  }

  async function refreshFromLiveAndSaveBaseline() {
    const ok = await window.StagingSandbox?.resetFromLive?.();
    if (ok === false) throw new Error("Live snapshot refresh was unavailable.");
    const saved = await saveBaseline("Fresh live-data baseline");
    reloadMemory("refresh-live-baseline");
    return saved;
  }

  window.StagingManualSnapshots = {
    version: 1,
    baselineKey: BASELINE_KEY,
    snapshot,
    info: baselineInfo,
    saveBaseline,
    restoreBaseline,
    refreshFromLiveAndSaveBaseline
  };

  console.log("🧪 Manual staging baseline controls ready");
})();
