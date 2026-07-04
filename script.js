const CLOUD_URL = "https://script.google.com/macros/s/AKfycbxxdjOJOKtlqajQgtR5DFMcK5xfeM43lkSTmgcIoVZ31WfKaagcylH_f_3w0E046val/exec";

const ENTRIES_KEY = "chickenEggEntriesV102";
const SETTINGS_KEY = "chickenEggSettingsV102";
let entries = [];
let farmSettings = defaultSettings();
let editingId = null;
let historyFilter = "all";
let isSyncing = false;

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const today = localToday();

function defaultSettings() {
  return {
    farmName: "",
    hens: 0,
    roosters: 0,
    eggGoal: 0,
    dozenPrice: 0,
    packPrice: 0,
    updatedAt: 0
  };
}

function number(v) {
  return Number(v) || 0;
}

function newId() {
  return crypto?.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function cleanDate(v) {
  if (!v) return today;
  const d = String(v).split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
}

function setSyncStatus(text) {
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = text;
}

function normalizeSettings(s = {}) {
  return {
    farmName: s.farmName || "",
    hens: number(s.hens),
    roosters: number(s.roosters),
    eggGoal: number(s.eggGoal),
    dozenPrice: number(s.dozenPrice),
    packPrice: number(s.packPrice),
    updatedAt: number(s.updatedAt)
  };
}

function normalizeEntry(e = {}) {
  const type = e.type === "sale" ? "sale" : "eggs";

  return {
    id: String(e.id || newId()),
    type,
    date: cleanDate(e.date),
    eggs: type === "eggs" ? number(e.eggs) : 0,
    dozenSold: type === "sale" ? number(e.dozenSold) : 0,
    dozenPrice: type === "sale" ? number(e.dozenPrice) : 0,
    packSold: type === "sale" ? number(e.packSold ?? e.packs18Sold) : 0,
    packPrice: type === "sale" ? number(e.packPrice ?? e.packs18Price) : 0,
    createdAt: number(e.createdAt) || Date.now(),
    updatedAt: number(e.updatedAt) || Date.now()
  };
}

function isValidEntry(e) {
  if (!e) return false;
  if (e.type === "eggs") return number(e.eggs) > 0;
  if (e.type === "sale") return number(e.dozenSold) > 0 || number(e.packSold) > 0;
  return false;
}

function visibleEntries() {
  return entries.map(normalizeEntry).filter(isValidEntry);
}

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function saveLocal() {
  entries = visibleEntries();
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(farmSettings));
}

function loadLocal() {
  entries = readJSON(ENTRIES_KEY, []).map(normalizeEntry).filter(isValidEntry);
  farmSettings = normalizeSettings(readJSON(SETTINGS_KEY, defaultSettings()));
}

function newestEntryTime(list) {
  return list.reduce((max, e) => Math.max(max, number(e.updatedAt)), 0);
}

function newestLocalTime() {
  return Math.max(newestEntryTime(entries), number(farmSettings.updatedAt));
}

function newestCloudTime(cloudEntries, cloudSettings) {
  return Math.max(newestEntryTime(cloudEntries), number(cloudSettings.updatedAt));
}

async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractEntries(data) {
  if (Array.isArray(data?.entries)) return data.entries;
  if (Array.isArray(data?.data?.entries)) return data.data.entries;
  return [];
}

function extractSettings(data) {
  if (data?.farmSettings) return data.farmSettings;
  if (data?.data?.farmSettings) return data.data.farmSettings;
  return {};
}

async function cloudSave() {
  try {
    setSyncStatus("Saving...");

    await fetchWithTimeout(CLOUD_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "saveAll",
        entries: visibleEntries(),
        farmSettings
      })
    });

    setSyncStatus("Saved " + new Date().toLocaleTimeString());
  } catch (err) {
    console.error(err);
    setSyncStatus("Offline - saved on this device");
  }
}

async function cloudLoad() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    setSyncStatus("Syncing...");

    const res = await fetchWithTimeout(CLOUD_URL + "?t=" + Date.now(), {
      method: "GET",
      cache: "no-store"
    });

    const data = await res.json();

    const cloudEntries = extractEntries(data).map(normalizeEntry).filter(isValidEntry);
    const cloudSettings = normalizeSettings(extractSettings(data));

    const localTime = newestLocalTime();
    const cloudTime = newestCloudTime(cloudEntries, cloudSettings);

    if (localTime > cloudTime) {
      await cloudSave();
    } else {
      entries = cloudEntries;
      farmSettings = cloudSettings;
      saveLocal();
      loadFarmSettings();
      updateApp();
    }

    setSyncStatus("Synced " + new Date().toLocaleTimeString());
  } catch (err) {
    console.error(err);
    setSyncStatus("Offline/local data shown");
    updateApp();
  } finally {
    isSyncing = false;
  }
}

function saveAndSync() {
  saveLocal();
  updateApp();
  cloudSave();
}

function loadFarmSettings() {
  document.getElementById("farmName").value = farmSettings.farmName || "";
  document.getElementById("farmHens").value = farmSettings.hens || "";
  document.getElementById("farmRoosters").value = farmSettings.roosters || "";
  document.getElementById("farmEggGoal").value = farmSettings.eggGoal || "";
  document.getElementById("farmDozenPrice").value = farmSettings.dozenPrice || "";
  document.getElementById("farmPackPrice").value = farmSettings.packPrice || "";
}

function saveFarmSettings() {
  farmSettings = {
    farmName: document.getElementById("farmName").value,
    hens: number(document.getElementById("farmHens").value),
    roosters: number(document.getElementById("farmRoosters").value),
    eggGoal: number(document.getElementById("farmEggGoal").value),
    dozenPrice: number(document.getElementById("farmDozenPrice").value),
    packPrice: number(document.getElementById("farmPackPrice").value),
    updatedAt: Date.now()
  };

  saveAndSync();
  showScreen("dashboard");
}

function deleteAllEntries() {
  if (!confirm("Delete ALL entries? Farm settings will stay.")) return;
  if (!confirm("This clears history on all synced devices. Continue?")) return;

  entries = [];
  saveAndSync();
  showScreen("dashboard");
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  document.querySelectorAll(".bottomNav button").forEach(btn => {
    btn.classList.remove("navActive");
    if (btn.getAttribute("onclick")?.includes(`'${id}'`)) btn.classList.add("navActive");
  });

  if (id === "sale") {
    if (!document.getElementById("dozenPrice").value && farmSettings.dozenPrice) {
      document.getElementById("dozenPrice").value = farmSettings.dozenPrice;
    }
    if (!document.getElementById("packPrice").value && farmSettings.packPrice) {
      document.getElementById("packPrice").value = farmSettings.packPrice;
    }
  }

  updateApp();
}

function setHistoryFilter(filter) {
  historyFilter = filter;
  updateApp();
}

function saveEggs() {
  const eggs = number(document.getElementById("eggCount").value);
  const date = cleanDate(document.getElementById("eggDate").value);

  if (eggs <= 0) {
    alert("Enter how many eggs you collected.");
    return;
  }

  if (editingId) {
    const entry = entries.find(e => e.id === editingId);
    if (entry) {
      Object.assign(entry, {
        type: "eggs",
        date,
        eggs,
        dozenSold: 0,
        dozenPrice: 0,
        packSold: 0,
        packPrice: 0,
        updatedAt: Date.now()
      });
    }
    editingId = null;
  } else {
    entries.push({
      id: newId(),
      type: "eggs",
      date,
      eggs,
      dozenSold: 0,
      dozenPrice: 0,
      packSold: 0,
      packPrice: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  document.getElementById("eggCount").value = "";
  saveAndSync();
  showScreen("dashboard");
}

function saveSale() {
  const date = cleanDate(document.getElementById("saleDate").value);
  const dozenSold = number(document.getElementById("dozenSold").value);
  const dozenPrice = number(document.getElementById("dozenPrice").value);
  const packSold = number(document.getElementById("packSold").value);
  const packPrice = number(document.getElementById("packPrice").value);

  if (dozenSold <= 0 && packSold <= 0) {
    alert("Enter a sale first.");
    return;
  }

  if (editingId) {
    const entry = entries.find(e => e.id === editingId);
    if (entry) {
      Object.assign(entry, {
        type: "sale",
        date,
        eggs: 0,
        dozenSold,
        dozenPrice,
        packSold,
        packPrice,
        updatedAt: Date.now()
      });
    }
    editingId = null;
  } else {
    entries.push({
      id: newId(),
      type: "sale",
      date,
      eggs: 0,
      dozenSold,
      dozenPrice,
      packSold,
      packPrice,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  document.getElementById("dozenSold").value = "";
  document.getElementById("packSold").value = "";
  document.getElementById("dozenPrice").value = farmSettings.dozenPrice || "";
  document.getElementById("packPrice").value = farmSettings.packPrice || "";

  saveAndSync();
  showScreen("dashboard");
}

function editEntry(id) {
  const entry = entries.find(e => e.id === String(id));
  if (!entry) return;

  editingId = entry.id;

  if (entry.type === "eggs") {
    document.getElementById("eggDate").value = entry.date;
    document.getElementById("eggCount").value = entry.eggs;
    showScreen("collect");
  } else {
    document.getElementById("saleDate").value = entry.date;
    document.getElementById("dozenSold").value = entry.dozenSold;
    document.getElementById("dozenPrice").value = entry.dozenPrice;
    document.getElementById("packSold").value = entry.packSold;
    document.getElementById("packPrice").value = entry.packPrice;
    showScreen("sale");
  }
}

function deleteEntry(id) {
  if (!confirm("Delete this one entry?")) return;
  entries = entries.filter(e => e.id !== String(id));
  saveAndSync();
}

function revenue(e) {
  return number(e.dozenSold) * number(e.dozenPrice) + number(e.packSold) * number(e.packPrice);
}

function eggsSold(e) {
  return number(e.dozenSold) * 12 + number(e.packSold) * 18;
}

function statCard(icon, title, value, note) {
  return `
    <div class="totalBox">
      <h3>${icon} ${title}</h3>
      <div class="totalValue">${value}</div>
      <p>${note}</p>
    </div>
  `;
}

function isWeek(date) {
  const d = new Date(cleanDate(date) + "T00:00:00");
  const n = new Date();
  const start = new Date(n);
  start.setDate(n.getDate() - n.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function isMonth(date) {
  const d = new Date(cleanDate(date) + "T00:00:00");
  const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function isYear(date) {
  const d = new Date(cleanDate(date) + "T00:00:00");
  return d.getFullYear() === new Date().getFullYear();
}

function updateApp() {
  const list = visibleEntries();

  let lifeEggs = 0, weekEggs = 0, monthEggs = 0, yearEggs = 0;
  let lifeRev = 0, weekRev = 0, monthRev = 0, yearRev = 0;
  let totalEggsSold = 0;

  list.forEach(e => {
    const r = revenue(e);
    lifeEggs += number(e.eggs);
    lifeRev += r;
    totalEggsSold += eggsSold(e);

    if (isWeek(e.date)) {
      weekEggs += number(e.eggs);
      weekRev += r;
    }

    if (isMonth(e.date)) {
      monthEggs += number(e.eggs);
      monthRev += r;
    }

    if (isYear(e.date)) {
      yearEggs += number(e.eggs);
      yearRev += r;
    }
  });

  const eggDays = new Set(list.filter(e => e.type === "eggs").map(e => e.date)).size || 1;
  const avg = lifeEggs / eggDays;

  const bestEggDay = list.filter(e => e.type === "eggs")
    .reduce((best, e) => number(e.eggs) > number(best.eggs) ? e : best, {});

  const bestSaleDay = list.filter(e => e.type === "sale")
    .reduce((best, e) => revenue(e) > revenue(best) ? e : best, {});

  const eggsToday = list.filter(e => e.type === "eggs" && e.date === today)
    .reduce((sum, e) => sum + number(e.eggs), 0);

  const hens = number(farmSettings.hens);
  const productionPercent = hens > 0 ? (eggsToday / hens) * 100 : 0;

  document.getElementById("farmHeroName").textContent = farmSettings.farmName || "Egg Production";
  document.getElementById("farmHeroText").textContent =
    hens > 0
      ? `${hens} hens • ${eggsToday} eggs today • ${productionPercent.toFixed(0)}% production`
      : "Track collections, sales, records, and revenue.";

  document.getElementById("dashboardTotals").innerHTML = `
    ${statCard("🥚", "Lifetime Eggs", lifeEggs, "since day 1")}
    ${statCard("📅", "This Week Eggs", weekEggs, "eggs collected")}
    ${statCard("🗓️", "This Month Eggs", monthEggs, "eggs collected")}
    ${statCard("📆", "This Year Eggs", yearEggs, "eggs collected")}
    ${statCard("💰", "Lifetime Revenue", "$" + lifeRev.toFixed(2), "all-time sales")}
    ${statCard("💵", "This Week Revenue", "$" + weekRev.toFixed(2), "sales this week")}
    ${statCard("💰", "This Month Revenue", "$" + monthRev.toFixed(2), "sales this month")}
    ${statCard("🏦", "This Year Revenue", "$" + yearRev.toFixed(2), "sales this year")}
    ${statCard("🏆", "Best Day", bestEggDay.eggs || 0, bestEggDay.date || "No data yet")}
    ${statCard("📊", "Avg / Day", avg.toFixed(1), "collection days")}
  `;

  document.getElementById("statsTotals").innerHTML = `
    ${statCard("🥚", "Lifetime Eggs", lifeEggs, "all collected eggs")}
    ${statCard("🛒", "Total Eggs Sold", totalEggsSold, "all sales")}
    ${statCard("📅", "Week Eggs", weekEggs, "this week")}
    ${statCard("💵", "Week Revenue", "$" + weekRev.toFixed(2), "this week")}
    ${statCard("🗓️", "Month Eggs", monthEggs, "this month")}
    ${statCard("💰", "Month Revenue", "$" + monthRev.toFixed(2), "this month")}
    ${statCard("📆", "Year Eggs", yearEggs, "this year")}
    ${statCard("🏦", "Year Revenue", "$" + yearRev.toFixed(2), "this year")}
    ${statCard("🔮", "Predicted Week", (avg * 7).toFixed(0), "estimated eggs")}
    ${statCard("🔮", "Predicted Month", (avg * 30).toFixed(0), "estimated eggs")}
    ${statCard("🚀", "Predicted Year", (avg * 365).toFixed(0), "estimated eggs")}
    ${statCard("💰", "Lifetime Revenue", "$" + lifeRev.toFixed(2), "all-time sales")}
  `;

  document.getElementById("recordsTotals").innerHTML = `
    ${statCard("🥚", "Highest Egg Day", bestEggDay.eggs || 0, bestEggDay.date || "No data yet")}
    ${statCard("💰", "Highest Revenue Day", "$" + revenue(bestSaleDay).toFixed(2), bestSaleDay.date || "No data yet")}
    ${statCard("💰", "Lifetime Revenue", "$" + lifeRev.toFixed(2), "all-time sales")}
  `;

  const search = (document.getElementById("historySearch")?.value || "").toLowerCase();

  const sorted = [...list]
    .filter(e => historyFilter === "all" || e.type === historyFilter)
    .filter(e => e.date.toLowerCase().includes(search))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById("historyList").innerHTML = sorted.length ? sorted.map(e => `
    <div class="entry">
      <strong>${e.type === "eggs" ? "🥚 Egg Collection" : "💰 Egg Sale"}</strong><br>
      <span>${e.date}</span><br>

      ${e.type === "eggs" ? `Eggs Collected: <strong>${e.eggs}</strong>` : ""}

      ${e.type === "sale" ? `
        Dozen Sold: <strong>${e.dozenSold}</strong> @ $${number(e.dozenPrice).toFixed(2)}<br>
        18-Packs Sold: <strong>${e.packSold}</strong> @ $${number(e.packPrice).toFixed(2)}<br>
        Eggs Sold: <strong>${eggsSold(e)}</strong><br>
        Revenue: <strong>$${revenue(e).toFixed(2)}</strong>
      ` : ""}

      <button onclick="editEntry('${e.id}')">Edit Entry</button>
      <button onclick="deleteEntry('${e.id}')">Delete This Entry</button>
    </div>
  `).join("") : `<div class="entry"><strong>No entries yet.</strong></div>`;
}

function backupData() {
  const backup = {
    entries: visibleEntries(),
    farmSettings,
    backupDate: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "chicken-eggs-backup.json";
  link.click();
}

function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const backup = JSON.parse(e.target.result);

      entries = Array.isArray(backup.entries)
        ? backup.entries.map(normalizeEntry).filter(isValidEntry)
        : [];

      farmSettings = normalizeSettings(backup.farmSettings);
      farmSettings.updatedAt = Date.now();

      saveAndSync();
      loadFarmSettings();
      showScreen("dashboard");

      alert("Backup restored.");
    } catch {
      alert("That backup file could not be restored.");
    }
  };

  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("eggDate").value = today;
  document.getElementById("saleDate").value = today;
  document.getElementById("todayText").textContent = new Date().toDateString();

  loadLocal();
  loadFarmSettings();
  updateApp();
  showScreen("dashboard");

  cloudLoad();
  setInterval(cloudLoad, 15000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) cloudLoad();
  });

  window.addEventListener("focus", cloudLoad);
});
