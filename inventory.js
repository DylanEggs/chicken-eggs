(() => {
  "use strict";

  const K = "chickenEggInventoryV2";
  const A = "chickenEggApp2V1";
  const CARTON_REPAIR_ID = "20260816-cartons-2x18-3doz-v1";
  const EXACT_IDS = ["inventoryDozens", "inventoryPacks18", "inventoryLoose"];
  let queued = false;
  let hooked = false;
  let exactDraft = false;

  const read = (k, f) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(f)); }
    catch { return f; }
  };
  const n = v => Math.max(0, Number(v) || 0);
  const whole = v => Math.max(0, Math.round(n(v)));
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const id = () => `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  function emptyState() {
    return { version: 4, dozens: 0, packs18: 0, loose: 0, adjustments: [], recoveryMarkers: {}, updatedAt: 0 };
  }

  function st() {
    const x = read(K, null);
    if (!x || typeof x !== "object") return emptyState();
    return {
      ...emptyState(),
      ...x,
      version: Math.max(4, Number(x.version) || 0),
      dozens: whole(x.dozens),
      packs18: whole(x.packs18),
      loose: whole(x.loose),
      adjustments: Array.isArray(x.adjustments) ? x.adjustments : [],
      recoveryMarkers: x.recoveryMarkers && typeof x.recoveryMarkers === "object" ? x.recoveryMarkers : {},
      updatedAt: Number(x.updatedAt) || 0
    };
  }

  const total = s => whole(s.dozens) * 12 + whole(s.packs18) * 18 + whole(s.loose);
  const res = () => {
    const a = read(A, { orders: [] });
    return (Array.isArray(a.orders) ? a.orders : [])
      .filter(o => o?.status === "pending")
      .reduce((q, o) => q + whole(o.dozen) * 12 + whole(o.packs18) * 18, 0);
  };

  function addLoose(s, qty) {
    s.loose = whole(s.loose) + whole(qty);
  }

  function removeGeneric(s, qty) {
    let remaining = Math.min(whole(qty), total(s));
    const removed = remaining;

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
    return removed - remaining;
  }

  function removeSmart(s, qty) {
    let remaining = Math.min(whole(qty), total(s));
    const requested = remaining;

    if (remaining > 0 && remaining % 12 === 0) {
      const wanted = Math.floor(remaining / 12);
      const take = Math.min(whole(s.dozens), wanted);
      s.dozens = whole(s.dozens) - take;
      remaining -= take * 12;
    }
    if (remaining > 0 && remaining % 18 === 0) {
      const wanted = Math.floor(remaining / 18);
      const take = Math.min(whole(s.packs18), wanted);
      s.packs18 = whole(s.packs18) - take;
      remaining -= take * 18;
    }
    if (remaining > 0) removeGeneric(s, remaining);
    return requested;
  }

  function save(s, delta = 0, reason = "Inventory adjustment", details = "", forceLog = false) {
    s.version = 4;
    s.adjustments = Array.isArray(s.adjustments) ? s.adjustments : [];
    s.recoveryMarkers = s.recoveryMarkers && typeof s.recoveryMarkers === "object" ? s.recoveryMarkers : {};
    if (delta || reason === "Exact inventory count" || forceLog) {
      s.adjustments.unshift({
        id: id(), date: today(), at: Date.now(), delta, reason, details, totalAfter: total(s),
        cartonBreakdown: { dozens: whole(s.dozens), packs18: whole(s.packs18), loose: whole(s.loose) }
      });
    }
    s.adjustments = s.adjustments.slice(0, 100);
    s.updatedAt = Date.now();
    localStorage.setItem(K, JSON.stringify(s));
    if (typeof window.syncFarmNow === "function") void Promise.resolve(window.syncFarmNow()).catch(() => {});
    renderSoon();
  }

  function updateDraftStatus(message = "") {
    const el = document.getElementById("inventoryExactDraftStatus");
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.style.display = "block";
    } else {
      el.textContent = "";
      el.style.display = "none";
    }
  }

  function markExactDraft() {
    exactDraft = true;
    updateDraftStatus("Unsaved changes — finish all three fields, then tap Save Exact Inventory.");
  }

  function bindExactEditor() {
    for (const inputId of EXACT_IDS) {
      const input = document.getElementById(inputId);
      if (!input || input.dataset.inventoryExactBound === "1") continue;
      input.dataset.inventoryExactBound = "1";
      input.addEventListener("input", markExactDraft);
      input.addEventListener("change", markExactDraft);
    }
  }

  function repairKnownCartonBreakdown() {
    if (exactDraft) return false;
    const s = st();
    if (s.recoveryMarkers?.[CARTON_REPAIR_ID]) return false;

    if (whole(s.dozens) === 0 && whole(s.packs18) === 4) {
      const before = total(s);
      s.dozens = 3;
      s.packs18 = 2;
      s.recoveryMarkers[CARTON_REPAIR_ID] = {
        appliedAt: Date.now(), total: before,
        from: { dozens: 0, packs18: 4 },
        to: { dozens: 3, packs18: 2 },
        loose: whole(s.loose)
      };
      save(s, 0, "Carton breakdown repair", "Restored 2 18-packs + 3 dozen without changing the egg total or loose eggs.", true);
      console.log("✅ Restored real carton breakdown without changing inventory total");
      return true;
    }
    return false;
  }

  function inject() {
    if (!document.getElementById("invCleanCss")) {
      const x = document.createElement("style");
      x.id = "invCleanCss";
      x.textContent = '.inventory-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:12px 0}.inventory-box{text-align:center;padding:14px;border-radius:18px;background:rgba(255,255,255,.68)}.inventory-box b{display:block;font-size:26px}.inventory-setGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.inventory-historyRow{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(127,127,127,.15)}#inventoryExactDraftStatus{display:none;margin:8px 0 0;font-size:12px;font-weight:850;color:var(--gold,#b7791f)}@media(max-width:600px){.inventory-setGrid{grid-template-columns:1fr}}';
      document.head.appendChild(x);
    }

    const app = document.querySelector(".app");
    const nav = document.querySelector(".bottomNav");
    if (app && nav && !document.getElementById("farm2Inventory")) {
      const w = document.createElement("div");
      w.innerHTML = `<section id="farm2Inventory" class="screen"><div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Egg Inventory</h2></div><div id="inventorySummary"></div><div class="farm2-card"><h3>✏️ Set Exact Inventory</h3><div class="inventory-setGrid"><div><label>Dozen Cartons</label><input id="inventoryDozens" type="number" min="0"></div><div><label>18-Packs</label><input id="inventoryPacks18" type="number" min="0"></div><div><label>Loose Eggs</label><input id="inventoryLoose" type="number" min="0"></div></div><div id="inventoryExactDraftStatus"></div><button onclick="inventorySetExact()">Save Exact Inventory</button></div><div class="farm2-card"><h3>🥚 Use / Give Away</h3><input id="inventoryAdjustQty" type="number" min="1" placeholder="How many eggs?"><button onclick="inventoryRemove('Used at home')">🍳 Used at Home</button><button onclick="inventoryRemove('Gave to family')">❤️ Gave to Family</button><button onclick="inventoryRemove('Broken / damaged')">💔 Broken / Damaged</button></div><div class="farm2-card"><h3>➕ Add Eggs</h3><input id="inventoryAddQty" type="number" min="1"><button onclick="inventoryAddEggs()">Add Eggs</button></div><div class="farm2-card"><h3>🕒 Inventory History</h3><div id="inventoryHistory"></div></div></section>`;
      app.insertBefore(w.firstElementChild, nav);
    }

    bindExactEditor();

    const g = document.querySelector("#farm2Hub .farm2-hubGrid");
    if (g && !document.getElementById("inventoryHubButton")) {
      const b = document.createElement("button");
      b.id = "inventoryHubButton";
      b.className = "farm2-hubButton green";
      b.setAttribute("onclick", "showScreen('farm2Inventory')");
      b.innerHTML = '<span class="farm2-bigEmoji">🥚</span>Inventory<small>Physical egg count</small>';
      g.prepend(b);
    }

    const t = document.getElementById("farm2TodayCard");
    if (t && !document.getElementById("inventoryDashboardCard")) {
      const d = document.createElement("div");
      d.id = "inventoryDashboardCard";
      d.className = "farm2-card";
      t.insertAdjacentElement("afterend", d);
    }
  }

  function render() {
    queued = false;
    inject();
    const s = st();
    const on = total(s);
    const r = res();
    const av = Math.max(0, on - r);
    const sum = document.getElementById("inventorySummary");
    if (sum) sum.innerHTML = `<div class="inventory-grid"><div class="inventory-box"><b>${on}</b><span>On Hand</span></div><div class="inventory-box"><b>${r}</b><span>Reserved</span></div><div class="inventory-box"><b>${av}</b><span>Available</span></div></div><div class="farm2-card">${s.dozens} dozen • ${s.packs18} 18-packs • ${s.loose} loose</div>`;

    if (!exactDraft) {
      [["inventoryDozens", s.dozens], ["inventoryPacks18", s.packs18], ["inventoryLoose", s.loose]].forEach(([i, v]) => {
        const e = document.getElementById(i);
        if (e) e.value = v;
      });
      updateDraftStatus("");
    }

    const h = document.getElementById("inventoryHistory");
    if (h) h.innerHTML = s.adjustments.length
      ? s.adjustments.slice(0, 30).map(a => `<div class="inventory-historyRow"><span>${a.reason}<small class="farm2-subtle"> ${a.date || ""}</small></span><b>${Number(a.delta) > 0 ? "+" : ""}${Number(a.delta) || 0} 🥚</b></div>`).join("")
      : '<div class="farm2-empty">No inventory adjustments yet.</div>';

    const c = document.getElementById("inventoryDashboardCard");
    if (c) c.innerHTML = `<div class="farm2-sectionHeader"><div><div class="farm2-kicker">Physical Egg Inventory</div><h3>${av} eggs available</h3></div></div><div class="inventory-grid"><div class="inventory-box"><b>${on}</b><span>On Hand</span></div><div class="inventory-box"><b>${r}</b><span>Reserved</span></div><div class="inventory-box"><b>${av}</b><span>Sell / Use</span></div></div><div class="farm2-subtle">${s.dozens} dozen • ${s.packs18} 18-packs • ${s.loose} loose</div><button onclick="showScreen('farm2Inventory')">✏️ Edit Inventory</button>`;
  }

  function renderSoon() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  }

  window.inventorySetExact = () => {
    const dozens = whole(document.getElementById("inventoryDozens")?.value);
    const packs18 = whole(document.getElementById("inventoryPacks18")?.value);
    const loose = whole(document.getElementById("inventoryLoose")?.value);
    const s = st();
    const old = total(s);
    s.dozens = dozens;
    s.packs18 = packs18;
    s.loose = loose;
    exactDraft = false;
    save(s, total(s) - old, "Exact inventory count", `${s.dozens} dozen, ${s.packs18} 18-packs, ${s.loose} loose`);
  };

  window.inventoryRemove = reason => {
    const q = whole(document.getElementById("inventoryAdjustQty")?.value);
    if (!q) { alert("Enter how many eggs left inventory."); return; }
    const s = st();
    const old = total(s);
    const rm = Math.min(q, old);
    removeSmart(s, rm);
    save(s, -rm, reason, `Removed ${rm} eggs while preserving untouched carton types.`);
    const e = document.getElementById("inventoryAdjustQty");
    if (e) e.value = "";
  };

  window.inventoryAddEggs = () => {
    const q = whole(document.getElementById("inventoryAddQty")?.value);
    if (!q) { alert("Enter how many eggs to add."); return; }
    const s = st();
    addLoose(s, q);
    save(s, q, "Manual inventory add", `Added ${q} loose eggs; existing cartons were left unchanged.`);
    const e = document.getElementById("inventoryAddQty");
    if (e) e.value = "";
  };

  window.getPhysicalEggInventory = () => {
    const s = st();
    const onHand = total(s);
    const reserved = res();
    return { state: s, onHand, reserved, available: Math.max(0, onHand - reserved) };
  };

  window.InventoryCartonMathV4 = {
    total: () => total(st()),
    addLoose(q) { const s = st(); addLoose(s, q); return s; },
    removeGeneric(q) { const s = st(); removeGeneric(s, q); return s; },
    removeSmart(q) { const s = st(); removeSmart(s, q); return s; },
    exactDraft: () => exactDraft
  };

  function hook() {
    if (hooked) return;
    if (typeof window.showScreen !== "function") { setTimeout(hook, 100); return; }
    hooked = true;
    const o = window.showScreen;
    window.showScreen = function() {
      const next = String(arguments[0] || "");
      if (next && next !== "farm2Inventory" && exactDraft) {
        exactDraft = false;
        updateDraftStatus("");
      }
      const z = o.apply(this, arguments);
      setTimeout(renderSoon, 0);
      return z;
    };
  }

  function init() {
    hook();
    render();
    setTimeout(repairKnownCartonBreakdown, 2200);
    window.addEventListener("farm-data-synced", e => {
      if (!e.detail?.key || [K, A].includes(e.detail.key)) {
        if (e.detail?.key === K) setTimeout(repairKnownCartonBreakdown, 80);
        renderSoon();
      }
    });
    window.addEventListener("core-data-synced", renderSoon);
    window.addEventListener("storage", e => { if ([K, A].includes(e.key)) renderSoon(); });
    console.log("✅ Physical inventory v4 active — exact editor draft lock + real carton preservation");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 80));
  else setTimeout(init, 80);
})();
