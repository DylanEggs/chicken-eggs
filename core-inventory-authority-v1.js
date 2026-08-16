(() => {
  "use strict";
  if (window.__coreInventoryAuthorityV1) return;
  window.__coreInventoryAuthorityV1 = true;

  const ENTRIES_KEY = "chickenEggEntriesV102";
  const INVENTORY_KEY = "chickenEggInventoryV2";
  let installed = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function physical(s) {
    s = s && typeof s === "object" ? s : {};
    return Math.max(0, Math.round(n(s.dozens)*12 + n(s.packs18)*18 + n(s.loose)));
  }
  function coreBalance() {
    const rows = read(ENTRIES_KEY, []);
    let collected = 0, sold = 0;
    for (const e of Array.isArray(rows) ? rows : []) {
      if (!e) continue;
      if (e.type === "eggs") collected += Math.max(0, n(e.eggs));
      if (e.type === "sale") sold += Math.max(0, n(e.dozenSold))*12 + Math.max(0, n(e.packSold ?? e.packs18Sold))*18;
    }
    return collected - sold;
  }
  function pack(total) {
    total = Math.max(0, Math.round(n(total)));
    return { dozens:0, packs18:Math.floor(total/18), loose:total%18 };
  }
  function reasonFor(name, delta) {
    if (name === "saveEggs") return delta >= 0 ? "Egg collection" : "Egg collection edit";
    if (name === "saveSale") return "Egg sale";
    if (name === "deleteEntry") return "History entry correction";
    return "Core inventory update";
  }
  function applyDelta(delta, name) {
    delta = Math.round(n(delta));
    if (!delta) return;

    const state = read(INVENTORY_KEY, { version:3, dozens:0, packs18:0, loose:0, adjustments:[], updatedAt:0 });
    const before = physical(state);
    const after = Math.max(0, before + delta);
    Object.assign(state, pack(after));
    state.version = Math.max(3, n(state.version));
    state.adjustments = Array.isArray(state.adjustments) ? state.adjustments : [];
    state.adjustments.unshift({
      id:`coreinv-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      date:today(),
      at:Date.now(),
      delta:after-before,
      reason:reasonFor(name, delta),
      details:`Automatic update from ${name}`,
      totalAfter:after
    });
    state.adjustments = state.adjustments.slice(0,100);
    state.updatedAt = Date.now();
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(state));

    window.dispatchEvent(new CustomEvent("farm-integrity-synced", {
      detail:{ source:"core-inventory-authority-v1", delta:after-before, physical:after, at:Date.now() }
    }));
    if (typeof window.syncFarmNow === "function") void Promise.resolve(window.syncFarmNow()).catch(()=>{});
    console.log(`✅ Core inventory authority applied ${after-before >= 0 ? "+" : ""}${after-before} eggs from ${name}; on hand ${after}`);
  }

  function wrap(name) {
    const original = window[name];
    if (typeof original !== "function" || original.__coreInventoryAuthorityV1) return false;
    const wrapped = function() {
      const before = coreBalance();
      const result = original.apply(this, arguments);
      const after = coreBalance();
      applyDelta(after-before, name);
      return result;
    };
    wrapped.__coreInventoryAuthorityV1 = true;
    wrapped.__coreInventoryOriginal = original;
    window[name] = wrapped;
    return true;
  }

  function install() {
    if (installed) return;
    const ready = ["saveEggs","saveSale","deleteEntry"].every(name => typeof window[name] === "function");
    if (!ready) { setTimeout(install, 50); return; }
    ["saveEggs","saveSale","deleteEntry"].forEach(wrap);
    installed = true;
    window.__inventoryCorrectionHooksInstalled = true;
    console.log("✅ Core inventory authority v1 active — egg history and physical inventory move together");
  }

  window.CoreInventoryAuthorityV1 = {
    isInstalled:() => installed,
    coreBalance,
    physical:() => physical(read(INVENTORY_KEY,{}))
  };

  install();
})();
