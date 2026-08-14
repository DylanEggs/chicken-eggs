(() => {
  "use strict";
  if (window.__farmDataIntegrityV1) return;
  window.__farmDataIntegrityV1 = true;

  const INVENTORY_KEY = "chickenEggInventoryV2";
  const APP2_KEY = "chickenEggApp2V1";
  let syncTimer = null;
  let healthTimer = null;
  let syncing = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Math.max(0, Number(v) || 0); }

  function inventoryState() {
    const x = read(INVENTORY_KEY, {});
    return {
      dozens: n(x?.dozens),
      packs18: n(x?.packs18),
      loose: n(x?.loose),
      updatedAt: Number(x?.updatedAt) || 0
    };
  }
  function app2State() {
    const x = read(APP2_KEY, {});
    return { ...x, orders: Array.isArray(x?.orders) ? x.orders : [] };
  }
  function physical() {
    const x = inventoryState();
    return Math.round(x.dozens * 12 + x.packs18 * 18 + x.loose);
  }
  function reserved() {
    return app2State().orders
      .filter(o => o?.status === "pending")
      .reduce((sum, o) => sum + n(o.dozen) * 12 + n(o.packs18) * 18, 0);
  }
  function available() { return Math.max(0, physical() - reserved()); }

  function announceHealth() {
    clearTimeout(healthTimer);
    healthTimer = null;
    window.dispatchEvent(new CustomEvent("farm-integrity-synced", {
      detail: {
        physical: physical(),
        reserved: reserved(),
        available: available(),
        at: Date.now()
      }
    }));
  }
  function scheduleHealth(delay = 0) {
    clearTimeout(healthTimer);
    healthTimer = setTimeout(announceHealth, delay);
  }

  async function catchUpWithFirebase() {
    if (syncing || !navigator.onLine) return;
    syncing = true;
    try {
      if (window.EggSyncAuthorityReady) await window.EggSyncAuthorityReady();
      if (typeof window.syncFarmNow === "function") await window.syncFarmNow();
      if (typeof window.refreshCoreFromFirebase === "function") await window.refreshCoreFromFirebase();
      scheduleHealth();
      if (typeof window.setSyncStatus === "function") {
        window.setSyncStatus("Firebase synced " + new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.warn("Farm catch-up sync skipped:", error);
    } finally {
      syncing = false;
    }
  }
  function scheduleCatchUp(delay = 250) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(catchUpWithFirebase, delay);
  }

  // Data integrity is intentionally data-only. UI rendering belongs to the
  // dedicated inventory / farm consistency layers so two modules cannot fight
  // over the same DOM nodes and cause flicker.
  window.addEventListener("farm-data-synced", () => scheduleHealth(0));
  window.addEventListener("core-data-synced", () => scheduleHealth(0));
  window.addEventListener("storage", e => {
    if ([INVENTORY_KEY, APP2_KEY].includes(e.key)) scheduleHealth(0);
  });
  window.addEventListener("online", () => scheduleCatchUp(100));
  window.addEventListener("pageshow", () => scheduleCatchUp(350));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleCatchUp(200);
  });

  function init() {
    scheduleHealth();
    scheduleCatchUp(900);
    setTimeout(() => scheduleCatchUp(0), 3500);
    window.FarmDataHealth = {
      physicalEggs: physical,
      reservedEggs: reserved,
      availableEggs: available,
      refresh: catchUpWithFirebase
    };
    console.log("✅ Farm data integrity active without DOM redraws");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
