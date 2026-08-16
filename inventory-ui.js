(() => {
  "use strict";
  if (window.__inventoryUiCompatibilityV6) return;
  window.__inventoryUiCompatibilityV6 = true;

  // This file remains only for old cached app shells. It no longer owns inventory,
  // backups, timers, cloud writes, or feature imports. InventorySystemV6 owns the
  // physical inventory dataset.
  function patchEggSaving() {
    if (typeof window.saveEggs !== "function" || window.saveEggs.__goldenRemoved) return;
    const original = window.saveEggs;
    function saveWithoutGolden() {
      const realRandom = Math.random;
      Math.random = function() {
        const v = realRandom();
        if (v >= .012 && v < .055) return .055 + ((v - .012) / .043) * .12;
        return v;
      };
      try { return original.apply(this, arguments); }
      finally { Math.random = realRandom; }
    }
    saveWithoutGolden.__goldenRemoved = true;
    window.saveEggs = saveWithoutGolden;
  }

  function removeGoldenUi() {
    document.querySelectorAll("#farm2HubSummary .farm2-badge,#farm2FunSummary .farm2-card").forEach(el => {
      if (/Golden Eggs?/i.test(el.textContent || "")) el.remove();
    });
    const activity = document.getElementById("farm2Activity");
    if (activity) [...activity.children].forEach(row => {
      if (/Golden Egg/i.test(row.textContent || "")) row.remove();
    });
  }

  function init() {
    patchEggSaving();
    removeGoldenUi();
    window.addEventListener("core-data-synced", () => { patchEggSaving(); removeGoldenUi(); });
    window.addEventListener("farm-data-synced", removeGoldenUi);
    console.log("✅ Legacy inventory-ui retired; only Golden Egg compatibility remains");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 160), { once:true });
  else setTimeout(init, 160);
})();
