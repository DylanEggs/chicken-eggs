(() => {
  "use strict";
  if (window.__ChickenEggsStagingManualSnapshots) return;
  window.__ChickenEggsStagingManualSnapshots = true;
  if (!window.__ChickenEggsStagingMode) return;

  const BASELINE_KEY = "chickenEggManualStagingBaselineV1";
  const BASELINE_KEYS = [
    "chickenEggApp2V1",
    "chickenEggInventoryV2",
    "chickenEggEntriesV102",
    "chickenEggSettingsV102",
    "chickenEggDeluxeV1",
    "chickenEggBusinessV1",
    "chickenEggCustomerRequestsV1"
  ];

  function snapshot() {
    const out = {};
    for (const key of BASELINE_KEYS) {
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
    try { window.StagingCustomerRequestsV1?.render?.(); } catch {}
    window.dispatchEvent(new CustomEvent("core-data-synced", { detail:{ staging:true, manualSnapshot:true, reason } }));
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ staging:true, manualSnapshot:true, reason, key:"manual-snapshot" } }));
  }

  function baselineInfo() {
    try {
      const raw = localStorage.getItem(BASELINE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.version >= 1 ? parsed : null;
    } catch { return null; }
  }

  async function saveBaseline(label = "Manual test baseline") {
    await window.FarmSyncSafety?.ready?.();
    const data = snapshot();
    const seed = window.StagingSandbox?.seedInfo?.() || null;
    const record = {
      version: 2,
      label: String(label || "Manual test baseline"),
      savedAt: Date.now(),
      sourceSeedAt: Number(seed?.importedAt) || 0,
      sourceCoreEntries: Number(seed?.coreEntries) || 0,
      keys: Object.keys(data).length,
      baselineKeys: BASELINE_KEYS.slice(),
      data
    };
    try { localStorage.setItem(BASELINE_KEY, JSON.stringify(record)); }
    catch (error) { throw new Error(`Test baseline could not be saved: ${String(error?.message || error)}`); }
    window.dispatchEvent(new CustomEvent("staging-baseline-saved", { detail:{ ...record, data:undefined } }));
    return { saved:true, ...record, data:undefined };
  }

  async function restoreBaseline() {
    const record = baselineInfo();
    if (!record?.data || typeof record.data !== "object") throw new Error("No saved staging baseline exists yet.");
    const oldRemote = window.__farmApplyingRemote;
    window.__farmApplyingRemote = true;
    try {
      for (const key of BASELINE_KEYS) {
        try { localStorage.removeItem(key); } catch {}
      }
      for (const [key, value] of Object.entries(record.data)) {
        if (!BASELINE_KEYS.includes(key)) continue;
        localStorage.setItem(key, String(value));
      }
    } finally { window.__farmApplyingRemote = oldRemote; }
    reloadMemory("restore-baseline");
    window.dispatchEvent(new CustomEvent("staging-baseline-restored", { detail:{ savedAt:record.savedAt, keys:record.keys } }));
    return { restored:true, savedAt:record.savedAt, keys:record.keys };
  }

  function sourceResult() {
    return window.StagingSandbox?.liveSourceResult?.() || window.__StagingLiveSourceResult || window.StagingLocalSeedV1?.result || null;
  }

  async function refreshFromLiveAndSaveBaseline() {
    const ok = await window.StagingSandbox?.resetFromLive?.();
    const source = sourceResult();
    if (ok === false || !source?.verified) {
      const detail = source?.error || `source=${String(source?.source||"unknown")}, copied ${Number(source?.copied)||0}/${Number(source?.eligible)||0}`;
      throw new Error(`Fresh LIVE data could not be verified in TEST/STAGING: ${detail}`);
    }
    const saved = await saveBaseline("Fresh verified live-data baseline");
    reloadMemory("refresh-live-baseline");
    return { ...saved, liveSource:source.source || "verified-live" };
  }

  window.StagingManualSnapshots = {
    version: 4,
    baselineKey: BASELINE_KEY,
    baselineKeys: BASELINE_KEYS.slice(),
    snapshot,
    info: baselineInfo,
    saveBaseline,
    restoreBaseline,
    sourceResult,
    refreshFromLiveAndSaveBaseline
  };

  console.log("🧪 Manual staging baseline controls ready — compact authoritative baseline only");
})();