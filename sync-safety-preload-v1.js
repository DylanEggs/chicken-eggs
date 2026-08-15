(() => {
  "use strict";
  if (window.FarmBootstrapSafety) return;

  // Old cached copies of sync-authority-v2 must become inert before they load.
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
  let retryTimer = null;

  // IMPORTANT: navigation must NEVER be disabled by sync startup.
  // Users may browse Home/Farm/Stats/History while Firebase is connecting.
  // Only actions that can change farm data are blocked until cloud-first
  // bootstrap completes.
  document.documentElement.classList.add("farm-sync-write-locked");

  function setStatus(text) {
    try {
      if (typeof window.setSyncStatus === "function") window.setSyncStatus(text);
      else {
        const el = document.getElementById("syncStatus");
        if (el) el.textContent = text;
      }
    } catch {}
  }

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
    if (key === "chickenEggBusinessV1") {
      return Array.isArray(x.chickenSales) ? x.chickenSales.length * 5 : 0;
    }
    if (key === "chickenEggInventoryV2") {
      return (Array.isArray(x.adjustments) ? x.adjustments.length : 0)
        + (Number(x.dozens) || 0)
        + (Number(x.packs18) || 0)
        + (Number(x.loose) || 0) / 12;
    }
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

  function isNavigationButton(button) {
    if (!button) return false;
    if (button.closest(".bottomNav")) return true;
    if (button.classList.contains("backMini")) return true;
    if (button.classList.contains("flock-photo-viewer-close")) return true;
    if (button.closest("#flockPhotoViewer")) return true;
    const inline = button.getAttribute("onclick") || "";
    if (/\bshowScreen\s*\(/.test(inline)) return true;
    if (button.classList.contains("secondary") && /^back$/i.test(button.textContent.trim())) return true;
    return false;
  }

  // Cloud-first safety without freezing the app. Navigation remains available;
  // saves/deletes/adjustments wait until Firebase has established authority.
  document.addEventListener("click", event => {
    if (!locked) return;
    const button = event.target?.closest?.("button");
    if (!button || isNavigationButton(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus(navigator.onLine
      ? "Still syncing — viewing is safe; changes are temporarily locked"
      : "Offline — viewing is safe; changes are locked until sync returns");
  }, true);

  function scheduleOneSafeRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (!locked || !navigator.onLine) return;
      const now = Date.now();
      const last = Number(sessionStorage.getItem("farmSafeRetryAt") || 0);
      if (now - last < 60000) {
        setStatus("Sync unavailable — viewing only; no cloud writes allowed");
        return;
      }
      sessionStorage.setItem("farmSafeRetryAt", String(now));
      setStatus("Retrying Firebase safely...");
      console.warn("🔄 Safe bootstrap still locked; performing one clean retry");
      setTimeout(() => location.reload(), 250);
    }, 18000);
  }

  window.FarmBootstrapSafety = {
    nativeSetItem,
    isLocked: () => locked,
    unlock() {
      locked = false;
      clearTimeout(retryTimer);
      document.documentElement.classList.remove("farm-sync-write-locked");
      document.documentElement.classList.remove("farm-sync-loading");
      console.log("✅ Startup write lock released after cloud bootstrap");
    },
    runBypass(fn) {
      bypass = true;
      try { return fn(); }
      finally { bypass = false; }
    }
  };

  // If this phone started offline or only half-loaded, reconnect gets a clean
  // cloud-first bootstrap instead of allowing stale cached state to continue.
  window.addEventListener("online", () => {
    if (!locked || reconnectReloaded) return;
    reconnectReloaded = true;
    setStatus("Internet returned — reloading farm safely...");
    setTimeout(() => location.reload(), 180);
  });

  scheduleOneSafeRetry();
  console.log("🔒 Farm startup write lock active; navigation remains available");
})();
