(() => {
  "use strict";
  if (window.__FarmTwelvePackDefaultV1) return;
  window.__FarmTwelvePackDefaultV1 = true;

  const KEY = "chickenEggInventoryV2";
  const priorSetItem = Storage.prototype.setItem;
  const whole = v => Math.max(0, Math.round(Number(v) || 0));
  const rawState = () => window.InventorySystemV6?.state?.() || {};
  const rawTotal = s => whole(s?.dozens) * 12 + whole(s?.packs18) * 18 + whole(s?.loose);

  // Normal inventory activity preserves any manually designated 18-packs, then
  // fills everything else into 12-packs first with individual eggs as remainder.
  function packaged(raw = rawState(), preferredPacks18 = null) {
    const s = raw && typeof raw === "object" ? { ...raw } : {};
    const eggs = rawTotal(s);
    let packs18 = preferredPacks18 == null ? whole(s.packs18) : whole(preferredPacks18);
    packs18 = Math.min(packs18, Math.floor(eggs / 18));
    const after18 = Math.max(0, eggs - packs18 * 18);
    return {
      ...s,
      dozens: Math.floor(after18 / 12),
      packs18,
      loose: after18 % 12,
      remainder: after18 % 12,
      total: eggs
    };
  }

  // The visible state is the exact stored packaging. Manual inventory edits therefore
  // remain exactly as entered until the next normal collection/sale/adjustment.
  function displayState(raw = rawState()) {
    const s = raw && typeof raw === "object" ? raw : {};
    const loose = whole(s.loose);
    return {
      dozens: whole(s.dozens),
      packs18: whole(s.packs18),
      loose,
      remainder: loose,
      total: rawTotal(s)
    };
  }

  function packageText(raw = rawState(), includeTotal = true) {
    const s = displayState(raw);
    const parts = [
      `${s.dozens} 12-pack${s.dozens === 1 ? "" : "s"}`,
      `${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"}`,
      `${s.loose} individual egg${s.loose === 1 ? "" : "s"}`
    ];
    if (includeTotal) parts.push(`${s.total} eggs total`);
    return parts.join(" • ");
  }

  // InventorySystemV6 remains the only writer. This wrapper only transforms its
  // ordinary authorized inventory writes into the preferred 12-pack breakdown.
  // Verified remote/restore paths stay byte-exact and are never repacked here.
  Storage.prototype.setItem = function(key, value) {
    if (
      this === window.localStorage &&
      String(key) === KEY &&
      !window.__farmApplyingRemote &&
      !window.__inventoryRestoreV6 &&
      !window.__completeSafetyRestoreV3
    ) {
      try { value = JSON.stringify(packaged(JSON.parse(String(value)))); } catch {}
    }
    return priorSetItem.call(this, key, value);
  };

  let saving = false;
  let showHooked = false;

  function prepareEditor() {
    const overlay = document.getElementById("inv6Overlay");
    if (!overlay) return;
    const s = displayState();
    const dozens = document.getElementById("inv6Dozens");
    const packs = document.getElementById("inv6Packs");
    const loose = document.getElementById("inv6Loose");
    const dozenLabel = overlay.querySelector('label[for="inv6Dozens"]');
    const packLabel = overlay.querySelector('label[for="inv6Packs"]');
    const looseLabel = overlay.querySelector('label[for="inv6Loose"]');
    const title = overlay.querySelector("h3");
    const save = document.getElementById("inv6Save");

    if (title) title.textContent = "🥚 Set Exact Egg Inventory";
    if (dozenLabel) dozenLabel.textContent = "12-Packs";
    if (packLabel) packLabel.textContent = "18-Packs";
    if (looseLabel) looseLabel.textContent = "Individual Eggs";
    if (dozens) { dozens.value = s.dozens; dozens.readOnly = false; }
    if (packs) { packs.value = s.packs18; packs.readOnly = false; }
    if (loose) { loose.value = s.loose; loose.readOnly = false; }
    const looseWrap = loose?.closest("div");
    const dozenWrap = dozens?.closest("div");
    if (looseWrap) looseWrap.style.display = "";
    if (dozenWrap) dozenWrap.style.opacity = "1";
    if (save) save.textContent = "Save Exact Inventory";
    updatePreview();
  }

  function updatePreview() {
    const d = whole(document.getElementById("inv6Dozens")?.value);
    const p = whole(document.getElementById("inv6Packs")?.value);
    const l = whole(document.getElementById("inv6Loose")?.value);
    const out = document.getElementById("inv6DraftTotal");
    if (!out) return;
    out.dataset.invalid = "0";
    out.textContent = `${d} 12-pack${d === 1 ? "" : "s"} • ${p} 18-pack${p === 1 ? "" : "s"} • ${l} individual egg${l === 1 ? "" : "s"} • ${d*12+p*18+l} eggs total`;
  }

  async function saveManualExact(dozens, packs18, loose) {
    dozens = whole(dozens);
    packs18 = whole(packs18);
    loose = whole(loose);
    const api = window.InventorySystemV6;
    if (!api?.replaceFromRestore) throw new Error("Inventory authority is not ready.");

    const before = api.state?.() || {};
    const beforeTotal = rawTotal(before);
    const next = { ...before, dozens, packs18, loose, updatedAt:Date.now() };
    const afterTotal = rawTotal(next);
    const adjustments = Array.isArray(before.adjustments) ? before.adjustments.slice() : [];
    adjustments.unshift({
      id:`manual-inventory-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      date:new Date().toISOString().slice(0,10),
      at:Date.now(),
      delta:afterTotal-beforeTotal,
      reason:"Exact inventory count",
      details:`${dozens} 12-packs, ${packs18} 18-packs, ${loose} individual eggs`,
      totalAfter:afterTotal,
      cartonBreakdown:{dozens,packs18,loose},
      authority:"twelve-pack-default-v2"
    });
    next.adjustments = adjustments.slice(0,100);

    // replaceFromRestore uses InventorySystemV6's protected exact-write path and
    // synchronizes the existing inventory dataset without the normal repack step.
    await api.replaceFromRestore(next);
    const savedRaw = api.state?.() || next;
    const saved = displayState(savedRaw);
    if (saved.dozens !== dozens || saved.packs18 !== packs18 || saved.loose !== loose) {
      throw new Error("Exact manual inventory verification failed");
    }
    return { ...savedRaw, ...saved };
  }

  async function saveInventory() {
    if (saving) return;
    const d = whole(document.getElementById("inv6Dozens")?.value);
    const p = whole(document.getElementById("inv6Packs")?.value);
    const l = whole(document.getElementById("inv6Loose")?.value);
    const status = document.getElementById("inv6SaveStatus");
    const button = document.getElementById("inv6Save");
    saving = true;
    if (button) button.disabled = true;
    try {
      if (status) status.textContent = "Saving exact 12-pack, 18-pack and individual egg inventory…";
      const saved = await saveManualExact(d, p, l);
      if (status) status.textContent = `Saved: ${packageText(saved)}. New inventory activity will default back to 12-packs.`;
      queuePatch();
      setTimeout(() => document.getElementById("inv6Overlay")?.classList.remove("show"), 850);
    } catch (error) {
      if (status) status.textContent = `Could not verify inventory. ${String(error?.message || error)}`;
    } finally {
      saving = false;
      if (button) button.disabled = false;
    }
  }

  function patchVisible() {
    const text = packageText();
    const current = document.getElementById("inv6Current");
    if (current) current.textContent = text;

    const inventoryScreen = document.getElementById("farm2Inventory");
    if (inventoryScreen) {
      const h3 = [...inventoryScreen.querySelectorAll("h3")].find(x => /Exact Carton Inventory|12-Pack & 18-Pack Inventory|Egg Inventory/i.test(x.textContent || ""));
      if (h3) h3.textContent = "📦 Egg Inventory";
      const open = document.getElementById("inv6Open");
      if (open) open.textContent = "Edit Inventory";
      const add = document.getElementById("inv6Add");
      if (add) add.textContent = "Add Eggs";
      [...inventoryScreen.querySelectorAll(".farm2-subtle")].forEach(el => {
        if (/Cartons stay exactly as you enter them|repack|loose|12-packs fill automatically|18-packs appear only|Manually set 12-packs/i.test(el.textContent || "")) {
          el.textContent = "Manually set 12-packs, 18-packs, and individual eggs. After the next normal inventory change, available eggs default back into 12-packs while your manual 18-packs stay designated.";
        }
      });
    }

    const dash = document.getElementById("inventoryDashboardCard");
    if (dash) {
      const subtle = dash.querySelector(".farm2-subtle");
      if (subtle) subtle.textContent = text;
    }
    const hub = document.getElementById("farm2HubSummary");
    if (hub) {
      const card = [...hub.querySelectorAll(".farm2-card")].find(c => /sellable inventory/i.test(c.querySelector(".farm2-kicker")?.textContent || c.textContent || ""));
      const subtle = card?.querySelector(".farm2-subtle");
      if (subtle) subtle.textContent = text;
    }
    const today = document.getElementById("farm2TodayCard");
    if (today) [...today.querySelectorAll(".farm2-subtle")].forEach(el => {
      if ((el.textContent || "").trim().startsWith("Inventory:")) el.textContent = `Inventory: ${text}`;
    });
  }

  function queuePatch() {
    setTimeout(patchVisible, 0);
    setTimeout(patchVisible, 80);
    setTimeout(patchVisible, 220);
  }

  document.addEventListener("click", event => {
    const btn = event.target.closest?.("button");
    if (!btn) return;
    if (btn.id === "inv6Open") {
      setTimeout(prepareEditor, 0);
      return;
    }
    if (btn.id === "inv6Save") {
      event.preventDefault();
      event.stopImmediatePropagation();
      void saveInventory();
    }
  }, true);

  document.addEventListener("input", event => {
    if (["inv6Dozens","inv6Packs","inv6Loose"].includes(event.target?.id)) updatePreview();
  }, true);

  function hookShowScreen() {
    if (showHooked) return;
    if (typeof window.showScreen !== "function") { setTimeout(hookShowScreen, 120); return; }
    const original = window.showScreen;
    const wrapped = function() {
      const result = original.apply(this, arguments);
      queuePatch();
      return result;
    };
    wrapped.__twelvePackDefaultV2 = true;
    wrapped.__twelvePackOriginal = original;
    window.showScreen = wrapped;
    showHooked = true;
  }

  function start() {
    setTimeout(patchVisible, 140);
    setTimeout(patchVisible, 500);
    setTimeout(hookShowScreen, 300);
    window.addEventListener("inventory-authority-changed", queuePatch);
    window.addEventListener("farm-integrity-synced", queuePatch);
    window.addEventListener("farm-data-synced", queuePatch);
    window.addEventListener("core-data-synced", queuePatch);
    window.addEventListener("storage", e => { if (e.key === KEY) queuePatch(); });
  }

  window.FarmTwelvePackDefaultV1 = {
    version:2,
    packaged,
    normalized:packaged,
    displayState,
    packageText,
    saveManualExact,
    refresh:patchVisible
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
