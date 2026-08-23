(() => {
  "use strict";
  if (window.__StagingRestockPlannerV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingRestockPlannerV1 = true;

  const BRAND="Rose Family Poultry";
  const FARM_STORE="rfpFarmManagerV1";
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const n=v=>Math.max(0,Number(v)||0);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=v=>`$${n(v).toFixed(2)}`;

  function supplies(){const s=read(FARM_STORE,{});return Array.isArray(s?.supplies)?s.supplies:[];}
  function recommendation(row={}){
    const quantity=n(row.quantity),lowAt=n(row.lowAt),costEach=n(row.costEach);
    const target=lowAt>0?Math.max(lowAt+1,Math.ceil(lowAt*2)):Math.ceil(quantity);
    const buy=Math.max(0,target-quantity);
    return {
      id:String(row.id||""),name:String(row.name||"Supply"),category:String(row.category||"Other"),unit:String(row.unit||"units"),
      quantity,lowAt,target,buy,costEach,estimatedCost:buy*costEach,
      low:lowAt>0&&quantity<=lowAt,out:quantity<=0
    };
  }
  function list(rows=supplies()){
    return rows.map(recommendation).filter(x=>x.low).sort((a,b)=>Number(b.out)-Number(a.out)||a.quantity-b.quantity||a.name.localeCompare(b.name));
  }
  function summary(rows=list()){
    return {items:rows.length,out:rows.filter(x=>x.out).length,estimatedCost:rows.reduce((s,x)=>s+x.estimatedCost,0),units:rows.reduce((s,x)=>s+x.buy,0)};
  }
  function text(rows=list()){
    if(!rows.length)return `${BRAND} shopping list\nNothing is currently below a low-stock threshold.`;
    return `${BRAND} shopping list\n`+rows.map(x=>`- ${x.name}: buy ${x.buy} ${x.unit} (on hand ${x.quantity}; low at ${x.lowAt})`).join("\n");
  }
  function panelHtml(rows=list()){
    const s=summary(rows);
    return `<section class="rfp-restock-panel"><div class="rfp-fm-banner"><strong>STAGING • LOCAL ONLY</strong><br>${BRAND} smart restock list is calculated from Supply Inventory and makes zero Firebase calls.</div><h3>🛒 Smart Restock / Shopping List</h3><div class="rfp-fm-stats"><div class="rfp-fm-stat"><span>Items to buy</span><b>${s.items}</b></div><div class="rfp-fm-stat"><span>Out of stock</span><b>${s.out}</b></div><div class="rfp-fm-stat"><span>Estimated restock</span><b>${money(s.estimatedCost)}</b></div></div>${rows.length?`<div class="rfp-fm-list">${rows.map(x=>`<div class="rfp-fm-item ${x.out?"rfp-low":""}"><header><strong>${esc(x.out?"🚨 ":"⚠️ ")}${esc(x.name)}</strong><b>Buy ${x.buy} ${esc(x.unit)}</b></header><small>${esc(x.category)} • ${x.quantity} on hand • low at ${x.lowAt} • target ${x.target}${x.costEach?` • est. ${money(x.estimatedCost)}`:""}</small></div>`).join("")}</div><div class="rfp-fm-actions"><button type="button" id="rfpCopyShoppingList">📋 Copy Shopping List</button></div>`:`<div class="rfp-fm-banner"><strong>✅ Supplies look good.</strong><br>No tracked item is currently at or below its low-stock threshold.</div>`}<p class="rfp-muted">Suggested buy quantity restores each low item to roughly twice its low-stock threshold. Estimated cost uses the cost-per-item already saved in Supply Inventory.</p></section>`;
  }
  function render(){const body=document.getElementById("rfpBizBody");if(!body)return false;const rows=list();body.innerHTML=panelHtml(rows);document.getElementById("rfpCopyShoppingList")?.addEventListener("click",async()=>{const value=text(rows);try{await navigator.clipboard.writeText(value);const b=document.getElementById("rfpCopyShoppingList");if(b){const old=b.textContent;b.textContent="✅ Copied";setTimeout(()=>{b.textContent=old;},1200);}}catch{window.prompt("Copy shopping list",value);}});return true;}
  function installTab(){const modal=document.getElementById("rfpBusinessModal");if(!modal)return false;const tabs=modal.querySelector(".rfp-biz-tabs");if(!tabs)return false;if(tabs.querySelector('[data-restock-planner]'))return true;const b=document.createElement("button");b.type="button";b.dataset.restockPlanner="1";b.textContent="🛒 Restock";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");render();});tabs.appendChild(b);return true;}
  function watchForModal(){if(installTab())return;const o=new MutationObserver(()=>{if(installTab())o.disconnect();});o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),15000);}

  window.StagingRestockPlannerV1={version:1,firebaseReads:0,firebaseWrites:0,supplies,recommendation,list,summary,text,panelHtml,render,installTab};
  watchForModal();
  window.addEventListener("rfp-staging-farm-manager-changed",()=>{if(document.querySelector('[data-restock-planner].active'))render();});
})();