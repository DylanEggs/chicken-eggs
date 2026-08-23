(() => {
  "use strict";
  if (window.__StagingBusinessGoalsV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingBusinessGoalsV1 = true;

  const BRAND="Rose Family Poultry";
  const STORE="rfpBusinessGoalsV1";
  const BUSINESS="rfpBusinessSuiteV1";
  const ENTRIES="chickenEggEntriesV102";
  const APP2="chickenEggApp2V1";
  const n=v=>Math.max(0,Number(v)||0);
  const money=v=>`$${n(v).toFixed(2)}`;
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
  const cleanBrand=v=>String(v||BRAND).replace(/,?\s*LLC\b/ig,"").trim()||BRAND;
  const year=()=>String(new Date().getFullYear());
  const month=()=>new Date().toISOString().slice(0,7);
  const daysInMonth=()=>new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const dayOfMonth=()=>new Date().getDate();

  function settings(){
    const s=read(STORE,{});
    return {
      monthlyRevenueGoal:n(s.monthlyRevenueGoal)||300,
      monthlyProfitGoal:n(s.monthlyProfitGoal)||150,
      yearlyRevenueGoal:n(s.yearlyRevenueGoal)||3600,
      yearlyProfitGoal:n(s.yearlyProfitGoal)||1800
    };
  }
  function saveSettings(next){const out={...settings(),...next};write(STORE,out);window.dispatchEvent(new CustomEvent("rfp-staging-business-goals-changed",{detail:out}));return out;}
  function saleAmount(e){
    if(!e||e.type!=="sale")return 0;
    if(Number.isFinite(Number(e.total)))return n(e.total);
    if(Number.isFinite(Number(e.amount)))return n(e.amount);
    return n(e.dozenSold||e.dozens||e.dozen)*n(e.dozenPrice||e.pricePerDozen||e.price)+n(e.packSold||e.packs18)*n(e.packPrice||e.pricePer18);
  }
  function birdSales(){
    const a=read(APP2,{}), pools=[a?.birdSales,a?.chickenSales,a?.sales], list=pools.find(Array.isArray)||[];
    return list;
  }
  function birdSaleAmount(x){return n(x?.total||x?.amount||x?.price||0)*Math.max(1,n(x?.quantity||x?.qty||1));}
  function expenseRows(){const s=read(BUSINESS,{});return Array.isArray(s?.expenses)?s.expenses:[];}
  function totals(){
    const e=read(ENTRIES,[]), entries=Array.isArray(e)?e:[], y=year(), m=month();
    const eggYear=entries.filter(x=>x?.type==="sale"&&String(x.date||"").startsWith(y)).reduce((a,x)=>a+saleAmount(x),0);
    const eggMonth=entries.filter(x=>x?.type==="sale"&&String(x.date||"").startsWith(m)).reduce((a,x)=>a+saleAmount(x),0);
    const birds=birdSales();
    const birdYear=birds.filter(x=>String(x?.date||x?.soldDate||"").startsWith(y)).reduce((a,x)=>a+birdSaleAmount(x),0);
    const birdMonth=birds.filter(x=>String(x?.date||x?.soldDate||"").startsWith(m)).reduce((a,x)=>a+birdSaleAmount(x),0);
    const exp=expenseRows();
    const expYear=exp.filter(x=>String(x?.date||"").startsWith(y)).reduce((a,x)=>a+n(x.amount),0);
    const expMonth=exp.filter(x=>String(x?.date||"").startsWith(m)).reduce((a,x)=>a+n(x.amount),0);
    const revenueYear=eggYear+birdYear, revenueMonth=eggMonth+birdMonth;
    return {revenueYear,revenueMonth,profitYear:revenueYear-expYear,profitMonth:revenueMonth-expMonth,eggYear,birdYear,expYear,eggMonth,birdMonth,expMonth};
  }
  const pct=(value,goal)=>goal>0?Math.max(0,Math.min(999,Math.round((value/goal)*100))):0;
  function forecast(){
    const t=totals(), d=Math.max(1,dayOfMonth()), dim=daysInMonth();
    const revenuePace=t.revenueMonth/d, profitPace=t.profitMonth/d;
    return {...t,projectedRevenue:revenuePace*dim,projectedProfit:profitPace*dim,daysElapsed:d,daysInMonth:dim};
  }
  function progressBar(value,goal){const p=Math.min(100,pct(value,goal));return `<div class="rfp-goal-track"><i style="width:${p}%"></i></div>`;}
  function css(){if(document.getElementById("rfpBusinessGoalsCss"))return;const s=document.createElement("style");s.id="rfpBusinessGoalsCss";s.textContent=`
    .rfp-goal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.rfp-goal-card{padding:13px;border-radius:16px;background:rgba(31,122,58,.07);border:1px solid rgba(31,122,58,.12)}.rfp-goal-card b{display:block;font-size:22px}.rfp-goal-track{height:8px;background:rgba(127,127,127,.18);border-radius:999px;overflow:hidden;margin:8px 0}.rfp-goal-track i{display:block;height:100%;background:currentColor;border-radius:999px}.rfp-goal-note{font-size:11px;opacity:.72}.rfp-goal-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.rfp-goal-form input{width:100%;box-sizing:border-box}.rfp-goal-form button{grid-column:1/-1}@media(max-width:560px){.rfp-goal-grid,.rfp-goal-form{grid-template-columns:1fr}}
  `;document.head.appendChild(s);}
  function render(){
    const body=document.getElementById("rfpBizBody");if(!body)return;
    const s=settings(),f=forecast();
    body.innerHTML=`<section class="rfp-biz-panel active"><h3>🎯 Business Goals & Forecast</h3><p class="rfp-goal-note">Private STAGING planner for ${cleanBrand(BRAND)}. No Firebase reads or writes.</p><div class="rfp-goal-grid">
      <div class="rfp-goal-card"><span>Monthly revenue</span><b>${money(f.revenueMonth)}</b>${progressBar(f.revenueMonth,s.monthlyRevenueGoal)}<small>${pct(f.revenueMonth,s.monthlyRevenueGoal)}% of ${money(s.monthlyRevenueGoal)} goal</small></div>
      <div class="rfp-goal-card"><span>Monthly profit</span><b>${money(f.profitMonth)}</b>${progressBar(Math.max(0,f.profitMonth),s.monthlyProfitGoal)}<small>${pct(Math.max(0,f.profitMonth),s.monthlyProfitGoal)}% of ${money(s.monthlyProfitGoal)} goal</small></div>
      <div class="rfp-goal-card"><span>Projected month revenue</span><b>${money(f.projectedRevenue)}</b><small>Based on ${f.daysElapsed} of ${f.daysInMonth} days</small></div>
      <div class="rfp-goal-card"><span>Projected month profit</span><b>${money(f.projectedProfit)}</b><small>Current pace after tracked expenses</small></div>
      <div class="rfp-goal-card"><span>Year revenue</span><b>${money(f.revenueYear)}</b>${progressBar(f.revenueYear,s.yearlyRevenueGoal)}<small>${pct(f.revenueYear,s.yearlyRevenueGoal)}% of ${money(s.yearlyRevenueGoal)}</small></div>
      <div class="rfp-goal-card"><span>Year profit</span><b>${money(f.profitYear)}</b>${progressBar(Math.max(0,f.profitYear),s.yearlyProfitGoal)}<small>${pct(Math.max(0,f.profitYear),s.yearlyProfitGoal)}% of ${money(s.yearlyProfitGoal)}</small></div>
    </div><form id="rfpGoalForm" class="rfp-goal-form"><label>Monthly revenue goal<input name="monthlyRevenueGoal" type="number" min="0" step="1" value="${s.monthlyRevenueGoal}"></label><label>Monthly profit goal<input name="monthlyProfitGoal" type="number" min="0" step="1" value="${s.monthlyProfitGoal}"></label><label>Year revenue goal<input name="yearlyRevenueGoal" type="number" min="0" step="1" value="${s.yearlyRevenueGoal}"></label><label>Year profit goal<input name="yearlyProfitGoal" type="number" min="0" step="1" value="${s.yearlyProfitGoal}"></label><button type="submit">Save Goals</button></form></section>`;
    document.getElementById("rfpGoalForm")?.addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);saveSettings({monthlyRevenueGoal:n(f.get("monthlyRevenueGoal")),monthlyProfitGoal:n(f.get("monthlyProfitGoal")),yearlyRevenueGoal:n(f.get("yearlyRevenueGoal")),yearlyProfitGoal:n(f.get("yearlyProfitGoal"))});render();});
  }
  function install(){css();const modal=document.getElementById("rfpBusinessModal");if(!modal)return false;const tabs=modal.querySelector(".rfp-biz-tabs");if(!tabs||tabs.querySelector('[data-tab="goals"]'))return true;const b=document.createElement("button");b.type="button";b.dataset.tab="goals";b.textContent="🎯 Goals";b.addEventListener("click",()=>{modal.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));render();});tabs.appendChild(b);return true;}
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer);},250);
  window.StagingBusinessGoalsV1={version:1,storageKey:STORE,networkCalls:0,firebaseReads:0,firebaseWrites:0,settings,saveSettings,totals,forecast,pct,render,install};
})();
