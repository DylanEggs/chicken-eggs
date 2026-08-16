(() => {
  "use strict";
  if (window.__inventoryMissedEntryRepairV1) return;
  window.__inventoryMissedEntryRepairV1 = true;

  const ENTRIES_KEY = "chickenEggEntriesV102";
  const INVENTORY_KEY = "chickenEggInventoryV2";
  const MARKER = "20260816-missed-aug15-11-v1";
  const AUG15_ID = "ce3cc173-c539-492b-908a-143492a13255";
  const AUG16_ID = "f4fb04e3-10d7-422b-b7ef-6513d4b60930";
  const FROM_TOTAL = 110;
  const TARGET_TOTAL = 121;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const n = v => Number(v) || 0;
  const physical = s => Math.round(n(s?.dozens) * 12 + n(s?.packs18) * 18 + n(s?.loose));
  const pack = total => ({ dozens:0, packs18:Math.floor(total / 18), loose:total % 18 });

  function hasExpectedCoreHistory() {
    const rows = read(ENTRIES_KEY, []);
    if (!Array.isArray(rows)) return false;
    const aug15 = rows.find(e => String(e?.id || "") === AUG15_ID);
    const aug16 = rows.find(e => String(e?.id || "") === AUG16_ID);
    return !!(
      aug15 && aug15.type === "eggs" && String(aug15.date || "").slice(0,10) === "2026-08-15" && n(aug15.eggs) === 11 &&
      aug16 && aug16.type === "eggs" && String(aug16.date || "").slice(0,10) === "2026-08-16" && n(aug16.eggs) === 14
    );
  }

  function markAndSave(target, delta) {
    const state = read(INVENTORY_KEY, {});
    state.recoveryMarkers = state.recoveryMarkers && typeof state.recoveryMarkers === "object" ? state.recoveryMarkers : {};
    if (state.recoveryMarkers[MARKER]) return false;

    if (delta) {
      Object.assign(state, pack(target));
      state.adjustments = Array.isArray(state.adjustments) ? state.adjustments : [];
      state.adjustments.unshift({
        id:`repair-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        date:"2026-08-16",
        at:Date.now(),
        delta,
        reason:"Recovered missed Aug 15 egg collection",
        details:"The Aug 15 backdated 11-egg collection and Aug 16 14-egg collection were both saved while physical inventory remained at 96. The prior recovery reached 110, so this one-time correction restores the missed Aug 15 +11 only.",
        totalAfter:target,
        authority:"inventory-missed-entry-repair-v1"
      });
      state.adjustments = state.adjustments.slice(0,100);
    }

    state.recoveryMarkers[MARKER] = {
      appliedAt:Date.now(),
      aug15EntryId:AUG15_ID,
      aug16EntryId:AUG16_ID,
      from:physical(state) - delta,
      target,
      delta
    };
    state.updatedAt = Date.now();
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("farm-integrity-synced", {
      detail:{ source:"inventory-missed-entry-repair-v1", physical:target, delta, at:Date.now() }
    }));
    if (typeof window.syncFarmNow === "function") void Promise.resolve(window.syncFarmNow()).catch(()=>{});
    return true;
  }

  async function run() {
    if (window.EggSyncAuthorityReady) {
      try { await window.EggSyncAuthorityReady(); } catch {}
    }
    if (typeof window.refreshCoreFromFirebase === "function") {
      try { await window.refreshCoreFromFirebase(); } catch {}
    }

    if (!hasExpectedCoreHistory()) {
      console.warn("Missed-entry repair skipped: expected Aug 15/Aug 16 core entries were not both present.");
      return;
    }

    const state = read(INVENTORY_KEY, {});
    const markers = state.recoveryMarkers && typeof state.recoveryMarkers === "object" ? state.recoveryMarkers : {};
    if (markers[MARKER]) return;

    const current = physical(state);
    if (current === FROM_TOTAL) {
      markAndSave(TARGET_TOTAL, 11);
      console.log("✅ One-time missed Aug 15 inventory repair applied: 110 -> 121");
      return;
    }
    if (current === TARGET_TOTAL) {
      markAndSave(TARGET_TOTAL, 0);
      console.log("✅ Missed Aug 15 inventory repair already reflected at 121; marker recorded only");
      return;
    }

    console.warn(`Missed-entry repair did not change inventory because current physical total is ${current}, not ${FROM_TOTAL} or ${TARGET_TOTAL}.`);
  }

  const start = () => setTimeout(run, 1800);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
