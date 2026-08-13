(() => {
  "use strict";

  const KEY = "chickenEggInventoryV2";
  const CORE_ENTRIES_KEY = "chickenEggEntriesV102";
  const APP2_KEY = "chickenEggApp2V1";
  const CLOUD_DOC_ID = "__farm_inventory_v2__";

  const defaultState = () => ({
    version: 2,
    exactMode: true,
    loose: 0,
    dozens: 0,
    packs18: 3,
    adjustments: [],
    initializedFromUserCount: true,
    updatedAt: 0
  });

  let state = load();
  let saveTimer = null;

  function num(v) { return Math.max(0, Number(v) || 0); }
  function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function id() { return "inv-" + Date.now() + "-" + Math.random().toString(36).slice(2,8); }
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function load() {
    const raw = readJSON(KEY, null);
    if (!raw || typeof raw !== "object") return defaultState();
    return {
      ...defaultState(), ...raw,
      loose: num(raw.loose),
      dozens: num(raw.dozens),
      packs18: num(raw.packs18),
      adjustments: Array.isArray(raw.adjustments) ? raw.adjustments.slice(0,100) : [],
      updatedAt: Number(raw.updatedAt) || 0
    };
  }
  function coreEntries() {
    return readJSON(CORE_ENTRIES_KEY, []).filter(e => e && (e.type === "eggs" || e.type === "sale"));
  }
  function farm2() { return readJSON(APP2_KEY, {}); }
  function eggsSold(e) { return (Number(e.dozenSold)||0)*12 + (Number(e.packSold)||0)*18; }
  function calculatedInventory() {
    const list = coreEntries();
    const collected = list.filter(e=>e.type==="eggs").reduce((s,e)=>s+(Number(e.eggs)||0),0);
    const sold = list.filter(e=>e.type==="sale").reduce((s,e)=>s+eggsSold(e),0);
    return Math.max(0, collected - sold);
  }
  function physicalTotal() { return Math.round(num(state.loose) + num(state.dozens)*12 + num(state.packs18)*18); }
  function reservedEggs() {
    const f2 = farm2();
    return (Array.isArray(f2.orders) ? f2.orders : [])
      .filter(o=>o.status==="pending")
      .reduce((s,o)=>s+(Number(o.dozen)||0)*12+(Number(o.packs18)||0)*18,0);
  }
  function availableTotal() { return Math.max(0, physicalTotal() - reservedEggs()); }

  function save() {
    state.updatedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCloud, 400);
    renderAll();
  }
  async function saveCloud() {
    try {
      if (!window.FirestoreDB || !window.FirebaseUser) return;
      const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
      await setDoc(doc(window.FirestoreDB, "entries", CLOUD_DOC_ID), {
        type: "inventory2", inventory: state, updatedAt: state.updatedAt, serverUpdatedAt: serverTimestamp()
      });
    } catch (err) { console.warn("Inventory cloud save skipped", err); }
  }
  async function loadCloud() {
    try {
      if (window.ChickenEggsDB?.waitUntilReady) await window.ChickenEggsDB.waitUntilReady();
      if (!window.FirestoreDB) return;
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
      const snap = await getDoc(doc(window.FirestoreDB, "entries", CLOUD_DOC_ID));
      if (!snap.exists()) { if (state.updatedAt) saveCloud(); return; }
      const remote = snap.data()?.inventory;
      if (remote && (Number(remote.updatedAt)||0) >= state.updatedAt) {
        state = { ...defaultState(), ...remote, adjustments: Array.isArray(remote.adjustments)?remote.adjustments:[] };
        localStorage.setItem(KEY, JSON.stringify(state));
        renderAll();
      } else saveCloud();
    } catch (err) { console.warn("Inventory cloud load skipped", err); }
  }

  function toast(text) {
    let el = document.getElementById("inventoryToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "inventoryToast";
      el.style.cssText = "position:fixed;left:50%;bottom:105px;transform:translateX(-50%) translateY(20px);background:#17351f;color:#fff;padding:13px 18px;border-radius:18px;font-weight:800;z-index:9999;opacity:0;transition:.2s;box-shadow:0 12px 30px rgba(0,0,0,.25);max-width:90%;text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(el._t); el._t = setTimeout(()=>{el.style.opacity="0";el.style.transform="translateX(-50%) translateY(20px)";},2200);
  }

  function injectStyles() {
    if (document.getElementById("inventoryStyles")) return;
    const s = document.createElement("style");
    s.id = "inventoryStyles";
    s.textContent = `
      .inventory-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:12px 0 16px}
      .inventory-box{background:rgba(255,255,255,.72);border:1px solid rgba(31,122,58,.15);border-radius:20px;padding:14px;text-align:center}
      .inventory-box b{display:block;font-size:28px;color:var(--dark);margin-bottom:3px}.inventory-box span{font-size:12px;font-weight:800;color:var(--muted)}
      .inventory-setGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.inventory-setGrid input{text-align:center;font-size:24px;font-weight:900}
      .inventory-reasonGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:10px}.inventory-reasonGrid button{font-size:14px;padding:13px 9px}
      .inventory-history{max-height:330px;overflow:auto}.inventory-historyRow{padding:11px 0;border-bottom:1px solid rgba(127,127,127,.16);display:flex;justify-content:space-between;gap:12px}.inventory-historyRow:last-child{border-bottom:0}
      .inventory-warning{padding:12px 14px;border-radius:16px;background:rgba(245,185,28,.13);font-weight:750;margin:10px 0;color:var(--dark)}
      .inventory-dashboard{margin:14px 0}.inventory-dashboard button{margin-top:11px}
      @media(max-width:600px){.inventory-setGrid{grid-template-columns:1fr}.inventory-grid{grid-template-columns:1fr 1fr 1fr}.inventory-box b{font-size:23px}}
    `;
    document.head.appendChild(s);
  }

  function injectUI() {
    injectStyles();
    if (!document.getElementById("farm2Inventory")) {
      const nav = document.querySelector(".bottomNav");
      const app = document.querySelector(".app");
      if (app && nav) {
        const wrap = document.createElement("div");
        wrap.innerHTML = inventoryScreenHTML();
        app.insertBefore(wrap.firstElementChild, nav);
      }
    }

    const hubGrid = document.querySelector("#farm2Hub .farm2-hubGrid");
    if (hubGrid && !document.getElementById("inventoryHubButton")) {
      const b = document.createElement("button");
      b.id = "inventoryHubButton";
      b.className = "farm2-hubButton green";
      b.setAttribute("onclick", "showScreen('farm2Inventory')");
      b.innerHTML = '<span class="farm2-bigEmoji">🥚</span>Inventory<small>Edit dozens, 18-packs & loose eggs</small>';
      hubGrid.insertBefore(b, hubGrid.firstChild);
    }

    const todayCard = document.getElementById("farm2TodayCard");
    if (todayCard && !document.getElementById("inventoryDashboardCard")) {
      const d = document.createElement("div");
      d.id = "inventoryDashboardCard";
      d.className = "farm2-card inventory-dashboard";
      todayCard.insertAdjacentElement("afterend", d);
    }
  }

  function inventoryScreenHTML() {
    return `<section id="farm2Inventory" class="screen">
      <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Egg Inventory</h2></div>
      <div id="inventorySummary"></div>

      <div class="farm2-card">
        <h3>✏️ Set Exact Inventory</h3>
        <p class="farm2-subtle">Count what is physically in your refrigerator/egg area right now. This becomes the inventory number the app trusts.</p>
        <div class="inventory-setGrid">
          <div><label>Dozen Cartons</label><input id="inventoryDozens" type="number" min="0" step="1" /></div>
          <div><label>18-Packs</label><input id="inventoryPacks18" type="number" min="0" step="1" /></div>
          <div><label>Loose Eggs</label><input id="inventoryLoose" type="number" min="0" step="1" /></div>
        </div>
        <button onclick="inventorySetExact()">Save Exact Inventory</button>
      </div>

      <div class="farm2-card">
        <h3>🥚 Quick Use / Give Away</h3>
        <p class="farm2-subtle">Use this when eggs leave without being recorded as a sale.</p>
        <label>How many eggs?</label><input id="inventoryAdjustQty" type="number" min="1" step="1" placeholder="Example: 6" />
        <div class="inventory-reasonGrid">
          <button onclick="inventoryRemove('Used at home')">🍳 Used at Home</button>
          <button onclick="inventoryRemove('Gave to family')">❤️ Gave to Family</button>
          <button onclick="inventoryRemove('Broken / damaged')">💔 Broken / Damaged</button>
          <button onclick="inventoryRemove('Other')">📝 Other</button>
        </div>
      </div>

      <div class="farm2-card">
        <h3>➕ Other Inventory Adjustment</h3>
        <p class="farm2-subtle">Add eggs back if the physical count is higher than the app. For a full recount, use Set Exact Inventory above.</p>
        <label>Eggs to add</label><input id="inventoryAddQty" type="number" min="1" step="1" placeholder="0" />
        <button onclick="inventoryAddEggs()">Add Eggs to Inventory</button>
      </div>

      <div class="farm2-card"><h3>🕒 Inventory History</h3><div id="inventoryHistory" class="inventory-history"></div></div>
    </section>`;
  }

  function packageFromTotal(total) {
    total = Math.max(0, Math.round(total));
    const packs18 = Math.floor(total / 18);
    const rem = total % 18;
    return { packs18, dozens: 0, loose: rem };
  }

  function removeFromPhysical(qty) {
    const total = Math.max(0, physicalTotal() - qty);
    const p = packageFromTotal(total);
    state.packs18 = p.packs18; state.dozens = p.dozens; state.loose = p.loose;
  }
  function addToPhysical(qty) {
    const total = physicalTotal() + qty;
    const p = packageFromTotal(total);
    state.packs18 = p.packs18; state.dozens = p.dozens; state.loose = p.loose;
  }

  function addHistory(delta, reason, details="") {
    state.adjustments.unshift({ id:id(), date:localDate(), at:Date.now(), delta, reason, details, totalAfter:physicalTotal() });
    state.adjustments = state.adjustments.slice(0,100);
  }

  function renderSummary() {
    const el = document.getElementById("inventorySummary");
    if (!el) return;
    const total = physicalTotal(), reserved = reservedEggs(), available = availableTotal();
    const calculated = calculatedInventory();
    el.innerHTML = `
      <div class="inventory-grid">
        <div class="inventory-box"><b>${total}</b><span>Physical Eggs</span></div>
        <div class="inventory-box"><b>${reserved}</b><span>Reserved</span></div>
        <div class="inventory-box"><b>${available}</b><span>Available</span></div>
      </div>
      <div class="farm2-card">
        <div class="farm2-kicker">How They Are Packed</div>
        <div class="farm2-moneyBig">${state.dozens} dozen • ${state.packs18} × 18-pack • ${state.loose} loose</div>
        <div class="farm2-subtle">The old collection-minus-sales math says ${calculated} eggs. Manual physical inventory is ${total}, so ${Math.abs(calculated-total)} egg${Math.abs(calculated-total)===1?"":"s"} ${calculated===total?"match exactly":calculated>total?"have been consumed/given away/not sold":"more are physically on hand than the old math predicts"}.</div>
      </div>`;

    const d=document.getElementById("inventoryDozens"), p=document.getElementById("inventoryPacks18"), l=document.getElementById("inventoryLoose");
    if (d && document.activeElement!==d) d.value=state.dozens;
    if (p && document.activeElement!==p) p.value=state.packs18;
    if (l && document.activeElement!==l) l.value=state.loose;
  }

  function renderHistory() {
    const el = document.getElementById("inventoryHistory");
    if (!el) return;
    el.innerHTML = state.adjustments.length ? state.adjustments.map(a => `
      <div class="inventory-historyRow"><div><b>${escapeHTML(a.reason)}</b><div class="farm2-subtle">${escapeHTML(a.date)}${a.details?" • "+escapeHTML(a.details):""}</div></div><div><b>${a.delta>0?"+":""}${a.delta} 🥚</b><div class="farm2-subtle">${a.totalAfter} after</div></div></div>`).join("") : '<div class="farm2-empty">No inventory adjustments yet.</div>';
  }

  function renderDashboard() {
    const el = document.getElementById("inventoryDashboardCard");
    if (!el) return;
    const total=physicalTotal(), reserved=reservedEggs(), available=availableTotal();
    el.innerHTML = `<div class="farm2-sectionHeader"><div><div class="farm2-kicker">Physical Egg Inventory</div><h3>${available} eggs available</h3></div><span class="farm2-badge gold">${state.packs18} × 18-pack</span></div>
      <div class="inventory-grid"><div class="inventory-box"><b>${total}</b><span>On Hand</span></div><div class="inventory-box"><b>${reserved}</b><span>Reserved</span></div><div class="inventory-box"><b>${available}</b><span>Sell / Use</span></div></div>
      <div class="farm2-subtle">${state.dozens} dozen cartons • ${state.packs18} 18-packs • ${state.loose} loose eggs</div>
      <button onclick="showScreen('farm2Inventory')">✏️ Edit Inventory</button>`;
  }

  function renderHubSummaryPatch() {
    const hub=document.getElementById("farm2HubSummary");
    if (!hub) return;
    let badge=document.getElementById("inventoryHubStatus");
    if (!badge) {
      badge=document.createElement("div"); badge.id="inventoryHubStatus"; badge.className="farm2-card"; badge.style.marginTop="12px"; hub.appendChild(badge);
    }
    badge.innerHTML=`<div class="farm2-kicker">Physical Inventory</div><div class="farm2-moneyBig">${availableTotal()} 🥚 available</div><div class="farm2-subtle">${state.packs18} 18-packs • ${state.dozens} dozen cartons • ${state.loose} loose • ${reservedEggs()} reserved</div>`;
  }

  function renderAll() { injectUI(); renderSummary(); renderHistory(); renderDashboard(); renderHubSummaryPatch(); }
  function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));}

  window.inventorySetExact = () => {
    const old=physicalTotal();
    state.dozens=num(document.getElementById("inventoryDozens")?.value);
    state.packs18=num(document.getElementById("inventoryPacks18")?.value);
    state.loose=num(document.getElementById("inventoryLoose")?.value);
    const diff=physicalTotal()-old;
    addHistory(diff,"Exact inventory count",`${state.dozens} dozen, ${state.packs18} 18-packs, ${state.loose} loose`);
    save(); toast(`Inventory set to ${physicalTotal()} eggs.`);
  };
  window.inventoryRemove = reason => {
    const q=Math.round(num(document.getElementById("inventoryAdjustQty")?.value));
    if(q<=0){alert("Enter how many eggs left inventory.");return;}
    if(q>physicalTotal() && !confirm(`You only have ${physicalTotal()} eggs recorded. Set inventory to 0?`))return;
    const removed=Math.min(q,physicalTotal());
    removeFromPhysical(removed); addHistory(-removed,reason); save();
    const input=document.getElementById("inventoryAdjustQty");if(input)input.value="";
    toast(`${removed} eggs removed — ${reason}.`);
  };
  window.inventoryAddEggs = () => {
    const q=Math.round(num(document.getElementById("inventoryAddQty")?.value));
    if(q<=0){alert("Enter how many eggs to add.");return;}
    addToPhysical(q); addHistory(q,"Manual inventory add"); save();
    const input=document.getElementById("inventoryAddQty");if(input)input.value="";
    toast(`${q} eggs added to inventory.`);
  };

  function hookShowScreen() {
    const original=window.showScreen;
    if(typeof original!=="function" || original._inventoryHook)return;
    const wrapped=function(){const result=original.apply(this,arguments);setTimeout(renderAll,0);return result;};
    wrapped._inventoryHook=true; window.showScreen=wrapped;
  }
  function hookCoreSaves() {
    ["saveEggs","saveSale"].forEach(name=>{
      const original=window[name]; if(typeof original!=="function"||original._inventoryHook)return;
      const wrapped=function(){const before=calculatedInventory();const result=original.apply(this,arguments);const after=calculatedInventory();
        if(name==="saveEggs" && after>before){addToPhysical(after-before);addHistory(after-before,"Egg collection","Automatically added from collection");save();}
        if(name==="saveSale" && after<before){const sold=before-after;removeFromPhysical(sold);addHistory(-sold,"Egg sale","Automatically removed from recorded sale");save();}
        return result;};
      wrapped._inventoryHook=true; window[name]=wrapped;
    });
  }

  function init() {
    injectUI(); hookShowScreen(); hookCoreSaves(); renderAll();
    if (!state.updatedAt) {
      addHistory(54,"Starting physical inventory","Initialized from 3 × 18-packs");
      save();
    }
    loadCloud();
    setInterval(renderAll,4000);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(init,50)); else setTimeout(init,50);
})();
