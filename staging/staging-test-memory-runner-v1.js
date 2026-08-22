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

  async function refreshVerifiedLiveMirror(btn) {
    if (btn) btn.textContent = "🪞 Syncing current LIVE app…";
    const mirror = window.StagingLocalSeedV1?.syncFromLiveBrowser?.();
    if (window.StagingLocalSeedV1 && mirror) window.StagingLocalSeedV1.result = mirror;
    if (!mirror?.verified || !mirror?.hasLiveBrowserData) {
      throw new Error("Current LIVE app data could not be mirrored and verified. The torture test was not started.");
    }
    // Re-load normal app memory from the newly mirrored staged copy. In this
    // staging build ready() is local-only and performs zero Firebase reads.
    await window.FarmSyncSafety?.ready?.();
    const current = window.StagingLocalSeedV1?.result;
    if (!current?.verified || !current?.hasLiveBrowserData) {
      throw new Error("LIVE mirror verification was lost while preparing the staging test.");
    }
    try { window.StagingFinalTestReadyGateV1?.refresh?.(); } catch {}
    return current;
  }

  async function run(btn) {
    if (running || !ready()) {
      try { window.StagingFinalTestReadyGateV1?.refresh?.(); } catch {}
      return;
    }
    if (!confirm("Run the destructive full sandbox test now? Staging will first re-sync and verify the current LIVE app data, then run every destructive check in a temporary in-memory copy. Live data will not be changed.")) return;

    running = true;
    let overlayStarted = false;
    if (btn) { btn.disabled = true; btn.textContent = "🪞 Syncing current LIVE app…"; }

    try {
      const mirror = await refreshVerifiedLiveMirror(btn);
      if (btn) btn.textContent = "🧠 Testing verified LIVE mirror…";

      const overlay = window.StagingStorageSandbox.beginMemoryOverlay();
      overlayStarted = !!overlay?.active;
      if (!overlayStarted) throw new Error("Staging memory test overlay could not start.");

      const result = await window.StagingFullTest.run();
      if (!result) throw new Error("Full staging test runner did not return a report.");
      window.__lastStagingFullTestResult = result;

      // Discard every destructive test write before showing the result.
      window.StagingStorageSandbox.endMemoryOverlay(true);
      overlayStarted = false;

      const mirrorNote = `Verified current LIVE mirror: ${Number(mirror.copied)||0} keys, 0 Firebase reads.`;
      if (result.failed) {
        const details = failureSummary(result);
        alert(`Sandbox test finished: ${result.passed}/${result.total} passed, ${result.failed} failed.\n\n${mirrorNote}\n\nFAILED CHECKS:\n${details || "Failure details were not returned."}\n\nThe in-memory test copy was discarded. Live and persistent staging data were not changed.`);
      } else {
        alert(`✅ Sandbox test passed ${result.passed}/${result.total} checks.\n\n${mirrorNote}\n\nThe in-memory test copy was discarded; persistent staging and live data were not changed.`);
      }
    } catch (error) {
      console.error("STAGING in-memory torture test failed:", error);
      alert(`Sandbox test could not complete: ${String(error?.message || error)}\n\nThe test was stopped. Live data was not changed.`);
    } finally {
      if (overlayStarted) {
        try { window.StagingStorageSandbox.endMemoryOverlay(true); } catch {}
      }
      running = false;
      try { window.StagingFinalTestReadyGateV1?.refresh?.(); } catch {}
      const currentBtn = btn || document.getElementById("stagingRunFullTest");
      if (currentBtn && window.StagingFinalTestReadyGateV1?.ready?.()) {
        currentBtn.disabled = false;
        currentBtn.textContent = "🧪 Run Full Sandbox Test";
      }
    }
  }

  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("#stagingRunFullTest");
    if (!btn) return;
    if (!ready()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void run(btn);
  }, true);

  window.StagingTestMemoryRunnerV1 = { version:2, ready, isRunning:()=>running, refreshVerifiedLiveMirror, run:()=>run(document.getElementById("stagingRunFullTest")) };
  console.log("🧠 STAGING full-test memory runner v2 active — current LIVE browser mirror is reverified before every torture run; destructive writes remain in memory");
})();