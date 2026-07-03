const CLOUD_URL = "https://script.google.com/macros/s/AKfycby3l3hzS7hDMUZWzT23KM7hp1X0MzqfG_2mPQMY-b0YPVy6G4VfgiH-EEVDbNnGFpr6IQ/exec";

const ENTRIES_KEY = "chickenEggEntries";
const FARM_KEY = "farmSettings";
const BACKUP_KEY = "chickenEggAutoBackups";
const DEVICE_KEY = "chickenEggDeviceId";

let entries = [];
let farmSettings = {
  farmName: "",
  hens: 0,
  roosters: 0,
  eggGoal: 0,
  dozenPrice: 0,
  packPrice: 0,
  updatedAt: 0
};

let editingId = null;
let historyFilter = "all";
let syncTimer = null;
let saveTimer = null;
let isSyncing = false;

function nowStamp() {
  return Date.now();
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = "device-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

const DEVICE_ID = getDeviceId();

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function setSyncStatus(text) {
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = text;
}

function safeJSON(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizeEntry(raw, source = "local") {
  const id = String(raw.id || ("entry-" + Date.now() + "-" + Math.random()));

  return {
    id,
    type: raw.type || (Number(raw.eggs) > 0 ? "eggs" : "sale"),
    date: raw.date || todayISO(),
    eggs: Number(raw.eggs) || 0,
    dozenSold: Number(raw.dozenSold) || 0,
    dozenPrice: Number(raw.dozenPrice) || 0,
    packSold: Number(raw.packSold ?? raw.packs18Sold) || 0,
    packPrice: Number(raw.packPrice ?? raw.packs18Price) || 0,
    deleted: Boolean(raw.deleted),
    createdAt: Number(raw.createdAt) || nowStamp(),
    updatedAt: Number(raw.updatedAt) || (source === "local" ? 1 : 0),
    deviceId: raw.deviceId || DEVICE_ID
  };
}

function normalizeFarmSettings(raw, source = "local") {
  raw = raw || {};
  return {
    farmName: raw.farmName || "",
    hens: Number(raw.hens) || 0,
    roosters: Number(raw.roosters) || 0,
    eggGoal: Number(raw.eggGoal) || 0,
    dozenPrice: Number(raw.dozenPrice) || 0,
    packPrice: Number(raw.packPrice) || 0,
    updatedAt: Number(raw.updatedAt) || (source === "local" ? 1 : 0),
    deviceId: raw.deviceId || DEVICE_ID
  };
}

function visibleEntries() {
  return entries.filter(e => !e.deleted);
}

function saveLocal() {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  localStorage.setItem(FARM_KEY, JSON.stringify(farmSettings));
}

function createSafetyBackup(reason) {
  const backup = {
    reason,
    date: new Date().toISOString(),
    entries: safeJSON(localStorage.getItem(ENTRIES_KEY), []),
    farmSettings: safeJSON(localStorage.getItem(FARM_KEY), {})
  };

  const backups = safeJSON(localStorage.getItem(BACKUP_KEY), []);
  backups.unshift(backup);
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, 10)));
}

function loadLocal() {
  const localEntries = safeJSON(localStorage.getItem(ENTRIES_KEY), []);
  const localFarm = safeJSON(localStorage.getItem(FARM_KEY), null);

  entries = Array.isArray(localEntries)
    ? localEntries.map(e => normalizeEntry(e, "local"))
    : [];

  farmSettings = normalizeFarmSettings(localFarm, "local");
  saveLocal();
}

function mergeEntries(localList, cloudList) {
  const map = new Map();

  localList.forEach(e => {
    const item = normalizeEntry(e, "local");
    map.set(item.id, item);
  });

  cloudList.forEach(e => {
    const cloudItem = normalizeEntry(e, "cloud");
    const existing = map.get(cloudItem.id);

    if (!existing || Number(cloudItem.updatedAt) > Number(existing.updatedAt)) {
      map.set(cloudItem.id, cloudItem);
    }
  });

  return [...map.values()].sort((a, b) => {
    if (a.date === b.date) return Number(b.createdAt) - Number(a.createdAt);
    return new Date(a.date) - new Date(b.date);
  });
}

function mergeFarm(localFarm, cloudFarm) {
  const local = normalizeFarmSettings(localFarm, "local");
  const cloud = normalizeFarmSettings(cloudFarm, "cloud");
  return Number(cloud.updatedAt) > Number(local.updatedAt) ? cloud : local;
}

function getCloudEntries(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.entries)) return data.entries;
  if (data.data && Array.isArray(data.data.entries)) return data.data.entries;
  return [];
}

function getCloudFarm(data) {
  if (data.farmSettings) return data.farmSettings;
  if (data.data && data.data.farmSettings) return data.data.farmSettings;
  return null;
}

async function cloudLoadAndMerge(saveAfterMerge = true) {
  if (isSyncing) return;
  isSyncing = true;

  try {
    setSyncStatus("Syncing...");
    createSafetyBackup("Before cloud sync");

    const response = await fetch(CLOUD_URL + "?t=" + Date.now(), {
      method: "GET",
      cache: "no-store"
    });

    const data = await response.json();
    const cloudEntries = getCloudEntries(data);
    const cloudFarm = getCloudFarm(data);

    entries = mergeEntries(entries, cloudEntries);
    if (cloudFarm) farmSettings = mergeFarm(farmSettings, cloudFarm);

    saveLocal();
    loadFarmSettings();
    updateApp();

    if (saveAfterMerge) {
      await cloudSave(false);
    } else {
      setSyncStatus("Synced " + new Date().toLocaleTimeString());
    }
  } catch (error) {
    console.error("Cloud sync failed:", error);
    setSyncStatus("Offline/local data shown");
    updateApp();
  } finally {
    isSyncing = false;
  }
}

async function cloudSave(showAlert = false) {
  try {
    setSyncStatus("Saving...");
    await fetch(CLOUD_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "saveAll",
        entries,
        farmSettings,
        updatedAt: nowStamp(),
        deviceId: DEVICE_ID
      })
    });

    setSyncStatus("Saved " + new Date().toLocaleTimeString());

    if (showAlert) alert("Cloud save complete!");
  } catch (error) {
    console.error("Cloud save failed:", error);
    setSyncStatus("Save failed - will retry");
    if (showAlert) alert("Cloud save failed. Your data is still saved on this device.");
  }
}

function queueCloudSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => cloudSave(false), 700);
}

function startAutoSync() {
  clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    cloudLoadAndMerge(false);
  }, 60000);

  window.addEventListener("focus", () => cloudLoadAndMerge(false));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) cloudLoadAndMerge(false);
  });
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
    hens: Number(document.getElementById("farmHens").value) || 0,
    roosters: Number(document.getElementById("farmRoosters").value) || 0,
    eggGoal: Number(document.getElementById("farmEggGoal").value) || 0,
    dozenPrice: Number(document.getElementById("farmDozenPrice").value) || 0,
    packPrice: Number(document.getElementById("farmPackPrice").value) || 0,
    updatedAt: nowStamp(),
    deviceId: DEVICE_ID
  };

  saveLocal();
  queueCloudSave();
  updateApp();
  showScreen("dashboard");
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  document.querySelectorAll(".bottomNav button").forEach(btn => {
    btn.classList.remove("navActive");
    if (btn.getAttribute("onclick")?.includes(`'${id}'`)) {
      btn.classList.add("navActive");
    }
  });

  updateApp();
}

function setHistoryFilter(filter) {
  historyFilter = filter;
  updateApp();
}

function revenue(e) {
  return ((Number(e.dozenSold) || 0) * (Number(e.dozenPrice) || 0)) +
         ((Number(e.packSold) || 0) * (Number(e.packPrice) || 0));
}

function eggsSold(e) {
  return ((Number(e.dozenSold) || 0) * 12) + ((Number(e.packSold) || 0) * 18);
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

function newEntry(data) {
  return {
    id: "entry-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
    deviceId: DEVICE_ID,
    deleted: false,
    ...data
  };
}

function saveEggs() {
  const eggs = Number(document.getElementById("eggCount").value) || 0;
  const date = document.getElementById("eggDate").value || todayISO();

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
        deleted: false,
        updatedAt: nowStamp(),
        deviceId: DEVICE_ID
      });
    }
    editingId = null;
  } else {
    entries.push(newEntry({
      type: "eggs",
      date,
      eggs,
      dozenSold: 0,
      dozenPrice: 0,
      packSold: 0,
      packPrice: 0
    }));
  }

  saveLocal();
  queueCloudSave();
  document.getElementById("eggCount").value = "";
  showScreen("dashboard");
}

function saveSale() {
  const date = document.getElementById("saleDate").value || todayISO();
  const dozenSold = Number(document.getElementById("dozenSold").value) || 0;
  const dozenPrice = Number(document.getElementById("dozenPrice").value) || 0;
  const packSold = Number(document.getElementById("packSold").value) || 0;
  const packPrice = Number(document.getElementById("packPrice").value) || 0;

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
        deleted: false,
        updatedAt: nowStamp(),
        deviceId: DEVICE_ID
      });
    }
    editingId = null;
  } else {
    entries.push(newEntry({
      type: "sale",
      date,
      eggs: 0,
      dozenSold,
      dozenPrice,
      packSold,
      packPrice
    }));
  }

  saveLocal();
  queueCloudSave();

  document.getElementById("dozenSold").value = "";
  document.getElementById("dozenPrice").value = "";
  document.getElementById("packSold").value = "";
  document.getElementById("packPrice").value = "";

  showScreen("dashboard");
}

function editEntry(id) {
  const entry = entries.find(e => e.id === String(id) && !e.deleted);
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
  if (!confirm("Are you sure you want to delete this entry?")) return;

  const entry = entries.find(e => e.id === String(id));
  if (entry) {
    entry.deleted = true;
    entry.updatedAt = nowStamp();
    entry.deviceId = DEVICE_ID;
  }

  saveLocal();
  queueCloudSave();
  updateApp();
}

function isWeek(date) {
  const d = new Date(date + "T00:00:00");
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function isMonth(date) {
  const d = new Date(date + "T00:00:00");
  const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function isYear(date) {
  const d = new Date(date + "T00:00:00");
  return d.getFullYear() === new Date().getFullYear();
}

function getDailyEggTotals() {
  const totals = {};
  visibleEntries().forEach(e => {
    if (e.type === "eggs") {
      totals[e.date] = (totals[e.date] || 0) + Number(e.eggs || 0);
    }
  });
  return totals;
}

function getBestEggDay() {
  const totals = getDailyEggTotals();
  let bestDate = "No data yet";
  let bestEggs = 0;

  Object.keys(totals).forEach(date => {
    if (totals[date] > bestEggs) {
      bestEggs = totals[date];
      bestDate = date;
    }
  });

  return { date: bestDate, eggs: bestEggs };
}

function getCurrentStreak() {
  const totals = getDailyEggTotals();
  let streak = 0;
  const d = new Date();

  while (true) {
    const date = d.toISOString().split("T")[0];
    if (totals[date] && totals[date] > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function getLongestStreak() {
  const totals = getDailyEggTotals();
  const dates = Object.keys(totals).sort();

  let longest = 0;
  let current = 0;
  let lastDate = null;

  dates.forEach(date => {
    if (!lastDate) {
      current = 1;
    } else {
      const prev = new Date(lastDate + "T00:00:00");
      prev.setDate(prev.getDate() + 1);
      current = prev.toISOString().split("T")[0] === date ? current + 1 : 1;
    }

    if (current > longest) longest = current;
    lastDate = date;
  });

  return longest;
}

function getLast7DaysData() {
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];

    const eggs = visibleEntries()
      .filter(e => e.type === "eggs" && e.date === date)
      .reduce((sum, e) => sum + Number(e.eggs || 0), 0);

    const money = visibleEntries()
      .filter(e => e.type === "sale" && e.date === date)
      .reduce((sum, e) => sum + revenue(e), 0);

    days.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      eggs,
      money
    });
  }

  return days;
}

function drawBarChart(canvasId, data, valueKey, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const padding = 36;
  const chartHeight = height - 76;
  const chartWidth = width - 54;
  const maxValue = Math.max(...data.map(d => d[valueKey]), 1);
  const barWidth = chartWidth / data.length - 12;

  ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, Segoe UI";
  ctx.textAlign = "center";

  data.forEach((d, i) => {
    const x = padding + i * (chartWidth / data.length) + 5;
    const barHeight = (d[valueKey] / maxValue) * chartHeight;
    const y = height - padding - barHeight;

    ctx.fillStyle = color;
    ctx.beginPath();

    if (ctx.roundRect) {
      ctx.roundRect(x, y, barWidth, barHeight || 4, 8);
    } else {
      ctx.rect(x, y, barWidth, barHeight || 4);
    }

    ctx.fill();

    ctx.fillStyle = "#7b8a7d";
    ctx.fillText(d.label, x + barWidth / 2, height - 12);

    ctx.fillStyle = "#17351f";
    const valueText = valueKey === "money" ? "$" + d[valueKey].toFixed(0) : d[valueKey];
    ctx.fillText(valueText, x + barWidth / 2, y - 8);
  });
}

function updateRecords() {
  const recordsBox = document.getElementById("recordsTotals");
  if (!recordsBox) return;

  const list = visibleEntries();
  const eggEntries = list.filter(e => e.type === "eggs");
  const saleEntries = list.filter(e => e.type === "sale");

  const highestEgg = eggEntries.reduce((best, e) =>
    Number(e.eggs) > Number(best.eggs || 0) ? e : best, {}
  );

  const highestRevenue = saleEntries.reduce((best, e) =>
    revenue(e) > revenue(best) ? e : best, {}
  );

  const mostDozens = saleEntries.reduce((best, e) =>
    Number(e.dozenSold || 0) > Number(best.dozenSold || 0) ? e : best, {}
  );

  const most18Packs = saleEntries.reduce((best, e) =>
    Number(e.packSold || 0) > Number(best.packSold || 0) ? e : best, {}
  );

  recordsBox.innerHTML = `
    ${statCard("🥚", "Highest Egg Day", highestEgg.eggs || 0, highestEgg.date || "No data yet")}
    ${statCard("💰", "Highest Revenue Day", "$" + revenue(highestRevenue).toFixed(2), highestRevenue.date || "No data yet")}
    ${statCard("📦", "Most Dozens Sold", mostDozens.dozenSold || 0, mostDozens.date || "No data yet")}
    ${statCard("🥚", "Most 18-Packs Sold", most18Packs.packSold || 0, most18Packs.date || "No data yet")}
    ${statCard("🔥", "Current Streak", getCurrentStreak(), "days in a row")}
    ${statCard("🏆", "Longest Streak", getLongestStreak(), "days in a row")}
  `;
}

function updateApp() {
  const list = visibleEntries();

  let weekEggs = 0, monthEggs = 0, yearEggs = 0, lifeEggs = 0;
  let weekRev = 0, monthRev = 0, yearRev = 0, lifeRev = 0;
  let totalEggsSold = 0;
  let totalDozensSold = 0;

  list.forEach(e => {
    const r = revenue(e);
    const sold = eggsSold(e);

    lifeEggs += Number(e.eggs) || 0;
    lifeRev += r;
    totalEggsSold += sold;
    totalDozensSold += Number(e.dozenSold) || 0;

    if (isWeek(e.date)) {
      weekEggs += Number(e.eggs) || 0;
      weekRev += r;
    }

    if (isMonth(e.date)) {
      monthEggs += Number(e.eggs) || 0;
      monthRev += r;
    }

    if (isYear(e.date)) {
      yearEggs += Number(e.eggs) || 0;
      yearRev += r;
    }
  });

  const eggsAvailable = lifeEggs - totalEggsSold;
  const safeEggsAvailable = Math.max(eggsAvailable, 0);
  const dozensAvailable = Math.floor(safeEggsAvailable / 12);
  const looseEggs = safeEggsAvailable % 12;
  const totalDozensProduced = Math.floor(lifeEggs / 12);
  const eggDays = new Set(list.filter(e => Number(e.eggs) > 0).map(e => e.date)).size || 1;
  const avg = lifeEggs / eggDays;
  const bestDay = getBestEggDay();
  const avgPricePerDozen = totalDozensSold > 0 ? lifeRev / totalDozensSold : 0;

  const farmName = farmSettings.farmName || "Egg Production";
  const hens = Number(farmSettings.hens) || 0;
  const eggsToday = list
    .filter(e => e.type === "eggs" && e.date === todayISO())
    .reduce((sum, e) => sum + Number(e.eggs || 0), 0);

  const productionPercent = hens > 0 ? (eggsToday / hens) * 100 : 0;

  document.getElementById("farmHeroName").textContent = farmName;
  document.getElementById("farmHeroText").textContent =
    hens > 0
      ? `${hens} hens • ${eggsToday} eggs today • ${productionPercent.toFixed(0)}% production`
      : "Track collections, sales, records, and revenue.";

  document.getElementById("dashboardTotals").innerHTML = `
    ${statCard("🥚", "Lifetime Eggs", lifeEggs, "since day 1")}
    ${statCard("📦", "Eggs Available", eggsAvailable, `${dozensAvailable} dozen + ${looseEggs} loose`)}
    ${statCard("💰", "Lifetime Revenue", "$" + lifeRev.toFixed(2), "all-time sales")}
    ${statCard("📅", "This Week", weekEggs, "eggs collected")}
    ${statCard("🏆", "Best Day", bestDay.eggs, bestDay.date)}
    ${statCard("🔥", "Current Streak", getCurrentStreak(), "days in a row")}
    ${statCard("📊", "Avg / Day", avg.toFixed(1), "collection days")}
    ${statCard("🥚", "Dozens Produced", totalDozensProduced, "lifetime")}

    <div class="totalBox" style="grid-column:1 / -1;">
      <h3>🥚 Eggs Collected - Last 7 Days</h3>
      <canvas id="eggChart" width="340" height="220"></canvas>
    </div>

    <div class="totalBox" style="grid-column:1 / -1;">
      <h3>💰 Revenue - Last 7 Days</h3>
      <canvas id="revenueChart" width="340" height="220"></canvas>
    </div>
  `;

  document.getElementById("statsTotals").innerHTML = `
    ${statCard("🥚", "Lifetime Eggs", lifeEggs, "all collected eggs")}
    ${statCard("📦", "Eggs Available", eggsAvailable, "ready to sell")}
    ${statCard("📦", "Dozens Available", dozensAvailable, "full dozens")}
    ${statCard("🥚", "Loose Eggs", looseEggs, "extra eggs")}
    ${statCard("🛒", "Total Eggs Sold", totalEggsSold, "all sales")}
    ${statCard("🥚", "Dozens Produced", totalDozensProduced, "lifetime")}
    ${statCard("📅", "Week Eggs", weekEggs, "this week")}
    ${statCard("🗓️", "Month Eggs", monthEggs, "this month")}
    ${statCard("📆", "Year Eggs", yearEggs, "this year")}
    ${statCard("💰", "Lifetime Revenue", "$" + lifeRev.toFixed(2), "all-time sales")}
    ${statCard("💵", "Avg Price / Dozen", "$" + avgPricePerDozen.toFixed(2), "based on dozen sales")}
    ${statCard("📊", "Average / Day", avg.toFixed(1), "collection days")}
    ${statCard("🔮", "Predicted Month", (avg * 30).toFixed(0), "estimated eggs")}
    ${statCard("🚀", "Predicted Year", (avg * 365).toFixed(0), "estimated eggs")}
  `;

  updateRecords();

  const chartData = getLast7DaysData();
  drawBarChart("eggChart", chartData, "eggs", "#f5b91c");
  drawBarChart("revenueChart", chartData, "money", "#1f7a3a");

  const searchText = (document.getElementById("historySearch")?.value || "").toLowerCase();

  const sorted = [...list]
    .filter(e => historyFilter === "all" || e.type === historyFilter)
    .filter(e => e.date.toLowerCase().includes(searchText))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById("historyList").innerHTML = sorted.map(e => `
    <div class="entry">
      <strong>${e.type === "eggs" ? "🥚 Egg Collection" : "💰 Egg Sale"}</strong><br>
      <span>${e.date}</span><br>

      ${e.type === "eggs" ? `
        Eggs Collected: <strong>${e.eggs}</strong>
      ` : ""}

      ${e.type === "sale" ? `
        Dozen Sold: <strong>${e.dozenSold}</strong> @ $${Number(e.dozenPrice).toFixed(2)}<br>
        18-Packs Sold: <strong>${e.packSold}</strong> @ $${Number(e.packPrice).toFixed(2)}<br>
        Eggs Sold: <strong>${eggsSold(e)}</strong><br>
        Revenue: <strong>$${revenue(e).toFixed(2)}</strong>
      ` : ""}

      <button onclick="editEntry('${e.id}')">Edit Entry</button>
      <button onclick="deleteEntry('${e.id}')">Delete This Entry</button>
    </div>
  `).join("");
}

function backupData() {
  const backup = {
    date: new Date().toISOString(),
    entries,
    farmSettings
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });

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
      createSafetyBackup("Before manual restore");

      const backup = JSON.parse(e.target.result);

      entries = Array.isArray(backup.entries)
        ? backup.entries.map(item => normalizeEntry(item, "local"))
        : [];

      farmSettings = normalizeFarmSettings(backup.farmSettings, "local");
      farmSettings.updatedAt = nowStamp();

      saveLocal();
      loadFarmSettings();
      updateApp();
      queueCloudSave();
      showScreen("dashboard");

      alert("Backup restored and will sync automatically.");
    } catch {
      alert("That backup file could not be restored.");
    }
  };

  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
  const today = todayISO();

  document.getElementById("eggDate").value = today;
  document.getElementById("saleDate").value = today;
  document.getElementById("todayText").textContent = new Date().toDateString();

  loadLocal();
  loadFarmSettings();
  updateApp();
  showScreen("dashboard");

  cloudLoadAndMerge(true);
  startAutoSync();
});
