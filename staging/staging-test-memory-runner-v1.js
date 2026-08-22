(() => {
  "use strict";
  if (window.__StagingTestMemoryRunnerV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingTestMemoryRunnerV1 = true;

  let running = false;
  const APP2="chickenEggApp2V1",INVENTORY="chickenEggInventoryV2",ENTRIES="chickenEggEntriesV102",SETTINGS="chickenEggSettingsV102",DELUXE="chickenEggDeluxeV1",BUSINESS="chickenEggBusinessV1";
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  const whole=v=>Number.isInteger(Number(v))&&Number(v)>=0;
  const finiteNonNegative=v=>Number.isFinite(Number(v))&&Number(v)>=0;

  function failureSummary(result) {
    const failed=(Array.isArray(result?.results)?result.results:[]).filter(x=>!x?.pass);
    return failed.map((x,i)=>`${i+1}. ${String(x?.name||`Failed check ${i+1}`)}${x?.detail?`\n   ${String(x.detail).slice(0,180)}`:""}`).join("\n\n");
  }
  function sourceResult(){return window.StagingSandbox?.liveSourceResult?.()||window.__StagingLiveSourceResult||window.StagingLocalSeedV1?.result||null;}
  function ready(){const gate=window.StagingFinalTestReadyGateV1;return !!(gate?.ready?.()&&window.StagingFullTest?.run&&window.StagingStorageSandbox?.beginMemoryOverlay&&window.StagingSandbox?.resetFromLive);}
  function snapshotMemory(){const out={};for(const key of window.StagingStorageSandbox?.listKeys?.()||[]){try{const v=localStorage.getItem(key);if(v!==null)out[key]=v;}catch{}}return out;}
  function restoreMemory(snap){const storage=window.StagingStorageSandbox;if(!storage?.overlayActive?.())storage?.beginMemoryOverlay?.();const old=window.__farmApplyingRemote;window.__farmApplyingRemote=true;try{localStorage.clear();for(const [k,v] of Object.entries(snap||{}))localStorage.setItem(k,v);}finally{window.__farmApplyingRemote=old;}try{window.loadLocal?.();}catch{}try{window.loadFarmSettings?.();}catch{}try{window.__reloadFarm2Memory?.();}catch{}try{window.updateApp?.();}catch{}try{window.InventorySystemV6?.render?.();}catch{}try{window.StagingCustomerRequestsV1?.render?.();}catch{}window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,testRestore:true,inMemory:true}}));window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,testRestore:true,inMemory:true,key:"test-memory-restore"}}));}
  async function refreshVerifiedLiveSource(btn){if(btn)btn.textContent="☁️ Refreshing LIVE test copy…";const ok=await window.StagingSandbox.resetFromLive();const source=sourceResult();if(ok===false||!source?.verified)throw new Error(source?.error||"Fresh LIVE Firebase data could not be verified for the sandbox test.");if(!window.StagingStorageSandbox?.overlayActive?.())throw new Error("Verified LIVE data was loaded, but the in-memory staging sandbox is not active.");try{window.StagingFinalTestReadyGateV1?.refresh?.();}catch{}return source;}

  function add(results,name,pass,detail=""){results.push({name,pass:!!pass,detail:String(detail||"")});}
  function uniqueNonEmptyIds(rows){const ids=(Array.isArray(rows)?rows:[]).map(x=>String(x?.id||"").trim()).filter(Boolean);return ids.length===new Set(ids).size;}
  async function fetchOk(path){try{const r=await fetch(new URL(path,location.href),{cache:"no-store"});return {ok:r.ok,status:r.status,text:r.ok?await r.text():""};}catch(error){return {ok:false,status:0,text:"",error:String(error?.message||error)};}}

  async function integrityChecks(source){
    const results=[];
    const entries=read(ENTRIES,[]),app=read(APP2,{}),inv=read(INVENTORY,{}),settings=read(SETTINGS,{}),business=read(BUSINESS,{}),deluxe=read(DELUXE,{});
    add(results,"Integrity: verified source is read-only LIVE Firebase memory",source?.verified===true&&String(source?.source||"").includes("firebase-read-only-memory"),String(source?.source||"missing"));
    add(results,"Integrity: all six authoritative LIVE datasets copied",Number(source?.copied)===6&&Number(source?.eligible)===6,`${source?.copied}/${source?.eligible}`);
    add(results,"Integrity: staging memory overlay remains active",window.StagingStorageSandbox?.overlayActive?.()===true);
    add(results,"Integrity: all six mirrored datasets are present",[APP2,INVENTORY,ENTRIES,SETTINGS,DELUXE,BUSINESS].every(k=>localStorage.getItem(k)!==null));
    add(results,"Integrity: egg/sale entry count matches verified Firebase source",Array.isArray(entries)&&entries.length===Number(source?.coreEntries),`${entries.length} vs ${source?.coreEntries}`);
    add(results,"Integrity: egg/sale entries have unique IDs",uniqueNonEmptyIds(entries));
    add(results,"Integrity: every history row is eggs or sale",entries.every(e=>e&&["eggs","sale"].includes(e.type)));
    add(results,"Integrity: every history row has YYYY-MM-DD date",entries.every(e=>/^\d{4}-\d{2}-\d{2}$/.test(String(e?.date||""))));
    add(results,"Integrity: egg collection counts are whole non-negative eggs",entries.filter(e=>e?.type==="eggs").every(e=>whole(e.eggs)));
    add(results,"Integrity: sale package quantities are whole non-negative numbers",entries.filter(e=>e?.type==="sale").every(e=>whole(e.dozenSold||0)&&whole(e.packSold??e.packs18Sold??0)));
    add(results,"Integrity: sale prices are finite and non-negative",entries.filter(e=>e?.type==="sale").every(e=>finiteNonNegative(e.dozenPrice||0)&&finiteNonNegative(e.packPrice??e.packs18Price??0)));
    add(results,"Integrity: inventory values are whole and non-negative",whole(inv.dozens||0)&&whole(inv.packs18||0)&&whole(inv.loose||0),JSON.stringify({dozens:inv.dozens,packs18:inv.packs18,loose:inv.loose}));
    add(results,"Integrity: app/settings/business/deluxe datasets are objects",[app,settings,business,deluxe].every(x=>x&&typeof x==="object"&&!Array.isArray(x)));
    add(results,"Integrity: customer IDs contain no duplicates",uniqueNonEmptyIds(app.customers||[]));
    add(results,"Integrity: flock IDs contain no duplicates",uniqueNonEmptyIds(app.flock||[]));
    add(results,"Integrity: order IDs contain no duplicates",uniqueNonEmptyIds(app.orders||[]));
    add(results,"Integrity: pending/order quantities are whole and non-negative",(Array.isArray(app.orders)?app.orders:[]).every(o=>whole(o?.dozen||0)&&whole(o?.packs18||0)));
    add(results,"Integrity: expenses contain no negative/non-finite amounts",(Array.isArray(app.expenses)?app.expenses:[]).every(e=>finiteNonNegative(e?.amount||0)));
    add(results,"Integrity: chicken-sale totals contain no negative/non-finite values",(Array.isArray(business.chickenSales)?business.chickenSales:[]).every(e=>finiteNonNegative(e?.total??(Number(e?.qty||0)*Number(e?.price||0)))));
    add(results,"Integrity: STAGING Firebase is explicitly read-only",window.__STAGING_FIREBASE_READONLY__===true&&!window.FirestoreDB&&!window.FirebaseUser);

    const critical=["eggDate","eggCount","saleDate","dozenSold","dozenPrice","packSold","packPrice"];
    add(results,"UI smoke: all critical collect/sale fields exist",critical.every(id=>!!document.getElementById(id)),critical.filter(id=>!document.getElementById(id)).join(", "));
    const navButtons=[...document.querySelectorAll(".bottomNav button")];
    const targets=navButtons.map(b=>(b.getAttribute("onclick")||"").match(/showScreen\(['\"]([^'\"]+)/)?.[1]).filter(Boolean);
    add(results,"UI smoke: every bottom-nav target exists",targets.length>0&&targets.every(id=>!!document.getElementById(id)),targets.join(", "));
    const activeBefore=document.querySelector(".screen.active")?.id||"dashboard";
    let navWorks=true,navDetail="";
    try{for(const id of [...new Set(targets)]){window.showScreen?.(id);if(document.querySelector(".screen.active")?.id!==id){navWorks=false;navDetail=id;break;}}}catch(error){navWorks=false;navDetail=String(error?.message||error);}finally{try{window.showScreen?.(activeBefore);}catch{}}
    add(results,"UI smoke: every bottom-nav screen can actually open",navWorks,navDetail);

    try{
      const builder=window.FarmPublicCustomerBuilderV3?.build;
      const pub=builder?.({entries,settings,inventory:inv,app2:app,weather:read("chickenEggWeatherV1",{}),deluxe,photoResolver:()=>""});
      add(results,"Customer smoke: public customer snapshot builds from mirrored LIVE data",!!pub&&typeof pub==="object");
      add(results,"Customer smoke: public snapshot is JSON-serializable",!!pub&&typeof JSON.stringify(pub)==="string");
    }catch(error){add(results,"Customer smoke: public snapshot builds without exception",false,String(error?.message||error));}

    const [preview,login,ownerFarm]=await Promise.all([fetchOk("view/"),fetchOk("owner-login/"),fetchOk("owner-farm/")]);
    add(results,"Route smoke: Customer Preview page returns HTTP success",preview.ok,`HTTP ${preview.status||0}`);
    add(results,"Route smoke: Owner Login page returns HTTP success",login.ok,`HTTP ${login.status||0}`);
    add(results,"Route smoke: Owner-Gated Test Farm returns HTTP success",ownerFarm.ok,`HTTP ${ownerFarm.status||0}`);
    add(results,"Route smoke: Customer Preview is not an empty response",preview.ok&&preview.text.length>200,`bytes=${preview.text.length}`);
    add(results,"Route smoke: Owner Login is not an empty response",login.ok&&login.text.length>200,`bytes=${login.text.length}`);
    return results;
  }

  function hasRealUserChecks(results){return (Array.isArray(results)?results:[]).filter(x=>String(x?.name||"").startsWith("Real-user flow:")).length>=19;}
  async function loadRealUserModule(){
    if(window.StagingRealUserFlowRegressionV1?.run)return true;
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      const stage=encodeURIComponent(String(window.__ChickenEggsStagingBuild||Date.now()));
      const app=encodeURIComponent(String(window.__ChickenEggsBuild||Date.now()));
      s.src=`staging/staging-real-user-flow-regression-v1.js?stage=${stage}&app=${app}&force=${Date.now()}`;
      s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error("Could not load the required real-user click workflow module."));document.body.appendChild(s);
    });
    return !!window.StagingRealUserFlowRegressionV1?.run;
  }
  async function requiredRealUserChecks(baseResults,verifiedSnap,btn){
    if(hasRealUserChecks(baseResults))return [];
    if(btn)btn.textContent="🖱️ Running Real-User Click Test…";
    const loaded=await loadRealUserModule();
    if(!loaded)throw new Error("Required real-user click workflow module did not load.");
    const extra=await window.StagingRealUserFlowRegressionV1.run();
    restoreMemory(verifiedSnap);
    if(!hasRealUserChecks(extra))throw new Error(`Real-user click workflow did not complete all 19 required checks. It returned ${(extra||[]).length}.`);
    return extra;
  }

  async function run(btn){
    if(running||!ready()){try{window.StagingFinalTestReadyGateV1?.refresh?.();}catch{}return;}
    if(!confirm("Run the full sandbox torture test now? It will refresh current LIVE Firebase read-only, run destructive checks and real-user Collect/Sale clicks only in memory, restore the verified TEST copy, then run live-data integrity and route smoke checks. LIVE data will not be changed."))return;
    running=true;let verifiedSnap=null;if(btn){btn.disabled=true;btn.textContent="☁️ Refreshing LIVE test copy…";}
    try{
      const source=await refreshVerifiedLiveSource(btn);verifiedSnap=snapshotMemory();
      if(btn)btn.textContent="🧠 Running Sandbox Test…";
      const base=await window.StagingFullTest.run();if(!base)throw new Error("Full staging test runner did not return a report.");
      restoreMemory(verifiedSnap);
      const userExtra=await requiredRealUserChecks(base.results||[],verifiedSnap,btn);
      restoreMemory(verifiedSnap);
      if(btn)btn.textContent="🔎 Running Integrity Checks…";
      const extra=await integrityChecks(source);const results=[...(base.results||[]),...userExtra,...extra];
      if(!hasRealUserChecks(results))throw new Error("Safety stop: the final report is missing the required 19 real-user click workflow checks.");
      const failed=results.filter(x=>!x.pass);const result={...base,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${base.suite||"staging-full"}+required-real-user-flow+live-integrity-v2`};
      window.__lastStagingFullTestResult=result;
      const sourceNote=`Verified LIVE source: ${String(source.source||"LIVE")} • ${Number(source.copied)||0}/${Number(source.eligible)||0} datasets${Number.isFinite(Number(source.coreEntries))?` • ${Number(source.coreEntries)} egg/sale entries`:""}.`;
      if(result.failed){alert(`Sandbox torture test finished: ${result.passed}/${result.total} passed, ${result.failed} failed.\n\n${sourceNote}\n\nFAILED CHECKS:\n${failureSummary(result)||"Failure details were not returned."}\n\nThe verified in-memory TEST copy was restored. LIVE data was not changed.`);}else{alert(`✅ Sandbox torture test passed ${result.passed}/${result.total} checks.\n\n${sourceNote}\n\nRequired real-user Collect/Sale click workflow, destructive tests, live-data integrity, navigation, Customer Preview, Owner Login, and Owner-Gated Farm smoke checks all passed.\n\nThe verified in-memory TEST copy was restored. LIVE data was not changed.`);}
    }catch(error){console.error("STAGING in-memory sandbox test failed:",error);if(verifiedSnap){try{restoreMemory(verifiedSnap);}catch{}}alert(`Sandbox test could not complete: ${String(error?.message||error)}\n\nThe test was stopped and the verified TEST copy was restored when available. LIVE data was not changed.`);}finally{running=false;try{window.StagingFinalTestReadyGateV1?.refresh?.();}catch{}const currentBtn=btn||document.getElementById("stagingRunFullTest");if(currentBtn){currentBtn.disabled=false;currentBtn.textContent="🧪 Run Full Sandbox Test";}}
  }

  document.addEventListener("click",event=>{const btn=event.target?.closest?.("#stagingRunFullTest");if(!btn||!ready())return;event.preventDefault();event.stopImmediatePropagation();void run(btn);},true);
  window.StagingTestMemoryRunnerV1={version:5,ready,isRunning:()=>running,sourceResult,refreshVerifiedLiveSource,refreshVerifiedLiveMirror:refreshVerifiedLiveSource,integrityChecks,requiredRealUserChecks,run:()=>run(document.getElementById("stagingRunFullTest"))};
  console.log("🧠 STAGING full-test memory runner v5 active — 19 real-user click checks are mandatory; silent 237-only passes are blocked");
})();