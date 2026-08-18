(() => {
  "use strict";
  if (window.__ChickenEggsStagingFullTest) return;
  window.__ChickenEggsStagingFullTest = true;
  if (!window.__ChickenEggsStagingMode) return;

  const APP2="chickenEggApp2V1";
  const ENTRIES="chickenEggEntriesV102";
  const INVENTORY="chickenEggInventoryV2";
  const BUSINESS="chickenEggBusinessV1";
  const REPORT="chickenEggStagingFullTestReportV1";
  const TEST_DATE="2099-12-31";
  let running=false;

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  const money=v=>Number(v||0).toFixed(2);
  const inv=()=>window.InventorySystemV6?.state?.()||read(INVENTORY,{});

  function snapshot(){
    const out={};
    for(const key of window.StagingStorageSandbox?.listKeys?.()||[]){
      const value=localStorage.getItem(key);
      if(value!==null)out[key]=value;
    }
    return out;
  }
  function restore(snap){
    const oldRemote=window.__farmApplyingRemote;
    window.__farmApplyingRemote=true;
    try{
      localStorage.clear();
      for(const [key,value] of Object.entries(snap||{})) localStorage.setItem(key,value);
    }finally{window.__farmApplyingRemote=oldRemote;}
    try{window.loadLocal?.();}catch{}
    try{window.loadFarmSettings?.();}catch{}
    try{window.__reloadFarm2Memory?.();}catch{}
    try{window.updateApp?.();}catch{}
    window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,testRestore:true}}));
    window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,testRestore:true,key:"restore"}}));
    window.dispatchEvent(new CustomEvent("bird-photos-changed",{detail:{staging:true,testRestore:true}}));
  }

  function element(id){return document.getElementById(id);}
  function setValue(id,value,results){
    const el=element(id);
    if(!el){results.push({name:`UI field #${id} exists`,pass:false,detail:"missing"});return false;}
    el.value=String(value);
    return true;
  }
  function addOption(select,id,label){
    if(!select)return;
    if([...select.options].some(o=>o.value===id)){select.value=id;return;}
    const o=document.createElement("option");o.value=id;o.textContent=label;select.appendChild(o);select.value=id;
  }
  function assert(results,name,pass,detail=""){
    results.push({name,pass:!!pass,detail:detail?String(detail):""});
    if(!pass)console.warn("STAGING TEST FAIL:",name,detail);
  }
  function findNew(before,after){
    const ids=new Set((before||[]).map(x=>String(x?.id||"")));
    return (after||[]).find(x=>x?.id&&!ids.has(String(x.id)))||null;
  }
  async function waitFor(predicate,timeout=2500){
    const start=Date.now();
    while(Date.now()-start<timeout){try{if(predicate())return true;}catch{}await sleep(40);}return false;
  }

  async function run(){
    if(running)return;
    running=true;
    const results=[];
    const startedAt=Date.now();
    let snap=null;
    const oldConfirm=window.confirm;
    const oldAlert=window.alert;
    window.confirm=()=>true;
    window.alert=msg=>console.warn("STAGING test alert:",msg);

    try{
      await window.FarmSyncSafety?.ready?.();
      await waitFor(()=>window.InventorySystemV6&&typeof window.saveEggs==="function"&&typeof window.saveSale==="function",5000);
      snap=snapshot();

      assert(results,"Environment is STAGING",window.__ChickenEggsEnvironment==="staging");
      assert(results,"Live Firestore handle is not exposed",!window.FirestoreDB);
      assert(results,"Live Firebase user handle is not exposed",!window.FirebaseUser);
      assert(results,"Staging Firebase is read-only",window.__STAGING_FIREBASE_READONLY__===true);
      assert(results,"InventorySystemV6 is active",!!window.InventorySystemV6);
      assert(results,"Who Owes v2 is active",window.__whoOwesV2===true);

      // Keep the destructive test quiet and deterministic.
      const pref=read(APP2,{});pref.preferences={...(pref.preferences||{}),sounds:false,surprises:false};
      localStorage.setItem(APP2,JSON.stringify(pref));window.__reloadFarm2Memory?.();

      // Exact carton editor / inventory authority.
      await window.InventorySystemV6.commitExact(5,3,20);
      await sleep(80);
      let s=inv();
      assert(results,"Exact carton inventory saves",Number(s.dozens)===5&&Number(s.packs18)===3&&Number(s.loose)===20,JSON.stringify({dozens:s.dozens,packs18:s.packs18,loose:s.loose}));

      // Egg collection -> edit -> delete and inventory delta reversal.
      const beforeEggRows=read(ENTRIES,[]);
      setValue("eggDate",TEST_DATE,results);setValue("eggCount",7,results);
      window.saveEggs();
      await waitFor(()=>read(ENTRIES,[]).length>beforeEggRows.length);
      let rows=read(ENTRIES,[]);
      const egg=findNew(beforeEggRows,rows);
      assert(results,"Egg collection creates one history entry",!!egg&&egg.type==="eggs"&&Number(egg.eggs)===7,egg?.id||"no entry");
      await sleep(180);s=inv();
      assert(results,"Egg collection adds loose eggs only",Number(s.dozens)===5&&Number(s.packs18)===3&&Number(s.loose)===27,JSON.stringify(s));

      if(egg){
        window.editEntry(egg.id);setValue("eggCount",9,results);window.saveEggs();await sleep(220);
        rows=read(ENTRIES,[]);const edited=rows.find(x=>String(x.id)===String(egg.id));s=inv();
        assert(results,"Editing collection updates existing entry",Number(edited?.eggs)===9);
        assert(results,"Editing collection applies only the +2 inventory delta",Number(s.loose)===29&&Number(s.dozens)===5&&Number(s.packs18)===3,JSON.stringify(s));
        window.deleteEntry(egg.id);await sleep(250);s=inv();rows=read(ENTRIES,[]);
        assert(results,"Deleting egg history removes the entry",!rows.some(x=>String(x.id)===String(egg.id)));
        assert(results,"Deleting collection reverses its inventory effect",Number(s.dozens)===5&&Number(s.packs18)===3&&Number(s.loose)===20,JSON.stringify(s));
      }

      // Customer.
      const beforeCustomers=read(APP2,{}).customers||[];
      setValue("farm2CustomerName","STAGING Test Customer",results);
      if(element("farm2CustomerContact"))element("farm2CustomerContact").value="test@example.invalid";
      if(element("farm2CustomerPrice"))element("farm2CustomerPrice").value="5";
      if(element("farm2CustomerNotes"))element("farm2CustomerNotes").value="Automated sandbox test";
      window.farm2AddCustomer?.();await sleep(100);
      let app=read(APP2,{});const customer=findNew(beforeCustomers,app.customers||[]);
      assert(results,"Customer add works",!!customer&&customer.name==="STAGING Test Customer",customer?.id||"no customer");

      // Order + reservation and deletion.
      if(customer){
        const beforeOrders=app.orders||[];const beforeReserved=Number(window.InventorySystemV6.reservations?.()||0);
        const orderCustomer=element("farm2OrderCustomer");addOption(orderCustomer,customer.id,customer.name);
        setValue("farm2OrderDate",TEST_DATE,results);setValue("farm2OrderDozen",2,results);setValue("farm2OrderPacks",1,results);
        if(element("farm2OrderNotes"))element("farm2OrderNotes").value="Sandbox order";
        window.farm2AddOrder?.();await sleep(100);app=read(APP2,{});const order=findNew(beforeOrders,app.orders||[]);
        assert(results,"Customer order add works",!!order&&Number(order.dozen)===2&&Number(order.packs18)===1,order?.id||"no order");
        assert(results,"Pending order reserves 42 eggs",Number(window.InventorySystemV6.reservations?.()||0)===beforeReserved+42,`${beforeReserved} -> ${window.InventorySystemV6.reservations?.()}`);
        if(order){window.farm2DeleteOrder?.(order.id);await sleep(100);assert(results,"Order deletion releases reservation",Number(window.InventorySystemV6.reservations?.()||0)===beforeReserved);}
      }

      // Expense add/delete.
      app=read(APP2,{});const beforeExpenses=app.expenses||[];
      setValue("farm2ExpenseAmount","12.34",results);setValue("farm2ExpenseDate",TEST_DATE,results);
      if(element("farm2ExpenseCategory"))element("farm2ExpenseCategory").value="Feed";
      if(element("farm2ExpenseDesc"))element("farm2ExpenseDesc").value="STAGING feed test";
      window.farm2AddExpense?.();await sleep(100);app=read(APP2,{});const expense=findNew(beforeExpenses,app.expenses||[]);
      assert(results,"Expense add works",!!expense&&money(expense.amount)==="12.34",expense?.id||"no expense");
      if(expense){window.farm2DeleteExpense?.(expense.id);await sleep(80);assert(results,"Expense delete works",!(read(APP2,{}).expenses||[]).some(x=>String(x.id)===String(expense.id)));}

      // Chore add/complete.
      app=read(APP2,{});const beforeChores=app.chores||[];
      setValue("farm2ChoreName","STAGING test chore",results);setValue("farm2ChoreDate",TEST_DATE,results);
      if(element("farm2ChoreRepeat"))element("farm2ChoreRepeat").value="once";
      window.farm2AddChore?.();await sleep(80);app=read(APP2,{});const chore=findNew(beforeChores,app.chores||[]);
      assert(results,"Chore add works",!!chore,chore?.id||"no chore");
      if(chore){window.farm2CompleteChore?.(chore.id);await sleep(80);assert(results,"One-time chore completion removes it",!(read(APP2,{}).chores||[]).some(x=>String(x.id)===String(chore.id)));}

      // Flock profile + local-only staging photo + delete.
      app=read(APP2,{});const beforeFlock=app.flock||[];
      setValue("farm2BirdName","STAGING Test Hen",results);
      if(element("farm2BirdBreed"))element("farm2BirdBreed").value="Test Breed";
      if(element("farm2BirdDate"))element("farm2BirdDate").value="2026-01-01";
      if(element("farm2BirdSex"))element("farm2BirdSex").value="Hen";
      if(element("farm2BirdNotes"))element("farm2BirdNotes").value="Sandbox only";
      window.farm2AddBird?.();await sleep(120);app=read(APP2,{});const bird=findNew(beforeFlock,app.flock||[]);
      assert(results,"Flock profile add works",!!bird&&bird.name==="STAGING Test Hen",bird?.id||"no bird");
      if(bird){
        const testPhoto="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";
        const photoResult=await window.FarmBirdPhotosV4?.savePrepared?.(bird.id,testPhoto);await sleep(60);
        assert(results,"Staging flock photo save works locally",photoResult?.saved===true&&window.FarmBirdPhotosV4?.get?.(bird.id)===testPhoto);
        await window.FarmBirdPhotosV4?.remove?.(bird.id);assert(results,"Staging flock photo remove works locally",!window.FarmBirdPhotosV4?.get?.(bird.id));
        window.farmFlockDeleteBirdV7?.(bird.id);await sleep(100);assert(results,"Flock profile delete works",!(read(APP2,{}).flock||[]).some(x=>String(x.id)===String(bird.id)));
      }

      // Chicken sale add/delete and business totals source.
      const beforeBusiness=read(BUSINESS,{chickenSales:[]});
      setValue("bizChickenDate",TEST_DATE,results);setValue("bizChickenDesc","STAGING pullet",results);setValue("bizChickenQty",2,results);setValue("bizChickenPrice",15,results);
      if(element("bizChickenBuyer"))element("bizChickenBuyer").value="STAGING Buyer";
      if(element("bizChickenNotes"))element("bizChickenNotes").value="Sandbox chicken sale";
      window.bizSaveChickenSale?.();await sleep(100);let business=read(BUSINESS,{chickenSales:[]});const birdSale=findNew(beforeBusiness.chickenSales||[],business.chickenSales||[]);
      assert(results,"Chicken sale add works",!!birdSale&&Number(birdSale.total)===30,birdSale?.id||"no chicken sale");
      if(birdSale){window.bizDeleteChickenSale?.(birdSale.id);await sleep(80);business=read(BUSINESS,{chickenSales:[]});assert(results,"Chicken sale delete works",!(business.chickenSales||[]).some(x=>String(x.id)===String(birdSale.id)));}

      // Unpaid egg sale -> customer metadata -> Who Owes -> paid -> delete -> inventory restore.
      await window.InventorySystemV6.commitExact(5,3,20);await sleep(80);
      const beforeSales=read(ENTRIES,[]);app=read(APP2,{});
      if(customer){
        const saleCustomer=element("farm2SaleCustomer");addOption(saleCustomer,customer.id,customer.name);
      }
      setValue("saleDate",TEST_DATE,results);setValue("dozenSold",1,results);setValue("dozenPrice",5,results);setValue("packSold",1,results);setValue("packPrice",8,results);
      if(element("farm2SalePaid"))element("farm2SalePaid").value="unpaid";
      if(element("farm2SaleNote"))element("farm2SaleNote").value="STAGING unpaid sale";
      window.saveSale();await waitFor(()=>read(ENTRIES,[]).length>beforeSales.length);await sleep(250);
      rows=read(ENTRIES,[]);const sale=findNew(beforeSales,rows);s=inv();app=read(APP2,{});
      assert(results,"Egg sale creates history with $13 revenue",!!sale&&Number(sale.dozenSold)===1&&Number(sale.packSold)===1&&money(Number(sale.dozenSold)*Number(sale.dozenPrice)+Number(sale.packSold)*Number(sale.packPrice))==="13.00",sale?.id||"no sale");
      assert(results,"Dozen + 18-pack sale removes matching sealed cartons",Number(s.dozens)===4&&Number(s.packs18)===2&&Number(s.loose)===20,JSON.stringify(s));
      if(sale){
        const meta=app.saleMeta?.[sale.id];
        assert(results,"Sale customer / unpaid metadata saves",!!meta&&meta.paid===false&&(!customer||String(meta.customerId)===String(customer.id)),JSON.stringify(meta||{}));
        await sleep(180);
        const owesCard=element("whoOwesCard");
        assert(results,"Who Owes renders unpaid sale on Home",!!owesCard&&/13\.00/.test(owesCard.textContent||"")&&(!customer||String(owesCard.textContent||"").includes(customer.name)),owesCard?.textContent||"no card");
        const saleBeforePaid=JSON.stringify(rows.find(x=>String(x.id)===String(sale.id))||{});
        const invBeforePaid=JSON.stringify(inv());
        const paidButton=owesCard?.querySelector?.(`button[data-sale-id="${CSS.escape(String(sale.id))}"]`);
        if(paidButton){paidButton.click();await sleep(220);} 
        app=read(APP2,{});
        assert(results,"Mark Paid changes only payment metadata",app.saleMeta?.[sale.id]?.paid===true);
        assert(results,"Mark Paid does not rewrite egg sale",JSON.stringify(read(ENTRIES,[]).find(x=>String(x.id)===String(sale.id))||{})===saleBeforePaid);
        assert(results,"Mark Paid does not change inventory",JSON.stringify(inv())===invBeforePaid);
        window.deleteEntry(sale.id);await sleep(260);s=inv();app=read(APP2,{});
        assert(results,"Deleting sale removes history",!read(ENTRIES,[]).some(x=>String(x.id)===String(sale.id)));
        assert(results,"Deleting sale restores dozen and 18-pack",Number(s.dozens)===5&&Number(s.packs18)===3&&Number(s.loose)===20,JSON.stringify(s));
        assert(results,"Deleting sale removes Who Owes metadata",!app.saleMeta?.[sale.id]);
      }

      // Visible Stats / Records features remain mounted after mutations.
      window.updateApp?.();await sleep(100);
      assert(results,"Records totals section renders",!!element("recordsTotals")&&element("recordsTotals").textContent.trim().length>0);
      assert(results,"Lifetime Profit/Loss Stats section renders",!!element("statsLifetimeProfit")&&element("statsLifetimeProfit").textContent.trim().length>0);
      assert(results,"Chicken of the Day feature remains loaded",document.body.textContent.includes("Chicken of the Day"));

    }catch(error){
      console.error("STAGING full test crashed:",error);
      results.push({name:"Full staging test completed without exception",pass:false,detail:String(error?.stack||error)});
    }finally{
      try{if(snap)restore(snap);}catch(error){results.push({name:"Staging baseline restored",pass:false,detail:String(error)});}
      window.confirm=oldConfirm;window.alert=oldAlert;
      const failed=results.filter(x=>!x.pass);
      const report={at:Date.now(),startedAt,durationMs:Date.now()-startedAt,total:results.length,passed:results.length-failed.length,failed:failed.length,results};
      try{localStorage.setItem(REPORT,JSON.stringify(report));}catch{}
      running=false;
      window.dispatchEvent(new CustomEvent("staging-full-test-complete",{detail:report}));
      return report;
    }
  }

  function renderReport(report=read(REPORT,null)){
    const out=element("stagingFullTestOut");if(!out)return;
    if(!report){out.innerHTML="No full sandbox test has run yet.";return;}
    const failures=(report.results||[]).filter(x=>!x.pass);
    out.innerHTML=`<div style="font-weight:950;margin:8px 0">${report.failed===0?"✅":"❌"} ${report.passed}/${report.total} checks passed</div>${failures.length?failures.map(x=>`<div style="margin:5px 0">❌ ${String(x.name)}${x.detail?` — ${String(x.detail).slice(0,220)}`:""}</div>`).join(""):`<div>All destructive staging checks passed and the staging baseline was restored.</div>`}`;
  }

  function inject(){
    const farm=element("farm2Hub")||element("farm");if(!farm||element("stagingFullTestCard"))return;
    const card=document.createElement("div");card.id="stagingFullTestCard";card.className="farm2-card";card.style.marginTop="14px";
    card.innerHTML=`<div class="farm2-kicker">🧪 Full Sandbox Test</div><h3 style="margin:5px 0">Test the working app without touching live data</h3><div class="farm2-subtle">This deliberately adds, edits, sells, marks paid, deletes, changes inventory, customers, orders, expenses, flock/photos and chicken sales in STAGING, verifies the results, then restores the staging snapshot.</div><button type="button" id="stagingFullTestBtn" style="margin-top:10px">Run Full Sandbox Test</button><div id="stagingFullTestOut" style="margin-top:10px;font-size:12px"></div>`;
    farm.appendChild(card);
    element("stagingFullTestBtn")?.addEventListener("click",async()=>{
      const btn=element("stagingFullTestBtn");if(running)return;
      btn.disabled=true;btn.textContent="Testing everything…";
      const report=await run();renderReport(report);btn.disabled=false;btn.textContent="Run Full Sandbox Test";
    });
    renderReport();
  }

  window.StagingFullTest={run,last:()=>read(REPORT,null),render:renderReport};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(inject,1200),{once:true});
  else setTimeout(inject,1200);
})();
