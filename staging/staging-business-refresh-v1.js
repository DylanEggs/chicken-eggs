(() => {
  "use strict";
  if (window.__StagingBusinessRefreshV1) return;
  window.__StagingBusinessRefreshV1 = true;
  if (!window.__ChickenEggsStagingMode) return;

  const ENTRIES="chickenEggEntriesV102";
  const APP2="chickenEggApp2V1";
  const BUSINESS="chickenEggBusinessV1";
  let queued=false;

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  const n=v=>Number(v)||0;
  const money=v=>"$"+n(v).toFixed(2);
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  const month=()=>localDate().slice(0,7);
  const eggRevenue=e=>n(e?.dozenSold)*n(e?.dozenPrice)+n(e?.packSold??e?.packs18Sold)*n(e?.packPrice??e?.packs18Price);

  function stats(){
    const p=month();
    const entries=read(ENTRIES,[]).filter(e=>e&&e.type==="sale"&&String(e.date||"").startsWith(p));
    const app=read(APP2,{expenses:[]});
    const business=read(BUSINESS,{chickenSales:[]});
    const egg=entries.reduce((sum,e)=>sum+eggRevenue(e),0);
    const chicken=(Array.isArray(business.chickenSales)?business.chickenSales:[])
      .filter(e=>String(e.date||"").startsWith(p)).reduce((sum,e)=>sum+n(e.total),0);
    const expenses=(Array.isArray(app.expenses)?app.expenses:[]).filter(e=>String(e.date||"").startsWith(p));
    const feed=expenses.filter(e=>String(e.category||"").toLowerCase()==="feed").reduce((sum,e)=>sum+n(e.amount),0);
    const supplies=expenses.filter(e=>String(e.category||"").toLowerCase()!=="feed").reduce((sum,e)=>sum+n(e.amount),0);
    return {egg,chicken,feed,supplies,revenue:egg+chicken,costs:feed+supplies,net:egg+chicken-feed-supplies};
  }

  function findStat(home,label){
    return [...home.querySelectorAll(".biz-stat")].find(card=>(card.querySelector("span")?.textContent||"").trim()===label)||null;
  }
  function setStat(home,label,value){
    const target=findStat(home,label)?.querySelector("b");
    if(target)target.textContent=money(value);
  }

  function render(){
    queued=false;
    const home=document.getElementById("bizHome");
    if(!home)return false;
    const s=stats();
    setStat(home,"Egg Sales",s.egg);
    setStat(home,"Chicken Sales",s.chicken);
    setStat(home,"Feed Cost",s.feed);
    setStat(home,"Other Supplies",s.supplies);
    setStat(home,"Total Income",s.revenue);
    setStat(home,"Total Costs",s.costs);

    const badge=home.querySelector(".farm2-sectionHeader .farm2-badge");
    if(badge){
      badge.textContent=s.net>=0?"PROFIT":"LOSS";
      badge.classList.toggle("red",s.net<0);
      badge.classList.toggle("gold",s.net>=0);
    }
    const net=[...home.querySelectorAll(".biz-net")].find(el=>el.id!=="bizCalcResult");
    if(net){
      net.classList.toggle("biz-good",s.net>=0);
      net.classList.toggle("biz-bad",s.net<0);
      net.textContent=`${s.net>=0?"+":""}${money(s.net)}`;
    }
    window.dispatchEvent(new CustomEvent("staging-business-display-refreshed",{detail:{...s,at:Date.now()}}));
    return true;
  }

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(render);
  }

  ["core-data-synced","farm-data-synced","farm-local-data-changed","inventory-authority-changed"].forEach(name=>window.addEventListener(name,schedule));
  document.addEventListener("click",event=>{
    const button=event.target?.closest?.("button");
    if(button&&(/save sale/i.test(button.textContent||"")||/mark paid/i.test(button.textContent||"")))setTimeout(schedule,0);
  },true);

  window.StagingBusinessDisplay={stats,refresh:render};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(render,900),{once:true});
  else setTimeout(render,900);
  console.log("🧪 STAGING business display bridge active — summary refreshes without replacing calculator inputs");
})();
