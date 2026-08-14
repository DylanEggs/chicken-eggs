(() => {
  "use strict";
  if (window.FarmBootstrapSafety) return;

  // Old cached copies of sync-authority-v2 must become inert before they load.
  // The protected Firebase authority will provide the compatibility API later.
  window.__eggSyncAuthorityV3 = true;
  window.__eggSyncAuthorityV2 = true;

  const PROTECTED = new Set([
    "chickenEggApp2V1",
    "chickenEggInventoryV2",
    "chickenEggBusinessV1",
    "chickenEggDeluxeV1"
  ]);
  const nativeSetItem = Storage.prototype.setItem;
  let locked = true;
  let bypass = false;
  let reconnectReloaded = false;

  // Disable write/navigation buttons immediately, before the deferred Firebase
  // module has even had a chance to start. This closes the startup race.
  const style = document.createElement("style");
  style.id = "farmBootstrapSafetyCss";
  style.textContent = `.farm-sync-loading .screen button,.farm-sync-loading .bottomNav button{pointer-events:none!important;opacity:.72}.farm-sync-loading #syncStatus{opacity:.9}`;
  (document.head || document.documentElement).appendChild(style);
  document.documentElement.classList.add("farm-sync-loading");

  function readObject(value) {
    try { const x = JSON.parse(value); return x && typeof x === "object" ? x : null; }
    catch { return null; }
  }
  function richness(key, value) {
    const x = value && typeof value === "object" ? value : {};
    if (key === "chickenEggApp2V1") {
      return (Array.isArray(x.flock) ? x.flock.length * 10 : 0)
        + (Array.isArray(x.expenses) ? x.expenses.length * 5 : 0)
        + (Array.isArray(x.customers) ? x.customers.length * 4 : 0)
        + (Array.isArray(x.orders) ? x.orders.length * 3 : 0)
        + (Array.isArray(x.chores) ? x.chores.length * 2 : 0);
    }
    if (key === "chickenEggBusinessV1") return Array.isArray(x.chickenSales) ? x.chickenSales.length * 5 : 0;
    if (key === "chickenEggInventoryV2") return (Array.isArray(x.adjustments) ? x.adjustments.length : 0) + (Number(x.dozens)||0) + (Number(x.packs18)||0) + (Number(x.loose)||0)/12;
    return Object.keys(x).length;
  }

  Storage.prototype.setItem = function(key, value) {
    if (!bypass && locked && this === window.localStorage && PROTECTED.has(String(key)) && !window.__farmApplyingRemote) {
      const currentRaw = localStorage.getItem(String(key));
      const current = readObject(currentRaw);
      const next = readObject(value);
      if (next) {
        const oldStamp = Number(current?.updatedAt) || 0;
        const newStamp = Number(next.updatedAt) || 0;
        const clearlyRicher = richness(String(key), next) > richness(String(key), current) + 2;
        if (newStamp > oldStamp && !clearlyRicher) {
          next.updatedAt = oldStamp;
          value = JSON.stringify(next);
          console.log(`🔒 Startup write timestamp held for ${String(key)}`);
        }
      }
    }
    return nativeSetItem.call(this, key, value);
  };

  window.FarmBootstrapSafety = {
    nativeSetItem,
    isLocked: () => locked,
    unlock() {
      locked = false;
      document.documentElement.classList.remove("farm-sync-loading");
      console.log("✅ Startup write lock released after cloud bootstrap");
    },
    runBypass(fn) { bypass = true; try { return fn(); } finally { bypass = false; } }
  };

  // If this phone started while offline or only half-loaded, never resume that
  // same startup session. Reconnect gets a clean page load and fresh cloud-first
  // bootstrap instead of allowing stale cached state to continue.
  window.addEventListener("online", () => {
    if (!locked || reconnectReloaded) return;
    reconnectReloaded = true;
    console.log("🔄 Network returned before safe bootstrap; reloading cleanly");
    setTimeout(() => location.reload(), 120);
  });

  console.log("🔒 Farm startup write lock active");
})();
