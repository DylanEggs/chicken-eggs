(() => {
  "use strict";
  if (window.__StagingTwelvePackDefaultV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingTwelvePackDefaultV1 = true;

  const KEY = "chickenEggInventoryV2";
  const priorSetItem = Storage.prototype.setItem;
  const whole = v => Math.max(0, Math.round(Number(v) || 0));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const total = s => whole(s?.dozens) * 12 + whole(s?.packs18) * 18 + whole(s?.loose);

  function normalized(raw = {}, preferredPacks18 = null) {
    const s = raw && typeof raw === "object" ? { ...raw } : {};
    const eggs = total(s);
    let packs18 = preferredPacks18 == null ? whole(s.packs18) : whole(preferredPacks18);
    packs18 = Math.min(packs18, Math.floor(eggs / 18));
    const after18 = Math.max(0, eggs - packs18 * 18);
    s.dozens = Math.floor(after18 / 12);
    s.packs18 = packs18;
    s.loose = after18 % 12; // hidden remainder only; never shown as a package type.
    return s;
  }

  function displayState(raw = read()) {
    const s = normalized(raw);
    return { dozens:whole(s.dozens), packs18:whole(s.packs18), remainder:whole(s.loose), total:total(s) };
  }
  function packageText(raw = read(), includeTotal = true) {
    const s = displayState(raw);
    const parts = [`${s.dozens} 12-pack${s.dozens === 1 ? "" : "s"}`];
    if (s.packs18 > 0) parts.push(`${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"}`);
    if (includeTotal) parts.push(`${s.total} eggs total`);
    return parts.join(" • ");
  }

  // Staging-only packaging rule: normal inventory writes auto-fill 12-packs while
  // keeping manually-entered 18-packs. Restore/remote writes remain byte-exact so
  // the backup and sandbox restoration tests retain their safety guarantees.
  Storage.prototype.setItem = function(key, value) {
    if (
      this === window.localStorage &&
      String(key) === KEY &&
      !window.__farmApplyingRemote &&
      !window.__inventoryRestoreV6 &&
      !window.__completeSafetyRestoreV3 &&
      !window.__stagingTwelvePackBypass
    ) {
      try {
        const parsed = JSON.parse(String(value));
        value = JSON.stringify(normalized(parsed));
      } catch {}
    }
    return priorSetItem.call(this, key, value);
  };

  let editorTotal = 0;
  let saving = false;

  function prepareEditor() {
    const overlay = document.getElementById("inv6Overlay");
    if (!overlay) return;
    const s = displayState();
    editorTotal = s.total;
    const dozens = document.getElementById("inv6Dozens");
    const packs = document.getElementById("inv6Packs");
    const loose = document.getElementById("inv6Loose");
    const dozensWrap = dozens?.closest("div");
    const looseWrap = loose?.closest("div");
    const dozenLabel = overlay.querySelector('label[for="inv6Dozens"]');
    const packLabel = overlay.querySelector('label[for="inv6Packs"]');
    const title = overlay.querySelector("h3");
    if (title) title.textContent = "🥚 Set Carton Packaging";
    if (dozenLabel) dozenLabel.textContent = "12-Packs (automatic)";
    if (packLabel) packLabel.textContent = "18-Packs (manual only)";
    if (dozens) { dozens.value = s.dozens; dozens.readOnly = true; }
    if (packs) packs.value = s.packs18;
    if (loose) loose.value = s.remainder;
    if (looseWrap) looseWrap.style.display = "none";
    if (dozensWrap) dozensWrap.style.opacity = ".78";
    updateEditorPreview();
  }

  function updateEditorPreview() {
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
    const s = normalized({dozens:0,packs18:0,loose:editorTotal}, requested);
    dozens.value = whole(s.dozens);
    loose.value = whole(s.loose);
    out.dataset.invalid = "0";
    out.textContent = `${packageText(s)} • total stays ${editorTotal}`;
  }

  async function savePackaging() {
    if (saving) return;
    const packsEl = document.getElementById("inv6Packs");
    const status = document.getElementById("inv6SaveStatus");
    const button = document.getElementById("inv6Save");
    const requested = whole(packsEl?.value);
    const max = Math.floor(editorTotal / 18);
    if (requested > max) {
      if (status) status.textContent = `Choose ${max} or fewer 18-packs. The total egg count will not be changed.`;
      return;
    }
    const s = normalized({dozens:0,packs18:0,loose:editorTotal}, requested);
    saving = true;
    if (button) button.disabled = true;
    try {
      if (status) status.textContent = "Saving packaging without changing the total egg count…";
      await window.InventorySystemV6?.commitExact?.(s.dozens, s.packs18, s.loose);
      const check = displayState();
      if (check.total !== editorTotal || check.packs18 !== requested) throw new Error("Packaging verification failed");
      if (status) status.textContent = `Saved: ${packageText(check)}.`;
      patchVisible();
      setTimeout(() => document.getElementById("inv6Overlay")?.classList.remove("show"), 650);
    } catch (error) {
      if (status) status.textContent = `Could not verify packaging. ${String(error?.message || error)}`;
    } finally {
      saving = false;
      if (button) button.disabled = false;
    }
  }

  function patchVisible() {
    const s = displayState();
    const current = document.getElementById("inv6Current");
    if (current) current.textContent = packageText(s);

    const inventoryScreen = document.getElementById("farm2Inventory");
    if (inventoryScreen) {
      const h3 = [...inventoryScreen.querySelectorAll("h3")].find(x => /Exact Carton Inventory/i.test(x.textContent || ""));
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

    const dash = document.getElementById("inventoryDashboardCard");
    if (dash) {
      const subtle = dash.querySelector(".farm2-subtle");
      if (subtle) subtle.textContent = packageText(s);
    }

    const hub = document.getElementById("farm2HubSummary");
    if (hub) {
      const card = [...hub.querySelectorAll(".farm2-card")].find(c => /sellable inventory/i.test(c.querySelector(".farm2-kicker")?.textContent || c.textContent || ""));
      if (card) {
        const subtle = card.querySelector(".farm2-subtle");
        if (subtle) subtle.textContent = packageText(s);
      }
    }

    const today = document.getElementById("farm2TodayCard");
    if (today) [...today.querySelectorAll(".farm2-subtle")].forEach(el => {
      if ((el.textContent || "").trim().startsWith("Inventory:")) el.textContent = `Inventory: ${packageText(s)}`;
    });
  }

  document.addEventListener("click", event => {
    const btn = event.target.closest?.("button");
    if (!btn) return;
    if (btn.id === "inv6Open") {
      editorTotal = total(read());
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
    if (event.target?.id === "inv6Packs") updateEditorPreview();
  }, true);

  function start() {
    setTimeout(patchVisible, 140);
    setTimeout(patchVisible, 500);
    window.addEventListener("inventory-authority-changed", () => setTimeout(patchVisible, 0));
    window.addEventListener("farm-integrity-synced", () => setTimeout(patchVisible, 0));
    window.addEventListener("farm-data-synced", e => { if (!e.detail?.key || e.detail.key === KEY) setTimeout(patchVisible, 0); });
    window.addEventListener("core-data-synced", () => setTimeout(patchVisible, 0));
  }

  window.StagingTwelvePackDefaultV1 = {
    version:1,
    normalized,
    displayState,
    packageText,
    total,
    setManual18(totalEggs, packs18) { return normalized({dozens:0,packs18:0,loose:whole(totalEggs)}, packs18); },
    refresh:patchVisible
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
  console.log("📦 STAGING 12-pack-default inventory layer active — loose remainder hidden, 18-packs manual only");
})();
