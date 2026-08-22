(() => {
  "use strict";
  if (window.__StagingEggSafetyV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingEggSafetyV1 = true;

  const STORE="rfpFarmManagerV1";
  const BRAND="Rose Family Poultry";
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");return x&&typeof x==="object"?x:{};}catch{return {};}};
  const write=s=>{try{localStorage.setItem(STORE,JSON.stringify(s));window.dispatchEvent(new CustomEvent("rfp-staging-farm-manager-changed"));return true;}catch{return false;}};
  const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const daysBetween=(a,b)=>Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000);

  function normalizeHealth(state){return Array.isArray(state?.health)?state.health.filter(Boolean):[];}
  function summarize(state=read(),today=localDate()){
    const all=normalizeHealth(state);
    const active=[];
    const missing=[];
    const recentlyEnded=[];
    for(const h of all){
      const end=String(h.endDate||"").slice(0,10);
      const start=String(h.date||"").slice(0,10);
      if(!end){
        if(start && start<=today) missing.push({...h,daysOpen:Math.max(0,daysBetween(start,today))});
        continue;
      }
      if(end>=today){active.push({...h,daysRemaining:Math.max(0,daysBetween(today,end))});continue;}
      const ago=Math.max(0,daysBetween(end,today));
      if(ago<=7)recentlyEnded.push({...h,daysAgo:ago});
    }
    active.sort((a,b)=>String(a.endDate).localeCompare(String(b.endDate)));
    missing.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
    return {today,total:all.length,active,missing,recentlyEnded,needsReview:active.length+missing.length};
  }

  function css(){
    if(document.getElementById("rfpEggSafetyCss"))return;
    const s=document.createElement("style");s.id="rfpEggSafetyCss";s.textContent=`
      .rfp-egg-safety-alert{margin:12px 0;padding:13px 14px;border-radius:16px;border:2px solid rgba(185,28,28,.32);background:rgba(254,226,226,.92);color:#7f1d1d}.farm2-dark .rfp-egg-safety-alert{background:rgba(127,29,29,.32);color:#fee2e2;border-color:rgba(252,165,165,.35)}
      .rfp-egg-safety-ok{margin:12px 0;padding:13px 14px;border-radius:16px;background:rgba(220,252,231,.9);color:#14532d}.farm2-dark .rfp-egg-safety-ok{background:rgba(20,83,45,.35);color:#dcfce7}
      .rfp-egg-safety-list{display:grid;gap:8px;margin-top:10px}.rfp-egg-safety-item{padding:11px;border-radius:14px;background:rgba(31,122,58,.07)}.rfp-egg-safety-item strong{display:block}.rfp-egg-safety-item small{display:block;opacity:.75;margin-top:4px}.rfp-egg-safety-chip{display:inline-block;margin-top:6px;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:900;background:rgba(185,28,28,.11);color:#991b1b}.farm2-dark .rfp-egg-safety-chip{color:#fecaca}
      #rfpEggSafetyHome{margin:0 0 14px}.rfp-egg-safety-note{font-size:11px;opacity:.72;margin-top:8px}
    `;document.head.appendChild(s);
  }

  function ensureTab(){
    const tabs=document.querySelector("#rfpBusinessModal .rfp-biz-tabs");
    if(!tabs||tabs.querySelector('[data-egg-safety]'))return false;
    const b=document.createElement("button");b.type="button";b.dataset.eggSafety="1";b.textContent="🥚 Egg Safety";
    b.addEventListener("click",()=>renderPanel(true));tabs.appendChild(b);return true;
  }
  function item(h,kind){
    const bird=esc(h.bird||"Bird / group not listed"),symptom=esc(h.symptom||"No symptom listed"),treatment=esc(h.treatment||"Treatment not listed"),product=esc(h.product||"Product not listed");
    let chip="";
    if(kind==="active")chip=h.daysRemaining===0?"Ends today":`${h.daysRemaining} day${h.daysRemaining===1?"":"s"} remaining`;
    if(kind==="missing")chip="No withdrawal/end date entered";
    if(kind==="ended")chip=h.daysAgo===0?"Ended today":`Ended ${h.daysAgo} day${h.daysAgo===1?"":"s"} ago`;
    return `<div class="rfp-egg-safety-item"><strong>${bird}</strong><small>${symptom} • ${treatment} • ${product}<br>Started ${esc(h.date||"—")} • Withdrawal/end ${esc(h.endDate||"not entered")}</small><span class="rfp-egg-safety-chip">${esc(chip)}</span></div>`;
  }
  function panelHtml(summary){
    const warning=summary.needsReview?`<div class="rfp-egg-safety-alert"><strong>⚠️ ${summary.needsReview} treatment record${summary.needsReview===1?"":"s"} need egg-sale review</strong><div>Before selling or using eggs, check the affected bird/group and the withdrawal/end date you entered in the Health Log.</div></div>`:`<div class="rfp-egg-safety-ok"><strong>✅ No active treatment/withdrawal records are flagged today</strong><div>This only reflects dates you entered in the private Health Log.</div></div>`;
    return `<section><h3>🥚 Egg Treatment Safety</h3><div class="rfp-muted">Private • STAGING only • ${BRAND}</div>${warning}${summary.active.length?`<h4>Active withdrawal / treatment windows</h4><div class="rfp-egg-safety-list">${summary.active.map(h=>item(h,"active")).join("")}</div>`:""}${summary.missing.length?`<h4>Needs an end / withdrawal date</h4><div class="rfp-egg-safety-list">${summary.missing.map(h=>item(h,"missing")).join("")}</div>`:""}${summary.recentlyEnded.length?`<h4>Recently ended</h4><div class="rfp-egg-safety-list">${summary.recentlyEnded.map(h=>item(h,"ended")).join("")}</div>`:""}<p class="rfp-egg-safety-note">This feature does not calculate medication withdrawal times. It only follows the treatment and end/withdrawal dates you enter, so product labels and veterinary instructions remain the source of truth.</p></section>`;
  }
  function renderPanel(select=false){
    ensureTab();
    const body=document.getElementById("rfpBizBody");if(!body)return false;
    if(select){document.querySelectorAll("#rfpBusinessModal .rfp-biz-tabs button").forEach(b=>b.classList.toggle("active",!!b.dataset.eggSafety));body.innerHTML=panelHtml(summarize());}
    return true;
  }

  function homeHost(){
    return document.querySelector("#dashboard .heroCard")?.parentElement||document.querySelector("#dashboard")||null;
  }
  function renderHome(){
    const host=homeHost();if(!host)return false;
    let box=document.getElementById("rfpEggSafetyHome");
    const s=summarize();
    if(!s.needsReview){box?.remove();return true;}
    if(!box){box=document.createElement("div");box.id="rfpEggSafetyHome";const hero=document.querySelector("#dashboard .heroCard");if(hero?.nextSibling)hero.parentNode.insertBefore(box,hero.nextSibling);else host.prepend(box);}
    box.className="rfp-egg-safety-alert";
    box.innerHTML=`<strong>🥚 Egg-sale safety check</strong><div>${s.needsReview} treatment record${s.needsReview===1?"":"s"} need review before eggs from the affected bird/group are sold or used.</div><button type="button" id="rfpEggSafetyOpen" style="width:auto;margin:8px 0 0;padding:7px 10px">Review Health Holds</button>`;
    box.querySelector("#rfpEggSafetyOpen")?.addEventListener("click",()=>{document.getElementById("rfpBusinessLauncher")?.click();setTimeout(()=>renderPanel(true),0);});
    return true;
  }

  function refresh(){css();ensureTab();renderHome();}
  const observer=new MutationObserver(()=>{if(document.getElementById("rfpBusinessModal"))ensureTab();if(document.getElementById("dashboard"))renderHome();});
  function start(){css();refresh();observer.observe(document.body,{childList:true,subtree:true});window.addEventListener("rfp-staging-farm-manager-changed",refresh);window.addEventListener("storage",e=>{if(e.key===STORE)refresh();});}

  window.StagingEggSafetyV1={version:1,environment:"staging-local-only",firebaseReads:0,firebaseWrites:0,summarize,panelHtml,refresh,readState:read,writeState:write};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
