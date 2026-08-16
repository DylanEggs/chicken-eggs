(() => {
  "use strict";
  if (window.__recordsDailyTotalsV1) return;
  window.__recordsDailyTotalsV1 = true;

  const ENTRIES_KEY = "chickenEggEntriesV102";

  function n(v) { return Number(v) || 0; }
  function readEntries() {
    try {
      const data = JSON.parse(localStorage.getItem(ENTRIES_KEY) || "[]");
      return Array.isArray(data) ? data.filter(e => e && (e.type === "eggs" || e.type === "sale")) : [];
    } catch {
      return [];
    }
  }
  function saleRevenue(e) {
    const packs = n(e.packSold ?? e.packs18Sold);
    const packPrice = n(e.packPrice ?? e.packs18Price);
    return n(e.dozenSold) * n(e.dozenPrice) + packs * packPrice;
  }
  function bestDaily(map) {
    let bestDate = "";
    let bestValue = 0;
    Object.keys(map).sort().forEach(date => {
      const value = n(map[date]);
      if (!bestDate || value > bestValue) {
        bestDate = date;
        bestValue = value;
      }
    });
    return { date: bestDate, value: bestValue };
  }
  function card(icon, title, value, note) {
    if (typeof window.statCard === "function") return window.statCard(icon, title, value, note);
    return `<div class="totalBox"><h3>${icon} ${title}</h3><div class="totalValue">${value}</div><p>${note}</p></div>`;
  }

  function render() {
    const target = document.getElementById("recordsTotals");
    if (!target) return;

    const eggByDate = {};
    const revenueByDate = {};
    let lifetimeRevenue = 0;

    for (const e of readEntries()) {
      const date = String(e.date || "").slice(0, 10);
      if (!date) continue;
      if (e.type === "eggs") {
        eggByDate[date] = (eggByDate[date] || 0) + n(e.eggs);
      } else if (e.type === "sale") {
        const amount = saleRevenue(e);
        revenueByDate[date] = (revenueByDate[date] || 0) + amount;
        lifetimeRevenue += amount;
      }
    }

    const bestEgg = bestDaily(eggByDate);
    const bestRevenue = bestDaily(revenueByDate);

    target.innerHTML = `
      ${card("🥚", "Highest Egg Day", bestEgg.value, bestEgg.date || "No data yet")}
      ${card("💰", "Highest Revenue Day", "$" + bestRevenue.value.toFixed(2), bestRevenue.date || "No data yet")}
      ${card("💰", "Lifetime Revenue", "$" + lifetimeRevenue.toFixed(2), "all-time sales")}
    `;
  }

  if (typeof window.updateApp === "function" && !window.updateApp.__recordsDailyTotalsV1) {
    const originalUpdateApp = window.updateApp;
    const wrappedUpdateApp = function() {
      const result = originalUpdateApp.apply(this, arguments);
      render();
      return result;
    };
    wrappedUpdateApp.__recordsDailyTotalsV1 = true;
    window.updateApp = wrappedUpdateApp;
  }

  window.addEventListener("core-data-synced", render);
  window.addEventListener("storage", event => {
    if (event.key === ENTRIES_KEY) render();
  });
  document.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    if (button && /showScreen\(['\"]records['\"]\)/.test(button.getAttribute("onclick") || "")) setTimeout(render, 0);
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once:true });
  else render();
})();
