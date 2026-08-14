(() => {
  "use strict";
  if (window.__adaptiveEggForecastV1) return;
  window.__adaptiveEggForecastV1 = true;

  const ENTRIES_KEY = "chickenEggEntriesV102";
  const SETTINGS_KEY = "chickenEggSettingsV102";
  let queued = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function addDays(date, amount) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + amount);
    return localDate(d);
  }
  function avg(values) {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  function eggMap() {
    const map = {};
    const rows = read(ENTRIES_KEY, []);
    if (!Array.isArray(rows)) return map;
    for (const e of rows) {
      if (e?.type !== "eggs" || !e.date) continue;
      const date = String(e.date).slice(0, 10);
      map[date] = (map[date] || 0) + Math.max(0, n(e.eggs));
    }
    return map;
  }

  function analyze() {
    const map = eggMap();
    const today = localDate();
    const allDates = Object.keys(map).filter(d => d <= today).sort();
    const recentCutoff = addDays(today, -21);
    let recentDates = allDates.filter(d => d >= recentCutoff).slice(-7);
    if (recentDates.length < 3) recentDates = allDates.slice(-7);

    const recentValues = recentDates.map(d => n(map[d]));
    const last3Values = recentValues.slice(-3);
    const recentAvg = avg(recentValues);
    const last3Avg = avg(last3Values);
    const lifetimeAvg = allDates.length ? avg(allDates.map(d => n(map[d]))) : 0;

    let adaptiveDaily = recentAvg || lifetimeAvg || 0;
    if (recentValues.length >= 3) {
      const accelerating = recentAvg > 0 && last3Avg > recentAvg * 1.15;
      adaptiveDaily = accelerating
        ? last3Avg * 0.70 + recentAvg * 0.30
        : last3Avg * 0.55 + recentAvg * 0.45;
    }

    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartKey = localDate(weekStart);
    const weekEggs = allDates
      .filter(d => d >= weekStartKey && d <= today)
      .reduce((sum, d) => sum + n(map[d]), 0);
    const elapsedWeekDays = now.getDay() + 1;
    const remainingWeekDays = Math.max(0, 7 - elapsedWeekDays);
    const observedWeekPace = weekEggs > 0 ? weekEggs / elapsedWeekDays : 0;

    // When production suddenly jumps, let the current week pull the estimate upward quickly.
    // Do not let a partial current day drag an otherwise stronger recent pace downward.
    if (observedWeekPace > adaptiveDaily) {
      const weekWeight = Math.min(0.65, 0.25 + elapsedWeekDays * 0.07);
      adaptiveDaily = adaptiveDaily * (1 - weekWeight) + observedWeekPace * weekWeight;
    }

    // Total Hens is used only as a sanity ceiling when the setting still agrees with
    // observed production. If that setting is stale (for example it says 3 while 10+
    // eggs are being logged), observed production wins instead of being artificially capped.
    const settings = read(SETTINGS_KEY, {});
    const hens = Math.max(0, n(settings?.hens));
    const recentMax = recentValues.length ? Math.max(...recentValues) : 0;
    if (hens > 0 && recentMax <= hens * 1.20) adaptiveDaily = Math.min(adaptiveDaily, hens);

    adaptiveDaily = Math.max(0, adaptiveDaily);
    const predictedWeek = Math.max(weekEggs, Math.round(weekEggs + adaptiveDaily * remainingWeekDays));

    const monthPrefix = today.slice(0, 7);
    const monthEggs = allDates.filter(d => d.startsWith(monthPrefix)).reduce((sum, d) => sum + n(map[d]), 0);
    const year = Number(today.slice(0, 4));
    const monthIndex = Number(today.slice(5, 7)) - 1;
    const dayOfMonth = Number(today.slice(8, 10));
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const remainingMonthDays = Math.max(0, daysInMonth - dayOfMonth);
    const predictedMonth = Math.max(monthEggs, Math.round(monthEggs + adaptiveDaily * remainingMonthDays));

    const yearPrefix = today.slice(0, 4);
    const yearEggs = allDates.filter(d => d.startsWith(yearPrefix)).reduce((sum, d) => sum + n(map[d]), 0);
    const startOfYear = new Date(year, 0, 1, 12, 0, 0, 0);
    const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
    const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
    const remainingYearDays = Math.max(0, daysInYear - dayOfYear);
    const predictedYear = Math.max(yearEggs, Math.round(yearEggs + adaptiveDaily * remainingYearDays));

    const confidence = recentDates.length >= 7 ? "strong recent data" : recentDates.length >= 4 ? "building recent data" : "limited recent data";
    return {
      recentDates,
      recentAvg,
      last3Avg,
      adaptiveDaily,
      weekEggs,
      monthEggs,
      yearEggs,
      predictedWeek,
      predictedMonth,
      predictedYear,
      remainingWeekDays,
      confidence
    };
  }

  function card(title) {
    return [...document.querySelectorAll("#statsTotals .totalBox")]
      .find(box => (box.querySelector("h3")?.textContent || "").includes(title));
  }
  function setCard(title, value, note) {
    const box = card(title);
    if (!box) return;
    const numberEl = box.querySelector(".totalValue");
    const noteEl = box.querySelector("p");
    if (numberEl && numberEl.textContent !== String(value)) numberEl.textContent = String(value);
    if (noteEl && noteEl.textContent !== note) noteEl.textContent = note;
  }

  function render() {
    queued = false;
    const a = analyze();
    setCard("Predicted Week", a.predictedWeek, `${a.weekEggs} already collected • ${a.adaptiveDaily.toFixed(1)}/day current pace`);
    setCard("Predicted Month", a.predictedMonth, `${a.monthEggs} already collected • recent flock pace`);
    setCard("Predicted Year", a.predictedYear, `${a.yearEggs} already collected • ${a.confidence}`);
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  }

  function wrapUpdateApp() {
    const original = window.updateApp;
    if (typeof original !== "function") { setTimeout(wrapUpdateApp, 100); return; }
    if (original.__adaptiveForecast) return;
    const wrapped = function() {
      const result = original.apply(this, arguments);
      schedule();
      return result;
    };
    wrapped.__adaptiveForecast = true;
    window.updateApp = wrapped;
  }

  window.EggProductionForecast = { analyze, render };
  window.addEventListener("core-data-synced", schedule);
  window.addEventListener("farm-data-synced", schedule);
  window.addEventListener("storage", e => {
    if ([ENTRIES_KEY, SETTINGS_KEY].includes(e.key)) schedule();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });

  function init() {
    wrapUpdateApp();
    const totals = document.getElementById("statsTotals");
    if (totals) new MutationObserver(schedule).observe(totals, { childList: true });
    render();
    console.log("✅ Adaptive egg forecast active");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 700));
  else setTimeout(init, 700);
})();
