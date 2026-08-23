(() => {
  "use strict";
  if (window.__StagingCashFlowV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingCashFlowV1 = true;

  const BRAND="Rose Family Poultry";
  const ENTRIES="chickenEggEntriesV102";
  const APP2="chickenEggApp2V1";
  const BUSINESS="rfpBusinessSuiteV1";
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const n=v=>Math.max(0,Number(v)||0);
  const money=v=>`${Number(v)<0?"-":""}$${Math.abs(Number(v)||0).toFixed(2)}`;
  const monthLabel=key=>{const d=new Date(`${key}-01T12:00:00`);return Number.isNaN(d.getTime())?key:d.toLocaleDateString(undefined,{month:"short"});};
  const currentYear=()=>String(new Date().getFullYear());

  function eggSaleAmount(e){
    if(!e||e.type!=="sale")return 0;
    if(Number.isFinite(Number(e.total)))return n(e.total);
    if(Number.isFinite(Number(e.amount)))return n(e.amount);
    return n(e.dozenSold||e.dozens||e.dozen)*n(e.dozenPrice||e.pricePerDozen||e.price)+n(e.packSold||e.packs18)*n(e.packPrice||e.pricePer18);
  }
  function birdSaleAmount(x){
    if(!x)return 0;
    if(Number.isFinite(Number(x.total)))return n(x.total);
    if(Number.isFinite(Number(x.amount)))return n(x.amount);
    return n(x.price)*Math.max(1,n(x.quantity||x.qty||1));
  }
  function birdSales(){
    const a=read(APP2,{});const pools=[a?.birdSales,a?.chickenSales];
    const list=pools.find(Array.isArray)||[];return list;
  }
  function expenses(){const s=read(BUSINESS,{});return Array.isArray(s?.expenses)?s.expenses:[];}
  function rowsForYear(year=currentYear()){
    const months=Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,"0")}`);
    const rows=months.map(month=>({month,eggSales:0,chickenSales:0,income:0,expenses:0,net:0}));
    const byMonth=new Map(rows.map(r=>[r.month,r]));
    const entries=read(ENTRIES,[]);
    for(const e of Array.isArray(entries)?entries:[]){const key=String(e?.date||"").slice(0,7),r=byMonth.get(key);if(!r)continue;r.eggSales+=eggSaleAmount(e);}
    for(const s of birdSales()){const key=String(s?.date||s?.soldDate||"").slice(0,7),r=byMonth.get(key);if(!r)continue;r.chickenSales+=birdSaleAmount(s);}
    for(const e of expenses()){const key=String(e?.date||"").slice(0,7),r=byMonth.get(key);if(!r)continue;r.expenses+=n(e.amount);}
    for(const r of rows){r.income=r.eggSales+r.chickenSales;r.net=r.income-r.expenses;}
    return rows;
  }
  function summarize(rows=rowsForYear()){
    const active=rows.filter(r=>r.income||r.expenses);
    const income=rows.reduce((s,r)=>s+r.income,0),expensesTotal=rows.reduce((s,r)=>s+r.expenses,0),net=income-expensesTotal;
    const best=active.length?active.reduce((a,b)=>b.net>a.net?b:a):null;
    const worst=active.length?active.reduce((a,b)=>b.net<a.net?b:a):null;
    const profitable=active.filter(r=>r.net>0).length;
    return {income,expenses:expensesTotal,net,best,worst,profitable,activeMonths:active.length};
  }
  function panelHtml(rows=rowsForYear()){
    const s=summarize(rows),max=Math.max(1,...rows.map(r=>Math.max(r.income,r.expenses)));
    return `<section><div class="rfp-fm-banner"><strong>STAGING • LOCAL ONLY</strong><br>${BRAND} monthly cash-flow calculations make zero Firebase calls.</div><h3>📆 Monthly Cash Flow</h3><div class="rfp-fm-stats"><div class="rfp-fm-stat"><span>YTD income</span><b>${money(s.income)}</b></div><div class="rfp-fm-stat"><span>YTD expenses</span><b>${money(s.expenses)}</b></div><div class="rfp-fm-stat"><span>YTD net</span><b>${money(s.net)}</b></div></div><div class="rfp-fm-banner"><strong>Best month:</strong> ${s.best?`${monthLabel(s.best.month)} ${money(s.best.net)}`:"No activity yet"} • <strong>Profitable months:</strong> ${s.profitable}/${s.activeMonths||0}</div><div class="rfp-cashflow-list">${rows.map(r=>`<div class="rfp-cashflow-row"><strong>${monthLabel(r.month)}</strong><div class="rfp-cashflow-bars"><i style="width:${Math.round((r.income/max)*100)}%" title="Income ${money(r.income)}"></i><em style="width:${Math.round((r.expenses/max)*100)}%" title="Expenses ${money(r.expenses)}"></em></div><span>${money(r.net)}</span></div>`).join("")}</div><p class="rfp-muted">Green bar = income • second bar = expenses • right side = monthly net. Uses staged egg sales, chicken sales and business expenses already in the app.</p></section>`;
  }
  function css(){if(document.getElementById("rfpCashFlowCss"))return;const s=document.createElement("style");s.id="rfpCashFlowCss";s.textContent=`.rfp-cashflow-list{display:grid;gap:8px;margin-top:12px}.rfp-cashflow-row{display:grid;grid-template-columns:38px 1fr 78px;gap:8px;align-items:center;font-size:12px}.rfp-cashflow-row>span{text-align:right;font-weight:900}.rfp-cashflow-bars{display:grid;gap:3px}.rfp-cashflow-bars i,.rfp-cashflow-bars em{display:block;min-height:7px;border-radius:999px;background:rgba(31,122,58,.72)}.rfp-cashflow-bars em{background:rgba(185,28,28,.48)}@media(max-width:520px){.rfp-cashflow-row{grid-template-columns:34px 1fr 70px}}`;document.head.appendChild(s);}
  function render(){css();const body=document.getElementById("rfpBizBody");if(!body)return false;body.innerHTML=panelHtml();return true;}
  function installTab(){const modal=document.getElementById("rfpBusinessModal");if(!modal)return false;const tabs=modal.querySelector(".rfp-biz-tabs");if(!tabs)return false;if(tabs.querySelector('[data-cash-flow]'))return true;const b=document.createElement("button");b.type="button";b.dataset.cashFlow="1";b.textContent="📆 Cash Flow";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");render();});tabs.appendChild(b);return true;}
  function watch(){if(installTab())return;const o=new MutationObserver(()=>{if(installTab())o.disconnect();});o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),15000);}

  window.StagingCashFlowV1={version:1,firebaseReads:0,firebaseWrites:0,eggSaleAmount,birdSaleAmount,rowsForYear,summarize,panelHtml,render,installTab};
  watch();
  window.addEventListener("rfp-staging-business-changed",()=>{if(document.querySelector('[data-cash-flow].active'))render();});
})();