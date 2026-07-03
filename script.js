let entries = JSON.parse(localStorage.getItem("chickenEggEntries")) || [];
let editingId = null;
let historyFilter = "all";

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

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
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
  return (Number(e.dozenSold) || 0) * (Number(e.dozenPrice) || 0) +
         (Number(e.packSold) || 0) * (Number(e.packPrice) || 0);
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

  const padding = 35;
  const chartHeight = height - 70;
  const chartWidth = width - 50;
  const maxValue = Math.max(...data.map(d => d[valueKey]), 1);
  const barWidth = chartWidth / data.length - 12;

  ctx.font = "13px Arial";
  ctx.fillStyle = "#333";

  data.forEach((d, i) => {
    const x = padding + i * (chartWidth / data.length) + 5;
    const barHeight = (d[valueKey] / maxValue) * chartHeight;
    const y = height - padding - barHeight;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#333";
    ctx.textAlign = "center";
    ctx.fillText(d.label, x + barWidth / 2, height - 12);

    const valueText = valueKey === "money"
      ? "$" + d[valueKey].toFixed(0)
      : d[valueKey];

    ctx.fillText(valueText, x + barWidth / 2, y - 6);
  });
}

function getHighestEggDay() {
  const eggTotals = {};

  entries.forEach(e => {
    if (e.type === "eggs") {
      eggTotals[e.date] = (eggTotals[e.date] || 0) + Number(e.eggs || 0);
    }
  });

  let bestDate = "No data yet";
  let bestEggs = 0;

  Object.keys(eggTotals).forEach(date => {
    if (eggTotals[date] > bestEggs) {
      bestDate = date;
      bestEggs = eggTotals[date];
    }
  });

  return { date: bestDate, eggs: bestEggs };
}

function getHighestRevenueDay() {
  const revenueTotals = {};

  entries.forEach(e => {
    if (e.type === "sale") {
      revenueTotals[e.date] = (revenueTotals[e.date] || 0) + revenue(e);
    }
  });

  let bestDate = "No data yet";
  let bestRevenue = 0;

  Object.keys(revenueTotals).forEach(date => {
    if (revenueTotals[date] > bestRevenue) {
      bestDate = date;
      bestRevenue = revenueTotals[date];
    }
  });

  return { date: bestDate, money: bestRevenue };
}

function getMostDozensSoldDay() {
  let bestDate = "No data yet";
  let bestAmount = 0;

  entries.forEach(e => {
    if (Number(e.dozenSold || 0) > bestAmount) {
      bestDate = e.date;
      bestAmount = Number(e.dozenSold || 0);
    }
  });

  return { date: bestDate, amount: bestAmount };
}

function getMost18PacksSoldDay() {
  let bestDate = "No data yet";
  let bestAmount = 0;

  entries.forEach(e => {
    if (Number(e.packSold || 0) > bestAmount) {
      bestDate = e.date;
      bestAmount = Number(e.packSold || 0);
    }
  });

  return { date: bestDate, amount: bestAmount };
}

function getLargestSingleSale() {
  let bestDate = "No data yet";
  let bestMoney = 0;

  entries.forEach(e => {
    const saleTotal = revenue(e);
    if (saleTotal > bestMoney) {
      bestDate = e.date;
      bestMoney = saleTotal;
    }
  });

  return { date: bestDate, money: bestMoney };
}

function updateRecords() {
  const recordsBox = document.getElementById("recordsTotals");
  if (!recordsBox) return;

  const highestEggDay = getHighestEggDay();
  const highestRevenueDay = getHighestRevenueDay();
  const mostDozens = getMostDozensSoldDay();
  const most18Packs = getMost18PacksSoldDay();
  const largestSale = getLargestSingleSale();

  recordsBox.innerHTML = `
    <div class="totalBox">
      <h3>Highest Egg Day</h3>
      <div class="totalValue">${highestEggDay.eggs}</div>
      <p>${highestEggDay.date}</p>
    </div>

    <div class="totalBox">
      <h3>Highest Revenue Day</h3>
      <div class="totalValue">$${highestRevenueDay.money.toFixed(2)}</div>
      <p>${highestRevenueDay.date}</p>
    </div>

    <div class="totalBox">
      <h3>Most Dozens Sold</h3>
      <div class="totalValue">${mostDozens.amount}</div>
      <p>${mostDozens.date}</p>
    </div>

    <div class="totalBox">
      <h3>Most 18-Packs Sold</h3>
      <div class="totalValue">${most18Packs.amount}</div>
      <p>${most18Packs.date}</p>
    </div>

    <div class="totalBox">
      <h3>Largest Single Sale</h3>
      <div class="totalValue">$${largestSale.money.toFixed(2)}</div>
      <p>${largestSale.date}</p>
    </div>
  `;
}

function updateApp() {
  let weekEggs = 0, monthEggs = 0, yearEggs = 0, lifeEggs = 0;
  let weekRev = 0, monthRev = 0, yearRev = 0, lifeRev = 0;

  entries.forEach(e => {
    const r = revenue(e);
    lifeEggs += Number(e.eggs) || 0;
    lifeRev += r;

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

  const eggDays = new Set(entries.filter(e => Number(e.eggs) > 0).map(e => e.date)).size || 1;
  const avg = lifeEggs / eggDays;

  document.getElementById("dashboardTotals").innerHTML = `
    <div class="totalBox"><h3>Lifetime Eggs</h3><div class="totalValue">${lifeEggs}</div></div>
    <div class="totalBox"><h3>Lifetime Revenue</h3><div class="totalValue">$${lifeRev.toFixed(2)}</div></div>
    <div class="totalBox"><h3>Eggs This Week</h3><div class="totalValue">${weekEggs}</div></div>
    <div class="totalBox"><h3>Predicted Week</h3><div class="totalValue">${(avg * 7).toFixed(0)}</div></div>

    <div class="totalBox" style="grid-column: 1 / -1;">
      <h3>Eggs Collected - Last 7 Days</h3>
      <canvas id="eggChart" width="340" height="220"></canvas>
    </div>

    <div class="totalBox" style="grid-column: 1 / -1;">
      <h3>Revenue - Last 7 Days</h3>
      <canvas id="revenueChart" width="340" height="220"></canvas>
    </div>
  `;

  document.getElementById("statsTotals").innerHTML = `
    <div class="totalBox"><h3>Week Eggs</h3><div class="totalValue">${weekEggs}</div></div>
    <div class="totalBox"><h3>Month Eggs</h3><div class="totalValue">${monthEggs}</div></div>
    <div class="totalBox"><h3>Year Eggs</h3><div class="totalValue">${yearEggs}</div></div>
    <div class="totalBox"><h3>Lifetime Eggs</h3><div class="totalValue">${lifeEggs}</div></div>
    <div class="totalBox"><h3>Week Revenue</h3><div class="totalValue">$${weekRev.toFixed(2)}</div></div>
    <div class="totalBox"><h3>Month Revenue</h3><div class="totalValue">$${monthRev.toFixed(2)}</div></div>
    <div class="totalBox"><h3>Year Revenue</h3><div class="totalValue">$${yearRev.toFixed(2)}</div></div>
    <div class="totalBox"><h3>Lifetime Revenue</h3><div class="totalValue">$${lifeRev.toFixed(2)}</div></div>
    <div class="totalBox"><h3>Average / Day</h3><div class="totalValue">${avg.toFixed(1)}</div></div>
    <div class="totalBox"><h3>Predicted Month</h3><div class="totalValue">${(avg * 30).toFixed(0)}</div></div>
    <div class="totalBox"><h3>Predicted Year</h3><div class="totalValue">${(avg * 365).toFixed(0)}</div></div>
  `;

  updateRecords();

  const chartData = getLast7DaysData();
  drawBarChart("eggChart", chartData, "eggs", "#f4b400");
  drawBarChart("revenueChart", chartData, "money", "#34a853");

  const searchText = (document.getElementById("historySearch")?.value || "").toLowerCase();

  const sorted = [...entries]
    .filter(e => historyFilter === "all" || e.type === historyFilter)
    .filter(e => e.date.toLowerCase().includes(searchText))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById("historyList").innerHTML = sorted.map(e => `
    <div class="entry">
      <strong>${e.date}</strong><br>
      ${e.type === "eggs" ? `🥚 Eggs Collected: ${e.eggs}` : ""}
      ${e.type === "sale" ? `
        💰 Dozen Sold: ${e.dozenSold} @ $${Number(e.dozenPrice).toFixed(2)}<br>
        💰 18-Packs Sold: ${e.packSold} @ $${Number(e.packPrice).toFixed(2)}<br>
        <strong>Revenue: $${revenue(e).toFixed(2)}</strong>
      ` : ""}
      <button onclick="editEntry(${e.id})">Edit Entry</button>
      <button onclick="deleteEntry(${e.id})">Delete This Entry</button>
    </div>
  `).join("");
}

saveData();
updateApp();