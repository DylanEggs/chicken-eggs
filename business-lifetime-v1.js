(() => {
  "use strict";

  const BUSINESS_KEY = "chickenEggBusinessV1";
  const ENTRIES_KEY = "chickenEggEntriesV102";
  const APP2_KEY = "chickenEggApp2V1";
  let queued = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function money(v) { return "$" + n(v).toFixed(2); }

  function stats() {
    const business = read(BUSINESS_KEY, { chickenSales:[] });
    const app = read(APP2_KEY, { expenses:[] });
    const entries = read(ENTRIES_KEY, []).filter(e => e && e.type === "sale");

    const eggSales = entries.reduce((sum,e) => sum + n(e.dozenSold)*n(e.dozenPrice) + n(e.packSold)*n(e.packPrice), 0);
    const chickenSales = (Array.isArray(business.chickenSales) ? business.chickenSales : []).reduce((sum,e) => sum + n(e.total), 0);
    const expenses = Array.isArray(app.expenses) ? app.expenses : [];
    const feed = expenses.filter(e => String(e.category || "").toLowerCase() === "feed").reduce((sum,e) => sum + n(e.amount), 0);
    const supplies = expenses.filter(e => String(e.category || "").toLowerCase() !== "feed").reduce((sum,e) => sum + n(e.amount), 0);
    const income = eggSales + chickenSales;
    const costs = feed + supplies;
    return { eggSales, chickenSales, feed, supplies, income, costs, net: income - costs };
  }

  function render() {
    queued = false;
    const monthly = document.getElementById("bizHome");
    if (!monthly) return;

    let card = document.getElementById("bizLifetimeHome");
    if (!card) {
      card = document.createElement("div");
      card.id = "bizLifetimeHome";
      card.className = "biz-card";
      monthly.insertAdjacentElement("afterend", card);
    }

    const s = stats();
    const cls = s.net >= 0 ? "biz-good" : "biz-bad";
    card.innerHTML = `
      <div class="farm2-sectionHeader">
        <div><div class="farm2-kicker">Lifetime • Farm Business</div><h3>All-Time Gains & Losses</h3></div>
        <span class="farm2-badge ${s.net < 0 ? "red" : "gold"}">${s.net >= 0 ? "PROFIT" : "LOSS"}</span>
      </div>
      <div class="biz-grid">
        <div class="biz-stat"><b>${money(s.eggSales)}</b><span>Lifetime Egg Sales</span></div>
        <div class="biz-stat"><b>${money(s.chickenSales)}</b><span>Lifetime Chicken Sales</span></div>
        <div class="biz-stat"><b>${money(s.feed)}</b><span>Lifetime Feed Cost</span></div>
        <div class="biz-stat"><b>${money(s.supplies)}</b><span>Lifetime Other Supplies</span></div>
        <div class="biz-stat"><b>${money(s.income)}</b><span>Total Lifetime Income</span></div>
        <div class="biz-stat"><b>${money(s.costs)}</b><span>Total Lifetime Costs</span></div>
      </div>
      <div class="${cls}" style="margin-top:13px">
        <div class="farm2-kicker">Lifetime Net Profit / Loss</div>
        <div class="biz-net">${s.net >= 0 ? "+" : ""}${money(s.net)}</div>
      </div>`;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  }

  window.addEventListener("farm-data-synced", schedule);
  window.addEventListener("storage", e => {
    if ([BUSINESS_KEY, ENTRIES_KEY, APP2_KEY].includes(e.key)) schedule();
  });

  function init() {
    render();
    const app = document.querySelector(".app");
    if (app) {
      const observer = new MutationObserver(schedule);
      observer.observe(app, { childList:true, subtree:true, characterData:true });
    }
    console.log("✅ Lifetime farm profit/loss active");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 700));
  else setTimeout(init, 700);
})();
