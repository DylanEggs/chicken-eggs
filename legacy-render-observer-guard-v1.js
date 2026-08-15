(() => {
  "use strict";
  if (window.__legacyRenderObserverGuardV1) return;
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
  const original = proto?.observe;
  if (!proto || typeof original !== "function" || original.__farmObserverGuard) return;

  function guardedObserve(target, options) {
    const id = String(target?.id || "");
    const isOldFarmList = blockedIds.has(id);
    const isWholeAppWatcher = target?.classList?.contains?.("app");
    if (isOldFarmList || isWholeAppWatcher) {
      console.log("🛑 Blocked obsolete self-triggering farm render observer", id || ".app");
      return;
    }
    return original.call(this, target, options);
  }
  guardedObserve.__farmObserverGuard = true;
  proto.observe = guardedObserve;

  console.log("✅ Legacy farm render observers disabled; event-driven rendering only");
})();
