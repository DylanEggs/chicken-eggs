const CLOUD_URL = "https://script.google.com/macros/s/AKfycby3l3hzS7hDMUZWzT23KM7hp1X0MzqfG_2mPQMY-b0YPVy6G4VfgiH-EEVDbNnGFpr6IQ/exec";
let entries = JSON.parse(localStorage.getItem("chickenEggEntries")) || [];
let editingId = null;
let historyFilter = "all";
// =========================
// Farm Settings
// =========================

let farmSettings = JSON.parse(localStorage.getItem("farmSettings")) || {
  farmName: "",
  hens: 0,
  roosters: 0,
  eggGoal: 0,
  dozenPrice: 0,
  packPrice: 0
};

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
    packPrice: Number(document.getElementById("farmPackPrice").value) || 0
  };

  localStorage.setItem("farmSettings", JSON.stringify(farmSettings));

  alert("Farm settings saved!");

  showScreen("dashboard");
}

entries = entries.map(e => ({
  id: e.id || Date.now() + Math.random(),
  type: e.type || (Number(e.eggs) > 0 ? "eggs" : "sale"),
  date: e.date || new Date().toISOString().split("T")[0],
  eggs: Number(e.eggs) || 0,
  dozenSold: Number(e.dozenSold) || 0,
  dozenPrice: Number(e.dozenPrice) || 0,
  packSold: Number(e.packSold ?? e.packs18Sold) || 0,
  packPrice: Number(e.packPrice ?? e.packs18Price) || 0
}));

const today = new Date().toISOString().split("T")[0];

document.getElementById("eggDate").value = today;
document.getElementById("saleDate").value = today;
document.getElementById("todayText").textContent = new Date().toDateString();
loadFarmSettings();

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  document.querySelectorAll(".bottomNav button").forEach(btn => btn.classList.remove("navActive"));
  document.querySelectorAll(".bottomNav button").forEach(btn => {
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

function saveData() {
  localStorage.setItem("chickenEggEntries", JSON.stringify(entries));
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

function saveEggs() {
  const eggs = Number(document.getElementById("eggCount").value) || 0;
  const date = document.getElementById("eggDate").value;

  if (eggs <= 0) {
    alert("Enter how many eggs you collected.");
    return;
  }

  if (editingId) {
    const entry = entries.find(e => e.id === editingId);
    entry.type = "eggs";
    entry.date = date;
    entry.eggs = eggs;
    entry.dozenSold = 0;
    entry.dozenPrice = 0;
    entry.packSold = 0;
    entry.packPrice = 0;
    editingId = null;
  } else {
    entries.push({
      id: Date.now() + Math.random(),
      type: "eggs",
      date,
      eggs,
      dozenSold: 0,
      dozenPrice: 0,
      packSold: 0,
      packPrice: 0
    });
  }

  saveData();
  cloudSave(false);
  document.getElementById("eggCount").value = "";
  showScreen("dashboard");
}

function saveSale() {
  const date = document.getElementById("saleDate").value;
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
    entry.type = "sale";
    entry.date = date;
    entry.eggs = 0;
    entry.dozenSold = dozenSold;
    entry.dozenPrice = dozenPrice;
    entry.packSold = packSold;
    entry.packPrice = packPrice;
    editingId = null;
  } else {
    entries.push({
      id: Date.now() + Math.random(),
      type: "sale",
      date,
      eggs: 0,
      dozenSold,
      dozenPrice,
      packSold,
      packPrice
    });
  }

  saveData();
  cloudSave(false);
  document.getElementById("dozenSold").value = "";
  document.getElementById("dozenPrice").value = "";
  document.getElementById("packSold").value = "";
  document.getElementById("packPrice").value = "";
  showScreen("dashboard");
}

function editEntry(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  editingId = id;

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
  if (confirm("Are you sure you want to delete this entry?")) {
    entries = entries.filter(e => e.id !== id);
    saveData();
    cloudSave(false);
    updateApp();
  }
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

  entries.forEach(e => {
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
    const d = new Date(date + "T00:00:00");

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

    const eggs = entries
      .filter(e => e.type === "eggs" && e.date === date)
      .reduce((sum, e) => sum + Number(e.eggs || 0), 0);

    const money = entries
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
    const radius = 8;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight || 4, radius);
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

  const eggEntries = entries.filter(e => e.type === "eggs");
  const saleEntries = entries.filter(e => e.type === "sale");

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
  let weekEggs = 0, monthEggs = 0, yearEggs = 0, lifeEggs = 0;
  let weekRev = 0, monthRev = 0, yearRev = 0, lifeRev = 0;
  let totalEggsSold = 0;
  let totalDozensSold = 0;

  entries.forEach(e => {
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
  const eggDays = new Set(entries.filter(e => Number(e.eggs) > 0).map(e => e.date)).size || 1;
  const avg = lifeEggs / eggDays;
  const bestDay = getBestEggDay();
  const avgPricePerDozen = totalDozensSold > 0 ? lifeRev / totalDozensSold : 0;
  const farmName = farmSettings.farmName || "Egg Production";
const hens = Number(farmSettings.hens) || 0;
const eggGoal = Number(farmSettings.eggGoal) || 0;
const eggsToday = entries
  .filter(e => e.type === "eggs" && e.date === today)
  .reduce((sum, e) => sum + Number(e.eggs || 0), 0);

const eggsPerHen = hens > 0 ? eggsToday / hens : 0;
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

  const sorted = [...entries]
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

      <button onclick="editEntry(${e.id})">Edit Entry</button>
      <button onclick="deleteEntry(${e.id})">Delete This Entry</button>
    </div>
  `).join("");
}

saveData();
cloudSave(false);
updateApp();
showScreen("dashboard");
function backupData() {
  const backup = {
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
      const backup = JSON.parse(e.target.result);

      entries = backup.entries || [];
      farmSettings = backup.farmSettings || farmSettings;

      localStorage.setItem("chickenEggEntries", JSON.stringify(entries));
      localStorage.setItem("farmSettings", JSON.stringify(farmSettings));

      alert("Backup restored!");
      updateApp();
      showScreen("dashboard");
    } catch {
      alert("That backup file could not be restored.");
    }
  };

  reader.readAsText(file);
}
async function cloudSave(showAlert = true) {
  try {
    await fetch(CLOUD_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "saveAll",
        entries
      })
    });

    if (showAlert) {
      alert("Cloud save complete!");
    }
  } catch (error) {
    console.error("Cloud save failed:", error);
    if (showAlert) {
      alert("Cloud save failed. Try again.");
    }
  }
}

async function cloudLoad(showAlert = true) {
  try {
    const response = await fetch(CLOUD_URL);
    const data = await response.json();

    if (data.entries) {
      entries = data.entries.map(e => ({
        id: Number(e.id),
        type: e.type,
        date: e.date,
        eggs: Number(e.eggs) || 0,
        dozenSold: Number(e.dozenSold) || 0,
        dozenPrice: Number(e.dozenPrice) || 0,
        packSold: Number(e.packSold) || 0,
        packPrice: Number(e.packPrice) || 0
      }));

      saveData();
      updateApp();

      if (showAlert) {
        alert("Cloud data loaded!");
      }
    }
  } catch (error) {
    console.error("Cloud load failed:", error);

    if (showAlert) {
      alert("Cloud load failed. Try again.");
    }

    updateApp();
  }
}

    
  showScreen("dashboard");
cloudLoad(false);


