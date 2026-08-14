(() => {
  "use strict";
  if (window.__farmDataIntegrityV1) return;
  window.__farmDataIntegrityV1 = true;

  const INVENTORY_KEY = "chickenEggInventoryV2";
  const APP2_KEY = "chickenEggApp2V1";
  const CORE_ENTRIES_KEY = "chickenEggEntriesV102";
  const SETTINGS_KEY = "chickenEggSettingsV102";
  const BUSINESS_KEY = "chickenEggBusinessV1";
  const DELUXE_KEY = "chickenEggDeluxeV1";
  const FARM_KEYS = new Set([INVENTORY_KEY, APP2_KEY, BUSINESS_KEY, DELUXE_KEY]);
  let patchQueued = false;
  let syncTimer = null;
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

  function setText(el, text) {
    text = String(text);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function patchHubInventory() {
    const hub = document.getElementById("farm2HubSummary");
    if (!hub) return;
    const first = hub.querySelector(".farm2-grid2 .farm2-card");
    if (!first) return;
    const av = available();
    setText(first.querySelector(".farm2-kicker"), "Sellable Inventory");
    setText(first.querySelector(".farm2-moneyBig"), `${av} 🥚`);
    setText(first.querySelector(".farm2-subtle"), `${Math.floor(av / 12)} dozen + ${av % 12} loose after reservations`);
  }

  function patchTodayInventory() {
    const card = document.getElementById("farm2TodayCard");
    if (!card) return;
    const av = available();
    const r = reserved();
    const minis = card.querySelectorAll(".farm2-miniStat");
    if (minis.length >= 3) {
      setText(minis[0].querySelector("b"), av);
      setText(minis[0].querySelector("span"), "Eggs available");
      setText(minis[1].querySelector("b"), Math.floor(av / 12));
      setText(minis[1].querySelector("span"), "Full dozens");
      setText(minis[2].querySelector("b"), r);
      setText(minis[2].querySelector("span"), "Reserved eggs");
    }
    card.querySelectorAll(".farm2-subtle").forEach(el => {
      if ((el.textContent || "").trim().startsWith("Inventory:")) {
        setText(el, `Inventory: ${Math.floor(av / 12)} dozen + ${av % 12} loose`);
      }
    });
  }

  function patchOrderInventory() {
    const sum = document.getElementById("farm2OrderSummary");
    if (!sum) return;
    const cards = sum.querySelectorAll(".farm2-card");
    for (const card of cards) {
      const label = (card.querySelector(".farm2-kicker")?.textContent || "").trim();
      if (label === "Eggs Reserved") setText(card.querySelector(".farm2-moneyBig"), reserved());
      if (label === "Still Available") setText(card.querySelector(".farm2-moneyBig"), available());
    }
  }

  function patchSnapshots() {
    const snap = document.getElementById("xSnapshot");
    if (!snap) return;
    snap.querySelectorAll(".xstat").forEach(box => {
      if ((box.querySelector("span")?.textContent || "").trim() === "Available") {
        setText(box.querySelector("b"), available());
      }
    });
  }

  function patchAll() {
    patchQueued = false;
    patchHubInventory();
    patchTodayInventory();
    patchOrderInventory();
    patchSnapshots();
  }
  function schedulePatch() {
    if (patchQueued) return;
    patchQueued = true;
    requestAnimationFrame(patchAll);
  }

  function announceSynced() {
    const detail = {
      physical: physical(),
      reserved: reserved(),
      available: available(),
      at: Date.now()
    };
    window.dispatchEvent(new CustomEvent("farm-integrity-synced", { detail }));
    if (typeof window.setSyncStatus === "function") {
      window.setSyncStatus("Firebase synced " + new Date().toLocaleTimeString());
    }
  }

  async function catchUpWithFirebase() {
    if (syncing || !navigator.onLine) return;
    syncing = true;
    try {
      if (window.EggSyncAuthorityReady) await window.EggSyncAuthorityReady();
      if (typeof window.syncFarmNow === "function") await window.syncFarmNow();
      if (typeof window.refreshCoreFromFirebase === "function") await window.refreshCoreFromFirebase();
      schedulePatch();
      announceSynced();
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

  window.addEventListener("farm-data-synced", e => {
    if (!e.detail?.key || FARM_KEYS.has(e.detail.key)) schedulePatch();
  });
  window.addEventListener("core-data-synced", schedulePatch);
  window.addEventListener("storage", e => {
    if (FARM_KEYS.has(e.key) || e.key === CORE_ENTRIES_KEY || e.key === SETTINGS_KEY) schedulePatch();
  });
  window.addEventListener("online", () => scheduleCatchUp(100));
  window.addEventListener("pageshow", () => scheduleCatchUp(350));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleCatchUp(200);
  });

  function init() {
    const root = document.querySelector(".app") || document.body;
    const observer = new MutationObserver(schedulePatch);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    schedulePatch();
    scheduleCatchUp(900);
    setTimeout(() => scheduleCatchUp(0), 3500);
    window.FarmDataHealth = {
      physicalEggs: physical,
      reservedEggs: reserved,
      availableEggs: available,
      refresh: catchUpWithFirebase
    };
    console.log("✅ Farm data integrity guard active");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
