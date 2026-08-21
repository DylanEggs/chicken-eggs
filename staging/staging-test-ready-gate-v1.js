(() => {
  "use strict";
  if (window.__StagingFinalTestReadyGateV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingFinalTestReadyGateV1 = true;

  // Regular staging has a deliberately layered torture suite. Do not let the
  // user start it while Firebase is still seeding the isolated sandbox or while
  // later regression wrappers are still attaching to StagingFullTest.
  const regularMode = window.__ChickenEggsStagingOwnerMode !== true;
  let timer = null;

  function suiteReady() {
    const s = window.StagingFullTest;
    if (!s?.run) return false;
    if (!regularMode) return true;
    return !!(
      s.__twelvePackFullSuiteV1 &&
      s.__historyBackV1 &&
      s.__saleEditBackV1 &&
      s.__customerRequestsV1
    );
  }

  function dataReady() {
    try { return window.FarmSyncSafety?.isReady?.() === true; }
    catch { return false; }
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
      btn.title = regularMode ? "Final staging torture suite is assembled and test data is ready." : "Staging test data is ready.";
    } else if (!sync) {
      btn.textContent = "⏳ Preparing test data…";
      btn.title = "Waiting for the isolated read-only live snapshot to finish.";
    } else {
      btn.textContent = "⏳ Assembling tests…";
      btn.title = "Waiting for all staging regression modules to attach.";
    }
  }

  function start() {
    refresh();
    timer = setInterval(() => {
      refresh();
      if (ready() && timer) {
        clearInterval(timer);
        timer = null;
        window.dispatchEvent(new CustomEvent("staging-final-test-ready", { detail:{ expectedChecks:193 } }));
        console.log("✅ STAGING final torture suite ready — test data settled and final wrappers attached");
      }
    }, 100);
  }

  // Belt-and-suspenders guard: even a synthetic/programmatic click cannot run
  // the destructive suite before the final readiness conditions are true.
  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("#stagingRunFullTest");
    if (!btn || ready()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    refresh();
  }, true);

  window.addEventListener("farm-sync-ready", refresh);
  window.addEventListener("staging-baseline-restored", refresh);
  window.addEventListener("staging-final-suite-changed", refresh);

  window.StagingFinalTestReadyGateV1 = {
    version: 1,
    ready,
    dataReady,
    suiteReady,
    refresh,
    expectedChecks: regularMode ? 193 : null
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
