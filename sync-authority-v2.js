(() => {
  "use strict";
  if (window.__eggSyncAuthorityV4Compat) return;
  window.__eggSyncAuthorityV4Compat = true;
  window.__eggSyncAuthorityV3 = true;
  window.__eggSyncAuthorityV2 = true;

  let readyPromise = null;
  async function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        if (window.FarmSyncSafety?.ready) return window.FarmSyncSafety.ready();
        await new Promise(r => setTimeout(r, 75));
      }
      throw new Error("Protected Firebase authority did not become available");
    })();
    return readyPromise;
  }

  window.EggSyncAuthorityReady = ready;
  void ready().catch(error => console.warn("Protected sync authority wait failed:", error));
  console.log("✅ Legacy sync authority is read-only compatibility; protected Firebase owns sync");
})();
