(() => {
  "use strict";
  if (window.__whoOwesV2) return;
  window.__whoOwesV2 = true;

  const APP2_KEY = "chickenEggApp2V1";
  const ENTRIES_KEY = "chickenEggEntriesV102";

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function num(v) { return Number(v) || 0; }
  function money(v) { return "$" + num(v).toFixed(2); }
  function escapeHTML(v) {
    return String(v ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[ch]));
  }
  function saleAmount(entry) {
    return num(entry.dozenSold) * num(entry.dozenPrice)
      + num(entry.packSold) * num(entry.packPrice);
  }

  function unpaidRows() {
    const farm = read(APP2_KEY, { saleMeta:{}, customers:[] });
    const entries = read(ENTRIES_KEY, []).filter(e => e && e.type === "sale");
    const customers = Array.isArray(farm.customers) ? farm.customers : [];
    const meta = farm.saleMeta && typeof farm.saleMeta === "object" ? farm.saleMeta : {};

    return entries
      .filter(entry => meta[entry.id]?.paid === false)
      .map(entry => {
        const m = meta[entry.id] || {};
        const customer = customers.find(c => String(c.id) === String(m.customerId));
        return {
          id: String(entry.id),
          date: entry.date || "",
          amount: saleAmount(entry),
          name: customer?.name || "Customer"
        };
      })
      .sort((a,b) => String(a.date).localeCompare(String(b.date)));
  }

  function ensureStyles() {
    if (document.getElementById("whoOwesStyles")) return;
    const s = document.createElement("style");
    s.id = "whoOwesStyles";
    s.textContent = `
      .who-owes-card{margin:14px 0}
      .who-owes-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .who-owes-total{font-size:24px;font-weight:950;color:var(--dark)}
      .farm2-dark .who-owes-total{color:#f5fff7}
      .who-owes-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:11px 0;border-top:1px solid rgba(127,127,127,.16)}
      .who-owes-row:first-of-type{border-top:0}
      .who-owes-name{font-weight:900;color:var(--dark)}
      .farm2-dark .who-owes-name{color:#f5fff7}
      .who-owes-meta{font-size:12px;color:var(--muted);margin-top:3px}
      .who-owes-paid{width:auto!important;margin:0!important;padding:10px 13px!important;border-radius:14px!important;font-size:13px!important;white-space:nowrap}
      .who-owes-clear{font-weight:850;color:var(--green);padding:4px 0}
    `;
    document.head.appendChild(s);
  }

  function ensureCard() {
    let card = document.getElementById("whoOwesCard");
    if (card) return card;

    const anchor = document.getElementById("inventoryDashboardCard")
      || document.getElementById("farm2TodayCard")
      || document.querySelector("#dashboard .heroCard");
    if (!anchor) return null;

    card = document.createElement("div");
    card.id = "whoOwesCard";
    card.className = "farm2-card who-owes-card";
    anchor.insertAdjacentElement("afterend", card);
    return card;
  }

  function render() {
    ensureStyles();
    const card = ensureCard();
    if (!card) return;

    const rows = unpaidRows();
    const total = rows.reduce((sum,row) => sum + row.amount, 0);

    if (!rows.length) {
      card.innerHTML = `
        <div class="who-owes-head">
          <div><div class="farm2-kicker">💳 Who Owes</div><div class="who-owes-total">$0.00 owed</div></div>
          <span>✅</span>
        </div>
        <div class="who-owes-clear">Everybody is paid up.</div>`;
      return;
    }

    card.innerHTML = `
      <div class="who-owes-head">
        <div><div class="farm2-kicker">💳 Who Owes</div><div class="who-owes-total">${money(total)} owed</div></div>
        <span class="farm2-badge red">${rows.length} unpaid</span>
      </div>
      ${rows.map(row => `
        <div class="who-owes-row">
          <div>
            <div class="who-owes-name">${escapeHTML(row.name)} — ${money(row.amount)}</div>
            <div class="who-owes-meta">Sale ${escapeHTML(row.date)}</div>
          </div>
          <button type="button" class="who-owes-paid" data-sale-id="${escapeHTML(row.id)}">✓ Mark Paid</button>
        </div>`).join("")}`;

    card.querySelectorAll(".who-owes-paid").forEach(button => {
      button.addEventListener("click", () => void markPaid(button.dataset.saleId));
    });
  }

  async function markPaid(id) {
    id = String(id || "");
    if (!id || !unpaidRows().some(row => row.id === id)) return;

    const farm = read(APP2_KEY, { saleMeta:{}, customers:[], activity:[] });
    farm.saleMeta = farm.saleMeta && typeof farm.saleMeta === "object" ? farm.saleMeta : {};
    const existing = farm.saleMeta[id];
    if (!existing || existing.paid !== false) return;

    const rows = unpaidRows();
    const row = rows.find(x => x.id === id);
    farm.saleMeta[id] = { ...existing, paid:true, updatedAt:Date.now() };
    farm.updatedAt = Date.now();

    try {
      localStorage.setItem(APP2_KEY, JSON.stringify(farm));
    } catch (error) {
      console.error("Who Owes payment save failed:", error);
      alert("Could not mark this payment as paid yet. Your sale was not changed.");
      return;
    }

    window.dispatchEvent(new CustomEvent("farm-local-data-changed", { detail:{ key:APP2_KEY, whoOwes:true } }));
    render();

    try {
      if (typeof window.syncFarmNow === "function") await window.syncFarmNow();
    } catch (error) {
      console.warn("Who Owes payment sync waiting:", error);
    }

    window.dispatchEvent(new CustomEvent("who-owes-changed", { detail:{ saleId:id, amount:row?.amount || 0 } }));
    render();
  }

  let queued = false;
  function scheduleRender() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; render(); }, 40);
  }

  function init() {
    render();
    ["farm-data-synced","farm-local-data-changed","core-data-synced","farm-sync-ready","who-owes-changed"]
      .forEach(name => window.addEventListener(name, scheduleRender));
    window.addEventListener("focus", scheduleRender);
    window.addEventListener("pageshow", scheduleRender);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRender(); });
    console.log("✅ Who Owes v2 active — Home unpaid balances are event-driven");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 350), { once:true });
  } else {
    setTimeout(init, 350);
  }
})();
