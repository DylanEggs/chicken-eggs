(() => {
  "use strict";
  if (window.__inventorySystemV6) return;
  window.__inventorySystemV6 = true;

  const KEY = "chickenEggInventoryV2";
  const APP2_KEY = "chickenEggApp2V1";
  const ENTRIES_KEY = "chickenEggEntriesV102";
  const VERSION = 6;
  const AUTHORITY = "inventory-system-v6";
  const REPAIR_MARKER = "20260816-confirmed-cartons-3doz-2x18-8loose-v6";
  let internalWrite = false;
  let saving = false;
  let showHooked = false;
  let coreHooksInstalled = false;
  let renderQueued = false;

  const previousSetItem = Storage.prototype.setItem;

  function whole(v) { return Math.max(0, Math.round(Number(v) || 0)); }
  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch { return v; } }
  function localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function id(prefix="inv6") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function normalize(raw = {}) {
    const s = raw && typeof raw === "object" ? raw : {};
    return {
      ...s,
      version: Math.max(VERSION, Number(s.version) || 0),
      authorityVersion: VERSION,
      dozens: whole(s.dozens),
      packs18: whole(s.packs18),
      loose: whole(s.loose),
      adjustments: Array.isArray(s.adjustments) ? s.adjustments : [],
      recoveryMarkers: s.recoveryMarkers && typeof s.recoveryMarkers === "object" ? s.recoveryMarkers : {},
      updatedAt: Number(s.updatedAt) || 0
    };
  }
  function state() { return normalize(readJSON(KEY, {})); }
  function total(s = state()) { return whole(s.dozens) * 12 + whole(s.packs18) * 18 + whole(s.loose); }
  function reservations() {
    const a = readJSON(APP2_KEY, { orders:[] });
    return (Array.isArray(a.orders) ? a.orders : [])
      .filter(o => o?.status === "pending")
      .reduce((sum,o) => sum + whole(o.dozen) * 12 + whole(o.packs18) * 18, 0);
  }
  function available() { return Math.max(0, total() - reservations()); }

  // After this system is loaded, old modules are not allowed to write the inventory
  // dataset directly. Firebase verified remote writes are explicitly allowed.
  Storage.prototype.setItem = function(key, value) {
    if (
      this === window.localStorage &&
      String(key) === KEY &&
      !internalWrite &&
      !window.__farmApplyingRemote &&
      !window.__inventoryRestoreV6
    ) {
      console.warn("🛡️ Blocked obsolete direct inventory writer; InventorySystemV6 owns this dataset");
      window.dispatchEvent(new CustomEvent("inventory-legacy-write-blocked", { detail:{ at:Date.now() } }));
      return;
    }
    return previousSetItem.call(this, key, value);
  };

  function authorizedWrite(s) {
    s = normalize(s);
    s.authorityVersion = VERSION;
    s.updatedAt = Date.now();
    internalWrite = true;
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    finally { internalWrite = false; }
    return s;
  }

  function addAdjustment(s, before, reason, details, source = AUTHORITY) {
    const after = total(s);
    s.adjustments = Array.isArray(s.adjustments) ? s.adjustments : [];
    s.adjustments.unshift({
      id:id(), date:localDate(), at:Date.now(), delta:after-before,
      reason:reason || "Inventory adjustment",
      details:details || "",
      totalAfter:after,
      cartonBreakdown:{dozens:whole(s.dozens),packs18:whole(s.packs18),loose:whole(s.loose)},
      authority:source
    });
    s.adjustments = s.adjustments.slice(0,100);
  }

  async function syncExactNow() {
    try {
      if (window.EggSyncAuthorityReady) await window.EggSyncAuthorityReady();
      if (window.FarmSyncSafety?.saveInventoryNow) return await window.FarmSyncSafety.saveInventoryNow();
      if (typeof window.syncFarmNow === "function") return await window.syncFarmNow();
    } catch (error) {
      console.warn("Inventory sync waiting:", error);
      throw error;
    }
    return false;
  }

  async function commit(s, reason, details, options = {}) {
    const current = state();
    const before = total(current);
    s = normalize(s);
    if (options.marker) {
      s.recoveryMarkers = s.recoveryMarkers && typeof s.recoveryMarkers === "object" ? s.recoveryMarkers : {};
      s.recoveryMarkers[options.marker.id] = options.marker.value;
    }
    if (options.log !== false) addAdjustment(s, before, reason, details, options.source || AUTHORITY);
    authorizedWrite(s);
    scheduleRender();
    window.dispatchEvent(new CustomEvent("inventory-authority-changed", {
      detail:{ before, after:total(s), reason, at:Date.now() }
    }));
    if (options.sync !== false) await syncExactNow();
    return state();
  }

  function addLooseTo(s, qty) {
    s.loose = whole(s.loose) + whole(qty);
    return s;
  }

  function removeGenericFrom(s, qty) {
    let remaining = Math.min(whole(qty), total(s));
    const start = remaining;

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
    return start - remaining;
  }

  function removeDozensFrom(s, count) {
    count = whole(count);
    const sealed = Math.min(whole(s.dozens), count);
    s.dozens = whole(s.dozens) - sealed;
    const missing = count - sealed;
    if (missing) removeGenericFrom(s, missing * 12);
  }

  function removePacksFrom(s, count) {
    count = whole(count);
    const sealed = Math.min(whole(s.packs18), count);
    s.packs18 = whole(s.packs18) - sealed;
    const missing = count - sealed;
    if (missing) removeGenericFrom(s, missing * 18);
  }

  function removeSmartFrom(s, qty) {
    let remaining = Math.min(whole(qty), total(s));
    const requested = remaining;

    if (remaining > 0 && remaining % 12 === 0) {
      const cartons = Math.min(whole(s.dozens), Math.floor(remaining / 12));
      s.dozens = whole(s.dozens) - cartons;
      remaining -= cartons * 12;
    }
    if (remaining > 0 && remaining % 18 === 0) {
      const packs = Math.min(whole(s.packs18), Math.floor(remaining / 18));
      s.packs18 = whole(s.packs18) - packs;
      remaining -= packs * 18;
    }
    if (remaining) removeGenericFrom(s, remaining);
    return requested;
  }

  function contribution(e) {
    if (!e) return 0;
    if (e.type === "eggs") return whole(e.eggs);
    if (e.type === "sale") return -(whole(e.dozenSold) * 12 + whole(e.packSold ?? e.packs18Sold) * 18);
    return 0;
  }
  function entries() {
    const rows = readJSON(ENTRIES_KEY, []);
    return Array.isArray(rows) ? rows.filter(e => e && (e.type === "eggs" || e.type === "sale")) : [];
  }
  function mapRows(rows) {
    const m = new Map();
    for (const e of Array.isArray(rows) ? rows : []) if (e?.id) m.set(String(e.id), e);
    return m;
  }

  async function applyEntryDiff(beforeRows, afterRows, reason) {
    const b = mapRows(beforeRows), a = mapRows(afterRows);
    const ids = new Set([...b.keys(), ...a.keys()]);
    const s = state();
    const start = total(s);
    const notes = [];

    for (const entryId of ids) {
      const oldRow = b.get(entryId) || null;
      const newRow = a.get(entryId) || null;

      const oldEggs = oldRow?.type === "eggs" ? whole(oldRow.eggs) : 0;
      const newEggs = newRow?.type === "eggs" ? whole(newRow.eggs) : 0;
      const eggDelta = newEggs - oldEggs;
      if (eggDelta > 0) { addLooseTo(s, eggDelta); notes.push(`+${eggDelta} collected`); }
      else if (eggDelta < 0) { removeGenericFrom(s, -eggDelta); notes.push(`${eggDelta} collection correction`); }

      const oldDoz = oldRow?.type === "sale" ? whole(oldRow.dozenSold) : 0;
      const newDoz = newRow?.type === "sale" ? whole(newRow.dozenSold) : 0;
      const dozDelta = newDoz - oldDoz;
      if (dozDelta > 0) { removeDozensFrom(s, dozDelta); notes.push(`sold ${dozDelta} dozen`); }
      else if (dozDelta < 0) { s.dozens = whole(s.dozens) + (-dozDelta); notes.push(`restored ${-dozDelta} dozen`); }

      const oldPacks = oldRow?.type === "sale" ? whole(oldRow.packSold ?? oldRow.packs18Sold) : 0;
      const newPacks = newRow?.type === "sale" ? whole(newRow.packSold ?? newRow.packs18Sold) : 0;
      const packDelta = newPacks - oldPacks;
      if (packDelta > 0) { removePacksFrom(s, packDelta); notes.push(`sold ${packDelta} 18-pack`); }
      else if (packDelta < 0) { s.packs18 = whole(s.packs18) + (-packDelta); notes.push(`restored ${-packDelta} 18-pack`); }
    }

    if (total(s) === start && !notes.length) return state();
    return commit(s, reason || "Core history update", notes.join("; "));
  }

  function installCoreHooks() {
    if (coreHooksInstalled) return;
    if (typeof window.saveEggs !== "function" || typeof window.saveSale !== "function" || typeof window.deleteEntry !== "function") {
      setTimeout(installCoreHooks, 75);
      return;
    }
    const wrap = (name, reason) => {
      const original = window[name];
      if (typeof original !== "function" || original.__inventorySystemV6) return;
      const wrapped = function() {
        const beforeRows = clone(entries());
        const result = original.apply(this, arguments);
        const afterRows = clone(entries());
        void applyEntryDiff(beforeRows, afterRows, reason).catch(error => console.warn("Inventory core bridge failed:", error));
        return result;
      };
      wrapped.__inventorySystemV6 = true;
      wrapped.__inventoryOriginal = original;
      window[name] = wrapped;
    };
    wrap("saveEggs", "Egg collection");
    wrap("saveSale", "Egg sale");
    wrap("deleteEntry", "History entry correction");
    coreHooksInstalled = true;
    console.log("✅ InventorySystemV6 core entry bridge installed");
  }

  function ensureCss() {
    if (document.getElementById("inventoryV6Css")) return;
    const css = document.createElement("style");
    css.id = "inventoryV6Css";
    css.textContent = `
      .inv6-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}
      .inv6-stat{text-align:center;padding:14px;border-radius:18px;background:rgba(255,255,255,.68)}
      .inv6-stat b{display:block;font-size:26px}.inv6-row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(127,127,127,.15)}
      #inv6Overlay{position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.5);display:none;align-items:flex-end;justify-content:center;padding:14px;box-sizing:border-box}
      #inv6Overlay.show{display:flex}.inv6-sheet{width:min(100%,520px);background:#fff;border-radius:26px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);max-height:90vh;overflow:auto}
      .farm2-dark .inv6-sheet{background:#1d2720;color:#f5f7f3}.inv6-sheet input{width:100%;font-size:22px;font-weight:900}.inv6-sheet label{font-weight:900}
      .inv6-sheet-grid{display:grid;grid-template-columns:1fr;gap:11px}.inv6-total{margin:14px 0;padding:12px;border-radius:16px;background:rgba(245,185,28,.12);font-size:18px;font-weight:950}
      .inv6-current{padding:14px;border-radius:18px;background:rgba(31,122,58,.08);font-weight:900;margin:10px 0}.inv6-status{min-height:22px;margin-top:8px;font-size:13px;font-weight:850}
      @media(max-width:600px){.inv6-grid{grid-template-columns:1fr 1fr 1fr}}
    `;
    document.head.appendChild(css);
  }

  function ensureUi() {
    ensureCss();
    const app = document.querySelector(".app");
    const nav = document.querySelector(".bottomNav");
    if (!app || !nav) return false;

    let screen = document.getElementById("farm2Inventory");
    if (!screen) {
      screen = document.createElement("section");
      screen.id = "farm2Inventory";
      screen.className = "screen";
      app.insertBefore(screen, nav);
    }
    if (screen.dataset.inventoryV6 !== "1") {
      screen.dataset.inventoryV6 = "1";
      screen.innerHTML = `
        <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Egg Inventory</h2></div>
        <div id="inv6Summary"></div>
        <div class="farm2-card"><h3>✏️ Exact Carton Inventory</h3><div id="inv6Current" class="inv6-current"></div><button type="button" id="inv6Open">Edit Carton Breakdown</button><div class="farm2-subtle" style="margin-top:8px">Cartons stay exactly as you enter them. The app no longer repacks totals into 18-packs.</div></div>
        <div class="farm2-card"><h3>🥚 Use / Give Away</h3><input id="inv6RemoveQty" type="number" min="1" inputmode="numeric" placeholder="How many eggs?"><button type="button" data-inv6-remove="Used at home">🍳 Used at Home</button><button type="button" data-inv6-remove="Gave to family">❤️ Gave to Family</button><button type="button" data-inv6-remove="Broken / damaged">💔 Broken / Damaged</button></div>
        <div class="farm2-card"><h3>➕ Add Eggs Manually</h3><input id="inv6AddQty" type="number" min="1" inputmode="numeric" placeholder="How many eggs?"><button type="button" id="inv6Add">Add Loose Eggs</button></div>
        <div class="farm2-card"><h3>🕒 Inventory History</h3><div id="inv6History"></div></div>`;
      document.getElementById("inv6Open")?.addEventListener("click", openEditor);
      document.getElementById("inv6Add")?.addEventListener("click", () => void addManual());
      screen.querySelectorAll("[data-inv6-remove]").forEach(btn => btn.addEventListener("click", () => void removeManual(btn.dataset.inv6Remove)));
    }

    const grid = document.querySelector("#farm2Hub .farm2-hubGrid");
    if (grid && !document.getElementById("inventoryHubButton")) {
      const b = document.createElement("button");
      b.id = "inventoryHubButton"; b.className = "farm2-hubButton green";
      b.setAttribute("onclick", "showScreen('farm2Inventory')");
      b.innerHTML = '<span class="farm2-bigEmoji">🥚</span>Inventory<small>Physical egg count</small>';
      grid.prepend(b);
    }

    const todayCard = document.getElementById("farm2TodayCard");
    if (todayCard && !document.getElementById("inventoryDashboardCard")) {
      const d = document.createElement("div"); d.id = "inventoryDashboardCard"; d.className = "farm2-card";
      todayCard.insertAdjacentElement("afterend", d);
    }

    if (!document.getElementById("inv6Overlay")) {
      const overlay = document.createElement("div");
      overlay.id = "inv6Overlay";
      overlay.innerHTML = `<div class="inv6-sheet" role="dialog" aria-modal="true" aria-label="Edit exact egg inventory">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h3 style="margin:0">🥚 Edit Exact Inventory</h3><button type="button" class="secondary" id="inv6Close" style="width:auto;margin:0">Close</button></div>
        <div class="inv6-sheet-grid" style="margin-top:14px">
          <div><label for="inv6Dozens">Dozen Cartons</label><input id="inv6Dozens" type="number" min="0" inputmode="numeric"></div>
          <div><label for="inv6Packs">18-Packs</label><input id="inv6Packs" type="number" min="0" inputmode="numeric"></div>
          <div><label for="inv6Loose">Loose Eggs</label><input id="inv6Loose" type="number" min="0" inputmode="numeric"></div>
        </div>
        <div id="inv6DraftTotal" class="inv6-total"></div>
        <button type="button" id="inv6Save">Save Exact Inventory</button><div id="inv6SaveStatus" class="inv6-status"></div>
      </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", e => { if (e.target === overlay && !saving) closeEditor(); });
      document.getElementById("inv6Close")?.addEventListener("click", closeEditor);
      document.getElementById("inv6Save")?.addEventListener("click", () => void saveEditor());
      ["inv6Dozens","inv6Packs","inv6Loose"].forEach(x => document.getElementById(x)?.addEventListener("input", updateDraftTotal));
    }
    return true;
  }

  function stateText(s = state()) { return `${whole(s.dozens)} dozen • ${whole(s.packs18)} 18-packs • ${whole(s.loose)} loose • ${total(s)} eggs total`; }

  function render() {
    renderQueued = false;
    ensureUi();
    const s = state(), on = total(s), held = reservations(), av = Math.max(0,on-held);
    const summary = document.getElementById("inv6Summary");
    if (summary) summary.innerHTML = `<div class="inv6-grid"><div class="inv6-stat"><b>${on}</b><span>On Hand</span></div><div class="inv6-stat"><b>${held}</b><span>Reserved</span></div><div class="inv6-stat"><b>${av}</b><span>Available</span></div></div>`;
    const current = document.getElementById("inv6Current"); if (current) current.textContent = stateText(s);
    const history = document.getElementById("inv6History");
    if (history) history.innerHTML = s.adjustments.length ? s.adjustments.slice(0,30).map(a => `<div class="inv6-row"><span>${String(a.reason||"Inventory adjustment")}<small class="farm2-subtle"> ${String(a.date||"")}</small></span><b>${Number(a.delta)>0?"+":""}${Number(a.delta)||0} 🥚</b></div>`).join("") : '<div class="farm2-empty">No inventory adjustments yet.</div>';
    const dash = document.getElementById("inventoryDashboardCard");
    if (dash) dash.innerHTML = `<div class="farm2-sectionHeader"><div><div class="farm2-kicker">Physical Egg Inventory</div><h3>${av} eggs available</h3></div></div><div class="inv6-grid"><div class="inv6-stat"><b>${on}</b><span>On Hand</span></div><div class="inv6-stat"><b>${held}</b><span>Reserved</span></div><div class="inv6-stat"><b>${av}</b><span>Sell / Use</span></div></div><div class="farm2-subtle">${whole(s.dozens)} dozen • ${whole(s.packs18)} 18-packs • ${whole(s.loose)} loose</div><button type="button" onclick="showScreen('farm2Inventory')">✏️ Edit Inventory</button>`;
  }
  function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(render); }

  function updateDraftTotal() {
    const d=whole(document.getElementById("inv6Dozens")?.value), p=whole(document.getElementById("inv6Packs")?.value), l=whole(document.getElementById("inv6Loose")?.value);
    const el=document.getElementById("inv6DraftTotal"); if (el) el.textContent=`New total: ${d*12+p*18+l} eggs`;
  }
  function openEditor() {
    const s=state();
    document.getElementById("inv6Dozens").value=whole(s.dozens);
    document.getElementById("inv6Packs").value=whole(s.packs18);
    document.getElementById("inv6Loose").value=whole(s.loose);
    document.getElementById("inv6SaveStatus").textContent="";
    updateDraftTotal();
    document.getElementById("inv6Overlay")?.classList.add("show");
  }
  function closeEditor() { if (!saving) document.getElementById("inv6Overlay")?.classList.remove("show"); }

  async function saveEditor() {
    if (saving) return;
    saving=true;
    const button=document.getElementById("inv6Save"), status=document.getElementById("inv6SaveStatus");
    if (button) button.disabled=true;
    try {
      const d=whole(document.getElementById("inv6Dozens")?.value), p=whole(document.getElementById("inv6Packs")?.value), l=whole(document.getElementById("inv6Loose")?.value);
      const s=state(); s.dozens=d; s.packs18=p; s.loose=l;
      if (status) status.textContent="Saving exact carton count to this phone and Firebase…";
      await commit(s,"Exact inventory count",`${d} dozen, ${p} 18-packs, ${l} loose`);
      let check=state();
      if (whole(check.dozens)!==d || whole(check.packs18)!==p || whole(check.loose)!==l) {
        s.dozens=d; s.packs18=p; s.loose=l;
        await commit(s,"Exact inventory count retry",`${d} dozen, ${p} 18-packs, ${l} loose`,{source:"inventory-system-v6-retry"});
        check=state();
      }
      const ok=whole(check.dozens)===d && whole(check.packs18)===p && whole(check.loose)===l;
      if (!ok) throw new Error(`Inventory verification failed; saved state is ${stateText(check)}`);
      if (status) status.textContent=`Saved and verified: ${stateText(check)}`;
      scheduleRender();
      setTimeout(()=>{ if (!saving) closeEditor(); },700);
    } catch (error) {
      console.error("Exact inventory save failed:",error);
      if (status) status.textContent=`Could not verify the save. Nothing was intentionally repacked. ${error?.message||""}`;
    } finally {
      saving=false;
      if (button) button.disabled=false;
    }
  }

  async function addManual() {
    const input=document.getElementById("inv6AddQty"), q=whole(input?.value); if(!q){alert("Enter how many eggs to add.");return;}
    const s=state(); addLooseTo(s,q); await commit(s,"Manual inventory add",`Added ${q} loose eggs.`); if(input)input.value=""; scheduleRender();
  }
  async function removeManual(reason) {
    const input=document.getElementById("inv6RemoveQty"), q=whole(input?.value); if(!q){alert("Enter how many eggs left inventory.");return;}
    const s=state(), before=total(s), rm=Math.min(q,before); removeSmartFrom(s,rm); await commit(s,reason||"Inventory removal",`Removed ${rm} eggs while preserving carton types.`); if(input)input.value=""; scheduleRender();
  }

  async function repairConfirmedState() {
    try { if (window.EggSyncAuthorityReady) await window.EggSyncAuthorityReady(); } catch {}
    const s=state();
    if (s.recoveryMarkers?.[REPAIR_MARKER]) return false;
    if (whole(s.dozens)===0 && whole(s.packs18)===4 && whole(s.loose)===8 && total(s)===80) {
      s.dozens=3; s.packs18=2; s.loose=8;
      const marker={id:REPAIR_MARKER,value:{appliedAt:Date.now(),from:{dozens:0,packs18:4,loose:8},to:{dozens:3,packs18:2,loose:8},total:80}};
      await commit(s,"User-confirmed carton breakdown repair","Restored actual packaging to 3 dozen + 2 18-packs + 8 loose without changing the 80-egg total.",{marker});
      return true;
    }
    return false;
  }

  function hookShowScreen() {
    if (showHooked) return;
    if (typeof window.showScreen !== "function") { setTimeout(hookShowScreen,100); return; }
    const original=window.showScreen;
    window.showScreen=function(){const r=original.apply(this,arguments);setTimeout(scheduleRender,0);return r;};
    showHooked=true;
  }

  function runPureSelfTest() {
    const failures=[];
    const expect=(name,cond)=>{if(!cond)failures.push(name);};
    let s=normalize({dozens:4,packs18:2,loose:8,adjustments:[]});
    expect("baseline total",total(s)===92);
    removeDozensFrom(s,1); expect("dozen sale preserves 18-packs",s.dozens===3&&s.packs18===2&&s.loose===8&&total(s)===80);
    addLooseTo(s,14); expect("collection adds loose",s.dozens===3&&s.packs18===2&&s.loose===22&&total(s)===94);
    removePacksFrom(s,1); expect("18-pack sale removes pack",s.dozens===3&&s.packs18===1&&s.loose===22&&total(s)===76);
    s.packs18+=1; expect("deleted 18-pack sale restores pack",s.packs18===2&&total(s)===94);
    const exact=normalize({...s,dozens:1,packs18:3,loose:4}); expect("exact breakdown retained",exact.dozens===1&&exact.packs18===3&&exact.loose===4&&total(exact)===70);
    return {pass:failures.length===0,failures,tests:6,authority:AUTHORITY};
  }

  window.InventorySystemV6 = {
    version:VERSION, authority:AUTHORITY,
    state, total, available, reservations,
    open:openEditor, saveExact:saveEditor,
    commitExact:async(d,p,l)=>{const s=state();s.dozens=whole(d);s.packs18=whole(p);s.loose=whole(l);return commit(s,"Exact inventory count",`${whole(d)} dozen, ${whole(p)} 18-packs, ${whole(l)} loose`);},
    replaceFromRestore:async raw=>{window.__inventoryRestoreV6=true;try{const s=normalize(raw||{});authorizedWrite(s);await syncExactNow();return state();}finally{window.__inventoryRestoreV6=false;}},
    selfTest:runPureSelfTest,
    applyEntryDiff
  };
  window.getPhysicalEggInventory = () => ({state:state(),onHand:total(),reserved:reservations(),available:available()});
  window.inventorySetExact = saveEditor;
  window.inventoryAddEggs = addManual;
  window.inventoryRemove = removeManual;

  function init() {
    ensureUi();
    render();
    hookShowScreen();
    installCoreHooks();
    const test=runPureSelfTest();
    window.__inventorySelfTestV6=test;
    console[test.pass?"log":"error"]("InventorySystemV6 self-test",test);
    setTimeout(()=>void repairConfirmedState().catch(error=>console.warn("Confirmed carton repair skipped:",error)),1200);
    window.addEventListener("farm-data-synced",e=>{if(!e.detail?.key||e.detail.key===KEY||e.detail.key===APP2_KEY)scheduleRender();});
    window.addEventListener("core-data-synced",scheduleRender);
    window.addEventListener("storage",e=>{if([KEY,APP2_KEY].includes(e.key))scheduleRender();});
    console.log("✅ InventorySystemV6 active — one inventory writer, carton-preserving math, verified exact saves");
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,80),{once:true});
  else setTimeout(init,80);
})();
