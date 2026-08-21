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
      s.__twelvePackFullSuiteV1 &&
      s.__historyBackV1 &&
      s.__saleEditBackV1 &&
      s.__customerRequestsV1 &&
      window.StagingTestMemoryRunnerV1 &&
      window.StagingStorageSandbox?.beginMemoryOverlay
    );
  }

  function copyInProgress() {
    try {
      const text = String(document.getElementById("syncStatus")?.textContent || "");
      return /copying read-only live snapshot|refreshing|starting/i.test(text);
    } catch { return true; }
  }

  function dataReady() {
    try {
      return window.FarmSyncSafety?.isReady?.() === true && !copyInProgress();
    } catch { return false; }
  }

  function ready() {
    return dataReady() && suiteReady();
  }

  function button() {
    return document.getElementById("stagingRunFullTest");
  }

  function refresh() {
    const btn = button();
    if (!btn) return;
    const sync = dataReady();
    const suite = suiteReady();
    const ok = sync && suite;
    btn.disabled = !ok;
    btn.dataset.finalSuiteReady = ok ? "true" : "false";
    if (ok) {
      btn.textContent = "🧪 Run Full Sandbox Test";
      btn.title = regularMode ? "Final staging torture suite and in-memory runner are ready." : "Staging test data is ready.";
      if (!announcedReady) {
        announcedReady = true;
        window.dispatchEvent(new CustomEvent("staging-final-test-ready", { detail:{ expectedChecks:193, inMemory:true } }));
        console.log("✅ STAGING final torture suite ready — data settled, wrappers attached, in-memory runner active");
      }
    } else {
      announcedReady = false;
      if (!sync) {
        btn.textContent = "⏳ Preparing test data…";
        btn.title = "Waiting for the isolated read-only live snapshot to finish.";
      } else {
        btn.textContent = "⏳ Assembling tests…";
        btn.title = "Waiting for all staging regressions and the in-memory test runner to attach.";
      }
    }
  }

  function start() {
    refresh();
    setInterval(refresh, 120);
  }

  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("#stagingRunFullTest");
    if (!btn || ready()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    refresh();
  }, true);

  window.addEventListener("farm-sync-ready", refresh);
  window.addEventListener("core-data-synced", refresh);
  window.addEventListener("farm-data-synced", refresh);
  window.addEventListener("staging-baseline-restored", refresh);
  window.addEventListener("staging-final-suite-changed", refresh);
  window.addEventListener("staging-storage-overlay", refresh);

  window.StagingFinalTestReadyGateV1 = {
    version: 3,
    ready,
    dataReady,
    suiteReady,
    copyInProgress,
    refresh,
    expectedChecks: regularMode ? 193 : null,
    requiresMemoryRunner:true
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();