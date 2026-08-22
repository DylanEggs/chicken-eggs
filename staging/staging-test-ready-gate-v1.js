(() => {
  "use strict";
  if (window.__StagingFinalTestReadyGateV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingFinalTestReadyGateV1 = true;

  const regularMode = window.__ChickenEggsStagingOwnerMode !== true;
  let announcedReady = false;

  function mirrorReady(){
    const m=window.StagingLocalSeedV1;
    return !!(m?.version>=7 && m?.result?.verified === true && m?.result?.hasLiveBrowserData === true);
  }

  function suiteReady() {
    const s = window.StagingFullTest;
    if (!s?.run) return false;
    if (!regularMode) return !!window.StagingTestMemoryRunnerV1;
    return !!(
      mirrorReady() &&
      window.StagingCustomerPreviewGuardV1?.version >= 2 &&
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
      return /copying|refreshing|starting|preparing/i.test(text);
    } catch { return true; }
  }

  function dataReady() {
    try { return window.FarmSyncSafety?.isReady?.() === true && !copyInProgress(); }
    catch { return false; }
  }
  function ready(){return dataReady()&&suiteReady();}
  function button(){return document.getElementById("stagingRunFullTest");}

  function lockedReason(){
    const mirror = window.StagingLocalSeedV1?.result;
    if (!dataReady()) return "STAGING is still loading or refreshing its test data.";
    if (!mirrorReady()) {
      const copied=Number(mirror?.copied)||0;
      const eligible=Number(mirror?.eligible)||0;
      const skipped=Number(mirror?.skipped)||0;
      const mismatch=Array.isArray(mirror?.mismatchedKeys)?mirror.mismatchedKeys.length:(Number(mirror?.mismatchedKeys)||0);
      return `The LIVE mirror is not verified yet. Copied ${copied}/${eligible}, skipped ${skipped}, mismatches ${mismatch}. Use “Refresh Test Data From Live” first.`;
    }
    if (!suiteReady()) return "The LIVE mirror is verified, but one or more sandbox regression-test modules have not finished loading yet. Wait a few seconds and try again.";
    return "The sandbox test is not ready yet.";
  }

  function refresh(){
    const btn=button();if(!btn)return;
    const ok=ready();
    // Do NOT use the native disabled attribute: disabled buttons swallow clicks
    // completely. Keep it clickable so a locked test explains what is wrong.
    btn.disabled=false;
    btn.dataset.finalSuiteReady=ok?"true":"false";
    btn.dataset.testLocked=ok?"false":"true";
    btn.setAttribute("aria-disabled",ok?"false":"true");
    btn.textContent="🧪 Run Full Sandbox Test";
    if(ok){
      btn.title="Verified current LIVE browser mirror + Customer Preview guard + live-parity Customer Requests UI + in-memory torture suite are ready.";
      if(!announcedReady){
        announcedReady=true;
        window.dispatchEvent(new CustomEvent("staging-final-test-ready",{detail:{inMemory:true,verifiedLiveBrowserMirror:true,customerRequestsLiveParity:true,customerPreviewGuard:true}}));
        console.log("✅ STAGING ready — verified current LIVE browser mirror + preview guard + live Customer Requests parity + in-memory torture suite confirmed");
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
  for(const name of ["farm-sync-ready","core-data-synced","farm-data-synced","staging-baseline-restored","staging-final-suite-changed","staging-storage-overlay","staging-live-browser-mirrored"])window.addEventListener(name,refresh);

  window.StagingFinalTestReadyGateV1={version:9,ready,dataReady,suiteReady,mirrorReady,copyInProgress,lockedReason,refresh,requiresMemoryRunner:true,requiresCustomerRequestsLiveParity:true,requiresVerifiedLiveBrowserMirror:true,requiresCustomerPreviewGuard:true};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();