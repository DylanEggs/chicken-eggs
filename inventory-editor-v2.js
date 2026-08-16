(() => {
  "use strict";
  if (window.__inventoryEditorV2) return;
  window.__inventoryEditorV2 = true;

  const KEY = "chickenEggInventoryV2";
  const REPAIR = "20260816-user-confirmed-cartons-v2";
  let mounted = false;
  let saving = false;

  const read = () => {
    try {
      const x = JSON.parse(localStorage.getItem(KEY) || "{}");
      return x && typeof x === "object" ? x : {};
    } catch { return {}; }
  };
  const whole = v => Math.max(0, Math.round(Number(v) || 0));
  const total = s => whole(s.dozens) * 12 + whole(s.packs18) * 18 + whole(s.loose);
  const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function writeExact(dozens, packs18, loose, reason, details, marker = null) {
    const s = read();
    const before = total(s);
    s.version = Math.max(5, Number(s.version) || 0);
    s.dozens = whole(dozens);
    s.packs18 = whole(packs18);
    s.loose = whole(loose);
    s.adjustments = Array.isArray(s.adjustments) ? s.adjustments : [];
    s.recoveryMarkers = s.recoveryMarkers && typeof s.recoveryMarkers === "object" ? s.recoveryMarkers : {};
    if (marker) s.recoveryMarkers[REPAIR] = marker;
    const after = total(s);
    s.adjustments.unshift({
      id:`exactv2-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      date:localDate(), at:Date.now(), delta:after-before,
      reason:reason || "Exact inventory count",
      details:details || `${s.dozens} dozen, ${s.packs18} 18-packs, ${s.loose} loose`,
      totalAfter:after,
      cartonBreakdown:{dozens:s.dozens,packs18:s.packs18,loose:s.loose},
      authority:"inventory-editor-v2"
    });
    s.adjustments = s.adjustments.slice(0,100);
    s.updatedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("farm-integrity-synced", { detail:{ source:"inventory-editor-v2", physical:after, at:Date.now() } }));
    return { before, after, state:s };
  }

  async function syncTwice() {
    try {
      if (window.EggSyncAuthorityReady) await window.EggSyncAuthorityReady();
    } catch {}
    for (const delay of [0, 500, 900]) {
      if (delay) await wait(delay);
      try {
        if (typeof window.syncFarmNow === "function") await window.syncFarmNow();
      } catch {}
    }
  }

  function css() {
    if (document.getElementById("inventoryEditorV2Css")) return;
    const s = document.createElement("style");
    s.id = "inventoryEditorV2Css";
    s.textContent = `
      .inventory-editor-v2-current{padding:14px 15px;border-radius:18px;background:rgba(31,122,58,.08);margin:10px 0 12px;font-weight:850}
      #inventoryEditorV2Overlay{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.48);display:none;align-items:flex-end;justify-content:center;padding:14px;box-sizing:border-box}
      #inventoryEditorV2Overlay.show{display:flex}
      .inventory-editor-v2-sheet{width:min(100%,520px);background:#fff;border-radius:26px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);max-height:90vh;overflow:auto}
      .farm2-dark .inventory-editor-v2-sheet{background:#1d2720;color:#f5f7f3}
      .inventory-editor-v2-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      .inventory-editor-v2-head h3{margin:0}
      .inventory-editor-v2-close{width:auto!important;min-height:42px!important;margin:0!important;padding:8px 12px!important}
      .inventory-editor-v2-grid{display:grid;grid-template-columns:1fr;gap:11px}
      .inventory-editor-v2-grid label{font-weight:900}
      .inventory-editor-v2-grid input{width:100%;font-size:22px;font-weight:900}
      #inventoryEditorV2Total{font-size:18px;font-weight:950;margin:14px 0;padding:12px;border-radius:16px;background:rgba(245,185,28,.12)}
      #inventoryEditorV2Status{min-height:20px;margin-top:8px;font-size:13px;font-weight:850}
    `;
    document.head.appendChild(s);
  }

  function stateText(s = read()) {
    return `${whole(s.dozens)} dozen • ${whole(s.packs18)} 18-packs • ${whole(s.loose)} loose • ${total(s)} eggs total`;
  }

  function updateCard() {
    const box = document.getElementById("inventoryEditorV2Current");
    if (box) box.textContent = stateText();
  }

  function updateDraftTotal() {
    const d = whole(document.getElementById("inventoryDraftDozensV2")?.value);
    const p = whole(document.getElementById("inventoryDraftPacks18V2")?.value);
    const l = whole(document.getElementById("inventoryDraftLooseV2")?.value);
    const t = document.getElementById("inventoryEditorV2Total");
    if (t) t.textContent = `New total: ${d*12+p*18+l} eggs`;
  }

  function openEditor() {
    const s = read();
    document.getElementById("inventoryDraftDozensV2").value = whole(s.dozens);
    document.getElementById("inventoryDraftPacks18V2").value = whole(s.packs18);
    document.getElementById("inventoryDraftLooseV2").value = whole(s.loose);
    document.getElementById("inventoryEditorV2Status").textContent = "";
    updateDraftTotal();
    document.getElementById("inventoryEditorV2Overlay")?.classList.add("show");
  }
  function closeEditor() {
    if (saving) return;
    document.getElementById("inventoryEditorV2Overlay")?.classList.remove("show");
  }

  async function saveEditor() {
    if (saving) return;
    saving = true;
    const btn = document.getElementById("inventoryEditorV2Save");
    const status = document.getElementById("inventoryEditorV2Status");
    if (btn) btn.disabled = true;
    try {
      const d = whole(document.getElementById("inventoryDraftDozensV2")?.value);
      const p = whole(document.getElementById("inventoryDraftPacks18V2")?.value);
      const l = whole(document.getElementById("inventoryDraftLooseV2")?.value);
      const result = writeExact(d,p,l,"Exact inventory count",`${d} dozen, ${p} 18-packs, ${l} loose`);
      updateCard();
      if (status) status.textContent = `Saved on this phone: ${stateText(result.state)}. Syncing Firebase…`;
      await syncTwice();
      const check = read();
      if (whole(check.dozens) !== d || whole(check.packs18) !== p || whole(check.loose) !== l) {
        writeExact(d,p,l,"Exact inventory count retry",`${d} dozen, ${p} 18-packs, ${l} loose; reapplied after a stale refresh.`);
        await syncTwice();
      }
      const final = read();
      updateCard();
      if (status) status.textContent = `Saved: ${stateText(final)}`;
      setTimeout(() => document.getElementById("inventoryEditorV2Overlay")?.classList.remove("show"), 650);
    } finally {
      saving = false;
      if (btn) btn.disabled = false;
    }
  }

  function mount() {
    css();
    const screen = document.getElementById("farm2Inventory");
    if (!screen) return false;

    const oldCards = [...screen.querySelectorAll(".farm2-card")];
    const exactCard = oldCards.find(c => /Set Exact Inventory/i.test(c.querySelector("h3")?.textContent || c.textContent || ""));
    if (!exactCard) return false;

    if (!document.getElementById("inventoryEditorV2Card")) {
      exactCard.id = "inventoryEditorV2Card";
      exactCard.innerHTML = `
        <h3>✏️ Exact Carton Inventory</h3>
        <div id="inventoryEditorV2Current" class="inventory-editor-v2-current"></div>
        <button type="button" id="inventoryEditorV2Open">Edit Carton Breakdown</button>
        <div class="farm2-subtle" style="margin-top:8px">This editor is isolated from background screen refreshes, so your numbers will stay while you edit.</div>`;
      document.getElementById("inventoryEditorV2Open")?.addEventListener("click", openEditor);
    }

    if (!document.getElementById("inventoryEditorV2Overlay")) {
      const overlay = document.createElement("div");
      overlay.id = "inventoryEditorV2Overlay";
      overlay.innerHTML = `
        <div class="inventory-editor-v2-sheet" role="dialog" aria-modal="true" aria-label="Edit exact egg inventory">
          <div class="inventory-editor-v2-head"><h3>🥚 Edit Exact Inventory</h3><button type="button" class="secondary inventory-editor-v2-close" id="inventoryEditorV2Close">Close</button></div>
          <div class="inventory-editor-v2-grid">
            <div><label for="inventoryDraftDozensV2">Dozen Cartons</label><input id="inventoryDraftDozensV2" type="number" min="0" inputmode="numeric"></div>
            <div><label for="inventoryDraftPacks18V2">18-Packs</label><input id="inventoryDraftPacks18V2" type="number" min="0" inputmode="numeric"></div>
            <div><label for="inventoryDraftLooseV2">Loose Eggs</label><input id="inventoryDraftLooseV2" type="number" min="0" inputmode="numeric"></div>
          </div>
          <div id="inventoryEditorV2Total"></div>
          <button type="button" id="inventoryEditorV2Save">Save Exact Inventory</button>
          <div id="inventoryEditorV2Status"></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", e => { if (e.target === overlay) closeEditor(); });
      document.getElementById("inventoryEditorV2Close")?.addEventListener("click", closeEditor);
      document.getElementById("inventoryEditorV2Save")?.addEventListener("click", () => void saveEditor());
      ["inventoryDraftDozensV2","inventoryDraftPacks18V2","inventoryDraftLooseV2"].forEach(id => document.getElementById(id)?.addEventListener("input", updateDraftTotal));
    }

    updateCard();
    mounted = true;
    return true;
  }

  async function repairConfirmedCurrentLayout() {
    try {
      if (window.EggSyncAuthorityReady) await window.EggSyncAuthorityReady();
    } catch {}
    const s = read();
    const markers = s.recoveryMarkers && typeof s.recoveryMarkers === "object" ? s.recoveryMarkers : {};
    if (markers[REPAIR]) return;

    // User-confirmed physical state from the 2026-08-16 diagnostic:
    // 0 dozen + 4 x 18-packs + 8 loose was a display/repacking error.
    // Correct physical layout is 3 dozen + 2 x 18-packs + 8 loose. Both total 80.
    if (whole(s.dozens) === 0 && whole(s.packs18) === 4 && whole(s.loose) === 8 && total(s) === 80) {
      writeExact(3,2,8,"User-confirmed carton breakdown repair","Changed 0 dozen + 4 18-packs + 8 loose to the actual 3 dozen + 2 18-packs + 8 loose. Total remained 80 eggs.",{
        appliedAt:Date.now(),from:{dozens:0,packs18:4,loose:8},to:{dozens:3,packs18:2,loose:8},total:80
      });
      await syncTwice();
      updateCard();
      console.log("✅ User-confirmed carton breakdown repaired to 3 dozen + 2 18-packs + 8 loose (80 total)");
    }
  }

  function init() {
    const tryMount = () => {
      if (!mount()) setTimeout(tryMount, 120);
    };
    tryMount();
    setTimeout(() => void repairConfirmedCurrentLayout(), 900);
    window.addEventListener("farm-data-synced", e => {
      if (e.detail?.key === KEY) {
        mount();
        updateCard();
      }
    });
    window.addEventListener("storage", e => { if (e.key === KEY) updateCard(); });
  }

  window.InventoryEditorV2 = { open:openEditor, save:saveEditor, update:updateCard };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
