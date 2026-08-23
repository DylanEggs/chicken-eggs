(() => {
  "use strict";
  if(window.__StagingEggSalesForecastV1||!window.__ChickenEggsStagingMode)return;
  window.__StagingEggSalesForecastV1=true;

  const ENTRIES="chickenEggEntriesV102", INVENTORY="chickenEggInventoryV2", BRAND="Rose Family Poultry";
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const n=v=>Math.max(0,Number(v)||0), money=v=>`$${n(v).toFixed(2)}`;
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const daysAgo=d=>{const x=new Date();x.setHours(12,0,0,0);x.setDate(x.getDate()-d);return dateKey(x);};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  function eggsSold(e){if(!e||e.type!=="sale")return 0;return Math.round(n(e.dozenSold||e.dozens||e.dozen)*12+n(e.packSold||e.packs18)*18+n(e.looseSold||e.loose));}
  function saleRevenue(e){if(!e||e.type!=="sale")return 0;if(Number.isFinite(Number(e.total)))return n(e.total);if(Number.isFinite(Number(e.amount)))return n(e.amount);return n(e.dozenSold||e.dozens||e.dozen)*n(e.dozenPrice||e.pricePerDozen||e.price)+n(e.packSold||e.packs18)*n(e.packPrice||e.pricePer18);}
  function inventory(){const s=read(INVENTORY,{});return Math.round(n(s?.dozens)*12+n(s?.packs18)*18+n(s?.loose));}
  function period(startDays,endDays){
    const rows=read(ENTRIES,[]), list=Array.isArray(rows)?rows:[], newest=daysAgo(startDays), oldest=daysAgo(endDays);
    let produced=0,sold=0,revenue=0,saleCount=0;
    for(const e of list){const d=String(e?.date||"").slice(0,10);if(!d||d>newest||d<oldest)continue;if(e?.type==="eggs")produced+=Math.round(n(e.eggs||e.count||e.quantity));if(e?.type==="sale"){sold+=eggsSold(e);revenue+=saleRevenue(e);saleCount++;}}
    return {produced,sold,revenue,saleCount};
  }
  function metrics(){
    const current=period(0,29), prior=period(30,59), stock=inventory();
    const salesPerDay=current.sold/30, producedPerDay=current.produced/30, avgPricePerEgg=current.sold?current.revenue/current.sold:0;
    const sellThrough=current.produced?current.sold/current.produced*100:0;
    const daysSupply=salesPerDay>0?stock/salesPerDay:null;
    const projectedRevenue=salesPerDay*30*avgPricePerEgg;
    const salesTrend=prior.sold?((current.sold-prior.sold)/prior.sold)*100:(current.sold>0?100:0);
    const balance=current.produced-current.sold;
    return {brand:BRAND,current,prior,stock,salesPerDay,producedPerDay,avgPricePerEgg,sellThrough,daysSupply,projectedRevenue,salesTrend,balance};
  }

  function css(){if(document.getElementById("rfpEggForecastCss"))return;const s=document.createElement("style");s.id="rfpEggForecastCss";s.textContent=`
    .rfp-ef-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:10px 0}.rfp-ef-card{padding:12px;border-radius:16px;background:rgba(31,122,58,.07);border:1px solid rgba(31,122,58,.12)}.rfp-ef-card span{display:block;font-size:11px;opacity:.72}.rfp-ef-card b{display:block;font-size:21px;margin-top:3px}.rfp-ef-note{font-size:11px;line-height:1.45;opacity:.72;margin-top:10px}.rfp-ef-up{color:#166534}.rfp-ef-down{color:#b91c1c}@media(max-width:560px){.rfp-ef-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(s);}
  function render(){
    css();const body=document.getElementById("rfpBizBody");if(!body)return false;const d=metrics(),trendClass=d.salesTrend>=0?"rfp-ef-up":"rfp-ef-down",trend=`${d.salesTrend>=0?"+":""}${d.salesTrend.toFixed(0)}%`;
    body.innerHTML=`<section class="rfp-biz-panel active"><h3>📈 Egg Sales Forecast</h3><div class="rfp-muted">Last 30 days • private STAGING analysis</div><div class="rfp-ef-grid"><div class="rfp-ef-card"><span>Eggs collected</span><b>${d.current.produced}</b></div><div class="rfp-ef-card"><span>Eggs sold</span><b>${d.current.sold}</b></div><div class="rfp-ef-card"><span>Sell-through rate</span><b>${d.sellThrough.toFixed(0)}%</b></div><div class="rfp-ef-card"><span>Sales vs prior 30 days</span><b class="${trendClass}">${trend}</b></div><div class="rfp-ef-card"><span>Eggs on hand now</span><b>${d.stock}</b></div><div class="rfp-ef-card"><span>Days of supply at recent sales pace</span><b>${d.daysSupply==null?"—":d.daysSupply.toFixed(1)}</b></div><div class="rfp-ef-card"><span>Average revenue / sold egg</span><b>${money(d.avgPricePerEgg)}</b></div><div class="rfp-ef-card"><span>Projected next-30-day egg revenue</span><b>${money(d.projectedRevenue)}</b></div></div><p class="rfp-ef-note">Recent pace: ${d.producedPerDay.toFixed(1)} eggs collected/day and ${d.salesPerDay.toFixed(1)} eggs sold/day. ${d.balance>0?`${d.balance} more eggs were collected than sold in the last 30 days.`:d.balance<0?`${Math.abs(d.balance)} more eggs were sold than collected in the last 30 days.`:"Collection and sales were even."} Days-of-supply uses the current staged inventory and recent sales pace; it is a planning estimate, not a promise of future demand.</p></section>`;
    return true;
  }
  function ensureTab(){const tabs=document.querySelector("#rfpBusinessModal .rfp-biz-tabs");if(!tabs)return false;let b=tabs.querySelector('[data-egg-sales-forecast]');if(!b){b=document.createElement("button");b.type="button";b.dataset.eggSalesForecast="1";b.textContent="📈 Egg Forecast";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));render();});tabs.appendChild(b);}return true;}
  document.addEventListener("click",e=>{if(e.target?.closest?.("#rfpBusinessLauncher"))setTimeout(ensureTab,0);});
  ["core-data-synced","inventory-authority-changed","rfp-staging-business-changed"].forEach(name=>window.addEventListener(name,()=>{if(document.querySelector('[data-egg-sales-forecast].active'))render();}));
  setTimeout(ensureTab,1400);
  window.StagingEggSalesForecastV1={version:1,environment:"staging-local-only",brand:BRAND,networkCalls:0,firebaseReads:0,firebaseWrites:0,eggsSold,saleRevenue,inventory,period,metrics,render,ensureTab};
  console.log("🧪 STAGING Egg Sales Forecast active — local-only, zero Firebase calls");
})();
