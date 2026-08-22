(() => {
  "use strict";
  if (window.__StagingFinalTestReadyGateV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingFinalTestReadyGateV1 = true;

  const regularMode = window.__ChickenEggsStagingOwnerMode !== true;
  let announcedReady = false;

  function sourceResult(){return window.StagingSandbox?.liveSourceResult?.()||window.__StagingLiveSourceResult||window.StagingLocalSeedV1?.result||null;}
  function sourceReady(){const r=sourceResult();return !!(r?.verified===true);}

  function suiteReady() {
    const s = window.StagingFullTest;
    if (!s?.run) return false;
    if (!regularMode) return !!window.StagingTestMemoryRunnerV1;
    return !!(
      sourceReady() &&
      window.StagingCustomerPreviewGuardV1?.version >= 6 &&
      s.__twelvePackFullSuiteV1 &&
      s.__historyBackV1 &&
      s.__saleEditBackV1 &&
      s.__customerRequestsV1 &&
      s.__customerRequestsLiveParityV1 &&
      window.StagingCustomerRequestStatusTestV1?.parityReady?.() &&
      window.StagingCustomerRequestsV1?.version === "live-parity" &&
      String(window.FarmCustomerRequestsV1?.version || "").includes("staging-parity") &&
      window.StagingTestMemoryRunnerV1 &&
      window.StagingStorageSandbox?.beginMemoryOverlay
    );
  }

  function copyInProgress() {
    try {
      const text = String(document.getElementById("syncStatus")?.textContent || "");
      return /copying|refreshing|starting|preparing|reading current live/i.test(text);
    } catch { return true; }
  }

  function dataReady() {
    try { return window.FarmSyncSafety?.isReady?.() === true && !copyInProgress(); }
    catch { return false; }
  }
  function ready(){return dataReady()&&suiteReady();}
  function button(){return document.getElementById("stagingRunFullTest");}

  function lockedReason(){
    const source=sourceResult();
    if(!dataReady())return "STAGING is still loading or refreshing its test data.";
    if(!sourceReady()){
      if(source?.error)return `Fresh LIVE data is not verified yet: ${source.error}`;
      return "Fresh LIVE data is not verified yet. Click “Refresh Test Data From Live” first.";
    }
    if(!suiteReady())return "Fresh LIVE data is verified, but one or more sandbox regression-test modules are still loading. Wait a few seconds and click again.";
    return "The sandbox test is not ready yet.";
  }

  function refresh(){
    const btn=button();if(!btn)return;
    const ok=ready();
    btn.disabled=false;
    btn.dataset.finalSuiteReady=ok?"true":"false";
    btn.dataset.testLocked=ok?"false":"true";
    btn.setAttribute("aria-disabled",ok?"false":"true");
    btn.textContent="🧪 Run Full Sandbox Test";
    if(ok){
      const source=sourceResult();
      btn.title=`Verified ${String(source?.source||"LIVE")} data + full in-memory sandbox suite are ready.`;
      if(!announcedReady){
        announcedReady=true;
        window.dispatchEvent(new CustomEvent("staging-final-test-ready",{detail:{inMemory:true,verifiedLiveSource:true,source:source?.source||"live",customerRequestsLiveParity:true,customerPreviewGuard:true}}));
        console.log("✅ STAGING ready — verified LIVE source + full in-memory torture suite confirmed");
      }
    }else{
      announcedReady=false;
      btn.title=lockedReason();
    }
  }

  function start(){refresh();setInterval(refresh,180);}
  document.addEventListener("click",event=>{
    const btn=event.target?.closest?.("#stagingRunFullTest");
    if(!btn||ready())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    refresh();
    alert(lockedReason());
  },true);
  for(const name of ["farm-sync-ready","core-data-synced","farm-data-synced","staging-baseline-restored","staging-final-suite-changed","staging-storage-overlay","staging-live-source-verified","staging-live-browser-mirrored"])window.addEventListener(name,refresh);

  window.StagingFinalTestReadyGateV1={version:10,ready,dataReady,suiteReady,sourceReady,sourceResult,copyInProgress,lockedReason,refresh,requiresMemoryRunner:true,requiresCustomerRequestsLiveParity:true,requiresVerifiedLiveSource:true,requiresCustomerPreviewGuard:true};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();