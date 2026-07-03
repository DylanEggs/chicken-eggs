const CLOUD_URL = "https://script.google.com/macros/s/AKfycby3l3hzS7hDMUZWzT23KM7hp1X0MzqfG_2mPQMY-b0YPVy6G4VfgiH-EEVDbNnGFpr6IQ/exec";

let entries = [];
let farmSettings = {};
let editingId = null;
let historyFilter = "all";

const today = new Date().toISOString().split("T")[0];

function cleanDate(value) {
  if (!value) return today;
  return String(value).split("T")[0];
}

function normalizeEntry(e) {
  return {
    id: String(e.id || Date.now() + Math.random()),
    type: e.type || (Number(e.eggs) > 0 ? "eggs" : "sale"),
    date: cleanDate(e.date),
    eggs: Number(e.eggs) || 0,
    dozenSold: Number(e.dozenSold) || 0,
    dozenPrice: Number(e.dozenPrice) || 0,
    packSold: Number(e.packSold ?? e.packs18Sold) || 0,
    packPrice: Number(e.packPrice ?? e.packs18Price) || 0,
    deleted: Boolean(e.deleted),
    updatedAt: Number(e.updatedAt) || Date.now()
  };
}

function visibleEntries() {
  return entries.filter(e => {
    if (e.deleted) return false;
    if (e.type === "eggs" && Number(e.eggs) <= 0) return false;
    if (e.type === "sale" && Number(e.dozenSold) <= 0 && Number(e.packSold) <= 0) return false;
    return true;
  });
}

function setSyncStatus(text) {
  const box = document.getElementById("syncStatus");
  if (box) box.textContent = text;
}

function loadLocal() {
  entries = JSON.parse(localStorage.getItem("chickenEggEntries") || "[]").map(normalizeEntry);

  farmSettings = JSON.parse(localStorage.getItem("farmSettings") || "{}");
  farmSettings = {
    farmName: farmSettings.farmName || "",
    hens: Number(farmSettings.hens) || 0,
    roosters: Number(farmSettings.roosters) || 0,
    eggGoal: Number(farmSettings.eggGoal) || 0,
    dozenPrice: Number(farmSettings.dozenPrice) || 0,
    packPrice: Number(farmSettings.packPrice) || 0,
    eggsUsed: Number(farmSettings.eggsUsed) || 0,
    updatedAt: Number(farmSettings.updatedAt) || Date.now()
  };
}

function saveLocal() {
  localStorage.setItem("chickenEggEntries", JSON.stringify(entries));
  localStorage.setItem("farmSettings", JSON.stringify(farmSettings));
}

function loadFarmSettings() {
  document.getElementById("farmName").value = farmSettings.farmName || "";
  document.getElementById("farmHens").value = farmSettings.hens || "";
  document.getElementById("farmRoosters").value = farmSettings.roosters || "";
  document.getElementById("farmEggGoal").value = farmSettings.eggGoal || "";
  document.getElementById("farmDozenPrice").value = farmSettings.dozenPrice || "";
  document.getElementById("farmPackPrice").value = farmSettings.packPrice || "";
  document.getElementById("farmEggsUsed").value = farmSettings.eggsUsed || "";
}

function mergeEntries(localEntries, cloudEntries) {
  const map = new Map();

  [...localEntries, ...cloudEntries].forEach(raw => {
    const item = normalizeEntry(raw);
    const old = map.get(item.id);

    if (!old || item.updatedAt >= old.updatedAt) {
      map.set(item.id, item);
    }
  });

  return [...map.values()];
}

async function cloudSave() {
  try {
    setSyncStatus("Saving...");
    await fetch(CLOUD_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "saveAll",
        entries,
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
  try {
    setSyncStatus("Syncing...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(CLOUD_URL + "?t=" + Date.now(), {
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await res.json();

    const cloudEntries = Array.isArray(data.entries) ? data.entries : [];
    const cloudFarm = data.farmSettings || {};

    entries = mergeEntries(entries, cloudEntries);

    if ((Number(cloudFarm.updatedAt) || 0) > (Number(farmSettings.updatedAt) || 0)) {
      farmSettings = {
        ...farmSettings,
        ...cloudFarm
      };
    }

    saveLocal();
    loadFarmSettings();
    updateApp();

    setSyncStatus("Synced " + new Date().toLocaleTimeString());
  } catch (err) {
    console.error(err);
    setSyncStatus("Offline/local data shown");
  }
}

function saveAndSync() {
  saveLocal();
  updateApp();
  cloudSave();
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

function saveFarmSettings() {
  farmSettings = {
    farmName: document.getElementById("farmName").value,
    hens: Number(document.getElementById("farmHens").value) || 0,
    roosters: Number(document.getElementById("farmRoosters").value) || 0,
    eggGoal: Number(document.getElementById("farmEggGoal").value) || 0,
    dozenPrice: Number(document.getElementById("farmDozenPrice").value) || 0,
    packPrice: Number(document.getElementById("farmPackPrice").value) || 0,
    eggsUsed: Number(document.getElementById("farmEggsUsed").value) || 0,
    updatedAt: Date.now()
  };

  saveAndSync();
  showScreen("dashboard");
}

function deleteAllEntries() {
  if (!confirm("Delete ALL egg and sale entries? Farm settings will stay.")) return;
  if (!confirm("Are you sure? This clears history on every synced device.")) return;

  entries = [];
  localStorage.setItem("chickenEggEntries", JSON.stringify(entries));
  saveAndSync();
  showScreen("dashboard");
}

function saveEggs() {
  const eggs = Number(document.getElementById("eggCount").value) || 0;
  const date = cleanDate(document.getElementById("eggDate").value);

  if (eggs <= 0) {
    alert("Enter how many eggs you collected.");
    return;
  }

  if (editingId) {
    const entry = entries.find(e => e.id === editingId);
    if (entry) {
      entry.type = "eggs";
      entry.date = date;
      entry.eggs = eggs;
      entry.dozenSold = 0;
      entry.dozenPrice = 0;
      entry.packSold = 0;
      entry.packPrice = 0;
      entry.deleted = false;
      entry.updatedAt = Date.now();
    }
    editingId = null;
  } else {
    entries.push({
      id: String(Date.now() + Math.random()),
      type: "eggs",
      date,
      eggs,
      dozenSold: 0,
      dozenPrice: 0,
      packSold: 0,
      packPrice: 0,
      deleted: false,
      updatedAt: Date.now()
    });
  }

  document.getElementById("eggCount").value = "";
  saveAndSync();
  showScreen("dashboard");
}

function saveSale() {
  const date = cleanDate(document.getElementById("saleDate").value);
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
      entry.type = "sale";
      entry.date = date;
      entry.eggs = 0;
      entry.dozenSold = dozenSold;
      entry.dozenPrice = dozenPrice;
      entry.packSold = packSold;
      entry.packPrice = packPrice;
      entry.deleted = false;
      entry.updatedAt = Date.now();
    }
    editingId = null;
  } else {
    entries.push({
      id: String(Date.now() + Math.random()),
      type: "sale",
      date,
      eggs: 0,
      dozenSold,
      dozenPrice,
      packSold,
      packPrice,
      deleted: false,
      updatedAt: Date.now()
    });
  }

  document.getElementById("dozenSold").value = "";
  document.getElementById("dozenPrice").value = "";
  document.getElementById("packSold").value = "";
  document.getElementById("packPrice").value = "";

  saveAndSync();
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
  if (!confirm("Delete this one entry?")) return;

  entries = entries.filter(e => e.id !== String(id));

  saveAndSync();
}

function revenue(e) {
  return (Number(e.dozenSold) || 0) * (Number(e.dozenPrice) || 0) +
         (Number(e.packSold) || 0) * (Number(e.packPrice) || 0);
}

function eggsSold(e) {
  return (Number(e.dozenSold) || 0) * 12 + (Number(e.packSold) || 0) * 18;
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
  start.setHours(0,0,0,0);
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
    const eRev = revenue(e);
    lifeEggs += Number(e.eggs) || 0;
    lifeRev += eRev;
    totalEggsSold += eggsSold(e);

    if (isWeek(e.date)) {
      weekEggs += Number(e.eggs) || 0;
      weekRev += eRev;
    }

    if (isMonth(e.date)) {
      monthEggs += Number(e.eggs) || 0;
      monthRev += eRev;
    }

    if (isYear(e.date)) {
      yearEggs += Number(e.eggs) || 0;
      yearRev += eRev;
    }
  });

  const eggsUsed = Number(farmSettings.eggsUsed) || 0;
  const eggsAvailable = lifeEggs - totalEggsSold - eggsUsed;
  const safeAvailable = Math.max(eggsAvailable, 0);
  const dozensAvailable = Math.floor(safeAvailable / 12);
  const looseEggs = safeAvailable % 12;
  const totalDozensProduced = Math.floor(lifeEggs / 12);

  const eggDays = new Set(list.filter(e => e.type === "eggs" && e.eggs > 0).map(e => e.date)).size || 1;
  const avg = lifeEggs / eggDays;

  const predictedWeek = avg * 7;
  const predictedMonth = avg * 30;
  const predictedYear = avg * 365;

  const best = list
    .filter(e => e.type === "eggs")
    .reduce((a, b) => Number(b.eggs) > Number(a.eggs || 0) ? b : a, {});

  const eggsToday = list
    .filter(e => e.type === "eggs" && e.date === today)
    .reduce((sum, e) => sum + Number(e.eggs || 0), 0);

  const hens = Number(farmSettings.hens) || 0;
  const productionPercent = hens > 0 ? (eggsToday / hens) * 100 : 0;

  document.getElementById("farmHeroName").textContent = farmSettings.farmName || "Egg Production";
  document.getElementById("farmHeroText").textContent =
    hens > 0
      ? `${hens} hens • ${eggsToday} eggs today • ${productionPercent.toFixed(0)}% production`
      : "Track collections, sales, records, and revenue.";

  document.getElementById("dashboardTotals").innerHTML = `
    ${statCard("🥚", "Lifetime Eggs", lifeEggs, "since day 1")}
    ${statCard("📦", "Eggs Available", eggsAvailable, "ready to use or sell")}
    ${statCard("🍳", "Used / Eaten / Hatched", eggsUsed, "subtracted from available")}
    ${statCard("💰", "Lifetime Revenue", "$" + lifeRev.toFixed(2), "all-time sales")}
    ${statCard("📅", "This Week Eggs", weekEggs, "eggs collected")}
    ${statCard("💵", "This Week Revenue", "$" + weekRev.toFixed(2), "sales this week")}
    ${statCard("🗓️", "This Month Eggs", monthEggs, "eggs collected")}
    ${statCard("💰", "This Month Revenue", "$" + monthRev.toFixed(2), "sales this month")}
    ${statCard("📆", "This Year Eggs", yearEggs, "eggs collected")}
    ${statCard("🏦", "This Year Revenue", "$" + yearRev.toFixed(2), "sales this year")}
    ${statCard("🏆", "Best Day", best.eggs || 0, best.date || "No data yet")}
    ${statCard("📊", "Avg / Day", avg.toFixed(1), "collection days")}
  `;

  document.getElementById("statsTotals").innerHTML = `
    ${statCard("🥚", "Lifetime Eggs", lifeEggs, "all collected eggs")}
    ${statCard("📦", "Eggs Available", eggsAvailable, "after sales and used eggs")}
    ${statCard("🍳", "Used / Eaten / Hatched", eggsUsed, "manual adjustment")}
    ${statCard("📦", "Dozens Available", dozensAvailable, "full dozens")}

    ${statCard("🛒", "Total Eggs Sold", totalEggsSold, "all sales")}
    ${statCard("🥚", "Dozens Produced", totalDozensProduced, "lifetime")}
    ${statCard("📅", "Week Eggs", weekEggs, "this week")}
    ${statCard("💵", "Week Revenue", "$" + weekRev.toFixed(2), "this week")}
    ${statCard("🗓️", "Month Eggs", monthEggs, "this month")}
    ${statCard("💰", "Month Revenue", "$" + monthRev.toFixed(2), "this month")}
    ${statCard("📆", "Year Eggs", yearEggs, "this year")}
    ${statCard("🏦", "Year Revenue", "$" + yearRev.toFixed(2), "this year")}
    ${statCard("🔮", "Predicted Week", predictedWeek.toFixed(0), "estimated eggs")}
    ${statCard("🔮", "Predicted Month", predictedMonth.toFixed(0), "estimated eggs")}
    ${statCard("🚀", "Predicted Year", predictedYear.toFixed(0), "estimated eggs")}
    ${statCard("💰", "Lifetime Revenue", "$" + lifeRev.toFixed(2), "all-time sales")}
  `;

  document.getElementById("recordsTotals").innerHTML = `
    ${statCard("🥚", "Highest Egg Day", best.eggs || 0, best.date || "No data yet")}
    ${statCard("💰", "Lifetime Revenue", "$" + lifeRev.toFixed(2), "all-time sales")}
    ${statCard("📅", "Best Week Revenue", "$" + weekRev.toFixed(2), "current week")}
    ${statCard("🗓️", "Best Month Revenue", "$" + monthRev.toFixed(2), "current month")}
  `;

  const search = (document.getElementById("historySearch")?.value || "").toLowerCase();

  const sorted = [...list]
    .filter(e => historyFilter === "all" || e.type === historyFilter)
    .filter(e => e.date.toLowerCase().includes(search))
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
  const backup = { entries, farmSettings };

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
      const backup = JSON.parse(e.target.result);

      entries = (backup.entries || []).map(normalizeEntry);
      farmSettings = backup.farmSettings || farmSettings;
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

  setInterval(cloudLoad, 60000);
  window.addEventListener("focus", cloudLoad);
});
