(() => {
  "use strict";
  if (window.__StagingFeedRunwayV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingFeedRunwayV1 = true;

  const BRAND="Rose Family Poultry";
  const STORE="rfpFeedRunwayV1";
  const FARM_STORE="rfpFarmManagerV1";
  const ENTRIES="chickenEggEntriesV102";
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
  const n=v=>Math.max(0,Number(v)||0);
  const money=v=>`$${n(v).toFixed(2)}`;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const addDays=(date,days)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return localDate(d);};

  function settings(){const s=read(STORE,{});return {defaultBagWeight:n(s.defaultBagWeight)||50,dailyFeedLbs:n(s.dailyFeedLbs)||0};}
  function saveSettings(next={}){const current=settings(),out={...current,...next,defaultBagWeight:n(next.defaultBagWeight??current.defaultBagWeight)||50,dailyFeedLbs:n(next.dailyFeedLbs??current.dailyFeedLbs)};write(STORE,out);window.dispatchEvent(new CustomEvent("rfp-staging-feed-runway-changed",{detail:out}));return out;}
  function farmState(){const s=read(FARM_STORE,{});return s&&typeof s==="object"?s:{};}
  function entries(){const e=read(ENTRIES,[]);return Array.isArray(e)?e:[];}
  function feedRows(state=farmState()){
    return (Array.isArray(state?.supplies)?state.supplies:[]).filter(x=>/feed/i.test(String(x?.category||""))||/feed/i.test(String(x?.name||"")));
  }
  function poundsFor(row,defaultBagWeight=50){
    const q=n(row?.quantity),unit=String(row?.unit||"").trim().toLowerCase();
    if(/lb|pound/.test(unit))return q;
    if(/bag|sack/.test(unit)||!unit)return q*n(row?.bagWeight||defaultBagWeight);
    return q*n(row?.bagWeight||defaultBagWeight);
  }
  function costFor(row){return n(row?.quantity)*n(row?.costEach);}
  function eggAverage30(rows=entries(),today=localDate()){
    const start=addDays(today,-29),map={};
    for(const e of rows){if(e?.type!=="eggs"||!e.date)continue;const d=String(e.date).slice(0,10);if(d<start||d>today)continue;map[d]=(map[d]||0)+n(e.eggs);}
    let total=0;for(let i=0;i<30;i++)total+=n(map[addDays(start,i)]);
    return total/30;
  }
  function calculate(input={}){
    const rows=Array.isArray(input.feed)?input.feed:feedRows(input.state);
    const bagWeight=n(input.defaultBagWeight)||50;
    const daily=n(input.dailyFeedLbs);
    const pounds=rows.reduce((s,r)=>s+poundsFor(r,bagWeight),0);
    const inventoryCost=rows.reduce((s,r)=>s+costFor(r),0);
    const costPerLb=pounds>0?inventoryCost/pounds:0;
    const days=daily>0?pounds/daily:null;
    const monthlyFeedCost=daily>0?daily*30*costPerLb:0;
    const avgEggs=n(input.avgEggsPerDay);
    const monthlyEggs=avgEggs*30;
    const feedCostPerDozen=monthlyEggs>0?(monthlyFeedCost/monthlyEggs)*12:0;
    const reorder=days!=null&&days<=7;
    return {pounds,inventoryCost,costPerLb,days,monthlyFeedCost,avgEggsPerDay:avgEggs,monthlyEggs,feedCostPerDozen,reorder,feedItems:rows.length};
  }
  function current(){const s=settings();return calculate({state:farmState(),defaultBagWeight:s.defaultBagWeight,dailyFeedLbs:s.dailyFeedLbs,avgEggsPerDay:eggAverage30()});}
  function panelHtml(calc=current(),s=settings()){
    const days=calc.days==null?"Set daily use":`${calc.days.toFixed(1)} days`;
    return `<section class="rfp-feed-panel"><div class="rfp-fm-banner"><strong>STAGING • LOCAL ONLY</strong><br>${BRAND} feed planning makes zero Firebase calls.</div><h3>🌾 Feed Runway & Cost Planner</h3>${calc.reorder?'<div class="rfp-fm-banner"><strong>⚠️ Feed reorder warning:</strong> estimated feed runway is 7 days or less.</div>':""}<div class="rfp-fm-stats"><div class="rfp-fm-stat"><span>Feed on hand</span><b>${calc.pounds.toFixed(1)} lb</b></div><div class="rfp-fm-stat"><span>Estimated runway</span><b>${days}</b></div><div class="rfp-fm-stat"><span>Feed value on hand</span><b>${money(calc.inventoryCost)}</b></div><div class="rfp-fm-stat"><span>Monthly feed cost</span><b>${money(calc.monthlyFeedCost)}</b></div><div class="rfp-fm-stat"><span>30-day egg pace</span><b>${calc.avgEggsPerDay.toFixed(1)}/day</b></div><div class="rfp-fm-stat"><span>Feed cost / dozen</span><b>${money(calc.feedCostPerDozen)}</b></div></div><form id="rfpFeedPlannerForm" class="rfp-fm-form"><div class="rfp-fm-row"><label>Default bag weight (lb)<input name="defaultBagWeight" type="number" min="1" step="0.1" value="${esc(s.defaultBagWeight)}"></label><label>Estimated feed used per day (lb)<input name="dailyFeedLbs" type="number" min="0" step="0.1" value="${esc(s.dailyFeedLbs)}" placeholder="Example: 12"></label></div><button type="submit">Save Feed Assumptions</button></form><p class="rfp-muted">Uses feed items already entered in Supply Inventory. Bag/sack items use the default bag weight; items entered in pounds use their quantity directly. The cost-per-dozen figure is feed cost only, not total production cost.</p></section>`;
  }
  function render(){const body=document.getElementById("rfpBizBody");if(!body)return false;body.innerHTML=panelHtml();document.getElementById("rfpFeedPlannerForm")?.addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);saveSettings({defaultBagWeight:f.get("defaultBagWeight"),dailyFeedLbs:f.get("dailyFeedLbs")});render();});return true;}
  function installTab(){const modal=document.getElementById("rfpBusinessModal");if(!modal)return false;const tabs=modal.querySelector(".rfp-biz-tabs");if(!tabs)return false;if(tabs.querySelector('[data-feed-runway]'))return true;const b=document.createElement("button");b.type="button";b.dataset.feedRunway="1";b.textContent="🌾 Feed Planner";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");render();});tabs.appendChild(b);return true;}
  function watchForModal(){if(installTab())return;const o=new MutationObserver(()=>{if(installTab())o.disconnect();});o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),15000);}

  window.StagingFeedRunwayV1={version:1,firebaseReads:0,firebaseWrites:0,settings,saveSettings,feedRows,poundsFor,eggAverage30,calculate,current,panelHtml,render,installTab};
  watchForModal();
  window.addEventListener("rfp-staging-farm-manager-changed",()=>{if(document.querySelector('[data-feed-runway].active'))render();});
  window.addEventListener("rfp-staging-feed-runway-changed",()=>{if(document.querySelector('[data-feed-runway].active'))render();});
})();
