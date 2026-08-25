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

  // Normal inventory activity keeps the preferred 12-pack behavior. Any existing
  // manually-designated 18-packs stay intact; everything else fills 12-packs first.
  function normalized(raw = {}, preferredPacks18 = null) {
    const s = raw && typeof raw === "object" ? { ...raw } : {};
    const eggs = total(s);
    let packs18 = preferredPacks18 == null ? whole(s.packs18) : whole(preferredPacks18);
    packs18 = Math.min(packs18, Math.floor(eggs / 18));
    const after18 = Math.max(0, eggs - packs18 * 18);
    s.dozens = Math.floor(after18 / 12);
    s.packs18 = packs18;
    s.loose = after18 % 12;
    return s;
  }

  // Visible state is the exact stored packaging. This matters immediately after a
  // manual inventory count: 12-packs, 18-packs and individual eggs stay exactly as
  // entered. The next ordinary inventory change runs through normalized() above.
  function displayState(raw = read()) {
    const s = raw && typeof raw === "object" ? raw : {};
    return { dozens:whole(s.dozens), packs18:whole(s.packs18), remainder:whole(s.loose), total:total(s) };
  }
  function packageText(raw = read(), includeTotal = true) {
    const s = displayState(raw);
    const parts = [
      `${s.dozens} 12-pack${s.dozens === 1 ? "" : "s"}`,
      `${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"}`,
      `${s.remainder} individual egg${s.remainder === 1 ? "" : "s"}`
    ];
    if (includeTotal) parts.push(`${s.total} eggs total`);
    return parts.join(" • ");
  }

  // Normal inventory writes auto-fill 12-packs while keeping manually-entered
  // 18-packs. Exact manual inventory saves use __stagingTwelvePackBypass so the
  // owner can deliberately set all three fields without the wrapper repacking it.
  // Restore/remote writes remain byte-exact for sandbox and backup safety.
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

  let saving = false;

  function prepareEditor() {
    const overlay = document.getElementById("inv6Overlay");
    if (!overlay) return;
    const s = displayState();
    const dozens = document.getElementById("inv6Dozens");
    const packs = document.getElementById("inv6Packs");
    const loose = document.getElementById("inv6Loose");
    const dozensWrap = dozens?.closest("div");
    const looseWrap = loose?.closest("div");
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
    if (loose) { loose.value = s.remainder; loose.readOnly = false; }
    if (looseWrap) looseWrap.style.display = "";
    if (dozensWrap) dozensWrap.style.opacity = "1";
    if (save) save.textContent = "Save Exact Inventory";
    updateEditorPreview();
  }

  function updateEditorPreview() {
    const dozens = whole(document.getElementById("inv6Dozens")?.value);
    const packs = whole(document.getElementById("inv6Packs")?.value);
    const loose = whole(document.getElementById("inv6Loose")?.value);
    const out = document.getElementById("inv6DraftTotal");
    if (!out) return;
    const eggs = dozens * 12 + packs * 18 + loose;
    out.dataset.invalid = "0";
    out.textContent = `${dozens} 12-pack${dozens === 1 ? "" : "s"} • ${packs} 18-pack${packs === 1 ? "" : "s"} • ${loose} individual egg${loose === 1 ? "" : "s"} • ${eggs} eggs total`;
  }

  async function saveManualExact(dozens, packs18, loose) {
    dozens = whole(dozens);
    packs18 = whole(packs18);
    loose = whole(loose);
    const before = !!window.__stagingTwelvePackBypass;
    window.__stagingTwelvePackBypass = true;
    try {
      await window.InventorySystemV6?.commitExact?.(dozens, packs18, loose);
      const check = displayState();
      if (check.dozens !== dozens || check.packs18 !== packs18 || check.remainder !== loose) {
        throw new Error("Exact manual inventory verification failed");
      }
      return check;
    } finally {
      window.__stagingTwelvePackBypass = before;
    }
  }

  async function saveInventory() {
    if (saving) return;
    const dozens = whole(document.getElementById("inv6Dozens")?.value);
    const packs = whole(document.getElementById("inv6Packs")?.value);
    const loose = whole(document.getElementById("inv6Loose")?.value);
    const status = document.getElementById("inv6SaveStatus");
    const button = document.getElementById("inv6Save");
    saving = true;
    if (button) button.disabled = true;
    try {
      if (status) status.textContent = "Saving exact 12-pack, 18-pack and individual egg inventory…";
      const saved = await saveManualExact(dozens, packs, loose);
      if (status) status.textContent = `Saved: ${packageText(saved)}. New inventory activity will default back to 12-packs.`;
      patchVisible();
      setTimeout(() => document.getElementById("inv6Overlay")?.classList.remove("show"), 850);
    } catch (error) {
      if (status) status.textContent = `Could not verify inventory. ${String(error?.message || error)}`;
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
      const h3 = [...inventoryScreen.querySelectorAll("h3")].find(x => /Exact Carton Inventory|12-Pack & 18-Pack Inventory/i.test(x.textContent || ""));
      if (h3) h3.textContent = "📦 Egg Inventory";
      const open = document.getElementById("inv6Open");
      if (open) open.textContent = "Edit Inventory";
      const add = document.getElementById("inv6Add");
      if (add) add.textContent = "Add Eggs";
      [...inventoryScreen.querySelectorAll(".farm2-subtle")].forEach(el => {
        if (/Cartons stay exactly as you enter them|repack|loose|12-packs fill automatically|18-packs appear only/i.test(el.textContent || "")) {
          el.textContent = "Manually set 12-packs, 18-packs, and individual eggs. After the next normal inventory change, available eggs default back into 12-packs while your manual 18-packs stay designated.";
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
    if (["inv6Dozens","inv6Packs","inv6Loose"].includes(event.target?.id)) updateEditorPreview();
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
    version:2,
    normalized,
    displayState,
    packageText,
    total,
    setManual18(totalEggs, packs18) { return normalized({dozens:0,packs18:0,loose:whole(totalEggs)}, packs18); },
    saveManualExact,
    refresh:patchVisible
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
  console.log("📦 STAGING inventory layer active — exact manual 12/18/individual entry; normal changes default back to 12-packs");
})();
