(() => {
  "use strict";
  if (window.__StagingFinalTestReadyGateV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingFinalTestReadyGateV1 = true;

  let announcedReady=false,preparing=false,preparePromise=null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const MODULES=[
    "staging-12-pack-full-suite-v1.js",
    "staging-sale-edit-back-regression-v1.js",
    "staging-customer-requests-live-parity-v1.js",
    "staging-customer-requests-parity-compat-v1.js",
    "staging-customer-requests-regression-v1.js",
    "staging-customer-request-status-test-v1.js",
    "staging-real-user-flow-regression-v1.js",
    "staging-test-memory-runner-v1.js"
  ];

  function sourceResult(){return window.StagingSandbox?.liveSourceResult?.()||window.__StagingLiveSourceResult||window.StagingLocalSeedV1?.result||null;}
  function sourceReady(){return sourceResult()?.verified===true;}
  function dataReady(){try{return window.FarmSyncSafety?.isReady?.()===true;}catch{return false;}}

  function missingModules(){
    const s=window.StagingFullTest;
    const missing=[];
    if(!s?.run)missing.push("base sandbox test");
    if(!s?.__twelvePackFullSuiteV1)missing.push("12-pack suite");
    if(!s?.__historyBackV1)missing.push("history navigation suite");
    if(!s?.__saleEditBackV1)missing.push("sale edit/back suite");
    if(!s?.__customerRequestsV1)missing.push("customer requests suite");
    if(!s?.__customerRequestsLiveParityV1)missing.push("customer request live-parity suite");
    if(!window.StagingRealUserFlowRegressionV1?.run||window.StagingRealUserFlowRegressionV1?.isolated!==true)missing.push("isolated real-user click workflow suite");
    if(!window.StagingCustomerRequestStatusTestV1?.parityReady?.())missing.push("customer request status parity");
    if(window.StagingCustomerRequestsV1?.version!=="live-parity")missing.push("customer request parity API");
    if(!String(window.FarmCustomerRequestsV1?.version||"").includes("staging-parity"))missing.push("live customer request UI parity");
    if(!window.StagingTestMemoryRunnerV1?.run)missing.push("memory test runner");
    if(!window.StagingStorageSandbox?.beginMemoryOverlay)missing.push("memory sandbox");
    if(!window.StagingSandbox?.resetFromLive)missing.push("LIVE read-only refresh");
    return missing;
  }

  function suiteReady(){return missingModules().length===0;}
  function ready(){return dataReady()&&suiteReady();}
  function button(){return document.getElementById("stagingRunFullTest");}

  function scriptAlreadyLoaded(name){return [...document.scripts].some(s=>String(s.src||"").includes(`/staging/${name}`)||String(s.src||"").includes(name));}
  function loadScript(name){
    if(scriptAlreadyLoaded(name))return Promise.resolve(true);
    return new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      const stage=encodeURIComponent(String(window.__ChickenEggsStagingBuild||Date.now()));
      const app=encodeURIComponent(String(window.__ChickenEggsBuild||Date.now()));
      s.src=`staging/${name}?stage=${stage}&app=${app}&prepare=${Date.now()}`;
      s.async=false;s.onload=()=>resolve(true);s.onerror=()=>reject(new Error(`Could not load ${name}`));document.body.appendChild(s);
    });
  }

  async function ensureModules(){
    if(preparePromise)return preparePromise;
    preparePromise=(async()=>{for(const name of MODULES){try{await loadScript(name);}catch(error){console.error("STAGING test module load failed:",error);}}const deadline=Date.now()+15000;while(Date.now()<deadline){if(suiteReady())return true;await sleep(120);}return false;})().finally(()=>{preparePromise=null;});
    return preparePromise;
  }

  function lockedReason(){if(!dataReady())return "STAGING is still loading its farm runtime.";const missing=missingModules();return missing.length?`Test setup is missing: ${missing.join(", ")}.`:"The sandbox test is not ready yet.";}
  function refresh(){
    const btn=button();if(!btn)return;btn.disabled=false;btn.dataset.finalSuiteReady=ready()?"true":"false";btn.dataset.testLocked=ready()?"false":"true";btn.setAttribute("aria-disabled","false");
    if(preparing){btn.textContent="⏳ Preparing Sandbox Test…";btn.title="Loading and attaching the full staging regression suite.";return;}
    btn.textContent="🧪 Run Full Sandbox Test";
    if(ready()){btn.title=sourceReady()?"Ready. The test will refresh LIVE Firebase again before running.":"Ready. The test will fetch LIVE Firebase read-only before running.";if(!announcedReady){announcedReady=true;window.dispatchEvent(new CustomEvent("staging-final-test-ready",{detail:{selfLoading:true,selfRefreshesLiveSource:true,inMemory:true,realUserFlow:true,isolated:true}}));console.log("✅ STAGING full sandbox suite ready");}}
    else{announcedReady=false;btn.title=lockedReason();}
  }

  async function prepareAndRun(btn){if(preparing)return;preparing=true;refresh();try{const ok=await ensureModules();refresh();if(!ok||!ready())throw new Error(lockedReason());await window.StagingTestMemoryRunnerV1.run();}catch(error){console.error("STAGING sandbox preparation failed:",error);alert(`Sandbox test could not start.\n\n${String(error?.message||error)}\n\nLIVE data was not changed.`);}finally{preparing=false;refresh();}}
  document.addEventListener("click",event=>{const btn=event.target?.closest?.("#stagingRunFullTest");if(!btn)return;if(ready())return;event.preventDefault();event.stopImmediatePropagation();void prepareAndRun(btn);},true);
  for(const name of ["farm-sync-ready","core-data-synced","farm-data-synced","staging-final-suite-changed","staging-storage-overlay","staging-live-source-verified"])window.addEventListener(name,refresh);

  window.StagingFinalTestReadyGateV1={version:14,ready,dataReady,suiteReady,sourceReady,sourceResult,missingModules,ensureModules,lockedReason,refresh,prepareAndRun,selfLoadsRegressionModules:true,selfRefreshesVerifiedLiveSource:true,requiresRealUserFlow:true,requiresIsolatedRealUserFlow:true};
  async function start(){refresh();await ensureModules();refresh();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>void start(),{once:true});else void start();
})();