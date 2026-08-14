(() => {
  "use strict";
  if (window.__farmAppStableRuntimeV1) return;
  window.__farmAppStableRuntimeV1 = true;

  const INVENTORY_KEY = "chickenEggInventoryV2";
  const APP2_KEY = "chickenEggApp2V1";
  let syncTimer = null;
  let syncing = false;

  // Disable every older inventory-correction generation before Farm App 2 renders.
  // Some older iPhone/Safari caches can still request those files; these flags make
  // them exit immediately instead of competing with the current renderer.
  window.__inventoryPackagingDisplayV1 = true;
  window.__inventoryPackagingDisplayV2 = true;
  window.__inventoryHubAuthorityV3 = true;
  window.__farmDataIntegrityV1 = true;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Math.max(0, Number(v) || 0); }
  function inventory() {
    const s = read(INVENTORY_KEY, {});
    return { dozens:n(s.dozens), packs18:n(s.packs18), loose:n(s.loose) };
  }
  function app2() {
    const a = read(APP2_KEY, {});
    return { ...a, orders:Array.isArray(a.orders) ? a.orders : [] };
  }
  function onHand(s = inventory()) {
    return Math.round(s.dozens * 12 + s.packs18 * 18 + s.loose);
  }
  function reserved() {
    return app2().orders
      .filter(o => o?.status === "pending")
      .reduce((sum,o) => sum + n(o.dozen) * 12 + n(o.packs18) * 18, 0);
  }
  function available() { return Math.max(0, onHand() - reserved()); }
  function packaging(s = inventory()) {
    const parts = [];
    if (s.dozens) parts.push(`${s.dozens} dozen`);
    if (s.packs18) parts.push(`${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"}`);
    if (s.loose || !parts.length) parts.push(`${s.loose} loose`);
    return parts.join(" • ");
  }
  function setText(el, value) {
    const text = String(value);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function correctToday(root) {
    if (!root) return;
    const s = inventory(), av = available(), held = reserved();
    const minis = [...root.querySelectorAll(".farm2-miniStat")];
    if (minis[0]) {
      setText(minis[0].querySelector("b"), av);
      setText(minis[0].querySelector("span"), "Eggs available");
    }
    if (minis[1]) {
      setText(minis[1].querySelector("b"), s.packs18);
      setText(minis[1].querySelector("span"), "18-packs");
    }
    if (minis[2]) {
      setText(minis[2].querySelector("b"), held);
      setText(minis[2].querySelector("span"), "Reserved eggs");
    }
    [...root.querySelectorAll(".farm2-subtle")].forEach(el => {
      if ((el.textContent || "").trim().startsWith("Inventory:")) {
        setText(el, `Inventory: ${s.dozens} dozen + ${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"} + ${s.loose} loose`);
      }
    });
  }

  function correctHub(root) {
    if (!root) return;
    const s = inventory(), held = reserved(), av = available();
    const card = [...root.querySelectorAll(".farm2-card")]
      .find(c => /sellable inventory/i.test(c.querySelector(".farm2-kicker")?.textContent || c.textContent || ""));
    if (!card) return;
    setText(card.querySelector(".farm2-kicker"), "Sellable Inventory");
    setText(card.querySelector(".farm2-moneyBig"), `${av} 🥚`);
    setText(card.querySelector(".farm2-subtle"), held > 0
      ? `On hand: ${packaging(s)} • ${held} eggs reserved • ${av} available`
      : packaging(s));
  }

  function correctOrders(root) {
    if (!root) return;
    const held = reserved(), av = available();
    [...root.querySelectorAll(".farm2-card")].forEach(card => {
      const label = (card.querySelector(".farm2-kicker")?.textContent || "").trim();
      if (label === "Eggs Reserved") setText(card.querySelector(".farm2-moneyBig"), held);
      if (label === "Still Available") setText(card.querySelector(".farm2-moneyBig"), av);
    });
  }

  function correctTarget(el) {
    if (!el) return;
    if (el.id === "farm2TodayCard") correctToday(el);
    else if (el.id === "farm2HubSummary") correctHub(el);
    else if (el.id === "farm2OrderSummary") correctOrders(el);
  }

  // Correct the legacy HTML BEFORE it reaches the screen. This prevents a visible
  // wrong-frame/correct-frame cycle and therefore eliminates the inventory twitch.
  const proto = Element.prototype;
  if (!proto.__farmAppStableInventorySetter) {
    const desc = Object.getOwnPropertyDescriptor(proto, "innerHTML");
    if (desc?.get && desc?.set && desc.configurable) {
      Object.defineProperty(proto, "innerHTML", {
        configurable: desc.configurable,
        enumerable: desc.enumerable,
        get: desc.get,
        set(value) {
          const id = this?.id || "";
          if (!["farm2TodayCard","farm2HubSummary","farm2OrderSummary"].includes(id)) {
            desc.set.call(this, value);
            return;
          }
          const template = document.createElement("template");
          desc.set.call(template, String(value ?? ""));
          const holder = document.createElement("div");
          while (template.content.firstChild) holder.appendChild(template.content.firstChild);
          holder.id = id;
          correctTarget(holder);
          desc.set.call(this, desc.get.call(holder));
        }
      });
      Object.defineProperty(proto, "__farmAppStableInventorySetter", { value:true, configurable:true });
    }
  }

  function refreshVisible() {
    correctToday(document.getElementById("farm2TodayCard"));
    correctHub(document.getElementById("farm2HubSummary"));
    correctOrders(document.getElementById("farm2OrderSummary"));
    window.dispatchEvent(new CustomEvent("farm-integrity-synced", {
      detail:{ physical:onHand(), reserved:reserved(), available:available(), at:Date.now() }
    }));
  }

  async function catchUp() {
    if (syncing || !navigator.onLine) return;
    syncing = true;
    try {
      if (window.EggSyncAuthorityReady) await window.EggSyncAuthorityReady();
      if (typeof window.syncFarmNow === "function") await window.syncFarmNow();
      if (typeof window.refreshCoreFromFirebase === "function") await window.refreshCoreFromFirebase();
      refreshVisible();
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
    syncTimer = setTimeout(catchUp, delay);
  }

  window.addEventListener("farm-data-synced", refreshVisible);
  window.addEventListener("core-data-synced", refreshVisible);
  window.addEventListener("storage", e => {
    if ([INVENTORY_KEY, APP2_KEY].includes(e.key)) refreshVisible();
  });
  window.addEventListener("online", () => scheduleCatchUp(100));
  window.addEventListener("pageshow", () => scheduleCatchUp(350));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleCatchUp(200);
  });

  window.FarmDataHealth = {
    physicalEggs:onHand,
    reservedEggs:reserved,
    availableEggs:available,
    refresh:catchUp
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      refreshVisible();
      scheduleCatchUp(900);
      setTimeout(() => scheduleCatchUp(0), 3500);
    });
  } else {
    refreshVisible();
    scheduleCatchUp(900);
    setTimeout(() => scheduleCatchUp(0), 3500);
  }
  console.log("✅ Stable Farm App runtime active: one inventory display path, no polling, no DOM observer");
})();
