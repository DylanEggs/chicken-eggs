(() => {
  "use strict";
  if (window.__StagingAppPolishRefreshV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingAppPolishRefreshV1 = true;

  const RELEVANT = new Set([
    "chickenEggEntriesV102",
    "chickenEggSettingsV102",
    "chickenEggApp2V1",
    "chickenEggBusinessV1"
  ]);
  let queued = false;

  function schedule(event) {
    const key = String(event?.detail?.key || "");
    if (key && !RELEVANT.has(key)) return;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      window.dispatchEvent(new CustomEvent("core-data-synced", {
        detail: {
          staging: true,
          source: "staging-app-polish-refresh-v1",
          key
        }
      }));
    });
  }

  window.addEventListener("farm-local-data-changed", schedule, true);
  window.StagingAppPolishRefreshV1 = {
    version: 1,
    schedule,
    networkCalls: 0,
    firebaseReads: 0,
    firebaseWrites: 0
  };
  console.log("🧪 STAGING app-polish refresh bridge active — same-window farm changes refresh Farm-at-a-glance");
})();
