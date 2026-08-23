(() => {
  "use strict";
  if (window.__StagingWaitlistMatchmakerV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingWaitlistMatchmakerV1 = true;

  const BRAND="Rose Family Poultry";
  const FARM_STORE="rfpFarmManagerV1";
  const INVENTORY="chickenEggInventoryV2";
  const APP2="chickenEggApp2V1";
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
  const n=v=>Math.max(0,Number(v)||0);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const norm=v=>String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const tokens=v=>new Set(norm(v).split(/\s+/).filter(x=>x.length>2&&!['the','and','for','mix','bird','birds','chicken','chickens','want','wants'].includes(x)));

  function farm(){const s=read(FARM_STORE,{});return s&&typeof s==="object"?s:{};}
  function waitlist(){const s=farm();return Array.isArray(s.waitlist)?s.waitlist:[];}
  function batches(){const s=farm();return Array.isArray(s.batches)?s.batches:[];}
  function eggAvailability(){
    const inv=read(INVENTORY,{}),app=read(APP2,{});
    const physical=n(inv?.dozens)*12+n(inv?.packs18)*18+n(inv?.loose);
    const reserved=(Array.isArray(app?.orders)?app.orders:[]).filter(o=>o?.status==="pending").reduce((s,o)=>s+n(o?.dozen)*12+n(o?.packs18)*18,0);
    return Math.max(0,Math.round(physical-reserved));
  }
  function itemKind(item){const x=norm(item);return /\beggs?\b|dozen|18 pack/.test(x)?"eggs":"birds";}
  function batchScore(item,batch){
    const a=tokens(item),b=tokens(`${batch?.name||""} ${batch?.breed||""}`);let score=0;
    for(const t of a)if(b.has(t))score++;
    return score;
  }
  function bestBatch(item,rows=batches()){
    const candidates=rows.filter(b=>n(b?.remainingQty)>0).map(b=>({batch:b,score:batchScore(item,b)})).sort((a,b)=>b.score-a.score||n(b.batch.remainingQty)-n(a.batch.remainingQty));
    return candidates[0]||null;
  }
  function evaluate(entry,{eggs=eggAvailability(),batchRows=batches()}={}){
    const qty=Math.max(1,n(entry?.quantity)||1),kind=itemKind(entry?.item),status=String(entry?.status||"waiting").toLowerCase();
    if(status==="fulfilled")return {...entry,kind,qty,match:"done",available:0,reason:"Fulfilled"};
    if(kind==="eggs")return {...entry,kind,qty,match:eggs>=qty?"ready":"waiting",available:eggs,reason:eggs>=qty?`${eggs} eggs available`:`Need ${Math.max(0,qty-eggs)} more eggs`};
    const best=bestBatch(entry?.item,batchRows),generic=/\b(chick|chicks|pullet|pullets|bird|birds|chicken|chickens)\b/.test(norm(entry?.item));
    const totalBirds=batchRows.reduce((s,b)=>s+n(b?.remainingQty),0);
    if(best&&best.score>0){const have=n(best.batch.remainingQty);return {...entry,kind,qty,match:have>=qty?"ready":"waiting",available:have,batchId:String(best.batch.id||""),batchName:String(best.batch.name||best.batch.breed||"Batch"),reason:have>=qty?`${have} matching birds available`:`Matching batch has ${have}; needs ${qty}`};}
    if(generic&&totalBirds>=qty)return {...entry,kind,qty,match:"possible",available:totalBirds,reason:`${totalBirds} grow-out birds available; verify age/sex before contacting`};
    return {...entry,kind,qty,match:"waiting",available:totalBirds,reason:"No matching grow-out batch is ready yet"};
  }
  function rows(){return waitlist().filter(x=>String(x?.status||"waiting").toLowerCase()!=="fulfilled").map(x=>evaluate(x));}
  function summary(list=rows()){return {ready:list.filter(x=>x.match==="ready").length,possible:list.filter(x=>x.match==="possible").length,waiting:list.filter(x=>x.match==="waiting").length,total:list.length};}
  function setStatus(id,status){const s=farm();if(!Array.isArray(s.waitlist))return false;const row=s.waitlist.find(x=>String(x?.id||"")===String(id||""));if(!row)return false;row.status=status;row.statusUpdatedAt=Date.now();const ok=write(FARM_STORE,s);if(ok)window.dispatchEvent(new CustomEvent("rfp-staging-farm-manager-changed"));return ok;}
  function contactText(row){return `${BRAND}: ${row?.customer||"Customer"} — ${row?.quantity||1} ${row?.item||"item"}${row?.contact?` — ${row.contact}`:""}`;}
  function panelHtml(list=rows()){
    const s=summary(list),rank={ready:0,possible:1,waiting:2};
    const sorted=list.slice().sort((a,b)=>(rank[a.match]??9)-(rank[b.match]??9)||String(a.customer||"").localeCompare(String(b.customer||"")));
    const badge=x=>x.match==="ready"?"✅ READY":x.match==="possible"?"🟡 CHECK":"⏳ WAITING";
    return `<section><div class="rfp-fm-banner"><strong>STAGING • LOCAL ONLY</strong><br>${BRAND} compares the private waitlist with staged egg inventory and grow-out batches. Zero Firebase calls.</div><h3>🤝 Waitlist Matchmaker</h3><div class="rfp-fm-stats"><div class="rfp-fm-stat"><span>Ready to contact</span><b>${s.ready}</b></div><div class="rfp-fm-stat"><span>Verify first</span><b>${s.possible}</b></div><div class="rfp-fm-stat"><span>Still waiting</span><b>${s.waiting}</b></div></div>${sorted.length?`<div class="rfp-fm-list">${sorted.map(x=>`<div class="rfp-fm-item"><header><strong>${badge(x)} • ${esc(x.customer||"Customer")}</strong><b>${x.qty} ${esc(x.item||"item")}</b></header><small>${esc(x.reason)}${x.contact?` • ${esc(x.contact)}`:""}</small><div class="rfp-fm-actions"><button type="button" data-copy-wait="${esc(x.id)}">📋 Contact line</button>${String(x.status||"waiting").toLowerCase()==="contacted"?`<button type="button" data-wait-status="waiting" data-wait-id="${esc(x.id)}">↩ Waiting</button>`:`<button type="button" data-wait-status="contacted" data-wait-id="${esc(x.id)}">📞 Mark contacted</button>`}<button type="button" data-wait-status="fulfilled" data-wait-id="${esc(x.id)}">✅ Fulfilled</button></div></div>`).join("")}</div>`:`<div class="rfp-fm-banner"><strong>No active waitlist entries.</strong><br>Add customers from the Waitlist tab when someone asks for eggs or birds.</div>`}<p class="rfp-muted">“Ready” means quantity is available in the staged records. Generic chick/pullet requests are marked “Check” unless a breed/batch match is clear, so the app does not guess age or sex.</p></section>`;
  }
  function render(){const body=document.getElementById("rfpBizBody");if(!body)return false;const list=rows();body.innerHTML=panelHtml(list);document.querySelectorAll("[data-wait-status]").forEach(b=>b.addEventListener("click",()=>{setStatus(b.dataset.waitId,b.dataset.waitStatus);render();}));document.querySelectorAll("[data-copy-wait]").forEach(b=>b.addEventListener("click",async()=>{const row=list.find(x=>String(x.id)===String(b.dataset.copyWait));if(!row)return;const text=contactText(row);try{await navigator.clipboard.writeText(text);const old=b.textContent;b.textContent="✅ Copied";setTimeout(()=>b.textContent=old,1200);}catch{window.prompt("Copy contact line",text);}}));return true;}
  function installTab(){const modal=document.getElementById("rfpBusinessModal");if(!modal)return false;const tabs=modal.querySelector(".rfp-biz-tabs");if(!tabs)return false;if(tabs.querySelector('[data-wait-match]'))return true;const b=document.createElement("button");b.type="button";b.dataset.waitMatch="1";b.textContent="🤝 Match Waitlist";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");render();});tabs.appendChild(b);return true;}
  function watch(){if(installTab())return;const o=new MutationObserver(()=>{if(installTab())o.disconnect();});o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),15000);}

  window.StagingWaitlistMatchmakerV1={version:1,firebaseReads:0,firebaseWrites:0,eggAvailability,itemKind,batchScore,bestBatch,evaluate,rows,summary,setStatus,contactText,panelHtml,render,installTab};
  watch();
  window.addEventListener("rfp-staging-farm-manager-changed",()=>{if(document.querySelector('[data-wait-match].active'))render();});
  window.addEventListener("inventory-authority-changed",()=>{if(document.querySelector('[data-wait-match].active'))render();});
})();
