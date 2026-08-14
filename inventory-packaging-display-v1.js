(() => {
  "use strict";
  if (window.__inventoryPackagingDisplayV1) return;
  window.__inventoryPackagingDisplayV1 = true;

  const INVENTORY_KEY = "chickenEggInventoryV2";
  const APP2_KEY = "chickenEggApp2V1";
  let queued = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Math.max(0, Number(v) || 0); }
  function inventory() {
    const s = read(INVENTORY_KEY, {});
    return {
      dozens: n(s.dozens),
      packs18: n(s.packs18),
      loose: n(s.loose)
    };
  }
  function reserved() {
    const a = read(APP2_KEY, { orders: [] });
    return (Array.isArray(a.orders) ? a.orders : [])
      .filter(o => o?.status === "pending")
      .reduce((sum, o) => sum + n(o.dozen) * 12 + n(o.packs18) * 18, 0);
  }
  function total(s) {
    return Math.round(s.dozens * 12 + s.packs18 * 18 + s.loose);
  }
  function packageText(s) {
    const parts = [];
    if (s.dozens) parts.push(`${s.dozens} dozen`);
    if (s.packs18) parts.push(`${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"}`);
    if (s.loose || !parts.length) parts.push(`${s.loose} loose`);
    return parts.join(" • ");
  }

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function fixHubCard() {
    queued = false;
    const hub = document.getElementById("farm2Hub");
    if (!hub) return;

    const s = inventory();
    const onHand = total(s);
    const held = reserved();
    const available = Math.max(0, onHand - held);

    const cards = [...hub.querySelectorAll(".farm2-card")];
    const card = cards.find(c => /sellable inventory/i.test(c.querySelector(".farm2-kicker")?.textContent || c.textContent || ""));
    if (!card) return;

    const value = card.querySelector(".farm2-moneyBig, .farm2-numberBig, .farm2-bigNumber, strong");
    setText(value, String(available));

    let note = card.querySelector(".farm2-subtle");
    if (!note) {
      note = document.createElement("div");
      note.className = "farm2-subtle";
      card.appendChild(note);
    }

    const exactText = held > 0
      ? `On hand: ${packageText(s)} • ${held} eggs reserved`
      : packageText(s);
    setText(note, exactText);
    if (note.getAttribute("data-inventory-packaging-source") !== "exact") {
      note.setAttribute("data-inventory-packaging-source", "exact");
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(fixHubCard);
  }

  window.InventoryPackagingDisplay = { render: fixHubCard };
  window.addEventListener("farm-data-synced", schedule);
  window.addEventListener("core-data-synced", schedule);
  window.addEventListener("storage", e => {
    if ([INVENTORY_KEY, APP2_KEY].includes(e.key)) schedule();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });

  function init() {
    fixHubCard();
    const hub = document.getElementById("farm2Hub");
    if (hub) new MutationObserver(schedule).observe(hub, { childList: true, subtree: true, characterData: true });
    console.log("✅ Farm hub preserves exact egg packaging");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 900));
  else setTimeout(init, 900);
})();
