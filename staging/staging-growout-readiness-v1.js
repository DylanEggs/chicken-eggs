(() => {
  "use strict";
  if (window.__StagingGrowoutReadinessV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingGrowoutReadinessV1 = true;

  const BRAND="Rose Family Poultry";
  const FARM_STORE="rfpFarmManagerV1";
  const STORE="rfpGrowoutReadinessV1";
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
  const n=v=>Math.max(0,Number(v)||0);
  const money=v=>`$${n(v).toFixed(2)}`;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const today=()=>dayKey(new Date());

  function batches(){const s=read(FARM_STORE,{});return Array.isArray(s?.batches)?s.batches:[];}
  function settings(){const s=read(STORE,{});return s&&typeof s==="object"?s:{};}
  function ageDays(date,asOf=today()){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||""))||!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf||"")))return null;
    const a=new Date(`${date}T12:00:00`),b=new Date(`${asOf}T12:00:00`);
    if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return null;
    return Math.max(0,Math.floor((b-a)/86400000));
  }
  function analyze(batch={},cfg={},asOf=today()){
    const age=ageDays(batch.hatchDate,asOf),targetAgeWeeks=n(cfg.targetAgeWeeks||16),targetDays=Math.round(targetAgeWeeks*7);
    const daysUntil=age==null?null:Math.max(0,targetDays-age);
    const remaining=n(batch.remainingQty),weeklyFeedCostPerBird=n(cfg.weeklyFeedCostPerBird),targetPricePerBird=n(cfg.targetPricePerBird);
    const futureFeed=daysUntil==null?0:remaining*weeklyFeedCostPerBird*(daysUntil/7);
    const projectedRevenue=remaining*targetPricePerBird;
    const existingCost=n(batch.cost),earned=n(batch.earned);
    const projectedBatchProfit=earned+projectedRevenue-existingCost-futureFeed;
    let status="Age needed",tone="unknown";
    if(age!=null){if(daysUntil===0){status="Ready to sell";tone="ready";}else if(daysUntil<=14){status="Nearly ready";tone="soon";}else{status="Growing";tone="growing";}}
    return {id:String(batch.id||""),name:String(batch.name||"Grow-out batch"),breed:String(batch.breed||""),hatchDate:String(batch.hatchDate||""),ageDays:age,ageWeeks:age==null?null:Math.floor(age/7),targetAgeWeeks,targetDays,daysUntil,remaining,weeklyFeedCostPerBird,targetPricePerBird,futureFeed,projectedRevenue,existingCost,earned,projectedBatchProfit,status,tone};
  }
  function rows(asOf=today()){
    const cfg=settings();return batches().filter(b=>n(b.remainingQty)>0).map(b=>analyze(b,cfg[String(b.id||"")]||{},asOf)).sort((a,b)=>{
      const rank={ready:0,soon:1,growing:2,unknown:3};return (rank[a.tone]??9)-(rank[b.tone]??9)||(a.daysUntil??9999)-(b.daysUntil??9999)||a.name.localeCompare(b.name);
    });
  }
  function summary(list=rows()){
    return {activeBatches:list.length,birds:list.reduce((s,x)=>s+x.remaining,0),readyBirds:list.filter(x=>x.tone==="ready").reduce((s,x)=>s+x.remaining,0),projectedRevenue:list.reduce((s,x)=>s+x.projectedRevenue,0),futureFeed:list.reduce((s,x)=>s+x.futureFeed,0),projectedProfit:list.reduce((s,x)=>s+x.projectedBatchProfit,0)};
  }
  function saveConfig(id,cfg={}){const all=settings();all[String(id||"")]={targetAgeWeeks:n(cfg.targetAgeWeeks||16),weeklyFeedCostPerBird:n(cfg.weeklyFeedCostPerBird),targetPricePerBird:n(cfg.targetPricePerBird)};write(STORE,all);window.dispatchEvent(new CustomEvent("rfp-staging-growout-readiness-changed"));return all[String(id||"")];}
  function panelHtml(list=rows()){
    const s=summary(list);
    return `<section class="rfp-growout-readiness"><div class="rfp-fm-banner"><strong>STAGING • LOCAL ONLY</strong><br>${BRAND} grow-out planner estimates sale readiness and future feed cost with zero Firebase calls.</div><h3>🐥 Grow-Out Sale Readiness</h3><div class="rfp-fm-stats"><div class="rfp-fm-stat"><span>Birds growing</span><b>${s.birds}</b></div><div class="rfp-fm-stat"><span>Ready now</span><b>${s.readyBirds}</b></div><div class="rfp-fm-stat"><span>Projected sales</span><b>${money(s.projectedRevenue)}</b></div></div>${list.length?`<div class="rfp-fm-list">${list.map(x=>`<div class="rfp-fm-item ${x.tone==="ready"?"rfp-ready":""}"><header><strong>${esc(x.name)}</strong><b>${esc(x.status)}</b></header><small>${esc(x.breed||"Breed not listed")} • ${x.remaining} birds • ${x.ageWeeks==null?"age unknown":`${x.ageWeeks} wk old`}${x.daysUntil==null?"":x.daysUntil===0?" • target age reached":` • ${x.daysUntil} days to target`}</small><div class="rfp-fm-stats"><div class="rfp-fm-stat"><span>Future feed</span><b>${money(x.futureFeed)}</b></div><div class="rfp-fm-stat"><span>Projected revenue</span><b>${money(x.projectedRevenue)}</b></div><div class="rfp-fm-stat"><span>Projected batch profit</span><b>${money(x.projectedBatchProfit)}</b></div></div><form class="rfp-growout-form" data-growout-id="${esc(x.id)}"><div class="rfp-fm-row"><label>Target sale age (weeks)<input name="targetAgeWeeks" type="number" min="1" step="1" value="${x.targetAgeWeeks}"></label><label>Target price / bird<input name="targetPricePerBird" type="number" min="0" step="0.01" value="${x.targetPricePerBird}"></label></div><label>Estimated feed cost / bird / week<input name="weeklyFeedCostPerBird" type="number" min="0" step="0.01" value="${x.weeklyFeedCostPerBird}"></label><button type="submit">Save Batch Plan</button></form></div>`).join("")}</div>`:`<div class="rfp-fm-banner"><strong>No active grow-out batches.</strong><br>Add or move a hatch into Grow-Out / Sale Batch Tracking first.</div>`}<p class="rfp-muted">Projected batch profit = money already earned + projected remaining-bird sales − saved batch cost − estimated future feed. This is a planning estimate, not an accounting/tax figure.</p></section>`;
  }
  function ensureCss(){if(document.getElementById("rfpGrowoutReadinessCss"))return;const s=document.createElement("style");s.id="rfpGrowoutReadinessCss";s.textContent=`.rfp-growout-readiness .rfp-ready{border:2px solid rgba(31,122,58,.55)}.rfp-growout-form{display:grid;gap:8px;margin-top:10px}.rfp-growout-form input{width:100%;box-sizing:border-box}.rfp-growout-form button{margin:0!important}`;document.head.appendChild(s);}
  function render(){ensureCss();const body=document.getElementById("rfpBizBody");if(!body)return false;body.innerHTML=panelHtml();body.querySelectorAll(".rfp-growout-form").forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();const f=new FormData(form);saveConfig(form.dataset.growoutId,{targetAgeWeeks:f.get("targetAgeWeeks"),targetPricePerBird:f.get("targetPricePerBird"),weeklyFeedCostPerBird:f.get("weeklyFeedCostPerBird")});render();}));return true;}
  function installTab(){const modal=document.getElementById("rfpBusinessModal");if(!modal)return false;const tabs=modal.querySelector(".rfp-biz-tabs");if(!tabs)return false;if(tabs.querySelector('[data-growout-readiness]'))return true;const b=document.createElement("button");b.type="button";b.dataset.growoutReadiness="1";b.textContent="🐥 Sale Ready";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");render();});tabs.appendChild(b);return true;}
  function watchForModal(){if(installTab())return;const o=new MutationObserver(()=>{if(installTab())o.disconnect();});o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),15000);}

  window.StagingGrowoutReadinessV1={version:1,firebaseReads:0,firebaseWrites:0,brand:BRAND,ageDays,analyze,rows,summary,saveConfig,panelHtml,render,installTab};
  watchForModal();
  window.addEventListener("rfp-staging-farm-manager-changed",()=>{if(document.querySelector('[data-growout-readiness].active'))render();});
})();