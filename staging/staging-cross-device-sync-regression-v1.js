(() => {
  "use strict";
  if (window.__StagingCrossDeviceSyncRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingCrossDeviceSyncRegressionV1 = true;

  const ENTRIES = "chickenEggEntriesV102";
  const APP2 = "chickenEggApp2V1";
  const INVENTORY = "chickenEggInventoryV2";
  const SETTINGS = "chickenEggSettingsV102";
  const WEATHER = "chickenEggWeatherIntelligenceV2";
  const DELUXE = "chickenEggDeluxeV1";
  const PHOTOS = "chickenEggLocalBirdPhotosV1";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const n = v => Number(v) || 0;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const inventoryTotal = s => n(s?.dozens) * 12 + n(s?.packs18) * 18 + n(s?.loose);

  function snapshotStorage() {
    const out = {};
    for (const key of window.StagingStorageSandbox?.listKeys?.() || []) {
      const value = localStorage.getItem(key);
      if (value !== null) out[key] = value;
    }
    return out;
  }

  function restoreStorage(snap) {
    const oldRemote = window.__farmApplyingRemote;
    const oldInv = window.__inventoryRestoreV6;
    window.__farmApplyingRemote = true;
    window.__inventoryRestoreV6 = true;
    try {
      localStorage.clear();
      for (const [key, value] of Object.entries(snap || {})) localStorage.setItem(key, value);
    } finally {
      window.__farmApplyingRemote = oldRemote;
      window.__inventoryRestoreV6 = oldInv;
    }
    try { window.loadLocal?.(); } catch {}
    try { window.loadFarmSettings?.(); } catch {}
    try { window.__reloadFarm2Memory?.(); } catch {}
    try { window.updateApp?.(); } catch {}
    window.dispatchEvent(new CustomEvent("core-data-synced", { detail:{ staging:true, crossDeviceRestore:true } }));
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ staging:true, crossDeviceRestore:true, key:"restore" } }));
  }

  async function waitFor(fn, timeout = 3500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (fn()) return true; } catch {}
      await sleep(40);
    }
    return false;
  }

  function setField(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = String(value);
  }

  function publicSnapshot() {
    const builder = window.FarmPublicCustomerBuilderV2 || window.FarmPublicCustomerBuilderV1;
    if (!builder?.build) return null;
    const photoMap = read(PHOTOS, {});
    return builder.build({
      app2: read(APP2, {}),
      inventory: read(INVENTORY, {}),
      entries: read(ENTRIES, []),
      settings: read(SETTINGS, {}),
      weather: read(WEATHER, {}),
      deluxe: read(DELUXE, {}),
      photoResolver: id => typeof photoMap?.[String(id || "")] === "string" ? photoMap[String(id || "")] : ""
    });
  }

  async function runRegression() {
    const results = [];
    const check = (name, pass, detail = "") => {
      results.push({ name, pass: !!pass, detail: String(detail || "") });
      if (!pass) console.warn("STAGING CROSS-DEVICE FAIL:", name, detail);
    };
    const snap = snapshotStorage();
    const oldAlert = window.alert;
    const oldConfirm = window.confirm;
    window.alert = () => {};
    window.confirm = () => true;

    try {
      const probe = await window.StagingLiveFirebaseProbeV1?.run?.();
      check("Live Firebase anonymous probe runs", !!probe, JSON.stringify(probe || {}));
      check("Normal Egg App anonymous auth can reach live Firebase", probe?.ok === true, JSON.stringify(probe || {}));
      check("Live Firebase probe is using an anonymous device session", probe?.anonymous === true && probe?.uidPresent === true, JSON.stringify(probe || {}));
      check("Anonymous device session can read shared inventory and farm data", probe?.inventoryReadable === true && probe?.app2Readable === true, JSON.stringify(probe || {}));

      const app = read(APP2, {});
      app.orders = [];
      localStorage.setItem(APP2, JSON.stringify(app));
      try { window.__reloadFarm2Memory?.(); } catch {}

      await window.InventorySystemV6?.commitExact?.(2, 2, 21);
      await sleep(120);
      check("Cross-device regression starts from 81 eggs", inventoryTotal(window.InventorySystemV6?.state?.()) === 81, JSON.stringify(window.InventorySystemV6?.state?.() || {}));

      const before = read(ENTRIES, []);
      const beforeIds = new Set(before.map(e => String(e?.id || "")));
      setField("eggDate", today());
      setField("eggCount", 13);
      window.saveEggs?.();
      await waitFor(() => read(ENTRIES, []).some(e => e?.id && !beforeIds.has(String(e.id))));
      await sleep(180);

      const after = read(ENTRIES, []);
      const added = after.find(e => e?.id && !beforeIds.has(String(e.id))) || null;
      check("Device A creates one new 13-egg history row", !!added && n(added.eggs) === 13 && after.length === before.length + 1, JSON.stringify(added || {}));
      check("Device A exact inventory moves from 81 to 94", inventoryTotal(window.InventorySystemV6?.state?.()) === 94, JSON.stringify(window.InventorySystemV6?.state?.() || {}));

      const deviceBEntries = await window.ChickenEggsDB?.loadEntries?.();
      const deviceBSeesEntry = Array.isArray(deviceBEntries) && !!added && deviceBEntries.some(e => String(e?.id || "") === String(added.id) && n(e?.eggs) === 13);
      check("Shared database layer exposes Device A egg row to a second logical device", deviceBSeesEntry, JSON.stringify({ addedId:added?.id, rows:Array.isArray(deviceBEntries)?deviceBEntries.length:null }));

      const publicAfterAdd = publicSnapshot();
      check("Customer snapshot updates to the same 94 available eggs", n(publicAfterAdd?.summary?.availability?.eggs) === 94, JSON.stringify(publicAfterAdd?.summary?.availability || {}));

      if (added?.id) {
        window.deleteEntry?.(added.id);
        await waitFor(() => !read(ENTRIES, []).some(e => String(e?.id || "") === String(added.id)));
        await sleep(220);
      }
      check("Deleting the test collection returns exact inventory to 81", inventoryTotal(window.InventorySystemV6?.state?.()) === 81, JSON.stringify(window.InventorySystemV6?.state?.() || {}));

      const deviceBAfterDelete = await window.ChickenEggsDB?.loadEntries?.();
      check("Second logical device no longer sees the deleted collection", !!added && Array.isArray(deviceBAfterDelete) && !deviceBAfterDelete.some(e => String(e?.id || "") === String(added.id)), JSON.stringify({ addedId:added?.id, rows:Array.isArray(deviceBAfterDelete)?deviceBAfterDelete.length:null }));

      const publicAfterDelete = publicSnapshot();
      check("Customer snapshot returns to the same 81 available eggs", n(publicAfterDelete?.summary?.availability?.eggs) === 81, JSON.stringify(publicAfterDelete?.summary?.availability || {}));
    } catch (error) {
      check("Cross-device sync regression completed without exception", false, String(error?.stack || error));
    } finally {
      restoreStorage(snap);
      await sleep(120);
      window.alert = oldAlert;
      window.confirm = oldConfirm;
    }
    return results;
  }

  function install() {
    const base = window.StagingFullTest;
    if (!base?.run || base.__crossDeviceSyncRegressionV1) {
      setTimeout(install, 100);
      return;
    }
    const baseRun = base.run.bind(base);
    window.StagingFullTest = {
      ...base,
      async run() {
        const first = await baseRun();
        const extra = await runRegression();
        const results = [...(first?.results || []), ...extra];
        const failed = results.filter(x => !x.pass);
        const report = {
          ...first,
          total: results.length,
          passed: results.length - failed.length,
          failed: failed.length,
          results,
          suite: `${first?.suite || "staging-full"}+cross-device-sync-v1`
        };
        try { localStorage.setItem("chickenEggStagingCrossDeviceSyncReportV1", JSON.stringify(report)); } catch {}
        return report;
      },
      __crossDeviceSyncRegressionV1: true
    };
    console.log("🧪 STAGING cross-device sync regression active — live anonymous Firebase read plus 81→94→81 flow");
  }

  setTimeout(install, 1650);
})();
