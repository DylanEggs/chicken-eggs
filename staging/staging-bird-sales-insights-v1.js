(() => {
  "use strict";
  if (window.__StagingBirdSalesInsightsV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingBirdSalesInsightsV1 = true;
  const BRAND="Rose Family Poultry", APP2="chickenEggApp2V1", FARM="rfpFarmManagerV1";
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||"null");return v==null?f:v;}catch{return f;}};
  const n=v=>Math.max(0,Number(v)||0), money=v=>`$${n(v).toFixed(2)}`, esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  function summarize(app=read(APP2,{}),farm=read(FARM,{})){
    const listings=Array.isArray(app?.birdListings)?app.birdListings:[];
    const publicRows=listings.filter(x=>x?.public!==false);
    const priced=publicRows.filter(x=>x?.price!==""&&x?.price!=null&&Number.isFinite(Number(x.price)));
    const availableBirds=publicRows.reduce((s,x)=>s+n(x.quantity),0);
    const potentialRevenue=priced.reduce((s,x)=>s+n(x.quantity)*n(x.price),0);
    const weightedQty=priced.reduce((s,x)=>s+n(x.quantity),0);
    const weightedPrice=weightedQty?potentialRevenue/weightedQty:0;
    const batches=Array.isArray(farm?.growoutBatches)?farm.growoutBatches:Array.isArray(farm?.batches)?farm.batches:[];
    const sold=batches.reduce((s,x)=>s+n(x.sold||x.soldCount||x.quantitySold),0);
    const realized=batches.reduce((s,x)=>s+n(x.revenue||x.earnings||x.salesRevenue),0);
    const avgSoldPrice=sold?realized/sold:0;
    return {listings:listings.length,publicListings:publicRows.length,pricedListings:priced.length,availableBirds,potentialRevenue,weightedPrice,sold,realized,avgSoldPrice,rows:publicRows};
  }
  function render(){
    const body=document.getElementById("rfpBizBody"); if(!body)return;
    const s=summarize();
    body.innerHTML=`<section class="rfp-biz-panel active"><h3>🐔 Bird Sales & Pricing</h3><div class="rfp-biz-grid"><div class="rfp-biz-card"><span>Birds listed</span><b>${s.availableBirds}</b></div><div class="rfp-biz-card"><span>Potential listing revenue</span><b>${money(s.potentialRevenue)}</b></div><div class="rfp-biz-card"><span>Avg asking price</span><b>${money(s.weightedPrice)}</b></div><div class="rfp-biz-card"><span>Birds sold from batches</span><b>${s.sold}</b></div><div class="rfp-biz-card"><span>Recorded bird revenue</span><b>${money(s.realized)}</b></div><div class="rfp-biz-card"><span>Avg realized price</span><b>${money(s.avgSoldPrice)}</b></div></div><h4>Current public listings</h4><div class="rfp-biz-list">${s.rows.length?s.rows.map(x=>`<div class="rfp-biz-item"><div><strong>${esc(x.breed||"Bird listing")}</strong><small>${esc(x.birdType||"")} • ${n(x.quantity)} available</small></div><b>${x.price==null||x.price===""?"No price":money(x.price)}</b></div>`).join(""):"<div class='rfp-muted'>No public bird listings yet.</div>"}</div><p class="rfp-muted">Private STAGING analysis for ${BRAND}. No Firebase calls are made by this dashboard.</p></section>`;
  }
  function install(){
    const tabs=document.querySelector("#rfpBusinessModal .rfp-biz-tabs"); if(!tabs||tabs.querySelector('[data-bird-sales-insights="1"]'))return false;
    const b=document.createElement("button"); b.type="button"; b.dataset.birdSalesInsights="1"; b.textContent="🐔 Bird Sales";
    b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));render();}); tabs.appendChild(b); return true;
  }
  document.addEventListener("click",e=>{if(e.target?.closest?.("#rfpBusinessLauncher"))setTimeout(install,0);},true);
  window.addEventListener("bird-sale-listings-changed",()=>{if(document.querySelector('[data-bird-sales-insights="1"].active'))render();});
  if(document.getElementById("rfpBusinessModal"))install();
  window.StagingBirdSalesInsightsV1={version:1,brand:BRAND,networkCalls:0,firebaseReads:0,firebaseWrites:0,summarize,render,install};
})();