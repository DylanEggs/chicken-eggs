(() => {
  "use strict";
  if (window.__ReceiptsExpensesV1) return;
  window.__ReceiptsExpensesV1 = true;

  const BRAND = "Rose Family Poultry";
  const ENTRIES = "chickenEggEntriesV102";
  const APP2 = "chickenEggApp2V1";
  const BUSINESS = "chickenEggBusinessV1";

  const read = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const n = v => Number(v) || 0;
  const wholeMoney = v => Math.max(0, n(v));
  const money = v => `${n(v) < 0 ? "-" : ""}$${Math.abs(n(v)).toFixed(2)}`;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const monthKey = () => localDate().slice(0,7);
  const yearKey = () => localDate().slice(0,4);

  function eggSaleAmount(e) {
    if (!e || e.type !== "sale") return 0;
    const packs = n(e.packSold ?? e.packs18Sold);
    return n(e.dozenSold) * n(e.dozenPrice) + packs * n(e.packPrice);
  }
  function chickenSaleAmount(s) { return s ? n(s.total) : 0; }

  function calculate(input = {}, prefix = monthKey()) {
    const entries = Array.isArray(input.entries) ? input.entries : [];
    const app2 = input.app2 && typeof input.app2 === "object" ? input.app2 : {};
    const business = input.business && typeof input.business === "object" ? input.business : {};
    const eggSales = entries
      .filter(e => e?.type === "sale" && String(e.date || "").startsWith(prefix))
      .reduce((sum,e) => sum + eggSaleAmount(e), 0);
    const chickenSales = (Array.isArray(business.chickenSales) ? business.chickenSales : [])
      .filter(s => String(s?.date || "").startsWith(prefix))
      .reduce((sum,s) => sum + chickenSaleAmount(s), 0);
    const expenseRows = (Array.isArray(app2.expenses) ? app2.expenses : [])
      .filter(e => String(e?.date || "").startsWith(prefix));
    const expenses = expenseRows.reduce((sum,e) => sum + wholeMoney(e?.amount), 0);
    const revenue = eggSales + chickenSales;
    return { eggSales, chickenSales, revenue, expenses, net: revenue - expenses, expenseRows };
  }

  function currentData() {
    return {
      entries: read(ENTRIES, []),
      app2: read(APP2, {}),
      business: read(BUSINESS, {})
    };
  }
  function monthStats() { return calculate(currentData(), monthKey()); }
  function ytdStats() { return calculate(currentData(), yearKey()); }

  function businessState() {
    const b = read(BUSINESS, {});
    return {
      ...b,
      receipts: Array.isArray(b.receipts) ? b.receipts : [],
      receiptSettings: b.receiptSettings && typeof b.receiptSettings === "object"
        ? b.receiptSettings
        : { invoicePrefix:"RFP", nextInvoice:1, receiptFooter:"Thank you for supporting Rose Family Poultry!" }
    };
  }

  async function requireFarmReady() {
    if (window.FarmSyncSafety?.isReady?.()) return true;
    if (typeof window.EggSyncAuthorityReady === "function") {
      try { await window.EggSyncAuthorityReady(); return true; }
      catch { throw new Error("Farm sync is not ready yet. Check your connection and try again."); }
    }
    throw new Error("Farm sync is still starting. Try again in a moment.");
  }

  async function addExpense(record) {
    await requireFarmReady();
    const app = read(APP2, {});
    const expenses = Array.isArray(app.expenses) ? app.expenses.slice() : [];
    const notes = String(record?.notes || "");
    const vendor = String(record?.vendor || "");
    const item = {
      id: String(record?.id || `expense-${Date.now()}-${Math.random().toString(36).slice(2,7)}`),
      date: String(record?.date || localDate()).slice(0,10),
      vendor,
      category: String(record?.category || "Other"),
      description: notes || vendor,
      amount: wholeMoney(record?.amount),
      notes,
      createdAt: Date.now()
    };
    expenses.push(item);
    const next = {...app, expenses, updatedAt: Date.now()};
    if (!write(APP2, next)) throw new Error("Expense could not be saved in this browser.");
    return item;
  }

  function recentSales() {
    const d = currentData();
    const rows = [];
    (Array.isArray(d.entries) ? d.entries : [])
      .filter(e => e?.type === "sale")
      .forEach((e,i) => rows.push({key:`egg:${e.id || i}`,kind:"egg",date:String(e.date||""),amount:eggSaleAmount(e),raw:e}));
    (Array.isArray(d.business?.chickenSales) ? d.business.chickenSales : [])
      .forEach((s,i) => rows.push({key:`bird:${s?.id || i}`,kind:"bird",date:String(s?.date||""),amount:chickenSaleAmount(s),raw:s}));
    return rows.sort((a,b) => b.date.localeCompare(a.date)).slice(0,40);
  }

  function saleItems(row) {
    if (!row) return "Sale";
    if (row.kind === "bird") {
      const s = row.raw || {};
      const qty = Math.max(1, n(s.quantity || s.qty || 1));
      return `${qty} × ${String(s.description || s.bird || s.breed || "chicken")}`;
    }
    const e = row.raw || {};
    const dozens = n(e.dozenSold), packs = n(e.packSold ?? e.packs18Sold);
    return [dozens ? `${dozens} dozen eggs` : "", packs ? `${packs} 18-pack${packs===1?"":"s"}` : ""].filter(Boolean).join(" + ") || "Egg sale";
  }

  async function createReceipt(record) {
    await requireFarmReady();
    const b = businessState();
    const settings = b.receiptSettings || {};
    const prefix = String(settings.invoicePrefix || "RFP").replace(/[^A-Za-z0-9-]/g, "").slice(0,12) || "RFP";
    const nextNumber = Math.max(1, Math.floor(n(settings.nextInvoice) || 1));
    const receipt = {
      id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      number: `${prefix}-${String(nextNumber).padStart(4,"0")}`,
      date: String(record?.date || localDate()).slice(0,10),
      customer: String(record?.customer || "Customer"),
      status: String(record?.status || "Paid"),
      items: String(record?.items || "Sale"),
      total: wholeMoney(record?.total),
      createdAt: Date.now()
    };
    const next = {
      ...b,
      receipts: [...b.receipts, receipt],
      receiptSettings: {
        ...settings,
        invoicePrefix: prefix,
        nextInvoice: nextNumber + 1,
        receiptFooter: String(settings.receiptFooter || "Thank you for supporting Rose Family Poultry!")
      },
      updatedAt: Date.now()
    };
    if (!write(BUSINESS, next)) throw new Error("Receipt could not be saved in this browser.");
    return receipt;
  }

  function css() {
    if (document.getElementById("rfpSimpleBusinessCss")) return;
    const s = document.createElement("style");
    s.id = "rfpSimpleBusinessCss";
    s.textContent = `
      #rfpBusinessLauncher{display:none!important}
      #rfpSimpleBusinessLauncher{position:fixed;right:14px;bottom:92px;z-index:9998;width:auto!important;margin:0!important;padding:12px 15px!important;border-radius:999px!important;box-shadow:0 12px 30px rgba(0,0,0,.22);font-size:12px!important}
      #rfpSimpleBusinessModal[hidden]{display:none!important}#rfpSimpleBusinessModal{position:fixed;inset:0;z-index:10030;background:rgba(9,20,12,.72);padding:14px;overflow:auto}
      .rfp-simple-sheet{max-width:720px;margin:20px auto;background:#f7fbf7;color:#17351f;border-radius:24px;padding:18px;box-shadow:0 25px 70px rgba(0,0,0,.32)}.farm2-dark .rfp-simple-sheet{background:#18231b;color:#f7fbf7}
      .rfp-simple-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.rfp-simple-head h2{margin:2px 0 0}.rfp-simple-close{width:auto!important;margin:0!important;padding:8px 12px!important}
      .rfp-simple-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:14px 0}.rfp-simple-stat{padding:13px;border-radius:17px;background:rgba(31,122,58,.07);text-align:center}.rfp-simple-stat b{display:block;font-size:22px}.rfp-simple-stat.loss{background:rgba(185,28,28,.09);color:#a32626}.rfp-simple-stat.profit{background:rgba(31,122,58,.10);color:#176b31}
      .rfp-simple-tabs{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}.rfp-simple-tabs button{margin:0!important}.rfp-simple-tabs button.active{outline:3px solid rgba(31,122,58,.18)}
      .rfp-simple-card{padding:14px;border:1px solid rgba(31,122,58,.12);border-radius:18px;background:rgba(255,255,255,.72);margin:10px 0}.farm2-dark .rfp-simple-card{background:rgba(255,255,255,.05)}
      .rfp-simple-form{display:grid;gap:9px}.rfp-simple-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}.rfp-simple-form input,.rfp-simple-form select,.rfp-simple-form textarea{width:100%;box-sizing:border-box}.rfp-simple-form textarea{min-height:70px}
      .rfp-simple-list{display:grid;gap:8px;margin-top:12px}.rfp-simple-item{display:flex;justify-content:space-between;gap:10px;padding:11px;border-radius:14px;background:rgba(31,122,58,.06)}.rfp-simple-item small{display:block;opacity:.72}.rfp-simple-muted{font-size:11px;opacity:.72}.rfp-simple-receipt{background:#fff;color:#111;padding:18px;border-radius:14px;border:1px dashed #aaa;margin-top:12px}.rfp-simple-receipt h3{margin-top:0}.rfp-simple-actions{display:flex;gap:8px;flex-wrap:wrap}.rfp-simple-actions button{width:auto!important;margin:0!important}.rfp-simple-error{padding:10px 12px;border-radius:12px;background:rgba(185,28,28,.09);color:#a32626;font-weight:800;font-size:12px;margin-top:8px}
      @media(max-width:560px){.rfp-simple-summary,.rfp-simple-row{grid-template-columns:1fr}.rfp-simple-sheet{margin:4px auto}.rfp-simple-tabs{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(s);
  }

  function ensureUi() {
    css();
    const old = document.getElementById("rfpBusinessLauncher");
    if (old) old.hidden = true;
    if (!document.getElementById("rfpSimpleBusinessLauncher")) {
      const b = document.createElement("button");
      b.id = "rfpSimpleBusinessLauncher";
      b.type = "button";
      b.textContent = "🧾 Receipts & Expenses";
      b.addEventListener("click", open);
      document.body.appendChild(b);
    }
    if (!document.getElementById("rfpSimpleBusinessModal")) {
      const m = document.createElement("div");
      m.id = "rfpSimpleBusinessModal";
      m.hidden = true;
      m.innerHTML = `<div class="rfp-simple-sheet"><div class="rfp-simple-head"><div><div class="eyebrow">OWNER BUSINESS</div><h2>${BRAND}</h2><div class="rfp-simple-muted">Receipts, expenses, and the same profit/loss numbers used by Home.</div></div><button class="rfp-simple-close" type="button">Close</button></div><div id="rfpSimpleSummary"></div><div class="rfp-simple-tabs"><button type="button" data-simple-tab="expenses">🧾 Expenses</button><button type="button" data-simple-tab="receipts">💵 Sales Receipts</button></div><div id="rfpSimpleBody"></div></div>`;
      m.querySelector(".rfp-simple-close")?.addEventListener("click", close);
      m.addEventListener("click", e => { if (e.target === m) close(); });
      m.querySelectorAll("[data-simple-tab]").forEach(b => b.addEventListener("click", () => show(b.dataset.simpleTab)));
      document.body.appendChild(m);
    }
    renderSummary();
  }

  function renderSummary() {
    const el = document.getElementById("rfpSimpleSummary");
    if (!el) return;
    const m = monthStats(), y = ytdStats();
    el.innerHTML = `<div class="rfp-simple-summary"><div class="rfp-simple-stat"><span>Income this month</span><b>${money(m.revenue)}</b></div><div class="rfp-simple-stat"><span>Expenses this month</span><b>${money(m.expenses)}</b></div><div class="rfp-simple-stat ${m.net < 0 ? "loss" : "profit"}"><span>${m.net < 0 ? "Loss" : "Profit"} this month</span><b>${money(m.net)}</b></div></div><div class="rfp-simple-muted">YTD: ${money(y.revenue)} income • ${money(y.expenses)} expenses • ${money(y.net)} net</div>`;
  }

  function mark(tab) {
    document.querySelectorAll("#rfpSimpleBusinessModal [data-simple-tab]").forEach(b => b.classList.toggle("active", b.dataset.simpleTab === tab));
  }
  function showError(message) {
    const body = document.getElementById("rfpSimpleBody");
    if (!body) return;
    let e = body.querySelector(".rfp-simple-error");
    if (!e) { e = document.createElement("div"); e.className = "rfp-simple-error"; body.prepend(e); }
    e.textContent = message;
  }

  function expensePanel() {
    mark("expenses");
    const body = document.getElementById("rfpSimpleBody");
    if (!body) return;
    const rows = (Array.isArray(currentData().app2?.expenses) ? currentData().app2.expenses : []).slice().sort((a,b) => String(b?.date||"").localeCompare(String(a?.date||""))).slice(0,60);
    body.innerHTML = `<section><div class="rfp-simple-card"><h3>🧾 Add Expense</h3><form id="rfpSimpleExpenseForm" class="rfp-simple-form"><div class="rfp-simple-row"><input name="date" type="date" value="${localDate()}" required><input name="vendor" placeholder="Vendor / store" required></div><div class="rfp-simple-row"><select name="category"><option>Feed</option><option>Bedding</option><option>Egg Cartons</option><option>Equipment</option><option>Chicks / Poultry</option><option>Veterinary</option><option>Incubator Supplies</option><option>Other</option></select><input name="amount" type="number" min="0" step="0.01" placeholder="Amount" required></div><textarea name="notes" placeholder="Receipt number or notes (optional)"></textarea><button type="submit">Save Expense</button></form></div><div class="rfp-simple-card"><h3>Recent Expenses</h3><div class="rfp-simple-list">${rows.length ? rows.map(e => `<div class="rfp-simple-item"><div><strong>${esc(e.vendor || e.category || "Expense")}</strong><small>${esc(e.date || "")} • ${esc(e.category || "Other")}${(e.notes || e.description) ? ` • ${esc(e.notes || e.description)}` : ""}</small></div><b>${money(e.amount)}</b></div>`).join("") : '<div class="rfp-simple-muted">No expenses recorded yet.</div>'}</div></div></section>`;
    document.getElementById("rfpSimpleExpenseForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const button = e.currentTarget.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        await addExpense({date:f.get("date"),vendor:f.get("vendor"),category:f.get("category"),amount:f.get("amount"),notes:f.get("notes")});
        renderSummary();
        expensePanel();
      } catch (error) {
        if (button) button.disabled = false;
        showError(error?.message || "Expense could not be saved.");
      }
    });
  }

  function receiptPanel() {
    mark("receipts");
    const body = document.getElementById("rfpSimpleBody");
    if (!body) return;
    const sales = recentSales(), b = businessState();
    body.innerHTML = `<section><div class="rfp-simple-card"><h3>💵 Create Sales Receipt</h3><form id="rfpSimpleReceiptForm" class="rfp-simple-form"><select name="sale"><option value="manual">Manual receipt</option>${sales.map(r => `<option value="${esc(r.key)}">${esc(r.date)} • ${r.kind === "bird" ? "Chicken" : "Egg"} sale • ${money(r.amount)}</option>`).join("")}</select><div class="rfp-simple-row"><input name="customer" placeholder="Customer name"><select name="status"><option>Paid</option><option>Unpaid</option></select></div><input name="items" placeholder="Items" required><input name="total" type="number" min="0" step="0.01" placeholder="Total" required><button type="submit">Create Receipt</button></form><div id="rfpSimpleReceiptPreview"></div></div><div class="rfp-simple-card"><h3>Recent Sales Receipts</h3><div class="rfp-simple-list">${b.receipts.length ? b.receipts.slice(-12).reverse().map(r => `<div class="rfp-simple-item"><div><strong>${esc(r.number || "Receipt")}</strong><small>${esc(r.date || "")} • ${esc(r.customer || "Customer")} • ${esc(r.status || "")}</small></div><b>${money(r.total)}</b></div>`).join("") : '<div class="rfp-simple-muted">No sales receipts created yet.</div>'}</div></div></section>`;
    const form = document.getElementById("rfpSimpleReceiptForm");
    form?.querySelector('[name="sale"]')?.addEventListener("change", e => {
      const row = sales.find(x => x.key === e.target.value);
      if (!row) return;
      form.elements.items.value = saleItems(row);
      form.elements.total.value = row.amount.toFixed(2);
      const customer = row.raw?.buyer || row.raw?.customer || row.raw?.customerName || "";
      if (customer) form.elements.customer.value = customer;
    });
    form?.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const button = e.currentTarget.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        const receipt = await createReceipt({customer:f.get("customer"),status:f.get("status"),items:f.get("items"),total:f.get("total")});
        renderReceipt(receipt);
        if (button) button.disabled = false;
      } catch (error) {
        if (button) button.disabled = false;
        showError(error?.message || "Receipt could not be saved.");
      }
    });
  }

  function renderReceipt(r) {
    const p = document.getElementById("rfpSimpleReceiptPreview");
    if (!p || !r) return;
    const settings = businessState().receiptSettings || {};
    p.innerHTML = `<div class="rfp-simple-receipt"><h3>${BRAND}</h3><hr><div><strong>${esc(r.number)}</strong> • ${esc(r.date)}</div><div>Customer: ${esc(r.customer)}</div><div>Items: ${esc(r.items)}</div><div>Status: ${esc(r.status)}</div><h2>Total ${money(r.total)}</h2><small>${esc(settings.receiptFooter || "Thank you for supporting Rose Family Poultry!")}</small></div><div class="rfp-simple-actions" style="margin-top:8px"><button type="button" onclick="window.print()">Print / Save PDF</button></div>`;
  }

  function show(tab) {
    renderSummary();
    if (tab === "receipts") receiptPanel(); else expensePanel();
  }
  function open() {
    ensureUi();
    const m = document.getElementById("rfpSimpleBusinessModal");
    if (m) m.hidden = false;
    show("expenses");
  }
  function close() { const m = document.getElementById("rfpSimpleBusinessModal"); if (m) m.hidden = true; }

  function init() { ensureUi(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0), {once:true});
  else setTimeout(init, 0);

  ["farm-local-data-changed","farm-data-synced","core-data-synced"].forEach(name => window.addEventListener(name, () => {
    if (!document.getElementById("rfpSimpleBusinessModal")?.hidden) renderSummary();
  }));

  window.ReceiptsExpensesV1 = {
    version:1,
    sources:{entries:ENTRIES,expenses:APP2,chickenSales:BUSINESS,receipts:BUSINESS},
    calculate,monthStats,ytdStats,addExpense,recentSales,createReceipt,open,close,show,
    directFirebaseReads:0,directFirebaseWrites:0,networkCalls:0
  };
  console.log("🧾 Receipts & Expenses active — profit/loss uses the same expense source as Home; protected farm sync owns cloud writes");
})();
