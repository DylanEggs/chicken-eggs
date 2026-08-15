(() => {
  "use strict";
  if (window.FarmBootstrapSafety?.version === "2") return;

  // Disable every older Firebase farm authority before deferred modules execute.
  // firebase-safe-v9.js is the only protected farm sync authority.
  window.__farmSafeFirebaseV8 = true;
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
    try {
      const x = JSON.parse(value);
      return x && typeof x === "object" ? x : null;
    } catch {
      return null;
    }
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
    if (
      !bypass &&
      locked &&
      this === window.localStorage &&
      PROTECTED.has(String(key)) &&
      !window.__farmApplyingRemote
    ) {
      const current = readObject(localStorage.getItem(String(key)));
      const next = readObject(value);
      if (next) {
        const oldStamp = Number(current?.updatedAt) || 0;
        const newStamp = Number(next.updatedAt) || 0;
        const clearlyRicher = richness(String(key), next) > richness(String(key), current) + 2;
        if (newStamp > oldStamp && !clearlyRicher) {
          next.updatedAt = oldStamp;
          value = JSON.stringify(next);
          console.log(`🔒 Startup timestamp held for ${String(key)}`);
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

  function isProtectedWriteButton(button) {
    if (!button) return false;
    const inline = button.getAttribute("onclick") || "";
    if (!inline) return false;
    return /(saveEggs|saveSale|saveFarmSettings|deleteAllEntries|deleteEntry|farm2(?:Add|Delete|Complete|Save)|inventory(?:SetExact|Remove|AddEggs)|biz(?:Save|Delete)ChickenSale)/.test(inline);
  }

  function isDestructiveButton(button) {
    const inline = button?.getAttribute("onclick") || "";
    return button?.classList.contains("danger")
      || button?.classList.contains("farm2-delete")
      || /(deleteAllEntries|deleteEntry|farm2Delete|bizDelete|inventoryRemove)/.test(inline);
  }

  async function waitForSyncApi(timeoutMs = 22000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (window.FarmSyncSafety?.ready) return window.FarmSyncSafety;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    throw new Error("Firebase sync engine did not load");
  }

  async function queueWriteUntilReady(button) {
    if (!button || button.dataset.farmQueued === "1") return;
    button.dataset.farmQueued = "1";
    const original = button.innerHTML;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = "⏳ Waiting for sync…";
    setStatus("Finishing Firebase sync before saving…");

    try {
      const api = await waitForSyncApi();
      await api.ready();
      if (locked) throw new Error("Firebase did not unlock writes");
      button.innerHTML = original;
      button.removeAttribute("aria-busy");
      delete button.dataset.farmQueued;
      if (button.isConnected) button.click();
    } catch (error) {
      console.warn("Queued farm save could not run yet:", error);
      button.innerHTML = original;
      button.removeAttribute("aria-busy");
      delete button.dataset.farmQueued;
      setStatus(navigator.onLine
        ? "Firebase is still retrying — your form is still here; tap Save again shortly"
        : "Offline — your form is still here; save when internet returns");
    }
  }

  // Navigation is always allowed. A non-destructive Add/Save tap made during
  // startup waits for cloud-first bootstrap, then automatically runs once.
  // Destructive actions never auto-run after a delay; the user taps again.
  document.addEventListener("click", event => {
    if (!locked) return;
    const button = event.target?.closest?.("button");
    if (!button || isNavigationButton(button) || !isProtectedWriteButton(button)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (isDestructiveButton(button)) {
      setStatus("Finish Firebase sync before deleting or removing data");
      return;
    }

    void queueWriteUntilReady(button);
  }, true);

  window.FarmBootstrapSafety = {
    version: "2",
    nativeSetItem,
    isLocked: () => locked,
    unlock() {
      locked = false;
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

  // If the page began offline before the v9 module could load, coming online
  // performs one clean reload. If the v9 engine exists, let it retry in place.
  window.addEventListener("online", () => {
    if (!locked || reconnectReloaded) return;
    if (window.FarmSyncSafety?.ready) {
      void window.FarmSyncSafety.ready().catch(() => {});
      return;
    }
    reconnectReloaded = true;
    setStatus("Internet returned — reloading farm safely…");
    setTimeout(() => location.reload(), 250);
  });

  console.log("🔒 Farm startup safety v2 active; navigation stays available");
})();