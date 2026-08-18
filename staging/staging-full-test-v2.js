(() => {
  "use strict";
  if (window.__ChickenEggsStagingFullTestV2) return;
  window.__ChickenEggsStagingFullTestV2 = true;
  if (!window.__ChickenEggsStagingMode) return;

  const ENTRIES="chickenEggEntriesV102";
  const APP2="chickenEggApp2V1";
  const BUSINESS="chickenEggBusinessV1";
  const REPORT="chickenEggStagingFullTestReportV2";
  const FIELD_IDS=[
    "eggDate","eggCount","saleDate","dozenSold","dozenPrice","packSold","packPrice",
    "farm2SaleCustomer","farm2SalePaid","farm2SaleNote","farm2CustomerName","farm2CustomerContact","farm2CustomerPrice","farm2CustomerNotes",
    "farm2OrderCustomer","farm2OrderDate","farm2OrderDozen","farm2OrderPacks","farm2OrderNotes",
    "farm2ExpenseAmount","farm2ExpenseDate","farm2ExpenseCategory","farm2ExpenseDesc",
    "farm2ChoreName","farm2ChoreDate","farm2ChoreRepeat","farm2BirdName","farm2BirdBreed","farm2BirdDate","farm2BirdSex","farm2BirdNotes",
    "bizChickenDate","bizChickenDesc","bizChickenQty","bizChickenPrice","bizChickenBuyer","bizChickenNotes",
    "bizCalcEgg","bizCalcChicken","bizCalcFeed","bizCalcSupplies"
  ];
  let running=false;

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  const n=v=>Number(v)||0;
  const near=(a,b)=>Math.abs(n(a)-n(b))<0.005;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  const month=()=>today().slice(0,7);
  const eggRevenue=e=>n(e?.dozenSold)*n(e?.dozenPrice)+n(e?.packSold??e?.packs18Sold)*n(e?.packPrice??e?.packs18Price);
  const element=id=>document.getElementById(id);

  function storageSnapshot(){
    const out={};
    for(const key of window.StagingStorageSandbox?.listKeys?.()||[]){
      const value=localStorage.getItem(key);
      if(value!==null)out[key]=value;
    }
    return out;
  }

  function restoreStorage(snap){
    const oldRemote=window.__farmApplyingRemote;
    window.__farmApplyingRemote=true;
    try{
      localStorage.clear();
      for(const [key,value] of Object.entries(snap||{}))localStorage.setItem(key,value);
    }finally{window.__farmApplyingRemote=oldRemote;}
    try{window.loadLocal?.();}catch{}
    try{window.loadFarmSettings?.();}catch{}
    try{window.__reloadFarm2Memory?.();}catch{}
    try{window.updateApp?.();}catch{}
    window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,v2Restore:true}}));
    window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,v2Restore:true,key:"restore"}}));
  }

  function uiSnapshot(){
    const fields={};
    for(const id of FIELD_IDS){
      const el=element(id);if(!el)continue;
      fields[id]={value:el.value,checked:"checked" in el?!!el.checked:null};
    }
    return {
      fields,
      screen:document.querySelector(".screen.active")?.id||"dashboard",
      calculatorOpen:!!document.querySelector("#bizHome details")?.open
    };
  }

  function restoreUi(snap){
    if(!snap)return;
    try{if(snap.screen&&element(snap.screen))window.showScreen?.(snap.screen);}catch{}
    for(const [id,state] of Object.entries(snap.fields||{})){
      const el=element(id);if(!el)continue;
      el.value=state.value??"";
      if(state.checked!==null&&"checked" in el)el.checked=!!state.checked;
    }
    const details=document.querySelector("#bizHome details");
    if(details)details.open=!!snap.calculatorOpen;
    try{window.StagingBusinessDisplay?.refresh?.();}catch{}
  }

  function monthlyStats(){
    const p=month();
    const entries=read(ENTRIES,[]).filter(e=>e&&e.type==="sale"&&String(e.date||"").startsWith(p));
    const app=read(APP2,{expenses:[]});
    const business=read(BUSINESS,{chickenSales:[]});
    const egg=entries.reduce((sum,e)=>sum+eggRevenue(e),0);
    const chicken=(Array.isArray(business.chickenSales)?business.chickenSales:[]).filter(e=>String(e.date||"").startsWith(p)).reduce((sum,e)=>sum+n(e.total),0);
    const expenses=(Array.isArray(app.expenses)?app.expenses:[]).filter(e=>String(e.date||"").startsWith(p));
    const feed=expenses.filter(e=>String(e.category||"").toLowerCase()==="feed").reduce((sum,e)=>sum+n(e.amount),0);
    const supplies=expenses.filter(e=>String(e.category||"").toLowerCase()!=="feed").reduce((sum,e)=>sum+n(e.amount),0);
    return {egg,chicken,feed,supplies,revenue:egg+chicken,costs:feed+supplies,net:egg+chicken-feed-supplies};
  }

  function parseMoney(text){
    const cleaned=String(text||"").replace(/[^0-9.\-]/g,"");
    return Number(cleaned)||0;
  }

  function homeBusiness(){
    const home=element("bizHome");
    if(!home)return null;
    const value=label=>{
      const card=[...home.querySelectorAll(".biz-stat")].find(x=>(x.querySelector("span")?.textContent||"").trim()===label);
      return card?parseMoney(card.querySelector("b")?.textContent):NaN;
    };
    const net=[...home.querySelectorAll(".biz-net")].find(el=>el.id!=="bizCalcResult");
    return {egg:value("Egg Sales"),chicken:value("Chicken Sales"),feed:value("Feed Cost"),supplies:value("Other Supplies"),revenue:value("Total Income"),costs:value("Total Costs"),net:net?parseMoney(net.textContent):NaN};
  }

  function findNew(before,after){
    const ids=new Set((before||[]).map(x=>String(x?.id||"")));
    return (after||[]).find(x=>x?.id&&!ids.has(String(x.id)))||null;
  }

  async function waitFor(predicate,timeout=3500){
    const start=Date.now();
    while(Date.now()-start<timeout){try{if(predicate())return true;}catch{}await sleep(40);}
    return false;
  }

  function check(results,name,pass,detail=""){
    results.push({name,pass:!!pass,detail:detail?String(detail):""});
    if(!pass)console.warn("STAGING V2 TEST FAIL:",name,detail);
  }

  async function profitRegression(){
    const results=[];
    const storage=storageSnapshot();
    const ui=uiSnapshot();
    const oldConfirm=window.confirm;
    const oldAlert=window.alert;
    window.confirm=()=>true;
    window.alert=msg=>console.warn("STAGING v2 test alert:",msg);
    let sale=null;

    try{
      window.showScreen?.("dashboard");
      await sleep(100);
      window.StagingBusinessDisplay?.refresh?.();
      const before=monthlyStats();
      const beforeUi=homeBusiness();
      check(results,"Home business summary is readable before sale",!!beforeUi&&Number.isFinite(beforeUi.egg)&&Number.isFinite(beforeUi.net),JSON.stringify(beforeUi));
      check(results,"Home Egg Sales matches current-month data before sale",!!beforeUi&&near(beforeUi.egg,before.egg),`${beforeUi?.egg} vs ${before.egg}`);
      check(results,"Home Net Profit/Loss matches current-month data before sale",!!beforeUi&&near(beforeUi.net,before.net),`${beforeUi?.net} vs ${before.net}`);

      const details=document.querySelector("#bizHome details");
      if(details)details.open=true;
      const calcValues={bizCalcEgg:"111.11",bizCalcChicken:"22.22",bizCalcFeed:"33.33",bizCalcSupplies:"44.44"};
      for(const [id,value] of Object.entries(calcValues)){
        const el=element(id);
        if(el){
          el.value=value;
          el.dispatchEvent(new Event("input",{bubbles:true}));
        }
      }

      await window.InventorySystemV6?.commitExact?.(5,3,20);
      await sleep(100);
      const beforeInv=window.InventorySystemV6?.state?.();
      const beforeRows=read(ENTRIES,[]);

      const values={saleDate:today(),dozenSold:"1",dozenPrice:"5",packSold:"0",packPrice:"8",farm2SalePaid:"paid",farm2SaleCustomer:"",farm2SaleNote:"STAGING visible profit regression"};
      for(const [id,value] of Object.entries(values)){const el=element(id);if(el)el.value=value;}
      window.saveSale?.();
      await waitFor(()=>read(ENTRIES,[]).length>beforeRows.length);
      await sleep(220);
      sale=findNew(beforeRows,read(ENTRIES,[]));
      const after=monthlyStats();
      const afterInv=window.InventorySystemV6?.state?.();
      await waitFor(()=>{window.StagingBusinessDisplay?.refresh?.();const u=homeBusiness();return !!u&&near(u.egg,before.egg+5)&&near(u.net,before.net+5);},3500);
      const afterUi=homeBusiness();

      check(results,"Current-month $5 egg sale is actually saved",!!sale&&String(sale.date)===today()&&near(eggRevenue(sale),5),JSON.stringify(sale||{}));
      check(results,"$5 egg sale reduces physical inventory by 12 eggs",n(beforeInv?.dozens)===5&&n(afterInv?.dozens)===4&&n(afterInv?.packs18)===3&&n(afterInv?.loose)===20,JSON.stringify({before:beforeInv,after:afterInv}));
      check(results,"$5 egg sale increases current-month egg revenue by exactly $5",near(after.egg,before.egg+5),`${before.egg} -> ${after.egg}`);
      check(results,"$5 egg sale improves current-month profit/loss by exactly $5",near(after.net,before.net+5),`${before.net} -> ${after.net}`);
      check(results,"Home Egg Sales visibly increases by exactly $5",!!afterUi&&near(afterUi.egg,beforeUi.egg+5),`${beforeUi?.egg} -> ${afterUi?.egg}`);
      check(results,"Home Net Profit/Loss visibly improves by exactly $5",!!afterUi&&near(afterUi.net,beforeUi.net+5),`${beforeUi?.net} -> ${afterUi?.net}`);
      check(results,"Open Profit/Loss Calculator does not freeze business totals",!!details?.open&&!!afterUi&&near(afterUi.net,before.net+5));
      check(results,"Business refresh preserves calculator inputs",Object.entries(calcValues).every(([id,value])=>!element(id)||element(id).value===value),JSON.stringify(Object.fromEntries(Object.keys(calcValues).map(id=>[id,element(id)?.value]))));

      if(sale){
        window.deleteEntry?.(sale.id);
        await sleep(280);
        await waitFor(()=>{window.StagingBusinessDisplay?.refresh?.();const s=monthlyStats(),u=homeBusiness();return near(s.egg,before.egg)&&near(s.net,before.net)&&!!u&&near(u.egg,beforeUi.egg)&&near(u.net,beforeUi.net);},3500);
        const deleted=monthlyStats(),deletedUi=homeBusiness(),restoredInv=window.InventorySystemV6?.state?.();
        check(results,"Deleting test sale restores current-month revenue and profit",near(deleted.egg,before.egg)&&near(deleted.net,before.net),JSON.stringify({before,deleted}));
        check(results,"Deleting test sale restores visible Home business totals",!!deletedUi&&near(deletedUi.egg,beforeUi.egg)&&near(deletedUi.net,beforeUi.net),JSON.stringify({beforeUi,deletedUi}));
        check(results,"Deleting test sale restores the dozen to inventory",n(restoredInv?.dozens)===5&&n(restoredInv?.packs18)===3&&n(restoredInv?.loose)===20,JSON.stringify(restoredInv));
      }
    } catch(error){
      check(results,"Visible profit regression completed without exception",false,String(error?.stack||error));
    } finally {
      restoreStorage(storage);
      await sleep(120);
      restoreUi(ui);
      window.confirm=oldConfirm;
      window.alert=oldAlert;
      const saleDateRestored=(element("saleDate")?.value??"")===(ui.fields?.saleDate?.value??"");
      const eggDateRestored=(element("eggDate")?.value??"")===(ui.fields?.eggDate?.value??"");
      check(results,"Sandbox test restores sale date form field",saleDateRestored,`${element("saleDate")?.value} vs ${ui.fields?.saleDate?.value}`);
      check(results,"Sandbox test restores egg date form field",eggDateRestored,`${element("eggDate")?.value} vs ${ui.fields?.eggDate?.value}`);
    }
    return results;
  }

  function renderReport(report){
    const out=element("stagingFullTestOut");
    if(!out)return;
    if(!report){out.innerHTML="No full sandbox test has run yet.";return;}
    const failures=(report.results||[]).filter(x=>!x.pass);
    out.innerHTML=`<div style="font-weight:950;margin:8px 0">${report.failed===0?"✅":"❌"} ${report.passed}/${report.total} checks passed</div>${failures.length?failures.map(x=>`<div style="margin:5px 0">❌ ${String(x.name)}${x.detail?` — ${String(x.detail).slice(0,220)}`:""}</div>`).join(""):`<div>All destructive staging checks, visible business calculations, and UI restoration checks passed. The staging baseline was restored.</div>`}`;
  }

  async function install(){
    for(let i=0;i<120&&!window.StagingFullTest?.run;i++)await sleep(50);
    const base=window.StagingFullTest;
    if(!base?.run)return;
    const baseRun=base.run.bind(base);

    async function run(){
      if(running)return;
      running=true;
      const outerUi=uiSnapshot();
      try{
        const first=await baseRun();
        await sleep(100);
        restoreUi(outerUi);
        const extra=await profitRegression();
        const results=[...(first?.results||[]),...extra];
        const failed=results.filter(x=>!x.pass);
        const report={
          at:Date.now(),startedAt:first?.startedAt||Date.now(),durationMs:n(first?.durationMs),
          total:results.length,passed:results.length-failed.length,failed:failed.length,results,
          suite:"staging-full-v2-visible-business"
        };
        try{localStorage.setItem(REPORT,JSON.stringify(report));}catch{}
        renderReport(report);
        window.dispatchEvent(new CustomEvent("staging-full-test-v2-complete",{detail:report}));
        return report;
      } finally {
        running=false;
      }
    }

    window.StagingFullTest={
      ...base,
      run,
      last:()=>read(REPORT,null)||base.last?.()||null,
      render:()=>renderReport(read(REPORT,null)||base.last?.()||null),
      suite:"v2-visible-business"
    };

    document.addEventListener("click",async event=>{
      const btn=event.target?.closest?.("#stagingFullTestBtn");
      if(!btn)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(running)return;
      btn.disabled=true;btn.textContent="Testing everything + visible totals…";
      try{const report=await run();renderReport(report);}finally{btn.disabled=false;btn.textContent="Run Full Sandbox Test";}
    },true);

    renderReport(window.StagingFullTest.last());
    console.log("🧪 STAGING Full Test v2 active — visible revenue/profit and form-restoration regression checks added");
  }

  install();
})();
