(() => {
  "use strict";
  if (window.__coreInventoryAuthorityV2) return;
  window.__coreInventoryAuthorityV2 = true;
  window.__coreInventoryEventAuthorityV2 = true;

  const ENTRIES_KEY = "chickenEggEntriesV102";
  const INVENTORY_KEY = "chickenEggInventoryV2";
  const REPAIR_ID = "20260816-confirmed-96-baseline-v1";
  const BASELINE_AT = 1786907807786;
  const BASELINE_TOTAL = 96;
  let repairing = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function localDate() {
    const d = new Date();
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
    const s = read(INVENTORY_KEY, {});
    return {
      version:Math.max(3,n(s.version)),
      dozens:Math.max(0,n(s.dozens)),
      packs18:Math.max(0,n(s.packs18)),
      loose:Math.max(0,n(s.loose)),
      adjustments:Array.isArray(s.adjustments) ? s.adjustments : [],
      recoveryMarkers:s.recoveryMarkers && typeof s.recoveryMarkers === "object" ? s.recoveryMarkers : {},
      ...s
    };
  }
  function physical(s = inventoryState()) {
    return Math.max(0, Math.round(n(s.dozens)*12 + n(s.packs18)*18 + n(s.loose)));
  }
  function pack(total) {
    total = Math.max(0, Math.round(n(total)));
    return { dozens:0, packs18:Math.floor(total/18), loose:total%18 };
  }
  function saveInventoryTotal(target, reason, details, sourceDelta = null, marker = null) {
    const s = inventoryState();
    const before = physical(s);
    target = Math.max(0, Math.round(n(target)));
    if (before === target && !marker) return false;

    Object.assign(s, pack(target));
    s.version = Math.max(3,n(s.version));
    s.adjustments = Array.isArray(s.adjustments) ? s.adjustments : [];
    if (before !== target) {
      s.adjustments.unshift({
        id:`corev2-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        date:localDate(),
        at:Date.now(),
        delta:target-before,
        reason,
        details:details || "Authoritative core-history inventory reconciliation",
        totalAfter:target,
        authority:"core-inventory-v2",
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
      detail:{ source:"core-inventory-authority-v2", physical:target, delta:target-before, at:Date.now() }
    }));
    if (typeof window.syncFarmNow === "function") void Promise.resolve(window.syncFarmNow()).catch(()=>{});
    console.log(`✅ Core inventory v2 set physical inventory ${before} -> ${target} (${reason})`);
    return true;
  }

  function actionName(code) {
    if (/\bsaveEggs\s*\(/.test(code)) return "Egg collection";
    if (/\bsaveSale\s*\(/.test(code)) return "Egg sale";
    if (/\bdeleteEntry\s*\(/.test(code)) return "History entry correction";
    return "";
  }

  document.addEventListener("click", event => {
    const button = event.target.closest?.("button");
    if (!button) return;
    const code = button.getAttribute("onclick") || "";
    const name = actionName(code);
    if (!name) return;

    const beforeBalance = coreBalance();
    const beforePhysical = physical();
    const started = Date.now();

    setTimeout(() => {
      const afterBalance = coreBalance();
      const coreDelta = Math.round(afterBalance - beforeBalance);
      if (!coreDelta) return;

      const expected = Math.max(0, beforePhysical + coreDelta);
      const current = physical();
      if (current !== expected) {
        saveInventoryTotal(
          expected,
          name,
          `Verified from core history change ${coreDelta >= 0 ? "+" : ""}${coreDelta} after user action at ${new Date(started).toLocaleTimeString()}`,
          coreDelta
        );
      } else {
        console.log(`✅ Core inventory v2 verified ${name}: history ${coreDelta >= 0 ? "+" : ""}${coreDelta}, physical already correct at ${current}`);
      }
    }, 0);
  }, true);

  async function repairFromConfirmedBaseline() {
    if (repairing) return;
    repairing = true;
    try {
      if (window.EggSyncAuthorityReady) {
        try { await window.EggSyncAuthorityReady(); } catch {}
      }
      if (typeof window.refreshCoreFromFirebase === "function") {
        try { await window.refreshCoreFromFirebase(); } catch {}
      }

      const state = inventoryState();
      if (state.recoveryMarkers?.[REPAIR_ID]) return;

      const replay = entries()
        .filter(e => n(e.createdAt) > BASELINE_AT)
        .map(e => ({
          id:String(e.id || ""),
          type:e.type,
          date:String(e.date || ""),
          createdAt:n(e.createdAt),
          delta:contribution(e)
        }))
        .filter(x => x.delta !== 0);

      const net = replay.reduce((sum,x) => sum + x.delta, 0);
      const target = Math.max(0, BASELINE_TOTAL + net);
      const marker = {
        appliedAt:Date.now(),
        baselineAt:BASELINE_AT,
        baselineTotal:BASELINE_TOTAL,
        replayNet:net,
        target,
        replay
      };

      saveInventoryTotal(
        target,
        "Verified recovery from 96-egg baseline",
        `Replayed ${replay.length} surviving core entr${replay.length===1?"y":"ies"} created after the confirmed 96-egg Firebase inventory timestamp; net ${net >= 0 ? "+" : ""}${net}.`,
        net,
        marker
      );

      console.log("✅ Core inventory v2 baseline recovery complete", marker);
    } finally {
      repairing = false;
    }
  }

  window.CoreInventoryAuthorityV2 = {
    coreBalance,
    physical,
    repairFromConfirmedBaseline,
    baseline:{ at:BASELINE_AT, total:BASELINE_TOTAL, id:REPAIR_ID }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(repairFromConfirmedBaseline, 1200), { once:true });
  } else {
    setTimeout(repairFromConfirmedBaseline, 1200);
  }

  console.log("✅ Core inventory authority v2 active — user core-history actions are reconciled exactly once");
})();
