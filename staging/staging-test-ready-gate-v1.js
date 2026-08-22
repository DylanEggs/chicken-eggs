(() => {
  "use strict";
  if (window.__StagingFinalTestReadyGateV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingFinalTestReadyGateV1 = true;

  const regularMode = window.__ChickenEggsStagingOwnerMode !== true;
  let announcedReady = false;

  function suiteReady() {
    const s = window.StagingFullTest;
    if (!s?.run) return false;
    if (!regularMode) return !!window.StagingTestMemoryRunnerV1;
    return !!(
      window.StagingLocalSeedV1?.version >= 2 &&
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
    try {
      return window.FarmSyncSafety?.isReady?.() === true && !copyInProgress();
    } catch { return false; }
  }

  function ready() { return dataReady() && suiteReady(); }
  function button() { return document.getElementById("stagingRunFullTest"); }

  function refresh() {
    const btn = button();
    if (!btn) return;
    const sync = dataReady(), suite = suiteReady(), ok = sync && suite;
    btn.disabled = !ok;
    btn.dataset.finalSuiteReady = ok ? "true" : "false";
    if (ok) {
      btn.textContent = "🧪 Run Full Sandbox Test";
      btn.title = "Current LIVE browser mirror, Customer Preview guard, live-parity Customer Requests UI, and in-memory torture suite are ready.";
      if (!announcedReady) {
        announcedReady = true;
        window.dispatchEvent(new CustomEvent("staging-final-test-ready", {detail:{inMemory:true,liveBrowserMirror:true,customerRequestsLiveParity:true,customerPreviewGuard:true}}));
        console.log("✅ STAGING ready — current LIVE browser mirror + preview guard + live Customer Requests parity + in-memory torture suite confirmed");
      }
    } else {
      announcedReady = false;
      if (!sync) {
        btn.textContent = "⏳ Mirroring LIVE app…";
        btn.title = "Waiting for the isolated current-LIVE browser mirror to finish.";
      } else {
        btn.textContent = "⏳ Assembling exact tests…";
        btn.title = "Waiting for every live-parity regression and preview guard to attach.";
      }
    }
  }

  function start() { refresh(); setInterval(refresh, 120); }

  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("#stagingRunFullTest");
    if (!btn || ready()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    refresh();
  }, true);

  for (const name of ["farm-sync-ready","core-data-synced","farm-data-synced","staging-baseline-restored","staging-final-suite-changed","staging-storage-overlay","staging-live-browser-mirrored"]) {
    window.addEventListener(name, refresh);
  }

  window.StagingFinalTestReadyGateV1 = {
    version:6,
    ready,dataReady,suiteReady,copyInProgress,refresh,
    requiresMemoryRunner:true,
    requiresCustomerRequestsLiveParity:true,
    requiresLiveBrowserMirror:true,
    requiresCustomerPreviewGuard:true
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
