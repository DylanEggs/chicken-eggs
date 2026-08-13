(() => {
  "use strict";

  const INVENTORY_KEY = "chickenEggInventoryV2";
  const APP2_KEY = "chickenEggApp2V1";
  const ENTRIES_KEY = "chickenEggEntriesV102";
  const BUSINESS_KEY = "chickenEggBusinessV1";
  let renderQueued = false;
  let hooksInstalled = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Math.max(0, Number(v) || 0); }
  function money(v) { return "$" + (Number(v) || 0).toFixed(2); }
  function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }

  function inventory() { return read(INVENTORY_KEY, { dozens:0, packs18:0, loose:0, adjustments:[], updatedAt:0 }); }
  function app2() { return read(APP2_KEY, { orders:[], customers:[], saleMeta:{}, expenses:[] }); }
  function business() { return read(BUSINESS_KEY, { chickenSales:[] }); }
  function entries() { return read(ENTRIES_KEY, []).filter(e => e && (e.type === "eggs" || e.type === "sale")); }

  function physical() {
    const s = inventory();
    return Math.round(n(s.dozens) * 12 + n(s.packs18) * 18 + n(s.loose));
  }
  function reserved() {
    const a = app2();
    return (Array.isArray(a.orders) ? a.orders : [])
      .filter(o => o.status === "pending")
      .reduce((sum,o) => sum + n(o.dozen) * 12 + n(o.packs18) * 18, 0);
  }
  function available() { return Math.max(0, physical() - reserved()); }
  function calculatedCoreInventory() {
    let collected = 0, sold = 0;
    for (const e of entries()) {
      if (e.type === "eggs") collected += Number(e.eggs) || 0;
      if (e.type === "sale") sold += (Number(e.dozenSold)||0) * 12 + (Number(e.packSold)||0) * 18;
    }
    return collected - sold;
  }
  function saleAmount(e) {
    return (Number(e.dozenSold)||0) * (Number(e.dozenPrice)||0)
      + (Number(e.packSold)||0) * (Number(e.packPrice)||0);
  }

  function addAdjustment(state, delta, reason) {
    state.adjustments = Array.isArray(state.adjustments) ? state.adjustments : [];
    state.adjustments.unshift({
      id: "fix-" + Date.now() + "-" + Math.random().toString(36).slice(2,7),
      date: new Date().toISOString().slice(0,10),
      at: Date.now(), delta, reason,
      totalAfter: Math.round(n(state.dozens)*12+n(state.packs18)*18+n(state.loose))
    });
    state.adjustments = state.adjustments.slice(0,100);
  }

  function saveInventoryState(state) {
    state.updatedAt = Date.now();
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(state));
    scheduleRender();
  }

  function setPhysicalTotal(total, reason, delta) {
    total = Math.max(0, Math.round(Number(total) || 0));
    const state = inventory();
    const current = Math.round(n(state.dozens)*12+n(state.packs18)*18+n(state.loose));
    if (current === total) return;
    state.dozens = 0;
    state.packs18 = Math.floor(total / 18);
    state.loose = total % 18;
    addAdjustment(state, Number.isFinite(delta) ? delta : total-current, reason || "Inventory consistency correction");
    saveInventoryState(state);
  }

  function patchText(el, value) {
    if (el && el.textContent !== String(value)) el.textContent = String(value);
  }

  // inventory.js alone owns #inventoryDashboardCard and #inventorySummary.
  // This layer only keeps other screens consistent with that shared inventory value.
  function patchHome() {
    const s = inventory(), av = available(), r = reserved();
    const minis = document.querySelectorAll("#farm2TodayCard .farm2-miniStat");
    if (minis.length >= 3) {
      patchText(minis[0].querySelector("b"), av);
      patchText(minis[0].querySelector("span"), "Eggs available");
      patchText(minis[1].querySelector("b"), n(s.packs18));
      patchText(minis[1].querySelector("span"), "18-packs");
      patchText(minis[2].querySelector("b"), r);
      patchText(minis[2].querySelector("span"), "Reserved eggs");
    }
    document.querySelectorAll("#farm2TodayCard .farm2-subtle").forEach(el => {
      if ((el.textContent || "").trim().startsWith("Inventory:")) {
        patchText(el, `Inventory: ${n(s.dozens)} dozen + ${n(s.packs18)} 18-pack${n(s.packs18)===1?"":"s"} + ${n(s.loose)} loose`);
      }
    });
    const snap = document.getElementById("xSnapshot");
    if (snap) {
      [...snap.querySelectorAll(".xstat")].forEach(box => {
        const label = box.querySelector("span");
        if ((label?.textContent || "").trim() === "Available") patchText(box.querySelector("b"), av);
      });
    }
  }

  function patchReservations() {
    const a = app2(), pending = (Array.isArray(a.orders)?a.orders:[]).filter(o=>o.status==="pending");
    const sum = document.getElementById("farm2OrderSummary");
    if (!sum) return;
    const html = `<div class="farm2-grid3">
      <div class="farm2-card"><div class="farm2-kicker">Open Orders</div><div class="farm2-moneyBig">${pending.length}</div></div>
      <div class="farm2-card"><div class="farm2-kicker">Eggs Reserved</div><div class="farm2-moneyBig">${reserved()}</div></div>
      <div class="farm2-card"><div class="farm2-kicker">Still Available</div><div class="farm2-moneyBig">${available()}</div></div>
    </div>`;
    if (sum.innerHTML !== html) sum.innerHTML = html;
  }

  function unpaidRows() {
    const a = app2(), meta = a.saleMeta && typeof a.saleMeta === "object" ? a.saleMeta : {};
    const customers = Array.isArray(a.customers) ? a.customers : [];
    return entries().filter(e => e.type === "sale" && meta[e.id]?.paid === false).map(e => {
      const m = meta[e.id] || {};
      const c = customers.find(x => String(x.id) === String(m.customerId));
      return { id:String(e.id), date:e.date||"", amount:saleAmount(e), name:c?.name||"Customer" };
    }).sort((x,y)=>String(x.date).localeCompare(String(y.date)));
  }

  function ensureWhoOwes() {
    let card = document.getElementById("whoOwesCard");
    if (!card) {
      const anchor = document.getElementById("inventoryDashboardCard") || document.getElementById("farm2TodayCard");
      if (!anchor) return;
      card = document.createElement("div");
      card.id = "whoOwesCard";
      card.className = "farm2-card who-owes-card";
      anchor.insertAdjacentElement("afterend", card);
    }
    const rows = unpaidRows(), total = rows.reduce((s,x)=>s+x.amount,0);
    const html = rows.length ? `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px"><div><div class="farm2-kicker">💳 Who Owes</div><div class="farm2-moneyBig" style="font-size:27px">${money(total)} owed</div></div><span class="farm2-badge red">${rows.length} unpaid</span></div>
      ${rows.map(row=>`<div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:11px 0;border-top:1px solid rgba(127,127,127,.16)"><div><b>${esc(row.name)} — ${money(row.amount)}</b><div class="farm2-subtle">Sale ${esc(row.date)}</div></div><button type="button" style="width:auto;margin:0;padding:10px 13px" onclick="farmConsistencyMarkPaid('${esc(row.id)}')">✓ Mark Paid</button></div>`).join("")}` : `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div class="farm2-kicker">💳 Who Owes</div><div class="farm2-moneyBig" style="font-size:27px">$0.00 owed</div></div><span>✅</span></div><div class="farm2-subtle" style="margin-top:7px;font-weight:800">Everybody is paid up.</div>`;
    if (card.innerHTML !== html) card.innerHTML = html;
  }

  function patchLifetimeProfit() {
    const monthly = document.getElementById("bizHome");
    if (!monthly) return;
    let card = document.getElementById("bizLifetimeHome");
    if (!card) {
      card = document.createElement("div");
      card.id = "bizLifetimeHome";
      card.className = "biz-card";
      monthly.insertAdjacentElement("afterend", card);
    }
    const b = business(), a = app2();
    const eggSales = entries().filter(e=>e.type==="sale").reduce((sum,e)=>sum+saleAmount(e),0);
    const chickenSales = (Array.isArray(b.chickenSales)?b.chickenSales:[]).reduce((sum,e)=>sum+(Number(e.total)||0),0);
    const expenses = Array.isArray(a.expenses)?a.expenses:[];
    const feed = expenses.filter(e=>String(e.category||"").toLowerCase()==="feed").reduce((sum,e)=>sum+(Number(e.amount)||0),0);
    const supplies = expenses.filter(e=>String(e.category||"").toLowerCase()!=="feed").reduce((sum,e)=>sum+(Number(e.amount)||0),0);
    const income = eggSales + chickenSales, costs = feed + supplies, net = income - costs;
    const html = `<div class="farm2-sectionHeader"><div><div class="farm2-kicker">Lifetime • Farm Business</div><h3>All-Time Gains & Losses</h3></div><span class="farm2-badge ${net<0?"red":"gold"}">${net>=0?"PROFIT":"LOSS"}</span></div>
      <div class="biz-grid"><div class="biz-stat"><b>${money(eggSales)}</b><span>Lifetime Egg Sales</span></div><div class="biz-stat"><b>${money(chickenSales)}</b><span>Lifetime Chicken Sales</span></div><div class="biz-stat"><b>${money(feed)}</b><span>Lifetime Feed Cost</span></div><div class="biz-stat"><b>${money(supplies)}</b><span>Lifetime Other Supplies</span></div><div class="biz-stat"><b>${money(income)}</b><span>Total Lifetime Income</span></div><div class="biz-stat"><b>${money(costs)}</b><span>Total Lifetime Costs</span></div></div>
      <div class="${net>=0?"biz-good":"biz-bad"}" style="margin-top:13px"><div class="farm2-kicker">Lifetime Net Profit / Loss</div><div class="biz-net">${net>=0?"+":""}${money(net)}</div></div>`;
    if (card.innerHTML !== html) card.innerHTML = html;
  }

  window.farmConsistencyMarkPaid = id => {
    const a = app2();
    if (!a.saleMeta || typeof a.saleMeta !== "object") a.saleMeta = {};
    const old = a.saleMeta[String(id)] || {};
    a.saleMeta[String(id)] = { ...old, paid:true, updatedAt:Date.now() };
    a.updatedAt = Date.now();
    localStorage.setItem(APP2_KEY, JSON.stringify(a));
    scheduleRender();
  };

  function renderAll() {
    renderQueued = false;
    patchHome();
    patchReservations();
    ensureWhoOwes();
    patchLifetimeProfit();
  }
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(renderAll);
  }

  function installCoreCorrectionHooks() {
    if (hooksInstalled) return;
    if (typeof window.saveEggs !== "function" || typeof window.saveSale !== "function" || typeof window.deleteEntry !== "function") {
      setTimeout(installCoreCorrectionHooks,100);
      return;
    }
    hooksInstalled = true;
    window.__inventoryCorrectionHooksInstalled = true;
    ["saveEggs","saveSale","deleteEntry"].forEach(name => {
      const original = window[name];
      if (typeof original !== "function") return;
      window[name] = function() {
        const beforePhysical = physical();
        const beforeCore = calculatedCoreInventory();
        const result = original.apply(this, arguments);
        const afterCore = calculatedCoreInventory();
        const delta = afterCore-beforeCore;
        const expected = Math.max(0,beforePhysical+delta);
        if (physical() !== expected) setPhysicalTotal(expected, `${name} inventory correction`, expected-beforePhysical);
        scheduleRender();
        return result;
      };
    });
  }

  function installReservationGuard() {
    const tryIt = () => {
      const original = window.farm2AddOrder;
      if (typeof original !== "function") { setTimeout(tryIt,150); return; }
      if (original.__consistencyGuard) return;
      const wrapped = function() {
        const request = n(document.getElementById("farm2OrderDozen")?.value)*12 + n(document.getElementById("farm2OrderPacks")?.value)*18;
        if (request > available()) {
          alert(`Only ${available()} eggs are currently available after existing reservations.`);
          return;
        }
        const result = original.apply(this,arguments);
        scheduleRender();
        return result;
      };
      wrapped.__consistencyGuard = true;
      window.farm2AddOrder = wrapped;
    };
    tryIt();
  }

  function installShowScreenHook() {
    const tryIt = () => {
      const original = window.showScreen;
      if (typeof original !== "function") { setTimeout(tryIt,100); return; }
      if (original.__consistencyHook) return;
      const wrapped = function() { const r=original.apply(this,arguments); setTimeout(scheduleRender,0); return r; };
      wrapped.__consistencyHook = true;
      window.showScreen = wrapped;
    };
    tryIt();
  }

  const priorSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key,value) {
    priorSetItem.call(this,key,value);
    if (this === window.localStorage && [INVENTORY_KEY,APP2_KEY,ENTRIES_KEY,BUSINESS_KEY].includes(String(key))) scheduleRender();
  };

  window.addEventListener("storage", e => {
    if ([INVENTORY_KEY,APP2_KEY,ENTRIES_KEY,BUSINESS_KEY].includes(e.key)) scheduleRender();
  });
  window.addEventListener("farm-data-synced", scheduleRender);
  window.addEventListener("core-data-synced", scheduleRender);

  function init() {
    installCoreCorrectionHooks();
    installReservationGuard();
    installShowScreenHook();
    renderAll();
    console.log("✅ Farm consistency active without inventory redraw loop");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(init,250));
  else setTimeout(init,250);
})();