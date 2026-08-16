(() => {
  "use strict";
  if (window.__coreInventoryAuthorityV3) return;
  window.__coreInventoryAuthorityV3 = true;
  window.__coreInventoryEventAuthorityV2 = true;

  const ENTRIES_KEY = "chickenEggEntriesV102";
  const INVENTORY_KEY = "chickenEggInventoryV2";
  const REPAIR_ID = "20260816-ledger-from-last-exact-v1";
  let repairing = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function localDate(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function entries() {
    const rows = read(ENTRIES_KEY, []);
    return (Array.isArray(rows) ? rows : []).filter(e => e && (e.type === "eggs" || e.type === "sale"));
  }
  function contribution(e) {
    if (!e) return 0;
    if (e.type === "eggs") return Math.max(0, n(e.eggs));
    if (e.type === "sale") return -(Math.max(0, n(e.dozenSold))*12 + Math.max(0, n(e.packSold ?? e.packs18Sold))*18);
    return 0;
  }
  function coreBalance() {
    return entries().reduce((sum,e) => sum + contribution(e), 0);
  }
  function inventoryState() {
    const raw = read(INVENTORY_KEY, {});
    return {
      ...raw,
      version:Math.max(3,n(raw.version)),
      dozens:Math.max(0,n(raw.dozens)),
      packs18:Math.max(0,n(raw.packs18)),
      loose:Math.max(0,n(raw.loose)),
      adjustments:Array.isArray(raw.adjustments) ? raw.adjustments : [],
      recoveryMarkers:raw.recoveryMarkers && typeof raw.recoveryMarkers === "object" ? raw.recoveryMarkers : {}
    };
  }
  function physical(s = inventoryState()) {
    return Math.max(0, Math.round(n(s.dozens)*12 + n(s.packs18)*18 + n(s.loose)));
  }
  function pack(total) {
    total = Math.max(0, Math.round(n(total)));
    return { dozens:0, packs18:Math.floor(total/18), loose:total%18 };
  }
  function saveTotal(target, reason, details, sourceDelta = null, marker = null) {
    const s = inventoryState();
    const before = physical(s);
    target = Math.max(0, Math.round(n(target)));

    Object.assign(s, pack(target));
    s.version = Math.max(3,n(s.version));
    s.adjustments = Array.isArray(s.adjustments) ? s.adjustments : [];
    if (before !== target) {
      s.adjustments.unshift({
        id:`corev3-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        date:localDate(), at:Date.now(), delta:target-before,
        reason, details:details || "Authoritative inventory reconciliation",
        totalAfter:target, authority:"core-inventory-v3",
        sourceDelta:Number.isFinite(sourceDelta) ? sourceDelta : target-before
      });
      s.adjustments = s.adjustments.slice(0,100);
    }
    if (marker) {
      s.recoveryMarkers = s.recoveryMarkers && typeof s.recoveryMarkers === "object" ? s.recoveryMarkers : {};
      s.recoveryMarkers[REPAIR_ID] = marker;
    }
    s.updatedAt = Date.now();
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("farm-integrity-synced", {
      detail:{ source:"core-inventory-authority-v3", physical:target, delta:target-before, at:Date.now() }
    }));
    if (typeof window.syncFarmNow === "function") void Promise.resolve(window.syncFarmNow()).catch(()=>{});
    console.log(`✅ Core inventory v3 set inventory ${before} -> ${target}: ${reason}`);
    return { before, target, changed:before !== target };
  }

  function applyCoreDelta(delta, reason = "Core history update", details = "") {
    delta = Math.round(n(delta));
    if (!delta) return { before:physical(), target:physical(), changed:false };
    const before = physical();
    return saveTotal(Math.max(0,before+delta), reason, details || `Direct core history delta ${delta >= 0 ? "+" : ""}${delta}`, delta);
  }

  function latestExactBaseline(state = inventoryState()) {
    return state.adjustments
      .filter(a => a && /^Exact inventory count$/i.test(String(a.reason||"")) && n(a.at) > 0 && Number.isFinite(Number(a.totalAfter)))
      .sort((a,b) => n(b.at)-n(a.at))[0] || null;
  }
  function isManualAdjustment(a) {
    const reason = String(a?.reason || "");
    return /^(Manual inventory add|Used at home|Gave to family|Broken\s*\/\s*damaged)$/i.test(reason);
  }
  function ledgerPlan() {
    const state = inventoryState();
    const baseline = latestExactBaseline(state);
    if (!baseline) return { ok:false, reason:"No exact inventory baseline is available." };

    const baselineAt = n(baseline.at);
    const baselineDate = localDate(baselineAt);
    const coreEvents = entries()
      .filter(e => n(e.createdAt) > baselineAt && String(e.date || "") >= baselineDate)
      .map(e => ({
        id:String(e.id||""), type:e.type, date:String(e.date||""),
        createdAt:n(e.createdAt), updatedAt:n(e.updatedAt), delta:contribution(e)
      }))
      .filter(e => e.delta !== 0)
      .sort((a,b)=>a.createdAt-b.createdAt);

    const manualEvents = state.adjustments
      .filter(a => n(a.at) > baselineAt && isManualAdjustment(a))
      .map(a => ({ id:String(a.id||""), date:String(a.date||""), at:n(a.at), reason:String(a.reason||""), delta:n(a.delta) }))
      .filter(a => a.delta !== 0)
      .sort((a,b)=>a.at-b.at);

    const coreNet = coreEvents.reduce((s,e)=>s+e.delta,0);
    const manualNet = manualEvents.reduce((s,e)=>s+e.delta,0);
    const baselineTotal = Math.max(0,Math.round(n(baseline.totalAfter)));
    const target = Math.max(0,Math.round(baselineTotal + coreNet + manualNet));
    return {
      ok:true,
      baseline:{ id:String(baseline.id||""), at:baselineAt, date:String(baseline.date||baselineDate), total:baselineTotal },
      coreEvents, manualEvents, coreNet, manualNet, target,
      current:physical(state)
    };
  }

  async function repairFromLastExactCount(force = false) {
    if (repairing) return null;
    repairing = true;
    try {
      if (window.EggSyncAuthorityReady) {
        try { await window.EggSyncAuthorityReady(); } catch {}
      }
      if (typeof window.refreshCoreFromFirebase === "function") {
        try { await window.refreshCoreFromFirebase(); } catch {}
      }

      const state = inventoryState();
      if (!force && state.recoveryMarkers?.[REPAIR_ID]) return state.recoveryMarkers[REPAIR_ID];
      const plan = ledgerPlan();
      if (!plan.ok) return plan;

      const marker = {
        appliedAt:Date.now(), baseline:plan.baseline,
        coreNet:plan.coreNet, manualNet:plan.manualNet,
        target:plan.target, priorPhysical:plan.current,
        coreEvents:plan.coreEvents, manualEvents:plan.manualEvents
      };
      saveTotal(
        plan.target,
        "Ledger rebuild from last exact inventory count",
        `Baseline ${plan.baseline.total} on ${plan.baseline.date}; surviving core entries net ${plan.coreNet >= 0 ? "+" : ""}${plan.coreNet}; manual inventory changes net ${plan.manualNet >= 0 ? "+" : ""}${plan.manualNet}.`,
        plan.target-plan.current,
        marker
      );
      console.log("✅ Core inventory v3 ledger rebuild complete", marker);
      return marker;
    } finally {
      repairing = false;
    }
  }

  // Verification fallback. Direct calls from the core Save/Delete functions are
  // preferred, but this catches an older cached core script without double-counting.
  document.addEventListener("click", event => {
    const button = event.target.closest?.("button");
    if (!button) return;
    const code = button.getAttribute("onclick") || "";
    if (!/\b(saveEggs|saveSale|deleteEntry)\s*\(/.test(code)) return;
    const beforeBalance = coreBalance();
    const beforePhysical = physical();
    setTimeout(() => {
      const delta = Math.round(coreBalance()-beforeBalance);
      if (!delta) return;
      const expected = Math.max(0,beforePhysical+delta);
      if (physical() !== expected) {
        saveTotal(expected,"Core history verification correction",`History changed ${delta >= 0 ? "+" : ""}${delta}; inventory was forced to the matching total.`,delta);
      }
    }, 25);
  }, true);

  window.applyCoreInventoryDelta = applyCoreDelta;
  window.CoreInventoryAuthorityV3 = {
    coreBalance,
    physical:() => physical(),
    ledgerPlan,
    applyCoreDelta,
    repairFromLastExactCount
  };

  const startRepair = () => setTimeout(() => repairFromLastExactCount(false), 1500);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startRepair, { once:true });
  else startRepair();

  console.log("✅ Core inventory authority v3 active — exact-count ledger rebuild + direct delta API");
})();
