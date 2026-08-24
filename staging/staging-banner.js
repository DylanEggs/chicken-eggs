(() => {
  "use strict";
  if (window.__ChickenEggsStagingBanner) return;
  window.__ChickenEggsStagingBanner = true;

  function baselineLabel() {
    const info = window.StagingManualSnapshots?.info?.();
    if (!info?.savedAt) return "No manual baseline saved yet.";
    return `Manual baseline saved ${new Date(info.savedAt).toLocaleString()}.`;
  }

  function failureSummary(result) {
    const failed = (Array.isArray(result?.results) ? result.results : []).filter(x => !x?.pass);
    if (!failed.length) return "";
    return failed.map((x, i) => {
      const name = String(x?.name || `Failed check ${i + 1}`);
      const detail = String(x?.detail || "").trim();
      return `${i + 1}. ${name}${detail ? `\n   ${detail.slice(0, 180)}` : ""}`;
    }).join("\n\n");
  }

  function refreshReadyUi(){
    try{window.StagingFinalTestReadyGateV1?.refresh?.();}catch{}
    try{window.StagingCustomerPreviewGuardV1?.renderMirrorBadge?.();}catch{}
    try{window.updateApp?.();}catch{}
    try{window.InventorySystemV6?.render?.();}catch{}
  }

  function inject() {
    if (!document.body || document.getElementById("stagingSafetyBanner")) return;
    const ownerMode = window.__ChickenEggsStagingOwnerMode === true;

    const style = document.createElement("style");
    style.textContent = `
      #stagingSafetyBanner{position:sticky;top:0;z-index:100000;background:${ownerMode?'#174c75':'#7f1d1d'};color:#fff;padding:7px 10px;box-shadow:0 3px 14px rgba(0,0,0,.25);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #stagingSafetyBanner .st-head{display:flex;align-items:center;justify-content:center;gap:8px;min-height:32px}
      #stagingSafetyBanner .st-title{font-size:13px;font-weight:950;line-height:1.15;text-align:center}
      #stagingSafetyBanner .st-row{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;font-weight:900;text-align:center;margin-top:6px}
      #stagingSafetyBanner button,#stagingSafetyBanner a{width:auto!important;margin:0!important;padding:7px 9px!important;border-radius:10px!important;border:1px solid rgba(255,255,255,.4)!important;background:#fff!important;color:#7f1d1d!important;font-size:11px!important;font-weight:900!important;text-decoration:none!important;line-height:1.1}
      #stagingSafetyBanner .st-customer{background:#fff3b8!important;color:#604800!important;border-color:#ffe06a!important}
      #stagingSafetyBanner .st-owner{background:#e7f4ff!important;color:#174c75!important;border-color:#b9dcf7!important}
      #stagingSafetyBanner .st-test{background:#e7f8ec!important;color:#185b2b!important;border-color:#bce7c7!important}
      #stagingSafetyBanner small{display:block;text-align:center;margin-top:5px;opacity:.92;font-weight:700;line-height:1.3}
      #stagingBaselineState{display:block;margin-top:2px;opacity:.8;font-size:10px}
      #stagingToolsToggle{display:none!important;background:#fff3b8!important;color:#604800!important;white-space:nowrap!important;padding:6px 8px!important;font-size:11px!important}
      @media (max-width:600px){
        #stagingSafetyBanner{padding:5px 8px}
        #stagingSafetyBanner .st-head{justify-content:space-between;min-height:34px}
        #stagingSafetyBanner .st-title{font-size:11px;text-align:left;letter-spacing:.1px}
        #stagingToolsToggle{display:inline-flex!important;align-items:center!important;justify-content:center!important}
        #stagingSafetyBanner .st-row{display:none!important;margin-top:5px;padding-top:6px;border-top:1px solid rgba(255,255,255,.22);grid-template-columns:1fr 1fr;gap:6px}
        #stagingSafetyBanner.st-open .st-row{display:grid!important}
        #stagingSafetyBanner .st-row button,#stagingSafetyBanner .st-row a{width:100%!important;min-height:38px!important;padding:6px 7px!important;font-size:10.5px!important;display:flex!important;align-items:center!important;justify-content:center!important}
        #stagingSafetyBanner small{display:none!important}
      }
    `;
    document.head.appendChild(style);

    const bar = document.createElement("div");
    bar.id = "stagingSafetyBanner";
    bar.innerHTML = `
      <div class="st-head">
        <div class="st-title">${ownerMode?'🔐 OWNER STAGING':'🧪 TEST / STAGING'} • LIVE FIREBASE READ-ONLY</div>
        <button id="stagingToolsToggle" type="button" aria-expanded="false">⚙️ Test Tools</button>
      </div>
      <div class="st-row">
        <button id="stagingRefreshLive">🔄 Refresh Test Data From Live</button>
        <button id="stagingSaveBaseline">💾 Save Test Baseline</button>
        <button id="stagingRestoreBaseline">↩️ Restore Test Baseline</button>
        <button class="st-test" id="stagingRunFullTest">🧪 Run Full Sandbox Test</button>
        <a class="st-customer" href="staging/view/">👀 Customer Preview</a>
        <a class="st-owner" href="staging/owner-login/">🔎 Owner Login Check</a>
        ${ownerMode?'<a class="st-owner" href="staging/">🧪 Regular Test Farm</a>':'<a class="st-owner" href="staging/owner-farm/">🔐 Owner-Gated Test Farm</a>'}
        <a href="./">Open LIVE App</a>
      </div>
      <small>${ownerMode?'The whole test farm is running behind your exact Firebase owner login. ':''}Anything you add, edit, delete, pay, restore, or photograph here stays in the sandbox.<span id="stagingBaselineState">${baselineLabel()}</span></small>`;
    document.body.prepend(bar);

    const toolsToggle = document.getElementById("stagingToolsToggle");
    toolsToggle?.addEventListener("click", () => {
      const open = bar.classList.toggle("st-open");
      toolsToggle.setAttribute("aria-expanded", open ? "true" : "false");
      toolsToggle.textContent = open ? "✕ Close Tools" : "⚙️ Test Tools";
    });

    const state = () => document.getElementById("stagingBaselineState");
    const setState = text => { const el = state(); if (el) el.textContent = text; };

    document.getElementById("stagingRefreshLive")?.addEventListener("click", async () => {
      if (!confirm("Replace the TEST copy with a fresh read-only snapshot of the LIVE farm and save it as the new test baseline? Your live data will not be changed.")) return;
      const btn = document.getElementById("stagingRefreshLive");
      if (btn) { btn.disabled = true; btn.textContent = "Refreshing…"; }
      try {
        const saved = await window.StagingManualSnapshots?.refreshFromLiveAndSaveBaseline?.();
        if (!saved?.saved) throw new Error("The staging refresh did not return a saved verified baseline.");
        setState(`Fresh live baseline saved ${new Date(saved.savedAt || Date.now()).toLocaleString()}.`);
        refreshReadyUi();
        alert(`✅ Fresh LIVE data verified in TEST/STAGING.\n\nSource: ${String(saved.liveSource||"verified LIVE")}.\n\nThe TEST copy is running in memory so Chrome's storage limit cannot corrupt it. Live data was not changed.`);
      } catch (error) {
        console.error(error);
        alert(`Could not refresh the staging snapshot. Live data was not changed.\n\nERROR: ${String(error?.message||error)}`);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "🔄 Refresh Test Data From Live"; }
        refreshReadyUi();
      }
    });

    document.getElementById("stagingSaveBaseline")?.addEventListener("click", async () => {
      try {
        const saved = await window.StagingManualSnapshots?.saveBaseline?.();
        setState(`Manual baseline saved ${new Date(saved?.savedAt || Date.now()).toLocaleString()}.`);
        alert("Current TEST/STAGING state saved as your manual baseline for this staging session. Live data was not changed.");
      } catch (error) {
        console.error(error);
        alert(`Could not save the test baseline. Live data was not changed.\n\nERROR: ${String(error?.message||error)}`);
      }
    });

    document.getElementById("stagingRestoreBaseline")?.addEventListener("click", async () => {
      if (!window.StagingManualSnapshots?.info?.()) {
        alert("No manual test baseline has been saved yet. Use Save Test Baseline or Refresh Test Data From Live first.");
        return;
      }
      if (!confirm("Throw away the current TEST changes and restore the saved TEST baseline? Live data will not be changed.")) return;
      try {
        const restored = await window.StagingManualSnapshots.restoreBaseline();
        setState(`Restored baseline saved ${new Date(restored.savedAt).toLocaleString()}.`);
        refreshReadyUi();
        alert("TEST/STAGING was restored to the saved baseline. Live data was not changed.");
      } catch (error) {
        console.error(error);
        alert(`Could not restore the test baseline. Live data was not changed.\n\nERROR: ${String(error?.message||error)}`);
      }
    });

    document.getElementById("stagingRunFullTest")?.addEventListener("click", async () => {
      if (!confirm("Run the destructive full sandbox test now? It will add/edit/delete TEST data only and automatically restore the staging state afterward.")) return;
      const btn = document.getElementById("stagingRunFullTest");
      if (btn) { btn.disabled = true; btn.textContent = "Testing…"; }
      try {
        const result = await window.StagingFullTest?.run?.();
        if (!result) throw new Error("Full staging test runner is not ready yet.");
        window.__lastStagingFullTestResult = result;
        if (result.failed) {
          const details = failureSummary(result);
          alert(`Sandbox test finished: ${result.passed}/${result.total} passed, ${result.failed} failed.\n\nFAILED CHECKS:\n${details || "Failure details were not returned."}\n\nStaging state was restored.`);
        } else {
          alert(`✅ Sandbox test passed ${result.passed}/${result.total} checks. Staging state was restored.`);
        }
      } catch (error) {
        console.error(error);
        alert(`Sandbox test could not complete. Live data was not changed.\n\nERROR: ${String(error?.message||error)}`);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "🧪 Run Full Sandbox Test"; }
        refreshReadyUi();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject, { once:true });
  else inject();
})();