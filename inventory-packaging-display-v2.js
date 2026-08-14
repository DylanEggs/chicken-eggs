(() => {
  "use strict";
  if (window.__inventoryPackagingDisplayV2) return;
  window.__inventoryPackagingDisplayV2 = true;

  const INVENTORY_KEY = "chickenEggInventoryV2";
  const APP2_KEY = "chickenEggApp2V1";
  let queued = false;
  let applying = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Math.max(0, Number(v) || 0); }
  function inventory() {
    const s = read(INVENTORY_KEY, {});
    return { dozens: n(s.dozens), packs18: n(s.packs18), loose: n(s.loose) };
  }
  function orders() {
    const a = read(APP2_KEY, {});
    return Array.isArray(a.orders) ? a.orders : [];
  }
  function reservedEggs() {
    return orders().filter(o => o?.status === "pending")
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

  function correctHub(s, available, held) {
    const summary = document.getElementById("farm2HubSummary");
    if (!summary) return;
    const cards = [...summary.querySelectorAll(".farm2-card")];
    const card = cards.find(c => /sellable inventory/i.test(c.textContent || ""));
    if (!card) return;
    const value = card.querySelector(".farm2-moneyBig");
    if (value) value.textContent = `${available} 🥚`;
    const note = card.querySelector(".farm2-subtle");
    if (note) note.textContent = held > 0
      ? `On hand: ${packageText(s)} • ${held} eggs reserved • ${available} available`
      : packageText(s);
  }

  function correctTodayCard(s, available, held) {
    const card = document.getElementById("farm2TodayCard");
    if (!card) return;
    const stats = [...card.querySelectorAll(".farm2-miniStat")];
    const availStat = stats.find(x => /eggs available/i.test(x.textContent || ""));
    if (availStat) {
      const b = availStat.querySelector("b");
      if (b) b.textContent = String(available);
    }
    const dozenStat = stats.find(x => /full dozens/i.test(x.textContent || ""));
    if (dozenStat) {
      const b = dozenStat.querySelector("b");
      const label = dozenStat.querySelector("span");
      if (b) b.textContent = String(s.dozens);
      if (label) label.textContent = "Dozen cartons";
    }
    const reservedStat = stats.find(x => /reserved eggs/i.test(x.textContent || ""));
    if (reservedStat) {
      const b = reservedStat.querySelector("b");
      if (b) b.textContent = String(held);
    }
    const notes = [...card.querySelectorAll(".farm2-subtle")];
    const invNote = notes.find(x => /^Inventory:/i.test((x.textContent || "").trim()));
    if (invNote) invNote.textContent = `Inventory: ${packageText(s)}${held ? ` • ${held} reserved` : ""}`;
  }

  function correctOrders(available, held) {
    const summary = document.getElementById("farm2OrderSummary");
    if (!summary) return;
    const cards = [...summary.querySelectorAll(".farm2-card")];
    for (const card of cards) {
      const label = card.querySelector(".farm2-kicker")?.textContent || "";
      const value = card.querySelector(".farm2-moneyBig");
      if (!value) continue;
      if (/eggs reserved/i.test(label)) value.textContent = String(held);
      if (/still available/i.test(label)) value.textContent = String(available);
    }
  }

  function apply() {
    queued = false;
    if (applying) return;
    applying = true;
    try {
      const s = inventory();
      const onHand = total(s);
      const held = reservedEggs();
      const available = Math.max(0, onHand - held);
      correctHub(s, available, held);
      correctTodayCard(s, available, held);
      correctOrders(available, held);
    } finally {
      applying = false;
    }
  }

  function schedule() {
    if (queued || applying) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  window.InventoryPackagingDisplay = { render: apply, version: 2 };
  window.addEventListener("farm-data-synced", schedule);
  window.addEventListener("core-data-synced", schedule);
  window.addEventListener("storage", e => {
    if ([INVENTORY_KEY, APP2_KEY].includes(e.key)) schedule();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });

  function init() {
    apply();
    const targets = ["farm2HubSummary", "farm2TodayCard", "farm2OrderSummary"]
      .map(id => document.getElementById(id)).filter(Boolean);
    if (targets.length) {
      const observer = new MutationObserver(() => schedule());
      targets.forEach(el => observer.observe(el, { childList: true, subtree: true, characterData: true }));
    }
    console.log("✅ Exact physical inventory packaging display v2 active");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 120));
  else setTimeout(init, 120);
})();
