(() => {
  "use strict";
  if (window.__StagingEggPricingV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingEggPricingV1 = true;

  const BRAND="Rose Family Poultry";
  const STORE="rfpEggPricingV1";
  const ENTRIES="chickenEggEntriesV102";
  const BUSINESS="rfpBusinessSuiteV1";
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
  const n=v=>Math.max(0,Number(v)||0);
  const money=v=>`$${n(v).toFixed(2)}`;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const directCategories=/^(feed|bedding|egg cartons?|cartons?|oyster shell|calcium|incubator supplies)$/i;

  function settings(){const s=read(STORE,{});return {desiredMargin:n(s.desiredMargin)||25,dozenPrice:n(s.dozenPrice),pack18Price:n(s.pack18Price),monthlyDozens:n(s.monthlyDozens)};}
  function saveSettings(next={}){const old=settings(),out={...old,...next,desiredMargin:Math.min(95,n(next.desiredMargin??old.desiredMargin)),dozenPrice:n(next.dozenPrice??old.dozenPrice),pack18Price:n(next.pack18Price??old.pack18Price),monthlyDozens:n(next.monthlyDozens??old.monthlyDozens)};write(STORE,out);window.dispatchEvent(new CustomEvent("rfp-staging-egg-pricing-changed",{detail:out}));return out;}
  function eggRows(){const rows=read(ENTRIES,[]);return Array.isArray(rows)?rows:[];}
  function businessState(){const s=read(BUSINESS,{});return s&&typeof s==="object"?s:{};}
  function currentYear(){return String(new Date().getFullYear());}
  function productionYtd(){const y=currentYear();return eggRows().filter(e=>e?.type==="eggs"&&String(e.date||"").startsWith(y)).reduce((sum,e)=>sum+n(e.eggs),0);}
  function directCostsYtd(){const y=currentYear();const expenses=Array.isArray(businessState().expenses)?businessState().expenses:[];return expenses.filter(e=>String(e.date||"").startsWith(y)&&directCategories.test(String(e.category||""))).reduce((sum,e)=>sum+n(e.amount),0);}
  function calculate(input={}){
    const eggs=n(input.eggsProduced),cost=n(input.directCosts),margin=Math.min(95,n(input.desiredMargin));
    const costPerEgg=eggs>0?cost/eggs:0;
    const breakEvenDozen=costPerEgg*12;
    const breakEven18=costPerEgg*18;
    const marginFactor=1-(margin/100);
    const recommendedDozen=marginFactor>0?breakEvenDozen/marginFactor:breakEvenDozen;
    const recommended18=marginFactor>0?breakEven18/marginFactor:breakEven18;
    const dozenPrice=n(input.dozenPrice);
    const pack18Price=n(input.pack18Price);
    const profitPerDozen=dozenPrice-breakEvenDozen;
    const profitPer18=pack18Price-breakEven18;
    const monthlyDozens=n(input.monthlyDozens);
    const projectedMonthlyProfit=monthlyDozens*profitPerDozen;
    return {eggsProduced:eggs,directCosts:cost,costPerEgg,breakEvenDozen,breakEven18,recommendedDozen,recommended18,dozenPrice,pack18Price,profitPerDozen,profitPer18,monthlyDozens,projectedMonthlyProfit,desiredMargin:margin};
  }
  function current(){const s=settings();return calculate({eggsProduced:productionYtd(),directCosts:directCostsYtd(),...s});}
  function panelHtml(c=current(),s=settings()){
    const dozenStatus=c.dozenPrice?`${money(c.profitPerDozen)} profit/dozen`:"Enter your price";
    const packStatus=c.pack18Price?`${money(c.profitPer18)} profit/18-pack`:"Enter your price";
    return `<section><div class="rfp-fm-banner"><strong>STAGING • LOCAL ONLY</strong><br>${BRAND} pricing calculations make zero Firebase calls.</div><h3>🏷️ Egg Pricing & Profit Planner</h3><div class="rfp-fm-stats"><div class="rfp-fm-stat"><span>YTD eggs produced</span><b>${Math.round(c.eggsProduced)}</b></div><div class="rfp-fm-stat"><span>Tracked direct costs</span><b>${money(c.directCosts)}</b></div><div class="rfp-fm-stat"><span>Cost per egg</span><b>${money(c.costPerEgg)}</b></div><div class="rfp-fm-stat"><span>Break-even dozen</span><b>${money(c.breakEvenDozen)}</b></div><div class="rfp-fm-stat"><span>Break-even 18-pack</span><b>${money(c.breakEven18)}</b></div><div class="rfp-fm-stat"><span>Target margin</span><b>${c.desiredMargin.toFixed(0)}%</b></div></div><div class="rfp-fm-banner"><strong>Suggested minimum prices for your target margin:</strong><br>Dozen: ${money(c.recommendedDozen)} • 18-pack: ${money(c.recommended18)}</div><form id="rfpEggPricingForm" class="rfp-fm-form"><div class="rfp-fm-row"><label>Desired profit margin %<input name="desiredMargin" type="number" min="0" max="95" step="1" value="${esc(s.desiredMargin)}"></label><label>Expected dozens sold / month<input name="monthlyDozens" type="number" min="0" step="1" value="${esc(s.monthlyDozens)}"></label></div><div class="rfp-fm-row"><label>Your dozen price<input name="dozenPrice" type="number" min="0" step="0.01" value="${esc(s.dozenPrice)}"></label><label>Your 18-pack price<input name="pack18Price" type="number" min="0" step="0.01" value="${esc(s.pack18Price)}"></label></div><button type="submit">Save Pricing Assumptions</button></form><div class="rfp-fm-stats"><div class="rfp-fm-stat"><span>At your dozen price</span><b>${dozenStatus}</b></div><div class="rfp-fm-stat"><span>At your 18-pack price</span><b>${packStatus}</b></div><div class="rfp-fm-stat"><span>Projected monthly profit</span><b>${money(c.projectedMonthlyProfit)}</b></div></div><p class="rfp-muted">Uses YTD egg production plus tracked direct categories such as feed, bedding, cartons, oyster shell/calcium and incubator supplies. Equipment and unrelated overhead stay out of this break-even estimate.</p></section>`;
  }
  function render(){const body=document.getElementById("rfpBizBody");if(!body)return false;body.innerHTML=panelHtml();document.getElementById("rfpEggPricingForm")?.addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);saveSettings({desiredMargin:f.get("desiredMargin"),monthlyDozens:f.get("monthlyDozens"),dozenPrice:f.get("dozenPrice"),pack18Price:f.get("pack18Price")});render();});return true;}
  function installTab(){const modal=document.getElementById("rfpBusinessModal");if(!modal)return false;const tabs=modal.querySelector(".rfp-biz-tabs");if(!tabs)return false;if(tabs.querySelector('[data-egg-pricing]'))return true;const b=document.createElement("button");b.type="button";b.dataset.eggPricing="1";b.textContent="🏷️ Egg Pricing";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");render();});tabs.appendChild(b);return true;}
  function watch(){if(installTab())return;const o=new MutationObserver(()=>{if(installTab())o.disconnect();});o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),15000);}

  window.StagingEggPricingV1={version:1,firebaseReads:0,firebaseWrites:0,settings,saveSettings,productionYtd,directCostsYtd,calculate,current,panelHtml,render,installTab};
  watch();
  window.addEventListener("rfp-staging-business-changed",()=>{if(document.querySelector('[data-egg-pricing].active'))render();});
})();