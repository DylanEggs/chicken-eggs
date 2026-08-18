(() => {
  "use strict";
  if (window.__StagingSaleStockGuardV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingSaleStockGuardV1 = true;

  const whole = v => Math.max(0, Math.round(Number(v) || 0));
  const rawNumber = id => Number(document.getElementById(id)?.value || 0);

  function editingSaleCredit() {
    try {
      if (typeof editingId === "undefined" || !editingId || typeof entries === "undefined" || !Array.isArray(entries)) return 0;
      const row = entries.find(e => String(e?.id || "") === String(editingId));
      if (!row || row.type !== "sale") return 0;
      return whole(row.dozenSold) * 12 + whole(row.packSold ?? row.packs18Sold) * 18;
    } catch {
      return 0;
    }
  }

  function availableEggsForThisSale() {
    let available = Number(window.InventorySystemV6?.available?.());
    if (!Number.isFinite(available)) {
      const s = window.InventorySystemV6?.state?.() || {};
      available = whole(s.dozens) * 12 + whole(s.packs18) * 18 + whole(s.loose);
    }
    return Math.max(0, Math.round(available)) + editingSaleCredit();
  }

  function requestedEggs() {
    return whole(rawNumber("dozenSold")) * 12 + whole(rawNumber("packSold")) * 18;
  }

  function install() {
    const original = window.saveSale;
    if (typeof original !== "function") {
      setTimeout(install, 75);
      return;
    }
    if (original.__stagingSaleStockGuardV1) return;

    const guarded = function() {
      const rawDozens = rawNumber("dozenSold");
      const rawPacks = rawNumber("packSold");

      if (rawDozens < 0 || rawPacks < 0 || !Number.isInteger(rawDozens) || !Number.isInteger(rawPacks)) {
        alert("Sale blocked — enter whole, non-negative carton quantities.");
        return false;
      }

      const needed = requestedEggs();
      if (needed > 0) {
        const available = availableEggsForThisSale();
        if (needed > available) {
          const short = needed - available;
          const message = `Sale blocked — this sale needs ${needed} eggs, but only ${available} are available. Reduce the sale by at least ${short} egg${short === 1 ? "" : "s"}.`;
          alert(message);
          window.dispatchEvent(new CustomEvent("staging-sale-stock-blocked", {
            detail:{ needed, available, short, at:Date.now() }
          }));
          return false;
        }
      }

      return original.apply(this, arguments);
    };

    guarded.__stagingSaleStockGuardV1 = true;
    guarded.__stagingOriginalSaveSale = original;
    window.saveSale = guarded;
    console.log("🛡️ STAGING sale stock guard active — oversized egg sales are blocked before save");
  }

  window.StagingSaleStockGuard = {
    version:1,
    requestedEggs,
    availableEggsForThisSale,
    editingSaleCredit
  };

  install();
})();