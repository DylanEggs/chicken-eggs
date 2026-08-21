(() => {
  "use strict";
  if (window.__StagingTestMemoryRunnerV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingTestMemoryRunnerV1 = true;

  let running = false;

  function failureSummary(result) {
    const failed = (Array.isArray(result?.results) ? result.results : []).filter(x => !x?.pass);
    if (!failed.length) return "";
    return failed.map((x, i) => {
      const name = String(x?.name || `Failed check ${i + 1}`);
      const detail = String(x?.detail || "").trim();
      return `${i + 1}. ${name}${detail ? `\n   ${detail.slice(0,180)}` : ""}`;
    }).join("\n\n");
  }

  function ready() {
    const gate = window.StagingFinalTestReadyGateV1;
    return !!(gate?.ready?.() && window.StagingFullTest?.run && window.StagingStorageSandbox?.beginMemoryOverlay);
  }

  async function run(btn) {
    if (running || !ready()) {
      try { window.StagingFinalTestReadyGateV1?.refresh?.(); } catch {}
      return;
    }
    if (!confirm("Run the destructive full sandbox test now? It runs in a temporary in-memory copy, never writes test changes to live storage, and discards the copy afterward.")) return;

    running = true;
    let overlayStarted = false;
    if (btn) { btn.disabled = true; btn.textContent = "🧠 Testing in memory…"; }

    try {
      const overlay = window.StagingStorageSandbox.beginMemoryOverlay();
      overlayStarted = !!overlay?.active;
      if (!overlayStarted) throw new Error("Staging memory test overlay could not start.");

      const result = await window.StagingFullTest.run();
      if (!result) throw new Error("Full staging test runner did not return a report.");
      window.__lastStagingFullTestResult = result;

      // Discard every destructive test write before showing the result.
      window.StagingStorageSandbox.endMemoryOverlay(true);
      overlayStarted = false;

      if (result.failed) {
        const details = failureSummary(result);
        alert(`Sandbox test finished: ${result.passed}/${result.total} passed, ${result.failed} failed.\n\nFAILED CHECKS:\n${details || "Failure details were not returned."}\n\nThe in-memory test copy was discarded. Live and persistent staging data were not changed.`);
      } else {
        alert(`✅ Sandbox test passed ${result.passed}/${result.total} checks. The in-memory test copy was discarded; persistent staging and live data were not changed.`);
      }
    } catch (error) {
      console.error("STAGING in-memory torture test failed:", error);
      alert(`Sandbox test could not complete: ${String(error?.message || error)}\n\nLive data was not changed.`);
    } finally {
      if (overlayStarted) {
        try { window.StagingStorageSandbox.endMemoryOverlay(true); } catch {}
      }
      running = false;
      try { window.StagingFinalTestReadyGateV1?.refresh?.(); } catch {}
      if (btn && !btn.disabled) btn.textContent = "🧪 Run Full Sandbox Test";
    }
  }

  // Capture phase takes ownership before the older banner click handler. This
  // guarantees the full torture test always uses the memory overlay.
  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("#stagingRunFullTest");
    if (!btn) return;
    if (!ready()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void run(btn);
  }, true);

  window.StagingTestMemoryRunnerV1 = { version:1, ready, isRunning:()=>running, run:()=>run(document.getElementById("stagingRunFullTest")) };
  console.log("🧠 STAGING full-test memory runner active — torture writes never touch persistent browser storage");
})();