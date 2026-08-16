(() => {
  "use strict";
  if (window.__businessLifetimeStatsV2) return;
  window.__businessLifetimeStatsV2 = true;

  const BUSINESS_KEY = "chickenEggBusinessV1";
  const ENTRIES_KEY = "chickenEggEntriesV102";
  const APP2_KEY = "chickenEggApp2V1";
  let queued = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function money(v) {
    const x = n(v);
    return `${x < 0 ? "-" : ""}$${Math.abs(x).toFixed(2)}`;
  }

  function stats() {
    const business = read(BUSINESS_KEY, { chickenSales:[] });
    const app = read(APP2_KEY, { expenses:[] });
    const entries = read(ENTRIES_KEY, []).filter(e => e && e.type === "sale");

    const eggSales = entries.reduce((sum,e) => {
      const packs = n(e.packSold ?? e.packs18Sold);
      return sum + n(e.dozenSold) * n(e.dozenPrice) + packs * n(e.packPrice);
    }, 0);
    const chickenSales = (Array.isArray(business.chickenSales) ? business.chickenSales : [])
      .reduce((sum,e) => sum + n(e.total), 0);
    const expenses = Array.isArray(app.expenses) ? app.expenses : [];
    const feed = expenses
      .filter(e => String(e.category || "").toLowerCase() === "feed")
      .reduce((sum,e) => sum + n(e.amount), 0);
    const otherExpenses = expenses
      .filter(e => String(e.category || "").toLowerCase() !== "feed")
      .reduce((sum,e) => sum + n(e.amount), 0);
    const revenue = eggSales + chickenSales;
    const costs = feed + otherExpenses;
    return { eggSales, chickenSales, feed, otherExpenses, revenue, costs, net: revenue - costs };
  }

  function ensureCard() {
    const totals = document.getElementById("statsTotals");
    if (!totals) return null;
    let card = document.getElementById("statsLifetimeProfit");
    if (!card) {
      card = document.createElement("div");
      card.id = "statsLifetimeProfit";
      card.className = "farm2-card";
      totals.insertAdjacentElement("afterend", card);
    }
    return card;
  }

  function render() {
    queued = false;
    const card = ensureCard();
    if (!card) return;
    const s = stats();
    const resultLabel = s.net >= 0 ? "Lifetime Profit" : "Lifetime Loss";
    card.innerHTML = `
      <div class="farm2-sectionHeader">
        <div>
          <div class="farm2-kicker">Lifetime • Farm Business</div>
          <h3>💰 Lifetime Profit / Loss</h3>
        </div>
        <span class="farm2-badge ${s.net < 0 ? "red" : "gold"}">${s.net >= 0 ? "PROFIT" : "LOSS"}</span>
      </div>
      <div class="farm2-grid3">
        <div class="farm2-card" style="margin:0;text-align:center">
          <div class="farm2-moneyBig">${money(s.revenue)}</div>
          <div class="farm2-subtle">Lifetime Revenue</div>
        </div>
        <div class="farm2-card" style="margin:0;text-align:center">
          <div class="farm2-moneyBig">${money(s.costs)}</div>
          <div class="farm2-subtle">Lifetime Expenses</div>
        </div>
        <div class="farm2-card" style="margin:0;text-align:center">
          <div class="farm2-moneyBig">${money(s.net)}</div>
          <div class="farm2-subtle">${resultLabel}</div>
        </div>
      </div>
      <div class="farm2-subtle" style="margin-top:12px">
        Egg sales ${money(s.eggSales)} • Chicken sales ${money(s.chickenSales)} • Feed ${money(s.feed)} • Other expenses ${money(s.otherExpenses)}
      </div>`;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  }

  window.addEventListener("core-data-synced", schedule);
  window.addEventListener("farm-data-synced", schedule);
  window.addEventListener("farm-local-data-changed", event => {
    if (!event.detail?.key || [BUSINESS_KEY, APP2_KEY].includes(event.detail.key)) schedule();
  });
  window.addEventListener("storage", event => {
    if ([BUSINESS_KEY, ENTRIES_KEY, APP2_KEY].includes(event.key)) schedule();
  });
  document.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    if (button && /showScreen\(['\"]stats['\"]\)/.test(button.getAttribute("onclick") || "")) setTimeout(schedule, 0);
  }, true);

  function init() {
    render();
    console.log("✅ Lifetime farm profit/loss active on Statistics");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 250), { once:true });
  else setTimeout(init, 250);
})();
