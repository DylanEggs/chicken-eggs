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
  function num(v) { return Number(v) || 0; }
  function whole(v) { return Math.max(0, Math.round(num(v))); }
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
    if (e.type === "eggs") return whole(e.eggs);
    if (e.type === "sale") return -(whole(e.dozenSold)*12 + whole(e.packSold ?? e.packs18Sold)*18);
    return 0;
  }
  function coreBalance() {
    return entries().reduce((sum,e) => sum + contribution(e), 0);
  }
  function inventoryState() {
    const raw = read(INVENTORY_KEY, {});
    return {
      ...raw,
      version:Math.max(4,num(raw.version)),
      dozens:whole(raw.dozens),
      packs18:whole(raw.packs18),
      loose:whole(raw.loose),
      adjustments:Array.isArray(raw.adjustments) ? raw.adjustments : [],
      recoveryMarkers:raw.recoveryMarkers && typeof raw.recoveryMarkers === "object" ? raw.recoveryMarkers : {}
    };
  }
  function physical(s = inventoryState()) {
    return whole(s.dozens)*12 + whole(s.packs18)*18 + whole(s.loose);
  }

  function addLoose(s, qty) {
    s.loose = whole(s.loose) + whole(qty);
  }

  function removeGeneric(s, qty) {
    let remaining = Math.min(whole(qty), physical(s));
    const requested = remaining;

    const looseTake = Math.min(whole(s.loose), remaining);
    s.loose = whole(s.loose) - looseTake;
    remaining -= looseTake;

    while (remaining > 0 && whole(s.dozens) > 0) {
      s.dozens = whole(s.dozens) - 1;
      const take = Math.min(12, remaining);
      remaining -= take;
      s.loose = whole(s.loose) + (12 - take);
    }

    while (remaining > 0 && whole(s.packs18) > 0) {
      s.packs18 = whole(s.packs18) - 1;
      const take = Math.min(18, remaining);
      remaining -= take;
      s.loose = whole(s.loose) + (18 - take);
    }

    if (remaining > 0) {
      const take = Math.min(whole(s.loose), remaining);
      s.loose = whole(s.loose) - take;
      remaining -= take;
    }
    return requested - remaining;
  }

  function removeDozenCartons(s, count) {
    count = whole(count);
    const cartons = Math.min(whole(s.dozens), count);
    s.dozens = whole(s.dozens) - cartons;
    const missing = count - cartons;
    if (missing > 0) removeGeneric(s, missing * 12);
  }

  function remove18Packs(s, count) {
    count = whole(count);
    const packs = Math.min(whole(s.packs18), count);
    s.packs18 = whole(s.packs18) - packs;
    const missing = count - packs;
    if (missing > 0) removeGeneric(s, missing * 18);
  }

  function adjustToTotalPreservingCartons(s, target) {
    target = whole(target);
    const current = physical(s);
    if (target > current) addLoose(s, target - current);
    else if (target < current) removeGeneric(s, current - target);
    return s;
  }

  function saveState(s, before, reason, details, sourceDelta = null, marker = null) {
    const target = physical(s);
    s.version = Math.max(4,num(s.version));
    s.adjustments = Array.isArray(s.adjustments) ? s.adjustments : [];
    s.recoveryMarkers = s.recoveryMarkers && typeof s.recoveryMarkers === "object" ? s.recoveryMarkers : {};

    if (before !== target) {
      s.adjustments.unshift({
        id:`corev4-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        date:localDate(), at:Date.now(), delta:target-before,
        reason, details:details || "Authoritative inventory reconciliation",
        totalAfter:target, authority:"core-inventory-v4",
        sourceDelta:Number.isFinite(sourceDelta) ? sourceDelta : target-before,
        cartonBreakdown:{dozens:whole(s.dozens),packs18:whole(s.packs18),loose:whole(s.loose)}
      });
      s.adjustments = s.adjustments.slice(0,100);
    }
    if (marker) s.recoveryMarkers[REPAIR_ID] = marker;
    s.updatedAt = Date.now();
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("farm-integrity-synced", {
      detail:{ source:"core-inventory-authority-v4", physical:target, delta:target-before, at:Date.now() }
    }));
    if (typeof window.syncFarmNow === "function") void Promise.resolve(window.syncFarmNow()).catch(()=>{});
    console.log(`✅ Core inventory v4 updated ${before} -> ${target}: ${reason}`);
    return { before, target, changed:before !== target, state:s };
  }

  function saveTotal(target, reason, details, sourceDelta = null, marker = null) {
    const s = inventoryState();
    const before = physical(s);
    adjustToTotalPreservingCartons(s, target);
    return saveState(s, before, reason, details, sourceDelta, marker);
  }

  function applyCoreDelta(delta, reason = "Core history update", details = "") {
    delta = Math.round(num(delta));
    if (!delta) return { before:physical(), target:physical(), changed:false };
    const s = inventoryState();
    const before = physical(s);
    if (delta > 0) addLoose(s, delta);
    else removeGeneric(s, -delta);
    return saveState(s, before, reason, details || `Direct core history delta ${delta >= 0 ? "+" : ""}${delta}`, delta);
  }

  function rowMap(rows) {
    const map = new Map();
    for (const e of Array.isArray(rows) ? rows : []) {
      if (!e || !e.id || !["eggs","sale"].includes(e.type)) continue;
      map.set(String(e.id), e);
    }
    return map;
  }

  function applyEntryDiff(beforeRows, afterRows, reason = "Core history update") {
    const beforeMap = rowMap(beforeRows);
    const afterMap = rowMap(afterRows);
    const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    const s = inventoryState();
    const beforePhysical = physical(s);
    const notes = [];

    for (const id of ids) {
      const b = beforeMap.get(id) || null;
      const a = afterMap.get(id) || null;

      const bEggs = b?.type === "eggs" ? whole(b.eggs) : 0;
      const aEggs = a?.type === "eggs" ? whole(a.eggs) : 0;
      const eggDelta = aEggs - bEggs;
      if (eggDelta > 0) {
        addLoose(s, eggDelta);
        notes.push(`${id}: +${eggDelta} collected to loose`);
      } else if (eggDelta < 0) {
        removeGeneric(s, -eggDelta);
        notes.push(`${id}: ${eggDelta} collection correction`);
      }

      const bDozen = b?.type === "sale" ? whole(b.dozenSold) : 0;
      const aDozen = a?.type === "sale" ? whole(a.dozenSold) : 0;
      const dozenDelta = aDozen - bDozen;
      if (dozenDelta > 0) {
        removeDozenCartons(s, dozenDelta);
        notes.push(`${id}: sold ${dozenDelta} dozen carton${dozenDelta===1?"":"s"}`);
      } else if (dozenDelta < 0) {
        s.dozens = whole(s.dozens) + (-dozenDelta);
        notes.push(`${id}: restored ${-dozenDelta} dozen carton${dozenDelta===-1?"":"s"}`);
      }

      const bPacks = b?.type === "sale" ? whole(b.packSold ?? b.packs18Sold) : 0;
      const aPacks = a?.type === "sale" ? whole(a.packSold ?? a.packs18Sold) : 0;
      const packDelta = aPacks - bPacks;
      if (packDelta > 0) {
        remove18Packs(s, packDelta);
        notes.push(`${id}: sold ${packDelta} 18-pack${packDelta===1?"":"s"}`);
      } else if (packDelta < 0) {
        s.packs18 = whole(s.packs18) + (-packDelta);
        notes.push(`${id}: restored ${-packDelta} 18-pack${packDelta===-1?"":"s"}`);
      }
    }

    const afterPhysical = physical(s);
    const delta = afterPhysical - beforePhysical;
    if (!delta && !notes.length) return {before:beforePhysical,target:afterPhysical,changed:false,state:s};
    if (!delta) {
      // Shape-only history edits are rare; persist them without a fake egg delta.
      s.version = Math.max(4,num(s.version));
      s.updatedAt = Date.now();
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(s));
      if (typeof window.syncFarmNow === "function") void Promise.resolve(window.syncFarmNow()).catch(()=>{});
      return {before:beforePhysical,target:afterPhysical,changed:true,state:s};
    }
    return saveState(s, beforePhysical, reason, notes.join("; "), delta);
  }

  function latestExactBaseline(state = inventoryState()) {
    return state.adjustments
      .filter(a => a && /^Exact inventory count$/i.test(String(a.reason||"")) && num(a.at) > 0 && Number.isFinite(Number(a.totalAfter)))
      .sort((a,b) => num(b.at)-num(a.at))[0] || null;
  }
  function isManualAdjustment(a) {
    const reason = String(a?.reason || "");
    return /^(Manual inventory add|Used at home|Gave to family|Broken\s*\/\s*damaged)$/i.test(reason);
  }
  function ledgerPlan() {
    const state = inventoryState();
    const baseline = latestExactBaseline(state);
    if (!baseline) return { ok:false, reason:"No exact inventory baseline is available." };

    const baselineAt = num(baseline.at);
    const baselineDate = localDate(baselineAt);
    const coreEvents = entries()
      .filter(e => num(e.createdAt) > baselineAt && String(e.date || "") >= baselineDate)
      .map(e => ({
        id:String(e.id||""), type:e.type, date:String(e.date||""),
        createdAt:num(e.createdAt), updatedAt:num(e.updatedAt), delta:contribution(e)
      }))
      .filter(e => e.delta !== 0)
      .sort((a,b)=>a.createdAt-b.createdAt);

    const manualEvents = state.adjustments
      .filter(a => num(a.at) > baselineAt && isManualAdjustment(a))
      .map(a => ({ id:String(a.id||""), date:String(a.date||""), at:num(a.at), reason:String(a.reason||""), delta:num(a.delta) }))
      .filter(a => a.delta !== 0)
      .sort((a,b)=>a.at-b.at);

    const coreNet = coreEvents.reduce((sum,e)=>sum+e.delta,0);
    const manualNet = manualEvents.reduce((sum,e)=>sum+e.delta,0);
    const baselineTotal = whole(baseline.totalAfter);
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
        `Baseline ${plan.baseline.total} on ${plan.baseline.date}; surviving core entries net ${plan.coreNet >= 0 ? "+" : ""}${plan.coreNet}; manual inventory changes net ${plan.manualNet >= 0 ? "+" : ""}${plan.manualNet}. Carton types were preserved where possible.`,
        plan.target-plan.current,
        marker
      );
      console.log("✅ Core inventory v4 ledger rebuild complete", marker);
      return marker;
    } finally {
      repairing = false;
    }
  }

  // Verification fallback checks the egg total only. If it has to correct a
  // mismatch, it now changes loose/open-carton eggs instead of repacking all eggs.
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
        saveTotal(expected,"Core history verification correction",`History changed ${delta >= 0 ? "+" : ""}${delta}; inventory total was corrected without repacking intact cartons.`,delta);
      }
    }, 25);
  }, true);

  window.applyCoreInventoryDelta = applyCoreDelta;
  window.applyCoreInventoryEntryDiff = applyEntryDiff;
  window.CoreInventoryAuthorityV3 = {
    coreBalance,
    physical:() => physical(),
    ledgerPlan,
    applyCoreDelta,
    applyEntryDiff,
    repairFromLastExactCount
  };

  const startRepair = () => setTimeout(() => repairFromLastExactCount(false), 1500);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startRepair, { once:true });
  else startRepair();

  console.log("✅ Core inventory authority v4 active — carton-preserving entry math");
})();
