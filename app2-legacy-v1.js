(() => {
  "use strict";

  const APP2_KEY = "chickenEggApp2V1";
  const CORE_ENTRIES_KEY = "chickenEggEntriesV102";
  const CORE_SETTINGS_KEY = "chickenEggSettingsV102";
  const SNAPSHOT_KEY = "chickenEggApp2SnapshotsV1";
  const CLOUD_DOC_ID = "__farm_app_2__";

  const defaultState = () => ({
    version: 1,
    customers: [],
    orders: [],
    expenses: [],
    flock: [],
    chores: [],
    saleMeta: {},
    achievements: {},
    goldenEggs: 0,
    goals: { monthlyEggs: 0, monthlyRevenue: 0 },
    preferences: { mode: "auto", holiday: "auto", surprises: true, sounds: true },
    activity: [],
    updatedAt: 0
  });

  let farm2 = defaultState();
  let cloudTimer = null;
  let app2EditingSaleId = null;
  let initialized = false;

  function num(v) { return Number(v) || 0; }
  function money(v) { return "$" + num(v).toFixed(2); }
  function nowId(prefix = "f2") {
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }
  function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function coreEntries() {
    return readJSON(CORE_ENTRIES_KEY, []).filter(e => e && (e.type === "eggs" || e.type === "sale"));
  }
  function coreSettings() { return readJSON(CORE_SETTINGS_KEY, {}); }
  function revenue(e) { return num(e.dozenSold) * num(e.dozenPrice) + num(e.packSold) * num(e.packPrice); }
  function eggsSold(e) { return num(e.dozenSold) * 12 + num(e.packSold) * 18; }
  function allRevenue(list = coreEntries()) { return list.reduce((s, e) => s + (e.type === "sale" ? revenue(e) : 0), 0); }
  function allCollected(list = coreEntries()) { return list.reduce((s, e) => s + (e.type === "eggs" ? num(e.eggs) : 0), 0); }
  function monthPrefix(d = new Date()) { return localDate(d).slice(0, 7); }
  function thisMonth(list = coreEntries()) {
    const p = monthPrefix();
    return list.filter(e => String(e.date || "").startsWith(p));
  }
  function thisYear(list = coreEntries()) {
    const y = String(new Date().getFullYear());
    return list.filter(e => String(e.date || "").startsWith(y));
  }

  function sanitizeState(s) {
    const d = defaultState();
    if (!s || typeof s !== "object") return d;
    return {
      ...d,
      ...s,
      customers: Array.isArray(s.customers) ? s.customers : [],
      orders: Array.isArray(s.orders) ? s.orders : [],
      expenses: Array.isArray(s.expenses) ? s.expenses : [],
      flock: Array.isArray(s.flock) ? s.flock : [],
      chores: Array.isArray(s.chores) ? s.chores : [],
      saleMeta: s.saleMeta && typeof s.saleMeta === "object" ? s.saleMeta : {},
      achievements: s.achievements && typeof s.achievements === "object" ? s.achievements : {},
      goals: { ...d.goals, ...(s.goals || {}) },
      preferences: { ...d.preferences, ...(s.preferences || {}) },
      activity: Array.isArray(s.activity) ? s.activity.slice(0, 100) : [],
      goldenEggs: num(s.goldenEggs),
      updatedAt: num(s.updatedAt)
    };
  }

  function loadLocal2() { farm2 = sanitizeState(readJSON(APP2_KEY, defaultState())); }
  function persistLocal2() {
    farm2.updatedAt = Date.now();
    localStorage.setItem(APP2_KEY, JSON.stringify(farm2));
    scheduleCloudSave();
    renderFarm2();
  }

  async function cloudSave2() {
    try {
      if (!window.FirestoreDB || !window.FirebaseUser) return;
      const { doc, setDoc, serverTimestamp } = await import(
        "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
      );
      await setDoc(doc(window.FirestoreDB, "entries", CLOUD_DOC_ID), {
        type: "app2",
        farmApp2: farm2,
        updatedAt: farm2.updatedAt,
        serverUpdatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Farm App 2 cloud save skipped:", err);
    }
  }

  function scheduleCloudSave() {
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(cloudSave2, 500);
  }

  async function cloudLoad2() {
    try {
      if (window.ChickenEggsDB?.waitUntilReady) await window.ChickenEggsDB.waitUntilReady();
      if (!window.FirestoreDB) return;
      const { doc, getDoc } = await import(
        "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
      );
      const snap = await getDoc(doc(window.FirestoreDB, "entries", CLOUD_DOC_ID));
      if (!snap.exists()) {
        if (farm2.updatedAt) scheduleCloudSave();
        return;
      }
      const remote = sanitizeState(snap.data()?.farmApp2);
      if (remote.updatedAt >= farm2.updatedAt) {
        farm2 = remote;
        localStorage.setItem(APP2_KEY, JSON.stringify(farm2));
        applyTheme();
        renderFarm2();
      } else {
        scheduleCloudSave();
      }
    } catch (err) {
      console.warn("Farm App 2 cloud load skipped:", err);
    }
  }

  function logActivity(icon, text) {
    farm2.activity.unshift({ id: nowId("act"), icon, text, at: Date.now(), date: localDate() });
    farm2.activity = farm2.activity.slice(0, 100);
  }

  function toast(text) {
    let t = document.getElementById("farm2Toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "farm2Toast";
      t.className = "farm2-toast";
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2300);
  }

  function beep(kind = "egg") {
    if (!farm2.preferences.sounds) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = kind === "sale" ? 880 : kind === "gold" ? 1040 : 620;
      gain.gain.setValueAtTime(.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .23);
      osc.start();
      osc.stop(ctx.currentTime + .24);
      osc.onended = () => ctx.close();
    } catch {}
  }

  function celebration({ emoji = "🥚", title = "Saved!", message = "", style = "", confetti = ["🥚", "✨", "🐔"] } = {}) {
    if (!farm2.preferences.surprises) { toast(message || title); return; }
    let overlay = document.getElementById("farm2Celebration");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "farm2Celebration";
      overlay.addEventListener("click", () => overlay.classList.remove("show"));
      document.body.appendChild(overlay);
    }
    const bits = Array.from({ length: 24 }, (_, i) => {
      const item = confetti[i % confetti.length];
      return `<i style="left:${(i * 41) % 100}%;animation-delay:${(i % 8) * .08}s">${item}</i>`;
    }).join("");
    overlay.innerHTML = `
      <div class="farm2-celebrateCard ${style}">
        <div class="farm2-confetti">${bits}</div>
        <span class="farm2-celebrateEmoji">${emoji}</span>
        <h2>${title}</h2>
        <p>${message}</p>
        <div class="farm2-subtle" style="color:inherit;margin-top:12px;">Tap anywhere to close</div>
      </div>`;
    overlay.classList.add("show");
    clearTimeout(overlay._timer);
    overlay._timer = setTimeout(() => overlay.classList.remove("show"), 3600);
  }

  function randomCollectionCelebration(count, previousBest) {
    const roll = Math.random();
    if (count > previousBest && previousBest > 0) {
      celebration({ emoji: "🏆", title: "NEW FARM RECORD!", message: `${count} eggs! The girls just beat the old record of ${previousBest}.`, style: "rare", confetti: ["🏆","🥚","🎉","🐔"] });
      beep("gold");
      return;
    }
    if (roll < .012) {
      celebration({ emoji: "🛸", title: "ULTRA RARE EVENT!", message: `The aliens inspected the coop and left the ${count} eggs alone. Probably.`, style: "rare", confetti: ["🛸","👽","🥚","✨"] });
      beep("gold");
      return;
    }
    if (roll < .055) {
      farm2.goldenEggs += 1;
      logActivity("🌟", `Found Golden Egg #${farm2.goldenEggs}`);
      persistLocal2();
      celebration({ emoji: "🌟🥚", title: "GOLDEN EGG!", message: `Golden Egg #${farm2.goldenEggs} discovered! Your real total is still ${count} eggs.`, style: "gold", confetti: ["🌟","🥚","✨","👑"] });
      beep("gold");
      return;
    }
    if (count % 12 === 0) {
      celebration({ emoji: "📦", title: "Perfect Cartons!", message: `${count} eggs is exactly ${count / 12} full dozen${count === 12 ? "" : "s"}.`, style: "gold", confetti: ["🥚","📦","✨"] });
      beep("egg");
      return;
    }
    const messages = [
      `Arie has reviewed the numbers and claims full credit for all ${count} eggs.`,
      `The girls were busy — ${count} eggs added to inventory.`,
      `${count} eggs secured. Hen House Operations are running smoothly.`,
      `BREAKING NEWS: local hens produce another ${count} eggs.`,
      `${count} eggs! Farm economists describe today's outlook as egg-cellent.`,
      `${count} eggs collected. The flock demands payment in treats.`
    ];
    celebration({ emoji: roll < .28 ? "🐓" : "🥚", title: roll < .28 ? "Arie’s Report" : "Collection Saved!", message: messages[Math.floor(Math.random() * messages.length)] });
    beep("egg");
  }

  function randomSaleCelebration(amount) {
    const roll = Math.random();
    if (roll < .018) {
      celebration({ emoji: "💰", title: "SALE JACKPOT!", message: `${money(amount)} sale recorded! The cash register has lost its mind.`, style: "gold", confetti: ["💵","💰","✨","🥚"] });
      beep("gold");
    } else {
      const messages = [
        `${money(amount)} added to farm revenue. Cha-ching!`,
        `Sold! ${money(amount)} in the egg bank.`,
        `Another happy egg customer — ${money(amount)} recorded.`,
        `${money(amount)} sale complete. The hens would like a commission.`
      ];
      celebration({ emoji: "💵", title: "Sale Recorded!", message: messages[Math.floor(Math.random() * messages.length)], confetti: ["💵","✨","🥚"] });
      beep("sale");
    }
  }

  function inventoryStats() {
    const list = coreEntries();
    const collected = allCollected(list);
    const sold = list.reduce((s, e) => s + (e.type === "sale" ? eggsSold(e) : 0), 0);
    const physical = Math.max(0, collected - sold);
    const reserved = farm2.orders
      .filter(o => o.status === "pending")
      .reduce((s, o) => s + num(o.dozen) * 12 + num(o.packs18) * 18, 0);
    return { collected, sold, physical, reserved, available: Math.max(0, physical - reserved) };
  }

  function monthStats() {
    const list = thisMonth();
    const eggs = allCollected(list);
    const rev = allRevenue(list);
    const expenses = farm2.expenses
      .filter(e => String(e.date || "").startsWith(monthPrefix()))
      .reduce((s, e) => s + num(e.amount), 0);
    return { eggs, rev, expenses, profit: rev - expenses };
  }

  function todayStats() {
    const d = localDate();
    const list = coreEntries().filter(e => e.date === d);
    return {
      eggs: list.filter(e => e.type === "eggs").reduce((s, e) => s + num(e.eggs), 0),
      sales: list.filter(e => e.type === "sale").reduce((s, e) => s + revenue(e), 0),
      saleCount: list.filter(e => e.type === "sale").length
    };
  }

  function eggStreak() {
    const days = [...new Set(coreEntries().filter(e => e.type === "eggs").map(e => e.date))].sort().reverse();
    if (!days.length) return 0;
    let cursor = new Date(localDate() + "T00:00:00");
    const yesterday = new Date(cursor); yesterday.setDate(cursor.getDate() - 1);
    const first = days[0];
    if (first !== localDate(cursor) && first !== localDate(yesterday)) return 0;
    cursor = new Date(first + "T00:00:00");
    let streak = 0;
    const set = new Set(days);
    while (set.has(localDate(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  const ACHIEVEMENTS = [
    { id:"egg100", icon:"🥚", name:"First Hundred", desc:"Collect 100 lifetime eggs", test: s => s.eggs >= 100 },
    { id:"egg1000", icon:"🏆", name:"Egg Mountain", desc:"Collect 1,000 lifetime eggs", test: s => s.eggs >= 1000 },
    { id:"egg5000", icon:"👑", name:"Flock Legend", desc:"Collect 5,000 lifetime eggs", test: s => s.eggs >= 5000 },
    { id:"sale10", icon:"💵", name:"Egg Dealer", desc:"Record 10 sales", test: s => s.sales >= 10 },
    { id:"sale50", icon:"💰", name:"Market Boss", desc:"Record 50 sales", test: s => s.sales >= 50 },
    { id:"streak7", icon:"🔥", name:"On a Roll", desc:"Log eggs 7 days in a row", test: s => s.streak >= 7 },
    { id:"streak30", icon:"🌟", name:"Never Miss", desc:"Log eggs 30 days in a row", test: s => s.streak >= 30 },
    { id:"gold1", icon:"🌟🥚", name:"Golden!", desc:"Find your first Golden Egg", test: s => s.gold >= 1 },
    { id:"customer10", icon:"🤝", name:"Regular Crowd", desc:"Save 10 customers", test: s => s.customers >= 10 }
  ];

  function achievementStats() {
    const list = coreEntries();
    return {
      eggs: allCollected(list),
      sales: list.filter(e => e.type === "sale").length,
      streak: eggStreak(),
      gold: farm2.goldenEggs,
      customers: farm2.customers.length
    };
  }

  function checkAchievements(showPop = false) {
    const s = achievementStats();
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (!farm2.achievements[a.id] && a.test(s)) {
        farm2.achievements[a.id] = { unlockedAt: Date.now() };
        logActivity("🏅", `Achievement unlocked: ${a.name}`);
        changed = true;
        if (showPop) celebration({ emoji: a.icon, title: "Achievement Unlocked!", message: `${a.name} — ${a.desc}`, style: "gold", confetti: ["🏅","✨","🥚"] });
      }
    }
    if (changed) persistLocal2();
  }

  function holidayName() {
    if (farm2.preferences.holiday === "off") return "";
    const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    if (m === 12 && day >= 1) return "christmas";
    if (m === 10 && day >= 1) return "halloween";
    if (m === 7 && day >= 1 && day <= 7) return "july4";
    if (m === 11 && day >= 15) return "thanksgiving";
    if ((m === 3 && day >= 20) || (m === 4 && day <= 20)) return "easter";
    return "";
  }

  function applyTheme() {
    let mode = farm2.preferences.mode || "auto";
    if (mode === "auto") mode = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.body.classList.toggle("farm2-dark", mode === "dark");
    const h = holidayName();
    if (h) document.body.dataset.farm2Holiday = h;
    else delete document.body.dataset.farm2Holiday;
    const btn = document.getElementById("farm2ThemeBtn");
    if (btn) btn.textContent = mode === "dark" ? "🌙" : "☀️";
  }

  function cycleTheme() {
    const order = ["auto", "light", "dark"];
    const current = farm2.preferences.mode || "auto";
    farm2.preferences.mode = order[(order.indexOf(current) + 1) % order.length];
    persistLocal2();
    applyTheme();
    toast(`Display: ${farm2.preferences.mode}`);
  }

  function addInjectedUI() {
    if (document.getElementById("farm2Hub")) return;

    const header = document.querySelector(".appHeader");
    if (header) {
      const tools = document.createElement("div");
      tools.className = "farm2-headerTools";
      tools.innerHTML = `<button id="farm2ThemeBtn" class="farm2-iconButton" onclick="farm2CycleTheme()" title="Change display mode">☀️</button>`;
      header.appendChild(tools);
    }

    const todayCard = document.createElement("div");
    todayCard.id = "farm2TodayCard";
    todayCard.className = "farm2-today";
    document.querySelector("#dashboard .heroCard")?.insertAdjacentElement("afterend", todayCard);

    const mainActions = document.querySelector("#dashboard .mainActions");
    if (mainActions) {
      const more = document.createElement("button");
      more.innerHTML = "✨ Farm App 2.0";
      more.onclick = () => window.showScreen("farm2Hub");
      mainActions.appendChild(more);
    }

    const eggInput = document.getElementById("eggCount");
    if (eggInput) {
      const q = document.createElement("div");
      q.className = "farm2-quickAdds";
      q.innerHTML = [1,6,12,18,24].map(n => `<button type="button" onclick="farm2QuickEgg(${n})">+${n}</button>`).join("");
      eggInput.insertAdjacentElement("afterend", q);

      const voice = document.createElement("button");
      voice.type = "button";
      voice.className = "secondary";
      voice.style.marginBottom = "10px";
      voice.textContent = "🎙️ Voice Egg Entry";
      voice.onclick = voiceEggEntry;
      q.insertAdjacentElement("afterend", voice);
    }

    const packPrice = document.getElementById("packPrice");
    if (packPrice) {
      const extra = document.createElement("div");
      extra.id = "farm2SaleExtras";
      extra.innerHTML = `
        <label>Customer (optional)</label>
        <select id="farm2SaleCustomer"><option value="">Walk-in / no customer</option></select>
        <label>Payment Status</label>
        <select id="farm2SalePaid"><option value="paid">Paid</option><option value="unpaid">Unpaid / Owes</option></select>
        <label>Sale Note</label>
        <input id="farm2SaleNote" type="text" placeholder="Optional note" />
        <div id="farm2SalePreview" class="farm2-salePreview">Sale total: $0.00</div>`;
      packPrice.insertAdjacentElement("afterend", extra);
      ["dozenSold","dozenPrice","packSold","packPrice"].forEach(id => document.getElementById(id)?.addEventListener("input", updateSalePreview));
    }

    const nav = document.querySelector(".bottomNav");
    if (nav) {
      nav.classList.add("farm2-nav");
      const b = document.createElement("button");
      b.setAttribute("onclick", "showScreen('farm2Hub')");
      b.innerHTML = "✨<span>More</span>";
      nav.insertBefore(b, nav.lastElementChild);
    }

    const container = document.querySelector(".app");
    const navEl = document.querySelector(".bottomNav");
    const screens = document.createElement("div");
    screens.innerHTML = farm2ScreensHTML();
    [...screens.children].forEach(el => container.insertBefore(el, navEl));

    updateCustomerSelects();
  }

  function farm2ScreensHTML() {
    return `
    <section id="farm2Hub" class="screen">
      <div class="screenTitle"><button class="backMini" onclick="showScreen('dashboard')">←</button><h2>Farm App 2.0</h2></div>
      <div id="farm2HubSummary"></div>
      <div class="farm2-hubGrid">
        <button class="farm2-hubButton blue" onclick="showScreen('farm2Customers')"><span class="farm2-bigEmoji">🤝</span>Customers<small>Sales history & who owes</small></button>
        <button class="farm2-hubButton gold" onclick="showScreen('farm2Orders')"><span class="farm2-bigEmoji">📦</span>Orders<small>Reserved eggs & due dates</small></button>
        <button class="farm2-hubButton orange" onclick="showScreen('farm2Expenses')"><span class="farm2-bigEmoji">🌽</span>Expenses<small>Feed cost & farm profit</small></button>
        <button class="farm2-hubButton purple" onclick="showScreen('farm2Flock')"><span class="farm2-bigEmoji">🐔</span>Flock<small>Profiles, breeds & ages</small></button>
        <button class="farm2-hubButton teal" onclick="showScreen('farm2Chores')"><span class="farm2-bigEmoji">✅</span>Chores<small>Keep farm jobs organized</small></button>
        <button class="farm2-hubButton rose" onclick="showScreen('farm2Fun')"><span class="farm2-bigEmoji">🏅</span>Fun & Goals<small>Achievements & Golden Eggs</small></button>
      </div>
      <div class="farm2-card">
        <h3>🔎 Search Everything</h3>
        <input id="farm2GlobalSearch" type="text" placeholder="Customer, chicken, order, date..." oninput="farm2SearchAll()" />
        <div id="farm2SearchResults" class="farm2-searchResults"></div>
      </div>
      <div class="farm2-card"><h3>⚙️ App 2 Settings</h3><button onclick="showScreen('farm2Settings')">Open Settings & Backup Tools</button></div>
    </section>

    <section id="farm2Customers" class="screen">
      <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Customers</h2></div>
      <div class="farm2-card">
        <h3>Add Customer</h3>
        <label>Name</label><input id="farm2CustomerName" placeholder="Customer name" />
        <div class="farm2-formRow">
          <div><label>Phone / Contact</label><input id="farm2CustomerContact" placeholder="Optional" /></div>
          <div><label>Usual Dozen Price</label><input id="farm2CustomerPrice" type="number" step=".01" placeholder="Optional" /></div>
        </div>
        <label>Notes</label><input id="farm2CustomerNotes" placeholder="Optional notes" />
        <button onclick="farm2AddCustomer()">Add Customer</button>
      </div>
      <div id="farm2CustomerSummary"></div>
      <div id="farm2CustomerList" class="farm2-list"></div>
    </section>

    <section id="farm2Orders" class="screen">
      <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Orders & Reservations</h2></div>
      <div class="farm2-card">
        <h3>Reserve Eggs</h3>
        <label>Customer</label><select id="farm2OrderCustomer"><option value="">Choose customer</option></select>
        <label>Due Date</label><input id="farm2OrderDate" type="date" />
        <div class="farm2-formRow">
          <div><label>Dozen</label><input id="farm2OrderDozen" type="number" min="0" placeholder="0" /></div>
          <div><label>18-Packs</label><input id="farm2OrderPacks" type="number" min="0" placeholder="0" /></div>
        </div>
        <label>Notes</label><input id="farm2OrderNotes" placeholder="Optional" />
        <button onclick="farm2AddOrder()">Save Reservation</button>
      </div>
      <div id="farm2OrderSummary"></div>
      <div id="farm2OrderList" class="farm2-list"></div>
    </section>

    <section id="farm2Expenses" class="screen">
      <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Expenses & Profit</h2></div>
      <div id="farm2ProfitSummary"></div>
      <div class="farm2-card">
        <h3>Add Expense</h3>
        <label>Date</label><input id="farm2ExpenseDate" type="date" />
        <label>Category</label>
        <select id="farm2ExpenseCategory">
          <option value="Feed">🌽 Feed</option><option value="Cartons">📦 Cartons</option><option value="Bedding">🪹 Bedding</option>
          <option value="Oyster Shell">🐚 Oyster Shell</option><option value="Medical">🩺 Medical</option><option value="Equipment">🛠️ Equipment</option><option value="Other">🧾 Other</option>
        </select>
        <label>Description</label><input id="farm2ExpenseDesc" placeholder="Example: 50 lb all-flock feed" />
        <label>Amount</label><input id="farm2ExpenseAmount" type="number" step=".01" placeholder="0.00" />
        <button onclick="farm2AddExpense()">Add Expense</button>
      </div>
      <div id="farm2ExpenseList" class="farm2-list"></div>
    </section>

    <section id="farm2Flock" class="screen">
      <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Flock Profiles</h2></div>
      <div class="farm2-card">
        <h3>Add Chicken</h3>
        <div class="farm2-formRow">
          <div><label>Name</label><input id="farm2BirdName" placeholder="Name" /></div>
          <div><label>Breed</label><input id="farm2BirdBreed" placeholder="Breed" /></div>
        </div>
        <div class="farm2-formRow">
          <div><label>Hatch / Birth Date</label><input id="farm2BirdDate" type="date" /></div>
          <div><label>Sex</label><select id="farm2BirdSex"><option>Hen</option><option>Rooster</option><option>Pullet</option><option>Cockerel</option><option>Unknown</option></select></div>
        </div>
        <label>Notes</label><input id="farm2BirdNotes" placeholder="Personality, first egg, etc." />
        <button onclick="farm2AddBird()">Add to Flock</button>
      </div>
      <div id="farm2FlockSummary"></div>
      <div id="farm2FlockList" class="farm2-list"></div>
    </section>

    <section id="farm2Chores" class="screen">
      <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Farm Chores</h2></div>
      <div class="farm2-card">
        <h3>Add Chore</h3>
        <label>Chore</label><input id="farm2ChoreName" placeholder="Refill oyster shell, clean coop..." />
        <div class="farm2-formRow">
          <div><label>Due Date</label><input id="farm2ChoreDate" type="date" /></div>
          <div><label>Repeat</label><select id="farm2ChoreRepeat"><option value="once">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
        </div>
        <button onclick="farm2AddChore()">Add Chore</button>
      </div>
      <div id="farm2ChoreList" class="farm2-list"></div>
    </section>

    <section id="farm2Fun" class="screen">
      <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Goals & Achievements</h2></div>
      <div id="farm2FunSummary"></div>
      <div class="farm2-card">
        <h3>Monthly Goals</h3>
        <div class="farm2-formRow">
          <div><label>Egg Goal</label><input id="farm2GoalEggs" type="number" placeholder="Example: 600" /></div>
          <div><label>Revenue Goal</label><input id="farm2GoalRevenue" type="number" step=".01" placeholder="Example: 250" /></div>
        </div>
        <button onclick="farm2SaveGoals()">Save Goals</button>
      </div>
      <div class="farm2-card"><h3>🏅 Achievements</h3><div id="farm2AchievementList" class="farm2-achievementGrid"></div></div>
    </section>

    <section id="farm2Settings" class="screen">
      <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>App 2 Settings</h2></div>
      <div class="farm2-card">
        <h3>Appearance & Fun</h3>
        <label>Display Mode</label><select id="farm2Mode" onchange="farm2SettingsChanged()"><option value="auto">Automatic</option><option value="light">Day / Light</option><option value="dark">Night / Dark</option></select>
        <label>Holiday Themes</label><select id="farm2Holiday" onchange="farm2SettingsChanged()"><option value="auto">Automatic</option><option value="off">Off</option></select>
        <div class="farm2-toggleRow"><div><b>Surprise animations</b><div class="farm2-subtle">Golden Eggs, rare events & celebrations</div></div><input class="farm2-switch" id="farm2Surprises" type="checkbox" onchange="farm2SettingsChanged()" /></div>
        <div class="farm2-toggleRow"><div><b>Sound effects</b><div class="farm2-subtle">Short egg and sale sounds</div></div><input class="farm2-switch" id="farm2Sounds" type="checkbox" onchange="farm2SettingsChanged()" /></div>
      </div>
      <div class="farm2-card">
        <h3>💾 Data Tools</h3>
        <p class="farm2-subtle">The backup now includes your original egg/sale logs plus customers, orders, expenses, flock profiles, chores, goals and achievements.</p>
        <button onclick="backupData()">💾 Download Full Backup</button>
        <button class="secondary" onclick="farm2ExportCSV()">📊 Export Egg & Sale CSV</button>
        <p class="farm2-subtle" style="margin-top:12px;">The app also keeps up to 5 automatic local safety snapshots.</p>
      </div>
      <div class="farm2-card"><h3>🕒 Recent Farm Activity</h3><div id="farm2Activity"></div></div>
    </section>`;
  }

  function updateSalePreview() {
    const total = num(document.getElementById("dozenSold")?.value) * num(document.getElementById("dozenPrice")?.value)
      + num(document.getElementById("packSold")?.value) * num(document.getElementById("packPrice")?.value);
    const el = document.getElementById("farm2SalePreview");
    if (el) el.textContent = `Sale total: ${money(total)}`;
  }

  function updateCustomerSelects() {
    const options = farm2.customers
      .slice().sort((a,b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${escapeAttr(c.id)}">${escapeHTML(c.name)}</option>`).join("");
    const sale = document.getElementById("farm2SaleCustomer");
    const order = document.getElementById("farm2OrderCustomer");
    if (sale) {
      const current = sale.value;
      sale.innerHTML = `<option value="">Walk-in / no customer</option>${options}`;
      sale.value = current;
    }
    if (order) {
      const current = order.value;
      order.innerHTML = `<option value="">Choose customer</option>${options}`;
      order.value = current;
    }
  }

  function escapeHTML(v) {
    return String(v ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[ch]));
  }
  function escapeAttr(v) { return escapeHTML(v); }

  function ageText(date) {
    if (!date) return "Age unknown";
    const birth = new Date(date + "T00:00:00");
    const now = new Date();
    let days = Math.floor((now - birth) / 86400000);
    if (!Number.isFinite(days) || days < 0) return "Age unknown";
    if (days < 84) return `${Math.floor(days / 7)} weeks old`;
    if (days < 730) return `${Math.floor(days / 30.44)} months old`;
    return `${(days / 365.25).toFixed(1)} years old`;
  }

  function renderDashboardCard() {
    const el = document.getElementById("farm2TodayCard");
    if (!el) return;
    const t = todayStats(), inv = inventoryStats(), ms = monthStats();
    const cartons = Math.floor(inv.available / 12), loose = inv.available % 12;
    const eggGoal = num(farm2.goals.monthlyEggs);
    const pct = eggGoal ? Math.min(100, (ms.eggs / eggGoal) * 100) : 0;
    el.innerHTML = `
      <div class="farm2-sectionHeader"><div><div class="farm2-kicker">What changed today?</div><h3>${t.eggs} eggs • ${money(t.sales)} sales</h3></div><span class="farm2-badge gold">🔥 ${eggStreak()} day streak</span></div>
      <div class="farm2-todayGrid">
        <div class="farm2-miniStat"><b>${inv.available}</b><span>Eggs available</span></div>
        <div class="farm2-miniStat"><b>${cartons}</b><span>Full dozens</span></div>
        <div class="farm2-miniStat"><b>${inv.reserved}</b><span>Reserved eggs</span></div>
        <div class="farm2-miniStat"><b>${money(ms.profit)}</b><span>Month profit</span></div>
      </div>
      <div class="farm2-subtle" style="margin-top:11px;">Inventory: ${cartons} dozen + ${loose} loose • ${farm2.goldenEggs} Golden Egg${farm2.goldenEggs === 1 ? "" : "s"} found</div>
      ${eggGoal ? `<div class="farm2-subtle" style="margin-top:10px;">Monthly egg goal: ${ms.eggs} / ${eggGoal}</div><div class="farm2-progress"><span style="width:${pct}%"></span></div>` : ""}`;
  }

  function renderHub() {
    const el = document.getElementById("farm2HubSummary");
    if (!el) return;
    const inv = inventoryStats(), ms = monthStats();
    const unpaid = unpaidTotal();
    const due = farm2.orders.filter(o => o.status === "pending").length;
    el.innerHTML = `
      <div class="farm2-grid2">
        <div class="farm2-card"><div class="farm2-kicker">Sellable Inventory</div><div class="farm2-moneyBig">${inv.available} 🥚</div><div class="farm2-subtle">${Math.floor(inv.available/12)} dozen + ${inv.available%12} loose after reservations</div></div>
        <div class="farm2-card"><div class="farm2-kicker">This Month</div><div class="farm2-moneyBig">${money(ms.profit)}</div><div class="farm2-subtle">${money(ms.rev)} sales − ${money(ms.expenses)} expenses</div></div>
      </div>
      <div class="farm2-inline">
        <span class="farm2-badge blue">📦 ${due} open order${due === 1 ? "" : "s"}</span>
        <span class="farm2-badge ${unpaid > 0 ? "red" : ""}">💳 ${money(unpaid)} unpaid</span>
        <span class="farm2-badge gold">🌟 ${farm2.goldenEggs} Golden Eggs</span>
      </div>`;
  }

  function customerStats(id) {
    const list = coreEntries().filter(e => e.type === "sale" && farm2.saleMeta[e.id]?.customerId === id);
    return {
      sales: list.length,
      eggs: list.reduce((s,e) => s + eggsSold(e), 0),
      spent: list.reduce((s,e) => s + revenue(e), 0),
      unpaid: list.reduce((s,e) => s + (farm2.saleMeta[e.id]?.paid === false ? revenue(e) : 0), 0),
      last: list.map(e => e.date).sort().reverse()[0] || ""
    };
  }

  function unpaidTotal() {
    return coreEntries().filter(e => e.type === "sale")
      .reduce((s,e) => s + (farm2.saleMeta[e.id]?.paid === false ? revenue(e) : 0), 0);
  }

  function renderCustomers() {
    const sum = document.getElementById("farm2CustomerSummary");
    const listEl = document.getElementById("farm2CustomerList");
    if (!sum || !listEl) return;
    sum.innerHTML = `<div class="farm2-grid2"><div class="farm2-card"><div class="farm2-kicker">Customers</div><div class="farm2-moneyBig">${farm2.customers.length}</div></div><div class="farm2-card"><div class="farm2-kicker">Still Owed</div><div class="farm2-moneyBig">${money(unpaidTotal())}</div></div></div>`;
    const rows = farm2.customers.slice().sort((a,b)=>a.name.localeCompare(b.name));
    listEl.innerHTML = rows.length ? rows.map(c => {
      const s = customerStats(c.id);
      return `<div class="farm2-listItem">
        <div class="farm2-listTop"><div><h4>🤝 ${escapeHTML(c.name)}</h4><div class="farm2-subtle">${escapeHTML(c.contact || "No contact saved")}</div></div>${s.unpaid ? `<span class="farm2-badge red">Owes ${money(s.unpaid)}</span>` : `<span class="farm2-badge">Paid up</span>`}</div>
        <div class="farm2-subtle" style="margin-top:9px;">${s.sales} sales • ${s.eggs} eggs • ${money(s.spent)} lifetime${s.last ? ` • Last ${s.last}` : ""}</div>
        ${c.price ? `<div class="farm2-subtle">Usual dozen price: ${money(c.price)}</div>` : ""}
        ${c.notes ? `<div class="farm2-subtle">📝 ${escapeHTML(c.notes)}</div>` : ""}
        <div class="farm2-actions"><button onclick="farm2UseCustomer('${c.id}')">Record Sale</button><button class="farm2-delete" onclick="farm2DeleteCustomer('${c.id}')">Delete</button></div>
      </div>`;
    }).join("") : `<div class="farm2-empty">No customers yet. Add your first regular above.</div>`;
  }

  function renderOrders() {
    const inv = inventoryStats();
    const pending = farm2.orders.filter(o => o.status === "pending");
    const sum = document.getElementById("farm2OrderSummary");
    const list = document.getElementById("farm2OrderList");
    if (!sum || !list) return;
    sum.innerHTML = `<div class="farm2-grid3">
      <div class="farm2-card"><div class="farm2-kicker">Open Orders</div><div class="farm2-moneyBig">${pending.length}</div></div>
      <div class="farm2-card"><div class="farm2-kicker">Eggs Reserved</div><div class="farm2-moneyBig">${inv.reserved}</div></div>
      <div class="farm2-card"><div class="farm2-kicker">Still Available</div><div class="farm2-moneyBig">${inv.available}</div></div>
    </div>`;
    const rows = farm2.orders.slice().sort((a,b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || String(a.dueDate).localeCompare(String(b.dueDate)));
    list.innerHTML = rows.length ? rows.map(o => {
      const c = farm2.customers.find(x => x.id === o.customerId);
      const eggCount = num(o.dozen)*12 + num(o.packs18)*18;
      return `<div class="farm2-listItem">
        <div class="farm2-listTop"><div><h4>📦 ${escapeHTML(c?.name || "Unassigned Order")}</h4><div class="farm2-subtle">Due ${escapeHTML(o.dueDate || "No date")} • ${o.dozen || 0} dozen • ${o.packs18 || 0} 18-packs (${eggCount} eggs)</div></div>
        <span class="farm2-badge ${o.status === "pending" ? "gold" : ""}">${escapeHTML(o.status)}</span></div>
        ${o.notes ? `<div class="farm2-subtle" style="margin-top:8px;">📝 ${escapeHTML(o.notes)}</div>` : ""}
        <div class="farm2-actions">
          ${o.status === "pending" ? `<button onclick="farm2CompleteOrder('${o.id}')">✓ Fulfilled</button>` : ""}
          <button class="farm2-delete" onclick="farm2DeleteOrder('${o.id}')">Delete</button>
        </div>
      </div>`;
    }).join("") : `<div class="farm2-empty">No reserved orders yet.</div>`;
  }

  function renderExpenses() {
    const el = document.getElementById("farm2ProfitSummary");
    const list = document.getElementById("farm2ExpenseList");
    if (!el || !list) return;
    const ms = monthStats();
    const yearExpenses = farm2.expenses.filter(e => String(e.date||"").startsWith(String(new Date().getFullYear()))).reduce((s,e)=>s+num(e.amount),0);
    const yearRev = allRevenue(thisYear());
    el.innerHTML = `<div class="farm2-grid3">
      <div class="farm2-card"><div class="farm2-kicker">Month Revenue</div><div class="farm2-moneyBig">${money(ms.rev)}</div></div>
      <div class="farm2-card"><div class="farm2-kicker">Month Expenses</div><div class="farm2-moneyBig">${money(ms.expenses)}</div></div>
      <div class="farm2-card"><div class="farm2-kicker">Month Profit</div><div class="farm2-moneyBig">${money(ms.profit)}</div></div>
    </div><div class="farm2-card"><b>Year estimate:</b> ${money(yearRev)} revenue − ${money(yearExpenses)} tracked expenses = <b>${money(yearRev-yearExpenses)}</b> tracked profit</div>`;
    const rows = farm2.expenses.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    list.innerHTML = rows.length ? rows.map(e => `<div class="farm2-listItem">
      <div class="farm2-listTop"><div><h4>${e.category === "Feed" ? "🌽" : "🧾"} ${escapeHTML(e.category)}</h4><div class="farm2-subtle">${escapeHTML(e.date)} • ${escapeHTML(e.description || "")}</div></div><div class="farm2-moneyBig" style="font-size:23px;">${money(e.amount)}</div></div>
      <div class="farm2-actions"><button class="farm2-delete" onclick="farm2DeleteExpense('${e.id}')">Delete</button></div>
    </div>`).join("") : `<div class="farm2-empty">No expenses tracked yet. Add feed purchases here to start seeing profit.</div>`;
  }

  function renderFlock() {
    const sum = document.getElementById("farm2FlockSummary");
    const list = document.getElementById("farm2FlockList");
    if (!sum || !list) return;
    const hens = farm2.flock.filter(b => ["Hen","Pullet"].includes(b.sex)).length;
    const roos = farm2.flock.filter(b => ["Rooster","Cockerel"].includes(b.sex)).length;
    sum.innerHTML = `<div class="farm2-grid3"><div class="farm2-card"><div class="farm2-kicker">Profiles</div><div class="farm2-moneyBig">${farm2.flock.length}</div></div><div class="farm2-card"><div class="farm2-kicker">Hens/Pullets</div><div class="farm2-moneyBig">${hens}</div></div><div class="farm2-card"><div class="farm2-kicker">Roosters</div><div class="farm2-moneyBig">${roos}</div></div></div>`;
    const rows = farm2.flock.slice().sort((a,b)=>a.name.localeCompare(b.name));
    list.innerHTML = rows.length ? rows.map(b => `<div class="farm2-listItem">
      <div class="farm2-listTop"><div><h4>${["Rooster","Cockerel"].includes(b.sex) ? "🐓" : "🐔"} ${escapeHTML(b.name)}</h4><div class="farm2-subtle">${escapeHTML(b.breed || "Breed not set")} • ${escapeHTML(b.sex)} • ${ageText(b.hatchDate)}</div></div><span class="farm2-badge purple">${escapeHTML(b.status || "Active")}</span></div>
      ${b.hatchDate ? `<div class="farm2-subtle" style="margin-top:7px;">Hatched ${escapeHTML(b.hatchDate)}</div>` : ""}
      ${b.notes ? `<div class="farm2-subtle">📝 ${escapeHTML(b.notes)}</div>` : ""}
      <div class="farm2-actions"><button class="farm2-delete" onclick="farm2DeleteBird('${b.id}')">Delete</button></div>
    </div>`).join("") : `<div class="farm2-empty">No profiles yet. Add your named birds and the app will keep their ages automatically.</div>`;
  }

  function nextChoreDate(date, repeat) {
    const d = new Date((date || localDate()) + "T12:00:00");
    if (repeat === "daily") d.setDate(d.getDate()+1);
    else if (repeat === "weekly") d.setDate(d.getDate()+7);
    else if (repeat === "monthly") d.setMonth(d.getMonth()+1);
    else return "";
    return localDate(d);
  }

  function renderChores() {
    const list = document.getElementById("farm2ChoreList");
    if (!list) return;
    const rows = farm2.chores.slice().sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
    list.innerHTML = rows.length ? rows.map(c => {
      const overdue = c.dueDate && c.dueDate < localDate();
      return `<div class="farm2-listItem">
        <div class="farm2-listTop"><div><h4>${overdue ? "⚠️" : "✅"} ${escapeHTML(c.name)}</h4><div class="farm2-subtle">Due ${escapeHTML(c.dueDate || "Anytime")} • ${escapeHTML(c.repeat)}</div></div>${overdue ? `<span class="farm2-badge red">Overdue</span>` : `<span class="farm2-badge">Open</span>`}</div>
        <div class="farm2-actions"><button onclick="farm2CompleteChore('${c.id}')">✓ Done</button><button class="farm2-delete" onclick="farm2DeleteChore('${c.id}')">Delete</button></div>
      </div>`;
    }).join("") : `<div class="farm2-empty">No chores waiting. Enjoy it while it lasts. 😄</div>`;
  }

  function renderFun() {
    const s = achievementStats(), ms = monthStats();
    const summary = document.getElementById("farm2FunSummary");
    const list = document.getElementById("farm2AchievementList");
    if (!summary || !list) return;
    const eggGoal = num(farm2.goals.monthlyEggs), revGoal = num(farm2.goals.monthlyRevenue);
    summary.innerHTML = `<div class="farm2-grid3">
      <div class="farm2-card"><div class="farm2-kicker">Golden Eggs</div><div class="farm2-moneyBig">${farm2.goldenEggs} 🌟</div></div>
      <div class="farm2-card"><div class="farm2-kicker">Logging Streak</div><div class="farm2-moneyBig">${s.streak} 🔥</div></div>
      <div class="farm2-card"><div class="farm2-kicker">Unlocked</div><div class="farm2-moneyBig">${Object.keys(farm2.achievements).length}/${ACHIEVEMENTS.length}</div></div>
    </div>
    ${eggGoal ? `<div class="farm2-card"><b>🥚 Monthly egg goal</b><div class="farm2-subtle">${ms.eggs} / ${eggGoal}</div><div class="farm2-progress"><span style="width:${Math.min(100,ms.eggs/eggGoal*100)}%"></span></div></div>` : ""}
    ${revGoal ? `<div class="farm2-card"><b>💰 Monthly revenue goal</b><div class="farm2-subtle">${money(ms.rev)} / ${money(revGoal)}</div><div class="farm2-progress"><span style="width:${Math.min(100,ms.rev/revGoal*100)}%"></span></div></div>` : ""}`;
    list.innerHTML = ACHIEVEMENTS.map(a => {
      const unlocked = !!farm2.achievements[a.id];
      return `<div class="farm2-achievement ${unlocked ? "" : "locked"}"><div class="icon">${a.icon}</div><b>${escapeHTML(a.name)}</b><small>${escapeHTML(a.desc)}${unlocked ? " • Unlocked!" : ""}</small></div>`;
    }).join("");
    const ge = document.getElementById("farm2GoalEggs"), gr = document.getElementById("farm2GoalRevenue");
    if (ge && document.activeElement !== ge) ge.value = farm2.goals.monthlyEggs || "";
    if (gr && document.activeElement !== gr) gr.value = farm2.goals.monthlyRevenue || "";
  }

  function renderSettings() {
    const mode = document.getElementById("farm2Mode");
    const holiday = document.getElementById("farm2Holiday");
    const surprises = document.getElementById("farm2Surprises");
    const sounds = document.getElementById("farm2Sounds");
    if (mode) mode.value = farm2.preferences.mode;
    if (holiday) holiday.value = farm2.preferences.holiday;
    if (surprises) surprises.checked = !!farm2.preferences.surprises;
    if (sounds) sounds.checked = !!farm2.preferences.sounds;
    const a = document.getElementById("farm2Activity");
    if (a) a.innerHTML = farm2.activity.length ? farm2.activity.slice(0,18).map(x => `<div class="farm2-toggleRow"><div><b>${x.icon} ${escapeHTML(x.text)}</b><div class="farm2-subtle">${new Date(x.at).toLocaleString()}</div></div></div>`).join("") : `<div class="farm2-empty">Activity will appear here as you use the upgraded features.</div>`;
  }

  function renderFarm2() {
    if (!initialized) return;
    renderDashboardCard();
    renderHub();
    renderCustomers();
    renderOrders();
    renderExpenses();
    renderFlock();
    renderChores();
    renderFun();
    renderSettings();
    updateCustomerSelects();
    updateSalePreview();
  }

  function wrapCoreFunctions() {
    const originalSaveEggs = window.saveEggs;
    if (typeof originalSaveEggs === "function") {
      window.saveEggs = function() {
        const count = num(document.getElementById("eggCount")?.value);
        const before = coreEntries().filter(e => e.type === "eggs");
        const prevBest = before.reduce((m,e)=>Math.max(m,num(e.eggs)),0);
        const oldIds = new Set(before.map(e => e.id));
        const result = originalSaveEggs.apply(this, arguments);
        const after = coreEntries().filter(e => e.type === "eggs");
        const latest = after.filter(e => !oldIds.has(e.id)).sort((a,b)=>num(b.createdAt)-num(a.createdAt))[0];
        if (count > 0) {
          logActivity("🥚", `Collected ${count} eggs${latest?.date ? ` on ${latest.date}` : ""}`);
          createSafetySnapshot();
          persistLocal2();
          randomCollectionCelebration(count, prevBest);
          setTimeout(() => checkAchievements(true), 250);
        }
        return result;
      };
    }

    const originalSaveSale = window.saveSale;
    if (typeof originalSaveSale === "function") {
      window.saveSale = function() {
        const before = coreEntries().filter(e => e.type === "sale");
        const oldIds = new Set(before.map(e => e.id));
        const customerId = document.getElementById("farm2SaleCustomer")?.value || "";
        const paid = (document.getElementById("farm2SalePaid")?.value || "paid") === "paid";
        const note = document.getElementById("farm2SaleNote")?.value || "";
        const amount = num(document.getElementById("dozenSold")?.value) * num(document.getElementById("dozenPrice")?.value)
          + num(document.getElementById("packSold")?.value) * num(document.getElementById("packPrice")?.value);
        const result = originalSaveSale.apply(this, arguments);
        const after = coreEntries().filter(e => e.type === "sale");
        let targetId = app2EditingSaleId;
        if (!targetId) targetId = after.filter(e => !oldIds.has(e.id)).sort((a,b)=>num(b.createdAt)-num(a.createdAt))[0]?.id;
        if (targetId && amount > 0) {
          farm2.saleMeta[targetId] = { customerId, paid, note, updatedAt: Date.now() };
          const customer = farm2.customers.find(c => c.id === customerId);
          logActivity("💰", `Sale ${money(amount)}${customer ? ` to ${customer.name}` : ""}${paid ? "" : " (unpaid)"}`);
          persistLocal2();
          createSafetySnapshot();
          randomSaleCelebration(amount);
          setTimeout(() => checkAchievements(true), 250);
        }
        app2EditingSaleId = null;
        const c = document.getElementById("farm2SaleCustomer"), p = document.getElementById("farm2SalePaid"), n = document.getElementById("farm2SaleNote");
        if (c) c.value = ""; if (p) p.value = "paid"; if (n) n.value = "";
        return result;
      };
    }

    const originalEditEntry = window.editEntry;
    if (typeof originalEditEntry === "function") {
      window.editEntry = function(id) {
        const entry = coreEntries().find(e => String(e.id) === String(id));
        const result = originalEditEntry.apply(this, arguments);
        if (entry?.type === "sale") {
          app2EditingSaleId = String(id);
          setTimeout(() => {
            const meta = farm2.saleMeta[String(id)] || {};
            const c = document.getElementById("farm2SaleCustomer");
            const p = document.getElementById("farm2SalePaid");
            const n = document.getElementById("farm2SaleNote");
            if (c) c.value = meta.customerId || "";
            if (p) p.value = meta.paid === false ? "unpaid" : "paid";
            if (n) n.value = meta.note || "";
            updateSalePreview();
          }, 0);
        } else app2EditingSaleId = null;
        return result;
      };
    }

    const originalDeleteEntry = window.deleteEntry;
    if (typeof originalDeleteEntry === "function") {
      window.deleteEntry = function(id) {
        const hadMeta = !!farm2.saleMeta[String(id)];
        const result = originalDeleteEntry.apply(this, arguments);
        if (hadMeta) {
          delete farm2.saleMeta[String(id)];
          persistLocal2();
        }
        return result;
      };
    }

    const originalShowScreen = window.showScreen;
    if (typeof originalShowScreen === "function") {
      window.showScreen = function(id) {
        const result = originalShowScreen.apply(this, arguments);
        renderFarm2();
        return result;
      };
    }
  }

  function voiceEggEntry() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Voice entry is not supported in this browser."); return; }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    toast("Listening… say something like “17 eggs”.");
    recognition.onresult = event => {
      const text = event.results[0][0].transcript;
      const match = text.match(/\d+/);
      if (match) {
        document.getElementById("eggCount").value = match[0];
        toast(`Heard ${match[0]} eggs.`);
      } else toast(`I heard “${text}” but couldn't find a number.`);
    };
    recognition.onerror = () => toast("Voice entry couldn't hear that.");
    recognition.start();
  }

  function createSafetySnapshot() {
    const today = localDate();
    const shots = readJSON(SNAPSHOT_KEY, []);
    if (shots[0]?.date === today) return;
    shots.unshift({
      date: today,
      createdAt: Date.now(),
      entries: coreEntries(),
      farmSettings: coreSettings(),
      farmApp2: farm2
    });
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(shots.slice(0,5)));
  }

  async function fullBackup() {
    const backup = {
      format: "chicken-eggs-full-backup-v2",
      backupDate: new Date().toISOString(),
      entries: coreEntries(),
      farmSettings: coreSettings(),
      farmApp2: farm2
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `chicken-eggs-full-backup-${localDate()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Full backup downloaded.");
  }

  function exportCSV() {
    const rows = [["Date","Type","Eggs Collected","Dozen Sold","18-Packs Sold","Revenue","Customer","Paid","Note"]];
    coreEntries().slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(e => {
      const meta = farm2.saleMeta[e.id] || {};
      const customer = farm2.customers.find(c => c.id === meta.customerId)?.name || "";
      rows.push([
        e.date, e.type, e.type === "eggs" ? num(e.eggs) : "",
        e.type === "sale" ? num(e.dozenSold) : "", e.type === "sale" ? num(e.packSold) : "",
        e.type === "sale" ? revenue(e).toFixed(2) : "", customer,
        e.type === "sale" ? (meta.paid === false ? "No" : "Yes") : "", meta.note || ""
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chicken-eggs-${localDate()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.farm2CycleTheme = cycleTheme;
  window.farm2QuickEgg = n => {
    const el = document.getElementById("eggCount");
    if (el) { el.value = num(el.value) + num(n); el.focus(); }
  };
  window.farm2AddCustomer = () => {
    const name = document.getElementById("farm2CustomerName")?.value.trim();
    if (!name) { alert("Enter a customer name."); return; }
    farm2.customers.push({
      id: nowId("cust"), name,
      contact: document.getElementById("farm2CustomerContact")?.value.trim() || "",
      price: num(document.getElementById("farm2CustomerPrice")?.value),
      notes: document.getElementById("farm2CustomerNotes")?.value.trim() || "",
      createdAt: Date.now()
    });
    ["farm2CustomerName","farm2CustomerContact","farm2CustomerPrice","farm2CustomerNotes"].forEach(id => { const e=document.getElementById(id); if(e)e.value=""; });
    logActivity("🤝", `Added customer ${name}`);
    persistLocal2(); checkAchievements(true); toast(`${name} added.`);
  };
  window.farm2DeleteCustomer = id => {
    if (!confirm("Delete this customer profile? Sales history stays.")) return;
    farm2.customers = farm2.customers.filter(c => c.id !== id);
    farm2.orders = farm2.orders.map(o => o.customerId === id ? {...o, customerId:""} : o);
    persistLocal2();
  };
  window.farm2UseCustomer = id => {
    window.showScreen("sale");
    const sel = document.getElementById("farm2SaleCustomer");
    if (sel) sel.value = id;
    const c = farm2.customers.find(x=>x.id===id);
    if (c?.price && document.getElementById("dozenPrice")) document.getElementById("dozenPrice").value = c.price;
    updateSalePreview();
  };
  window.farm2AddOrder = () => {
    const customerId = document.getElementById("farm2OrderCustomer")?.value || "";
    const dueDate = document.getElementById("farm2OrderDate")?.value || localDate();
    const dozen = num(document.getElementById("farm2OrderDozen")?.value);
    const packs18 = num(document.getElementById("farm2OrderPacks")?.value);
    if (dozen <= 0 && packs18 <= 0) { alert("Enter an order quantity."); return; }
    farm2.orders.push({ id: nowId("ord"), customerId, dueDate, dozen, packs18, notes: document.getElementById("farm2OrderNotes")?.value.trim() || "", status:"pending", createdAt:Date.now() });
    ["farm2OrderDozen","farm2OrderPacks","farm2OrderNotes"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});
    logActivity("📦", `Reserved ${dozen*12+packs18*18} eggs for ${dueDate}`);
    persistLocal2(); toast("Order reserved.");
  };
  window.farm2CompleteOrder = id => {
    const o = farm2.orders.find(x=>x.id===id); if(!o)return;
    o.status="fulfilled"; o.completedAt=Date.now();
    logActivity("✅", `Fulfilled reserved order for ${o.dueDate}`);
    persistLocal2(); toast("Order marked fulfilled.");
  };
  window.farm2DeleteOrder = id => {
    if (!confirm("Delete this order?")) return;
    farm2.orders = farm2.orders.filter(o=>o.id!==id); persistLocal2();
  };
  window.farm2AddExpense = () => {
    const amount = num(document.getElementById("farm2ExpenseAmount")?.value);
    if (amount <= 0) { alert("Enter the expense amount."); return; }
    const category = document.getElementById("farm2ExpenseCategory")?.value || "Other";
    const desc = document.getElementById("farm2ExpenseDesc")?.value.trim() || "";
    const date = document.getElementById("farm2ExpenseDate")?.value || localDate();
    farm2.expenses.push({ id:nowId("exp"), date, category, description:desc, amount, createdAt:Date.now() });
    document.getElementById("farm2ExpenseAmount").value=""; document.getElementById("farm2ExpenseDesc").value="";
    logActivity("🧾", `${category} expense ${money(amount)}`);
    persistLocal2(); toast("Expense added.");
  };
  window.farm2DeleteExpense = id => {
    if (!confirm("Delete this expense?")) return;
    farm2.expenses = farm2.expenses.filter(e=>e.id!==id); persistLocal2();
  };
  window.farm2AddBird = () => {
    const name = document.getElementById("farm2BirdName")?.value.trim();
    if (!name) { alert("Enter the chicken's name."); return; }
    farm2.flock.push({ id:nowId("bird"), name, breed:document.getElementById("farm2BirdBreed")?.value.trim()||"", hatchDate:document.getElementById("farm2BirdDate")?.value||"", sex:document.getElementById("farm2BirdSex")?.value||"Unknown", status:"Active", notes:document.getElementById("farm2BirdNotes")?.value.trim()||"", createdAt:Date.now() });
    ["farm2BirdName","farm2BirdBreed","farm2BirdDate","farm2BirdNotes"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});
    logActivity("🐔", `Added ${name} to flock profiles`);
    persistLocal2(); toast(`${name} added to the flock.`);
  };
  window.farm2DeleteBird = id => {
    if (!confirm("Delete this flock profile?")) return;
    farm2.flock = farm2.flock.filter(b=>b.id!==id); persistLocal2();
  };
  window.farm2AddChore = () => {
    const name = document.getElementById("farm2ChoreName")?.value.trim();
    if (!name) { alert("Enter a chore."); return; }
    farm2.chores.push({ id:nowId("chore"), name, dueDate:document.getElementById("farm2ChoreDate")?.value||localDate(), repeat:document.getElementById("farm2ChoreRepeat")?.value||"once", createdAt:Date.now() });
    document.getElementById("farm2ChoreName").value="";
    logActivity("✅", `Added chore: ${name}`);
    persistLocal2();
  };
  window.farm2CompleteChore = id => {
    const c = farm2.chores.find(x=>x.id===id); if(!c)return;
    const next = nextChoreDate(c.dueDate, c.repeat);
    logActivity("✅", `Completed chore: ${c.name}`);
    if (next) c.dueDate = next; else farm2.chores = farm2.chores.filter(x=>x.id!==id);
    persistLocal2(); toast(next ? `Done. Next due ${next}.` : "Chore completed.");
  };
  window.farm2DeleteChore = id => { farm2.chores = farm2.chores.filter(c=>c.id!==id); persistLocal2(); };
  window.farm2SaveGoals = () => {
    farm2.goals.monthlyEggs = num(document.getElementById("farm2GoalEggs")?.value);
    farm2.goals.monthlyRevenue = num(document.getElementById("farm2GoalRevenue")?.value);
    logActivity("🎯", "Updated monthly goals");
    persistLocal2(); toast("Goals saved.");
  };
  window.farm2SettingsChanged = () => {
    farm2.preferences.mode = document.getElementById("farm2Mode")?.value || "auto";
    farm2.preferences.holiday = document.getElementById("farm2Holiday")?.value || "auto";
    farm2.preferences.surprises = !!document.getElementById("farm2Surprises")?.checked;
    farm2.preferences.sounds = !!document.getElementById("farm2Sounds")?.checked;
    persistLocal2(); applyTheme();
  };
  window.farm2SearchAll = () => {
    const q = (document.getElementById("farm2GlobalSearch")?.value || "").trim().toLowerCase();
    const el = document.getElementById("farm2SearchResults"); if(!el)return;
    if (!q) { el.innerHTML=""; return; }
    const results = [];
    farm2.customers.filter(x=>`${x.name} ${x.contact} ${x.notes}`.toLowerCase().includes(q)).forEach(x=>results.push(`🤝 Customer: ${escapeHTML(x.name)}`));
    farm2.flock.filter(x=>`${x.name} ${x.breed} ${x.notes}`.toLowerCase().includes(q)).forEach(x=>results.push(`🐔 Flock: ${escapeHTML(x.name)} — ${escapeHTML(x.breed)}`));
    farm2.orders.filter(x=>`${x.dueDate} ${x.notes}`.toLowerCase().includes(q)).forEach(x=>results.push(`📦 Order due ${escapeHTML(x.dueDate)} — ${x.dozen||0} dozen`));
    farm2.expenses.filter(x=>`${x.date} ${x.category} ${x.description}`.toLowerCase().includes(q)).forEach(x=>results.push(`🧾 ${escapeHTML(x.date)} ${escapeHTML(x.category)} ${money(x.amount)}`));
    coreEntries().filter(x=>`${x.date} ${x.type}`.toLowerCase().includes(q)).slice(0,12).forEach(x=>results.push(`${x.type==="eggs"?"🥚":"💰"} ${escapeHTML(x.date)} — ${x.type==="eggs"?`${x.eggs} eggs`:money(revenue(x))}`));
    el.innerHTML = results.length ? results.slice(0,30).map(r=>`<div class="farm2-listItem" style="margin:7px 0;">${r}</div>`).join("") : `<div class="farm2-empty">No matches.</div>`;
  };
  window.farm2ExportCSV = exportCSV;

  const oldBackup = window.backupData;
  window.backupData = fullBackup;
  window.farm2LegacyBackup = oldBackup;

  function setDefaultDates() {
    ["farm2OrderDate","farm2ExpenseDate","farm2ChoreDate"].forEach(id => {
      const el=document.getElementById(id); if(el && !el.value) el.value=localDate();
    });
  }

  function init() {
    if (initialized) return;
    loadLocal2();
    addInjectedUI();
    initialized = true;
    setDefaultDates();
    applyTheme();
    wrapCoreFunctions();
    createSafetySnapshot();
    renderFarm2();
    checkAchievements(false);
    cloudLoad2();
    window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
      if (farm2.preferences.mode === "auto") applyTheme();
    });
    console.log("🐔 Farm App 2.0 ready");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
