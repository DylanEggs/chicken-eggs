(() => {
  "use strict";
  if (window.__farmAppStableRuntimeV1) return;
  window.__farmAppStableRuntimeV1 = true;

  const INVENTORY_KEY = "chickenEggInventoryV2";
  const APP2_KEY = "chickenEggApp2V1";
  let syncTimer = null;
  let syncing = false;

  // Disable older cached correction generations before they can attach observers.
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
    return {
      ...a,
      orders:Array.isArray(a.orders) ? a.orders : [],
      achievements:a.achievements && typeof a.achievements === "object" ? a.achievements : {}
    };
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
    if (card) {
      setText(card.querySelector(".farm2-kicker"), "Sellable Inventory");
      setText(card.querySelector(".farm2-moneyBig"), `${av} 🥚`);
      setText(card.querySelector(".farm2-subtle"), held > 0
        ? `On hand: ${packaging(s)} • ${held} eggs reserved • ${av} available`
        : packaging(s));
    }
    [...root.querySelectorAll(".farm2-badge")].forEach(el => {
      if (/Golden Eggs?/i.test(el.textContent || "")) el.remove();
    });
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

  function correctFunSummary(root) {
    if (!root) return;
    [...root.querySelectorAll(".farm2-card")].forEach(card => {
      if (/Golden Eggs?/i.test(card.textContent || "")) card.remove();
    });
    const unlocked = Object.keys(app2().achievements).filter(k => k !== "gold1").length;
    [...root.querySelectorAll(".farm2-card")].forEach(card => {
      if (/Unlocked/i.test(card.querySelector(".farm2-kicker")?.textContent || "")) {
        setText(card.querySelector(".farm2-moneyBig"), `${Math.min(unlocked, 8)}/8`);
      }
    });
  }

  function correctAchievements(root) {
    if (!root) return;
    [...root.children].forEach(card => {
      if (/Golden!|Golden Egg/i.test(card.textContent || "")) card.remove();
    });
  }

  function correctTarget(el) {
    if (!el) return;
    if (el.id === "farm2TodayCard") correctToday(el);
    else if (el.id === "farm2HubSummary") correctHub(el);
    else if (el.id === "farm2OrderSummary") correctOrders(el);
    else if (el.id === "farm2FunSummary") correctFunSummary(el);
    else if (el.id === "farm2AchievementList") correctAchievements(el);
  }

  // Correct legacy HTML BEFORE it reaches the screen. No wrong-frame/correct-frame
  // cycle, no polling, and no MutationObserver watching its own changes.
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
          const targets = ["farm2TodayCard","farm2HubSummary","farm2OrderSummary","farm2FunSummary","farm2AchievementList"];
          if (!targets.includes(id)) {
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

  function cleanStaticLegacyText() {
    document.querySelectorAll("#farm2Hub small").forEach(el => {
      if (/Achievements\s*&\s*Golden Eggs/i.test(el.textContent || "")) el.textContent = "Achievements & monthly goals";
    });
    document.querySelectorAll("#farm2Settings .farm2-subtle").forEach(el => {
      if (/Golden Eggs, rare events & celebrations/i.test(el.textContent || "")) el.textContent = "Rare events & celebrations";
    });
    const activity = document.getElementById("farm2Activity");
    if (activity) [...activity.children].forEach(row => {
      if (/Golden Egg/i.test(row.textContent || "")) row.remove();
    });
  }

  function refreshVisible() {
    correctToday(document.getElementById("farm2TodayCard"));
    correctHub(document.getElementById("farm2HubSummary"));
    correctOrders(document.getElementById("farm2OrderSummary"));
    correctFunSummary(document.getElementById("farm2FunSummary"));
    correctAchievements(document.getElementById("farm2AchievementList"));
    cleanStaticLegacyText();
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

  function start() {
    refreshVisible();
    // One-time retries cover screen injection and slow authentication. These are not
    // repeating redraw timers.
    setTimeout(refreshVisible, 0);
    setTimeout(refreshVisible, 300);
    scheduleCatchUp(900);
    setTimeout(() => scheduleCatchUp(0), 3500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  console.log("✅ Stable Farm App runtime active: one pre-render path, no polling, no DOM observer");
})();
