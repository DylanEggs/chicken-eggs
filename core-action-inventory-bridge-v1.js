(() => {
  "use strict";
  if (window.__coreActionInventoryBridgeV1) return;
  window.__coreActionInventoryBridgeV1 = true;

  const ENTRIES_KEY = "chickenEggEntriesV102";
  let installed = false;

  function readEntries() {
    try {
      const rows = JSON.parse(localStorage.getItem(ENTRIES_KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch { return []; }
  }
  function cloneRows(rows) {
    try { return JSON.parse(JSON.stringify(rows)); }
    catch { return Array.isArray(rows) ? rows.slice() : []; }
  }
  function n(v) { return Number(v) || 0; }
  function contribution(e) {
    if (!e) return 0;
    if (e.type === "eggs") return Math.max(0,n(e.eggs));
    if (e.type === "sale") return -(Math.max(0,n(e.dozenSold))*12 + Math.max(0,n(e.packSold ?? e.packs18Sold))*18);
    return 0;
  }
  function balance(rows = readEntries()) { return rows.reduce((s,e)=>s+contribution(e),0); }

  function wrap(name, label) {
    const original = window[name];
    if (typeof original !== "function") return false;
    if (original.__coreActionInventoryBridgeV1) return true;

    const wrapped = function() {
      const beforeRows = cloneRows(readEntries());
      const beforeBalance = balance(beforeRows);
      const result = original.apply(this, arguments);
      const afterRows = cloneRows(readEntries());
      const afterBalance = balance(afterRows);
      const delta = Math.round(afterBalance-beforeBalance);

      if (typeof window.applyCoreInventoryEntryDiff === "function") {
        window.applyCoreInventoryEntryDiff(beforeRows, afterRows, label);
      } else if (delta && typeof window.applyCoreInventoryDelta === "function") {
        // Compatibility fallback for an older authority generation.
        window.applyCoreInventoryDelta(
          delta,
          label,
          `Direct ${name} bridge verified core history delta ${delta >= 0 ? "+" : ""}${delta}`
        );
      }
      return result;
    };
    wrapped.__coreActionInventoryBridgeV1 = true;
    wrapped.__coreActionInventoryOriginal = original;
    window[name] = wrapped;
    return true;
  }

  function install() {
    if (installed) return;
    if (!window.CoreInventoryAuthorityV3 || (typeof window.applyCoreInventoryEntryDiff !== "function" && typeof window.applyCoreInventoryDelta !== "function")) {
      setTimeout(install,50); return;
    }
    const ready = [
      wrap("saveEggs","Egg collection"),
      wrap("saveSale","Egg sale"),
      wrap("deleteEntry","History entry correction")
    ].every(Boolean);
    if (!ready) { setTimeout(install,50); return; }
    installed = true;
    console.log("✅ Direct core-action inventory bridge active — carton-aware entry diffs");
  }

  window.CoreActionInventoryBridgeV1 = { isInstalled:()=>installed, balance };
  install();
})();
