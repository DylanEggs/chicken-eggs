(() => {
  "use strict";

  const K = "chickenEggInventoryV2";
  const A = "chickenEggApp2V1";
  let queued = false;
  let hooked = false;

  const read = (k, f) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(f)); }
    catch { return f; }
  };
  const n = v => Math.max(0, Number(v) || 0);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const id = () => `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  function emptyState() {
    return { version: 3, dozens: 0, packs18: 0, loose: 0, adjustments: [], updatedAt: 0 };
  }

  function st() {
    const x = read(K, null);
    if (!x || typeof x !== "object") return emptyState();
    return {
      ...emptyState(),
      ...x,
      version: Math.max(3, Number(x.version) || 0),
      dozens: n(x.dozens),
      packs18: n(x.packs18),
      loose: n(x.loose),
      adjustments: Array.isArray(x.adjustments) ? x.adjustments : [],
      updatedAt: Number(x.updatedAt) || 0
    };
  }

  const total = s => Math.round(n(s.dozens) * 12 + n(s.packs18) * 18 + n(s.loose));
  const res = () => {
    const a = read(A, { orders: [] });
    return (Array.isArray(a.orders) ? a.orders : [])
      .filter(o => o?.status === "pending")
      .reduce((q, o) => q + n(o.dozen) * 12 + n(o.packs18) * 18, 0);
  };
  const pack = t => ({ dozens: 0, packs18: Math.floor(Math.max(0, t) / 18), loose: Math.max(0, t) % 18 });

  function save(s, delta = 0, reason = "Inventory adjustment", details = "") {
    s.version = 3;
    s.adjustments = Array.isArray(s.adjustments) ? s.adjustments : [];
    if (delta || reason === "Exact inventory count") {
      s.adjustments.unshift({
        id: id(), date: today(), at: Date.now(), delta, reason, details, totalAfter: total(s)
      });
    }
    s.adjustments = s.adjustments.slice(0, 100);
    s.updatedAt = Date.now();
    localStorage.setItem(K, JSON.stringify(s));
    renderSoon();
  }

  function inject() {
    if (!document.getElementById("invCleanCss")) {
      const x = document.createElement("style");
      x.id = "invCleanCss";
      x.textContent = '.inventory-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:12px 0}.inventory-box{text-align:center;padding:14px;border-radius:18px;background:rgba(255,255,255,.68)}.inventory-box b{display:block;font-size:26px}.inventory-setGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.inventory-historyRow{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(127,127,127,.15)}@media(max-width:600px){.inventory-setGrid{grid-template-columns:1fr}}';
      document.head.appendChild(x);
    }

    const app = document.querySelector(".app");
    const nav = document.querySelector(".bottomNav");
    if (app && nav && !document.getElementById("farm2Inventory")) {
      const w = document.createElement("div");
      w.innerHTML = `<section id="farm2Inventory" class="screen"><div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Egg Inventory</h2></div><div id="inventorySummary"></div><div class="farm2-card"><h3>✏️ Set Exact Inventory</h3><div class="inventory-setGrid"><div><label>Dozen Cartons</label><input id="inventoryDozens" type="number" min="0"></div><div><label>18-Packs</label><input id="inventoryPacks18" type="number" min="0"></div><div><label>Loose Eggs</label><input id="inventoryLoose" type="number" min="0"></div></div><button onclick="inventorySetExact()">Save Exact Inventory</button></div><div class="farm2-card"><h3>🥚 Use / Give Away</h3><input id="inventoryAdjustQty" type="number" min="1" placeholder="How many eggs?"><button onclick="inventoryRemove('Used at home')">🍳 Used at Home</button><button onclick="inventoryRemove('Gave to family')">❤️ Gave to Family</button><button onclick="inventoryRemove('Broken / damaged')">💔 Broken / Damaged</button></div><div class="farm2-card"><h3>➕ Add Eggs</h3><input id="inventoryAddQty" type="number" min="1"><button onclick="inventoryAddEggs()">Add Eggs</button></div><div class="farm2-card"><h3>🕒 Inventory History</h3><div id="inventoryHistory"></div></div></section>`;
      app.insertBefore(w.firstElementChild, nav);
    }

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

    [["inventoryDozens", s.dozens], ["inventoryPacks18", s.packs18], ["inventoryLoose", s.loose]].forEach(([i, v]) => {
      const e = document.getElementById(i);
      if (e && document.activeElement !== e) e.value = v;
    });

    const h = document.getElementById("inventoryHistory");
    if (h) h.innerHTML = s.adjustments.length
      ? s.adjustments.slice(0, 30).map(a => `<div class="inventory-historyRow"><span>${a.reason}<small class="farm2-subtle"> ${a.date || ""}</small></span><b>${n(a.delta) > 0 ? "+" : ""}${Number(a.delta) || 0} 🥚</b></div>`).join("")
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
    const s = st();
    const old = total(s);
    s.dozens = n(document.getElementById("inventoryDozens")?.value);
    s.packs18 = n(document.getElementById("inventoryPacks18")?.value);
    s.loose = n(document.getElementById("inventoryLoose")?.value);
    save(s, total(s) - old, "Exact inventory count", `${s.dozens} dozen, ${s.packs18} 18-packs, ${s.loose} loose`);
  };

  window.inventoryRemove = reason => {
    const q = Math.round(n(document.getElementById("inventoryAdjustQty")?.value));
    if (!q) { alert("Enter how many eggs left inventory."); return; }
    const s = st();
    const old = total(s);
    const rm = Math.min(q, old);
    Object.assign(s, pack(old - rm));
    save(s, -rm, reason);
    const e = document.getElementById("inventoryAdjustQty");
    if (e) e.value = "";
  };

  window.inventoryAddEggs = () => {
    const q = Math.round(n(document.getElementById("inventoryAddQty")?.value));
    if (!q) { alert("Enter how many eggs to add."); return; }
    const s = st();
    Object.assign(s, pack(total(s) + q));
    save(s, q, "Manual inventory add");
    const e = document.getElementById("inventoryAddQty");
    if (e) e.value = "";
  };

  window.getPhysicalEggInventory = () => {
    const s = st();
    const onHand = total(s);
    const reserved = res();
    return { state: s, onHand, reserved, available: Math.max(0, onHand - reserved) };
  };

  function hook() {
    if (hooked) return;
    if (typeof window.showScreen !== "function") { setTimeout(hook, 100); return; }
    hooked = true;
    const o = window.showScreen;
    window.showScreen = function() {
      const z = o.apply(this, arguments);
      setTimeout(renderSoon, 0);
      return z;
    };
  }

  function init() {
    // Important: do NOT create a fresh inventory record on startup. On a new device,
    // Firebase must get the first chance to supply the existing physical inventory.
    hook();
    render();
    window.addEventListener("farm-data-synced", e => {
      if (!e.detail?.key || [K, A].includes(e.detail.key)) renderSoon();
    });
    window.addEventListener("core-data-synced", renderSoon);
    window.addEventListener("storage", e => { if ([K, A].includes(e.key)) renderSoon(); });
    console.log("✅ Physical inventory v3 active; cloud inventory wins cleanly on new devices");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 80));
  else setTimeout(init, 80);
})();
