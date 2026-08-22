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

  function sourceResult() {
    return window.StagingSandbox?.liveSourceResult?.() ||
      window.__StagingLiveSourceResult ||
      window.StagingLocalSeedV1?.result || null;
  }

  function ready() {
    const gate = window.StagingFinalTestReadyGateV1;
    return !!(
      gate?.ready?.() &&
      window.StagingFullTest?.run &&
      window.StagingStorageSandbox?.beginMemoryOverlay &&
      window.StagingSandbox?.resetFromLive
    );
  }

  function snapshotMemory() {
    const out = {};
    for (const key of window.StagingStorageSandbox?.listKeys?.() || []) {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) out[key] = value;
      } catch {}
    }
    return out;
  }

  function restoreMemory(snap) {
    const storage = window.StagingStorageSandbox;
    if (!storage?.overlayActive?.()) storage?.beginMemoryOverlay?.();
    const oldRemote = window.__farmApplyingRemote;
    window.__farmApplyingRemote = true;
    try {
      localStorage.clear();
      for (const [key, value] of Object.entries(snap || {})) {
        localStorage.setItem(key, value);
      }
    } finally {
      window.__farmApplyingRemote = oldRemote;
    }
    try { window.loadLocal?.(); } catch {}
    try { window.loadFarmSettings?.(); } catch {}
    try { window.__reloadFarm2Memory?.(); } catch {}
    try { window.updateApp?.(); } catch {}
    try { window.InventorySystemV6?.render?.(); } catch {}
    try { window.StagingCustomerRequestsV1?.render?.(); } catch {}
    window.dispatchEvent(new CustomEvent("core-data-synced", {detail:{staging:true,testRestore:true,inMemory:true}}));
    window.dispatchEvent(new CustomEvent("farm-data-synced", {detail:{staging:true,testRestore:true,inMemory:true,key:"test-memory-restore"}}));
  }

  async function refreshVerifiedLiveSource(btn) {
    if (btn) btn.textContent = "☁️ Refreshing LIVE test copy…";

    const ok = await window.StagingSandbox.resetFromLive();
    const source = sourceResult();

    if (ok === false || !source?.verified) {
      throw new Error(source?.error || "Fresh LIVE Firebase data could not be verified for the sandbox test.");
    }
    if (!window.StagingStorageSandbox?.overlayActive?.()) {
      throw new Error("Verified LIVE data was loaded, but the in-memory staging sandbox is not active.");
    }

    try { window.StagingFinalTestReadyGateV1?.refresh?.(); } catch {}
    return source;
  }

  async function run(btn) {
    if (running || !ready()) {
      try { window.StagingFinalTestReadyGateV1?.refresh?.(); } catch {}
      return;
    }

    if (!confirm("Run the full sandbox test now? Staging will refresh the current LIVE Firebase data in read-only mode, run destructive checks only in memory, then restore the verified TEST copy. LIVE data will not be changed.")) return;

    running = true;
    let verifiedSnap = null;
    if (btn) { btn.disabled = true; btn.textContent = "☁️ Refreshing LIVE test copy…"; }

    try {
      const source = await refreshVerifiedLiveSource(btn);
      verifiedSnap = snapshotMemory();

      if (btn) btn.textContent = "🧠 Running Sandbox Test…";

      const result = await window.StagingFullTest.run();
      if (!result) throw new Error("Full staging test runner did not return a report.");
      window.__lastStagingFullTestResult = result;

      // Guarantee the exact verified pre-test TEST copy is restored even if one
      // of the nested regression suites altered more state than expected.
      restoreMemory(verifiedSnap);

      const sourceNote = `Verified LIVE source: ${String(source.source || "LIVE")} • ${Number(source.copied)||0}/${Number(source.eligible)||0} datasets${Number.isFinite(Number(source.coreEntries)) ? ` • ${Number(source.coreEntries)} egg/sale entries` : ""}.`;
      if (result.failed) {
        const details = failureSummary(result);
        alert(`Sandbox test finished: ${result.passed}/${result.total} passed, ${result.failed} failed.\n\n${sourceNote}\n\nFAILED CHECKS:\n${details || "Failure details were not returned."}\n\nThe verified in-memory TEST copy was restored. LIVE data was not changed.`);
      } else {
        alert(`✅ Sandbox test passed ${result.passed}/${result.total} checks.\n\n${sourceNote}\n\nThe verified in-memory TEST copy was restored. LIVE data was not changed.`);
      }
    } catch (error) {
      console.error("STAGING in-memory sandbox test failed:", error);
      if (verifiedSnap) {
        try { restoreMemory(verifiedSnap); } catch {}
      }
      alert(`Sandbox test could not complete: ${String(error?.message || error)}\n\nThe test was stopped and the verified TEST copy was restored when available. LIVE data was not changed.`);
    } finally {
      running = false;
      try { window.StagingFinalTestReadyGateV1?.refresh?.(); } catch {}
      const currentBtn = btn || document.getElementById("stagingRunFullTest");
      if (currentBtn) {
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

  window.StagingTestMemoryRunnerV1 = {
    version:3,
    ready,
    isRunning:()=>running,
    sourceResult,
    refreshVerifiedLiveSource,
    refreshVerifiedLiveMirror:refreshVerifiedLiveSource,
    run:()=>run(document.getElementById("stagingRunFullTest"))
  };

  console.log("🧠 STAGING full-test memory runner v3 active — verified read-only LIVE Firebase source is refreshed before every test; destructive writes stay in memory");
})();