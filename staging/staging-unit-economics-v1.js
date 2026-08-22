(() => {
  "use strict";
  if(window.__StagingUnitEconomicsV1||!window.__ChickenEggsStagingMode)return;
  window.__StagingUnitEconomicsV1=true;

  const BIZ="rfpBusinessSuiteV1", ENTRIES="chickenEggEntriesV102";
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const n=v=>Math.max(0,Number(v)||0);
  const money=v=>`$${n(v).toFixed(2)}`;
  const year=()=>String(new Date().getFullYear());
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const directCategory=c=>/feed|bedding|egg cartons?|oyster|layer|calcium/i.test(String(c||""));

  function saleRevenue(e){
    if(!e||e.type!=="sale")return 0;
    if(Number.isFinite(Number(e.total)))return n(e.total);
    if(Number.isFinite(Number(e.amount)))return n(e.amount);
    return n(e.dozenSold||e.dozens||e.dozen)*n(e.dozenPrice||e.pricePerDozen||e.price)+n(e.packSold||e.packs18)*n(e.packPrice||e.pricePer18);
  }
  function eggsSold(e){
    if(!e||e.type!=="sale")return 0;
    return Math.round(n(e.dozenSold||e.dozens||e.dozen)*12+n(e.packSold||e.packs18)*18+n(e.looseSold||e.loose));
  }
  function metrics(){
    const y=year(),entries=read(ENTRIES,[]),biz=read(BIZ,{}),expenses=Array.isArray(biz?.expenses)?biz.expenses:[];
    const yEntries=(Array.isArray(entries)?entries:[]).filter(e=>String(e?.date||"").startsWith(y));
    const produced=yEntries.filter(e=>e?.type==="eggs").reduce((s,e)=>s+Math.round(n(e.eggs||e.count||e.quantity)),0);
    const sales=yEntries.filter(e=>e?.type==="sale");
    const revenue=sales.reduce((s,e)=>s+saleRevenue(e),0);
    const soldEggs=sales.reduce((s,e)=>s+eggsSold(e),0);
    const direct=expenses.filter(e=>String(e?.date||"").startsWith(y)&&directCategory(e?.category));
    const directCost=direct.reduce((s,e)=>s+n(e.amount),0);
    const byCategory={};for(const e of direct){const k=String(e.category||"Other");byCategory[k]=(byCategory[k]||0)+n(e.amount);}
    const costPerEgg=produced?directCost/produced:0;
    const costPerDozen=costPerEgg*12;
    const revenuePerSoldEgg=soldEggs?revenue/soldEggs:0;
    const trackedMargin=revenue-directCost;
    const marginPct=revenue?trackedMargin/revenue*100:0;
    return {year:y,produced,soldEggs,revenue,directCost,costPerEgg,costPerDozen,revenuePerSoldEgg,trackedMargin,marginPct,byCategory};
  }

  function css(){if(document.getElementById("rfpUnitEconomicsCss"))return;const s=document.createElement("style");s.id="rfpUnitEconomicsCss";s.textContent=`
    .rfp-ue-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:10px 0}.rfp-ue-card{padding:12px;border-radius:16px;background:rgba(31,122,58,.07);border:1px solid rgba(31,122,58,.12)}.rfp-ue-card span{display:block;font-size:11px;opacity:.72}.rfp-ue-card b{display:block;font-size:21px;margin-top:3px}.rfp-ue-note{font-size:11px;line-height:1.45;opacity:.72;margin-top:10px}.rfp-ue-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;border-bottom:1px solid rgba(31,122,58,.10);font-size:12px}.rfp-ue-row:last-child{border-bottom:0}.rfp-ue-good{color:#166534}.rfp-ue-bad{color:#b91c1c}@media(max-width:560px){.rfp-ue-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(s);}

  function render(){
    css();const body=document.getElementById("rfpBizBody");if(!body)return false;
    const d=metrics(),cats=Object.entries(d.byCategory).sort((a,b)=>b[1]-a[1]);
    body.innerHTML=`<section class="rfp-biz-panel active"><h3>🥚 Egg Cost & Break-Even</h3><div class="rfp-muted">${esc(d.year)} • private staging analysis</div><div class="rfp-ue-grid"><div class="rfp-ue-card"><span>Eggs produced YTD</span><b>${d.produced}</b></div><div class="rfp-ue-card"><span>Eggs sold YTD</span><b>${d.soldEggs}</b></div><div class="rfp-ue-card"><span>Tracked direct egg costs</span><b>${money(d.directCost)}</b></div><div class="rfp-ue-card"><span>Break-even cost / dozen</span><b>${money(d.costPerDozen)}</b></div><div class="rfp-ue-card"><span>Revenue / sold egg</span><b>${money(d.revenuePerSoldEgg)}</b></div><div class="rfp-ue-card"><span>Revenue minus tracked direct costs</span><b class="${d.trackedMargin>=0?"rfp-ue-good":"rfp-ue-bad"}">${money(d.trackedMargin)}</b></div></div><h4>Direct-cost breakdown</h4><div class="rfp-ue-card">${cats.length?cats.map(([k,v])=>`<div class="rfp-ue-row"><span>${esc(k)}</span><strong>${money(v)}</strong></div>`).join(""):"No YTD feed, bedding, carton, oyster-shell, layer-feed or calcium expenses are staged yet."}</div><p class="rfp-ue-note">Break-even uses tracked direct egg-production costs divided by eggs produced. It is a management estimate, not a tax/accounting calculation, and intentionally excludes general equipment, mileage, veterinary, chick purchases and other overhead.</p></section>`;
    return true;
  }

  function ensureTab(){
    const tabs=document.querySelector("#rfpBusinessModal .rfp-biz-tabs");if(!tabs)return false;
    let b=tabs.querySelector('[data-unit-economics]');
    if(!b){b=document.createElement("button");b.type="button";b.dataset.unitEconomics="1";b.textContent="🥚 Cost / Egg";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));render();});tabs.appendChild(b);}
    return true;
  }

  document.addEventListener("click",e=>{if(e.target?.closest?.("#rfpBusinessLauncher"))setTimeout(ensureTab,0);});
  window.addEventListener("rfp-staging-business-changed",()=>{if(document.querySelector('[data-unit-economics].active'))render();});
  setTimeout(ensureTab,1200);

  window.StagingUnitEconomicsV1={version:1,environment:"staging-local-only",networkCalls:0,firebaseReads:0,firebaseWrites:0,directCategory,metrics,render,ensureTab};
  console.log("🧪 STAGING Egg Cost & Break-Even active — local-only, zero Firebase calls");
})();
