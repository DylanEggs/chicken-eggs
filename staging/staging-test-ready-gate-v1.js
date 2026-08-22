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
      window.StagingStorageSandbox?.beginMemoryOverlay &&
      window.StagingSandbox?.resetFromLive
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
    if(!dataReady())return "STAGING is still loading. Wait a few seconds and click again.";
    if(!suiteReady())return "One or more sandbox regression-test modules are still loading. Wait a few seconds and click again.";
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
      btn.title=sourceReady()
        ? `Ready. Current ${String(source?.source||"LIVE")} data is verified; the test will refresh it again before running.`
        : "Ready. The test will first fetch and verify fresh LIVE Firebase data read-only, then run entirely in memory.";
      if(!announcedReady){
        announcedReady=true;
        window.dispatchEvent(new CustomEvent("staging-final-test-ready",{detail:{inMemory:true,selfRefreshesLiveSource:true,customerRequestsLiveParity:true,customerPreviewGuard:true}}));
        console.log("✅ STAGING test runner ready — it will self-refresh verified LIVE Firebase data before every sandbox run");
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

  window.StagingFinalTestReadyGateV1={version:11,ready,dataReady,suiteReady,sourceReady,sourceResult,copyInProgress,lockedReason,refresh,requiresMemoryRunner:true,selfRefreshesVerifiedLiveSource:true,requiresCustomerRequestsLiveParity:true,requiresCustomerPreviewGuard:true};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();