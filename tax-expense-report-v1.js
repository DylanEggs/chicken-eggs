(() => {
  "use strict";
  if (window.__TaxExpenseReportV1) return;
  window.__TaxExpenseReportV1 = true;

  const APP2 = "chickenEggApp2V1";
  const BRAND = "Rose Family Poultry";
  const n = v => Number(v) || 0;
  const money = v => `$${n(v).toFixed(2)}`;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const yearStart = () => `${new Date().getFullYear()}-01-01`;

  function readExpenses() {
    try {
      const app = JSON.parse(localStorage.getItem(APP2) || "{}");
      return Array.isArray(app?.expenses) ? app.expenses : [];
    } catch {
      return [];
    }
  }

  function normalizeRow(row = {}) {
    return {
      date: String(row.date || "").slice(0, 10),
      vendor: String(row.vendor || row.description || row.category || "Expense"),
      category: String(row.category || "Other"),
      amount: Math.max(0, n(row.amount)),
      notes: String(row.notes || row.description || "")
    };
  }

  function buildReport(from, to, source = readExpenses()) {
    const start = String(from || "").slice(0,10);
    const end = String(to || "").slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error("Choose both a From and To date.");
    if (start > end) throw new Error("The From date must be before the To date.");
    const rows = (Array.isArray(source) ? source : [])
      .map(normalizeRow)
      .filter(row => row.date >= start && row.date <= end)
      .sort((a,b) => a.date.localeCompare(b.date) || a.vendor.localeCompare(b.vendor));
    const total = rows.reduce((sum,row) => sum + row.amount, 0);
    const byCategory = rows.reduce((out,row) => {
      out[row.category] = (out[row.category] || 0) + row.amount;
      return out;
    }, {});
    return { from:start, to:end, rows, total, byCategory, count:rows.length };
  }

  function csvCell(value) {
    const s = String(value ?? "").replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }

  function reportCsv(report) {
    const lines = [["Date","Vendor / Store","Category","Amount","Notes"]];
    for (const row of report.rows) lines.push([row.date,row.vendor,row.category,row.amount.toFixed(2),row.notes]);
    lines.push([]);
    lines.push(["","","TOTAL",report.total.toFixed(2),""]);
    return lines.map(row => row.map(csvCell).join(",")).join("\n");
  }

  function reportHtml(report) {
    const categoryRows = Object.entries(report.byCategory)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([name,total]) => `<tr><td>${esc(name)}</td><td class="num">${money(total)}</td></tr>`).join("");
    const expenseRows = report.rows.map(row => `<tr><td>${esc(row.date)}</td><td>${esc(row.vendor)}</td><td>${esc(row.category)}</td><td class="num">${money(row.amount)}</td><td>${esc(row.notes)}</td></tr>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND} Expense Report</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;margin:32px}h1{margin:0 0 4px}h2{margin-top:28px}.muted{color:#666}.summary{display:flex;gap:24px;flex-wrap:wrap;margin:20px 0;padding:14px;border:1px solid #ccc;border-radius:12px}.summary b{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;vertical-align:top}.num{text-align:right;white-space:nowrap}.total{font-size:20px;font-weight:800}.note{margin-top:24px;font-size:11px;color:#666}@media print{body{margin:.45in}.no-print{display:none!important}tr{break-inside:avoid}}</style></head><body><h1>${BRAND}</h1><div class="muted">Expense Report • ${esc(report.from)} through ${esc(report.to)}</div><div class="summary"><div><span>Expenses</span><br><b>${report.count}</b></div><div><span>Total expenses</span><br><b>${money(report.total)}</b></div></div><h2>Category Summary</h2><table><thead><tr><th>Category</th><th class="num">Total</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="2">No expenses in this date range.</td></tr>'}</tbody></table><h2>Expense Detail</h2><table><thead><tr><th>Date</th><th>Vendor / Store</th><th>Category</th><th class="num">Amount</th><th>Notes</th></tr></thead><tbody>${expenseRows || '<tr><td colspan="5">No expenses in this date range.</td></tr>'}</tbody><tfoot><tr><td colspan="3" class="total">Grand Total</td><td class="num total">${money(report.total)}</td><td></td></tr></tfoot></table><div class="note">Generated ${esc(localDate())} from the expense records stored in the Rose Family Poultry owner app. Review with your tax professional for tax treatment and deductibility.</div></body></html>`;
  }

  function openPrint(report) {
    const win = window.open("", "_blank");
    if (!win) throw new Error("Your browser blocked the report window. Allow pop-ups and try again.");
    win.document.open();
    win.document.write(reportHtml(report));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  async function shareReport(report) {
    const csv = reportCsv(report);
    const filename = `Rose-Family-Poultry-Expenses-${report.from}-to-${report.to}.csv`;
    const file = new File([csv], filename, {type:"text/csv"});
    const title = `${BRAND} Expense Report ${report.from} to ${report.to}`;
    const text = `${report.count} expenses totaling ${money(report.total)} for ${report.from} through ${report.to}.`;
    if (navigator.share && navigator.canShare?.({files:[file]})) {
      await navigator.share({title,text,files:[file]});
      return "shared";
    }
    location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\nThe app could not attach the CSV automatically on this device. Use Print / Save PDF to create a PDF attachment.`)}`;
    return "email";
  }

  function previewHtml(report) {
    const categories = Object.entries(report.byCategory).sort((a,b)=>b[1]-a[1]).map(([name,total]) => `<div class="rfp-tax-category"><span>${esc(name)}</span><b>${money(total)}</b></div>`).join("");
    const rows = report.rows.map(row => `<div class="rfp-tax-row"><div><b>${esc(row.vendor)}</b><small>${esc(row.date)} • ${esc(row.category)}${row.notes ? ` • ${esc(row.notes)}` : ""}</small></div><strong>${money(row.amount)}</strong></div>`).join("");
    return `<div class="rfp-tax-summary"><span>${report.count} expense${report.count===1?"":"s"}</span><b>${money(report.total)}</b></div>${categories ? `<div class="rfp-tax-categories">${categories}</div>` : ""}<div class="rfp-tax-list">${rows || '<div class="rfp-simple-muted">No expenses were recorded in this date range.</div>'}</div><div class="rfp-simple-actions" style="margin-top:12px"><button type="button" id="rfpTaxPrint">🖨️ Print / Save PDF</button><button type="button" id="rfpTaxShare">✉️ Email / Share</button></div><div class="rfp-simple-muted" style="margin-top:8px">On iPhone, Email / Share opens the Share sheet with a CSV expense report attached. Choose Mail to email it.</div>`;
  }

  function css() {
    if (document.getElementById("rfpTaxExpenseCss")) return;
    const style = document.createElement("style");
    style.id = "rfpTaxExpenseCss";
    style.textContent = `.rfp-tax-date-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}.rfp-tax-date-row label{font-size:12px;font-weight:800}.rfp-tax-date-row input{width:100%;box-sizing:border-box;margin-top:4px}.rfp-tax-summary{display:flex;justify-content:space-between;align-items:end;margin:14px 0;padding:12px;border-radius:14px;background:rgba(31,122,58,.09)}.rfp-tax-summary b{font-size:24px}.rfp-tax-categories{display:grid;gap:5px;margin-bottom:12px}.rfp-tax-category{display:flex;justify-content:space-between;font-size:12px}.rfp-tax-list{display:grid;gap:7px;max-height:360px;overflow:auto}.rfp-tax-row{display:flex;justify-content:space-between;gap:10px;padding:10px;border-radius:12px;background:rgba(31,122,58,.05)}.rfp-tax-row small{display:block;opacity:.72}.rfp-tax-row strong{white-space:nowrap}@media(max-width:560px){.rfp-tax-date-row{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function renderCard(card) {
    card.innerHTML = `<h3>📄 Tax Expense Report</h3><div class="rfp-simple-muted">Choose a date range for your tax records. This report uses the same expenses shown on Home.</div><div class="rfp-tax-date-row" style="margin-top:10px"><label>From<input id="rfpTaxFrom" type="date" value="${yearStart()}"></label><label>To<input id="rfpTaxTo" type="date" value="${localDate()}"></label></div><button type="button" id="rfpTaxGenerate" style="margin-top:10px">Generate Expense Report</button><div id="rfpTaxPreview"></div>`;
    const generate = () => {
      const preview = card.querySelector("#rfpTaxPreview");
      try {
        const report = buildReport(card.querySelector("#rfpTaxFrom")?.value, card.querySelector("#rfpTaxTo")?.value);
        preview.innerHTML = previewHtml(report);
        preview.dataset.reportFrom = report.from;
        preview.dataset.reportTo = report.to;
        preview.querySelector("#rfpTaxPrint")?.addEventListener("click", () => {
          try { openPrint(report); } catch (error) { alert(error.message || String(error)); }
        });
        preview.querySelector("#rfpTaxShare")?.addEventListener("click", async () => {
          try { await shareReport(report); } catch (error) { if (error?.name !== "AbortError") alert(error.message || String(error)); }
        });
      } catch (error) {
        preview.innerHTML = `<div class="rfp-simple-error">${esc(error.message || String(error))}</div>`;
      }
    };
    card.querySelector("#rfpTaxGenerate")?.addEventListener("click", generate);
  }

  function ensureCard() {
    css();
    const body = document.getElementById("rfpSimpleBody");
    if (!body || !document.getElementById("rfpSimpleExpenseForm")) return false;
    if (document.getElementById("rfpTaxExpenseCard")) return true;
    const card = document.createElement("div");
    card.id = "rfpTaxExpenseCard";
    card.className = "rfp-simple-card";
    renderCard(card);
    const cards = body.querySelectorAll(":scope > section > .rfp-simple-card");
    const recent = cards[1] || null;
    if (recent?.parentNode) recent.parentNode.insertBefore(card, recent);
    else (body.querySelector("section") || body).appendChild(card);
    return true;
  }

  function installObserver() {
    const modal = document.getElementById("rfpSimpleBusinessModal");
    if (!modal) { setTimeout(installObserver, 250); return; }
    ensureCard();
    const body = document.getElementById("rfpSimpleBody");
    if (body) new MutationObserver(() => ensureCard()).observe(body,{childList:true,subtree:false});
    modal.addEventListener("click", event => {
      if (event.target?.dataset?.simpleTab === "expenses") setTimeout(ensureCard, 0);
    });
  }

  window.FarmTaxExpenseReportV1 = {
    version:1,
    buildReport,
    reportCsv,
    reportHtml,
    ensureCard,
    firebaseReads:0,
    firebaseWrites:0,
    networkCalls:0
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(installObserver, 1200), {once:true});
  else setTimeout(installObserver, 1200);
})();
