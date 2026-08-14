(() => {
  "use strict";
  if (window.__inventoryHubAuthorityV3) return;
  window.__inventoryHubAuthorityV3 = true;

  const INVENTORY_KEY = "chickenEggInventoryV2";
  const APP2_KEY = "chickenEggApp2V1";
  let queued = false;
  let showHookInstalled = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Math.max(0, Number(v) || 0); }
  function state() {
    const s = read(INVENTORY_KEY, {});
    return { dozens: n(s.dozens), packs18: n(s.packs18), loose: n(s.loose) };
  }
  function held() {
    const a = read(APP2_KEY, {});
    return (Array.isArray(a.orders) ? a.orders : [])
      .filter(o => o?.status === "pending")
      .reduce((sum, o) => sum + n(o.dozen) * 12 + n(o.packs18) * 18, 0);
  }
  function total(s) { return Math.round(s.dozens * 12 + s.packs18 * 18 + s.loose); }
  function packageText(s) {
    const parts = [];
    if (s.dozens) parts.push(`${s.dozens} dozen`);
    if (s.packs18) parts.push(`${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"}`);
    if (s.loose || !parts.length) parts.push(`${s.loose} loose`);
    return parts.join(" • ");
  }
  function setText(el, text) {
    text = String(text);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function renderHub() {
    queued = false;
    const summary = document.getElementById("farm2HubSummary");
    if (!summary) return;
    const card = [...summary.querySelectorAll(".farm2-card")]
      .find(c => /sellable inventory/i.test(c.querySelector(".farm2-kicker")?.textContent || c.textContent || ""));
    if (!card) return;

    const s = state();
    const reserved = held();
    const available = Math.max(0, total(s) - reserved);
    setText(card.querySelector(".farm2-kicker"), "Sellable Inventory");
    setText(card.querySelector(".farm2-moneyBig"), `${available} 🥚`);
    const note = reserved > 0
      ? `On hand: ${packageText(s)} • ${reserved} eggs reserved • ${available} available`
      : packageText(s);
    setText(card.querySelector(".farm2-subtle"), note);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(renderHub);
  }

  function installShowHook() {
    if (showHookInstalled) return;
    if (typeof window.showScreen !== "function") {
      setTimeout(installShowHook, 100);
      return;
    }
    showHookInstalled = true;
    const original = window.showScreen;
    if (original.__inventoryHubAuthorityV3) return;
    const wrapped = function(id) {
      const result = original.apply(this, arguments);
      if (id === "farm2Hub") setTimeout(schedule, 0);
      return result;
    };
    wrapped.__inventoryHubAuthorityV3 = true;
    window.showScreen = wrapped;
  }

  if (!window.__inventoryHubStorageHookV3) {
    window.__inventoryHubStorageHookV3 = true;
    const priorSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      priorSetItem.call(this, key, value);
      if (this === window.localStorage && [INVENTORY_KEY, APP2_KEY].includes(String(key))) schedule();
    };
  }

  window.addEventListener("farm-data-synced", schedule);
  window.addEventListener("storage", e => {
    if ([INVENTORY_KEY, APP2_KEY].includes(e.key)) schedule();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedule();
  });

  function init() {
    installShowHook();
    schedule();
    // One-time startup retries cover the asynchronous Firebase/App 2 startup load
    // without a polling timer or a MutationObserver.
    setTimeout(schedule, 300);
    setTimeout(schedule, 1200);
    console.log("✅ Exact inventory hub display active without redraw loops");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
