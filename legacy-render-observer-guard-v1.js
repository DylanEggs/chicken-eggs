(() => {
  "use strict";
  if (window.__legacyRenderObserverGuardV2) return;
  window.__legacyRenderObserverGuardV2 = true;
  window.__legacyRenderObserverGuardV1 = true;

  const blockedIds = new Set([
    "bizChickenSummary",
    "bizChickenHistory",
    "farm2CustomerList",
    "farm2OrderList",
    "farm2ExpenseList",
    "farm2FlockList",
    "farm2ChoreList"
  ]);

  const proto = window.MutationObserver?.prototype;
  const originalObserve = proto?.observe;
  if (proto && typeof originalObserve === "function" && !originalObserve.__farmObserverGuard) {
    function guardedObserve(target, options) {
      const id = String(target?.id || "");
      const isOldFarmList = blockedIds.has(id);
      const isWholeAppWatcher = target?.classList?.contains?.("app");
      if (isOldFarmList || isWholeAppWatcher) {
        console.log("🛑 Blocked obsolete self-triggering farm render observer", id || ".app");
        return;
      }
      return originalObserve.call(this, target, options);
    }
    guardedObserve.__farmObserverGuard = true;
    proto.observe = guardedObserve;
  }

  // A previously cached app-audit generation retries every 300 ms forever when
  // flock-manager-v7 renames the legacy #farm2FlockList. Prevent only that exact
  // obsolete observer-attachment retry; all normal app timers remain untouched.
  const nativeSetTimeout = window.setTimeout.bind(window);
  if (!window.setTimeout.__farmAuditRetryGuard) {
    function guardedSetTimeout(fn, delay, ...args) {
      const ms = Number(delay) || 0;
      if (ms === 300 && typeof fn === "function") {
        let source = "";
        try { source = Function.prototype.toString.call(fn); } catch {}
        if (source.includes("MutationObserver") && source.includes("document.getElementById(id)") && source.includes("setTimeout(attach,300)")) {
          console.log("🛑 Blocked obsolete farm audit observer retry");
          return 0;
        }
      }
      return nativeSetTimeout(fn, delay, ...args);
    }
    guardedSetTimeout.__farmAuditRetryGuard = true;
    window.setTimeout = guardedSetTimeout;
  }

  console.log("✅ Legacy farm render observers/retry loops disabled; event-driven rendering only");
})();
