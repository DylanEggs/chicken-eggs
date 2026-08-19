(() => {
  "use strict";
  if (window.__FarmTwelvePackDefaultV1) return;
  window.__FarmTwelvePackDefaultV1 = true;

  const whole = v => Math.max(0, Math.round(Number(v) || 0));
  const rawState = () => window.InventorySystemV6?.state?.() || {};
  const rawTotal = s => whole(s?.dozens) * 12 + whole(s?.packs18) * 18 + whole(s?.loose);

  function packaged(raw = rawState(), preferredPacks18 = null) {
    const eggs = rawTotal(raw);
    let packs18 = preferredPacks18 == null ? whole(raw?.packs18) : whole(preferredPacks18);
    packs18 = Math.min(packs18, Math.floor(eggs / 18));
    const after18 = Math.max(0, eggs - packs18 * 18);
    return {
      dozens: Math.floor(after18 / 12),
      packs18,
      remainder: after18 % 12,
      total: eggs
    };
  }

  function packageText(raw = rawState()) {
    const s = packaged(raw);
    const parts = [`${s.dozens} 12-pack${s.dozens === 1 ? "" : "s"}`];
    if (s.packs18 > 0) parts.push(`${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"}`);
    parts.push(`${s.total} eggs total`);
    return parts.join(" • ");
  }

  let editorTotal = 0;
  let saving = false;
  let showHooked = false;

  function prepareEditor() {
    const overlay = document.getElementById("inv6Overlay");
    if (!overlay) return;
    const s = packaged();
    editorTotal = s.total;
    const dozens = document.getElementById("inv6Dozens");
    const packs = document.getElementById("inv6Packs");
    const loose = document.getElementById("inv6Loose");
    const dozenLabel = overlay.querySelector('label[for="inv6Dozens"]');
    const packLabel = overlay.querySelector('label[for="inv6Packs"]');
    const title = overlay.querySelector("h3");
    const save = document.getElementById("inv6Save");
    if (title) title.textContent = "🥚 Set Carton Packaging";
    if (dozenLabel) dozenLabel.textContent = "12-Packs (automatic)";
    if (packLabel) packLabel.textContent = "18-Packs (manual only)";
    if (dozens) { dozens.value = s.dozens; dozens.readOnly = true; }
    if (packs) packs.value = s.packs18;
    if (loose) loose.value = s.remainder;
    const looseWrap = loose?.closest("div");
    if (looseWrap) looseWrap.style.display = "none";
    if (save) save.textContent = "Save Packaging";
    updatePreview();
  }

  function updatePreview() {
    const packs = document.getElementById("inv6Packs");
    const dozens = document.getElementById("inv6Dozens");
    const loose = document.getElementById("inv6Loose");
    const out = document.getElementById("inv6DraftTotal");
    if (!packs || !dozens || !loose || !out) return;
    const requested = whole(packs.value);
    const max = Math.floor(editorTotal / 18);
    if (requested > max) {
      out.textContent = `Only ${max} full 18-pack${max === 1 ? "" : "s"} fit inside ${editorTotal} total eggs.`;
      out.dataset.invalid = "1";
      return;
    }
    const s = packaged({dozens:0,packs18:0,loose:editorTotal}, requested);
    dozens.value = s.dozens;
    loose.value = s.remainder;
    out.dataset.invalid = "0";
    out.textContent = `${s.dozens} 12-pack${s.dozens === 1 ? "" : "s"}${s.packs18 ? ` • ${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"}` : ""} • ${s.total} eggs total`;
  }

  async function savePackaging() {
    if (saving) return;
    const requested = whole(document.getElementById("inv6Packs")?.value);
    const max = Math.floor(editorTotal / 18);
    const status = document.getElementById("inv6SaveStatus");
    const button = document.getElementById("inv6Save");
    if (requested > max) {
      if (status) status.textContent = `Choose ${max} or fewer 18-packs. The total egg count will not be changed.`;
      return;
    }
    const s = packaged({dozens:0,packs18:0,loose:editorTotal}, requested);
    saving = true;
    if (button) button.disabled = true;
    try {
      if (status) status.textContent = "Saving packaging without changing the total egg count…";
      await window.InventorySystemV6?.commitExact?.(s.dozens, s.packs18, s.remainder);
      const check = packaged();
      if (check.total !== editorTotal || check.packs18 !== requested) throw new Error("Packaging verification failed");
      if (status) status.textContent = `Saved: ${packageText()}.`;
      queuePatch();
      setTimeout(() => document.getElementById("inv6Overlay")?.classList.remove("show"), 650);
    } catch (error) {
      if (status) status.textContent = `Could not verify packaging. ${String(error?.message || error)}`;
    } finally {
      saving = false;
      if (button) button.disabled = false;
    }
  }

  function patchVisible() {
    const s = packaged();
    const text = packageText();
    const current = document.getElementById("inv6Current");
    if (current) current.textContent = text;

    const inventoryScreen = document.getElementById("farm2Inventory");
    if (inventoryScreen) {
      const h3 = [...inventoryScreen.querySelectorAll("h3")].find(x => /Exact Carton Inventory|12-Pack & 18-Pack Inventory/i.test(x.textContent || ""));
      if (h3) h3.textContent = "📦 12-Pack & 18-Pack Inventory";
      const open = document.getElementById("inv6Open");
      if (open) open.textContent = "Set 18-Pack Quantity";
      const add = document.getElementById("inv6Add");
      if (add) add.textContent = "Add Eggs";
      [...inventoryScreen.querySelectorAll(".farm2-subtle")].forEach(el => {
        if (/Cartons stay exactly as you enter them|repack|loose/i.test(el.textContent || "")) {
          el.textContent = "12-packs fill automatically whenever enough eggs are available. 18-packs appear only when you set them manually.";
        }
      });
    }

    const loose = document.getElementById("inv6Loose");
    const looseWrap = loose?.closest("div");
    if (looseWrap) looseWrap.style.display = "none";

    const dash = document.getElementById("inventoryDashboardCard");
    if (dash) {
      const subtle = dash.querySelector(".farm2-subtle");
      if (subtle) subtle.textContent = text;
    }

    const hub = document.getElementById("farm2HubSummary");
    if (hub) {
      const card = [...hub.querySelectorAll(".farm2-card")].find(c => /sellable inventory/i.test(c.querySelector(".farm2-kicker")?.textContent || c.textContent || ""));
      if (card) {
        const subtle = card.querySelector(".farm2-subtle");
        if (subtle) subtle.textContent = text;
      }
    }

    const today = document.getElementById("farm2TodayCard");
    if (today) [...today.querySelectorAll(".farm2-subtle")].forEach(el => {
      if ((el.textContent || "").trim().startsWith("Inventory:")) el.textContent = `Inventory: ${text}`;
    });

    const dozenAuto = document.getElementById("inv6Dozens");
    if (dozenAuto && document.getElementById("inv6Overlay")?.classList.contains("show")) dozenAuto.value = s.dozens;
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
      editorTotal = rawTotal(rawState());
      setTimeout(prepareEditor, 0);
      return;
    }
    if (btn.id === "inv6Save") {
      event.preventDefault();
      event.stopImmediatePropagation();
      void savePackaging();
    }
  }, true);

  document.addEventListener("input", event => {
    if (event.target?.id === "inv6Packs") updatePreview();
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
    wrapped.__twelvePackDefaultV1 = true;
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
    window.addEventListener("storage", e => { if (e.key === "chickenEggInventoryV2") queuePatch(); });
  }

  window.FarmTwelvePackDefaultV1 = { version:1, packaged, packageText, refresh:patchVisible };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
