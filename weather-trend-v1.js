(() => {
  "use strict";

  const ENTRIES_KEY = "chickenEggEntriesV102";
  const DELUXE_KEY = "chickenEggDeluxeV1";
  let queued = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function day(offset = 0) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function avg(values) {
    const good = values.filter(Number.isFinite);
    return good.length ? good.reduce((a, b) => a + b, 0) / good.length : null;
  }
  function eggMap() {
    const map = {};
    read(ENTRIES_KEY, []).forEach(e => {
      if (e?.type === "eggs" && e.date) map[e.date] = (map[e.date] || 0) + n(e.eggs);
    });
    return map;
  }

  function analyze() {
    const deluxe = read(DELUXE_KEY, {});
    const weather = deluxe.weatherCache || {};
    const eggs = eggMap();
    const recentDates = Array.from({ length: 5 }, (_, i) => day(-(i + 1))).reverse();
    const baselineDates = Array.from({ length: 10 }, (_, i) => day(-(i + 6))).reverse();
    const recent = recentDates.filter(d => Number.isFinite(Number(eggs[d])) && Number.isFinite(Number(weather[d]?.max)));
    const baseline = baselineDates.filter(d => Number.isFinite(Number(eggs[d])) && Number.isFinite(Number(weather[d]?.max)));
    const latestWeatherDate = Object.keys(weather).sort().pop() || "";
    const result = { ready: recent.length >= 4 && baseline.length >= 6, recentMatched: recent.length, baselineMatched: baseline.length, latestWeatherDate, location: deluxe.weatherLabel || deluxe.weatherLocation || "your farm", kind: "none", severity: "none", title: "", message: "", detail: "" };
    if (!result.ready) return result;

    const recentEgg = avg(recent.map(d => n(eggs[d])));
    const baseEgg = avg(baseline.map(d => n(eggs[d])));
    const recentHigh = avg(recent.map(d => n(weather[d].max)));
    const baseHigh = avg(baseline.map(d => n(weather[d].max)));
    if (!baseEgg || recentEgg === null || recentHigh === null || baseHigh === null) return result;

    const eggChange = ((recentEgg - baseEgg) / baseEgg) * 100;
    const tempChange = recentHigh - baseHigh;
    const hotDays = recent.filter(d => n(weather[d].max) >= 90).length;
    const veryHotDays = recent.filter(d => n(weather[d].max) >= 95).length;
    const coldDays = recent.filter(d => n(weather[d].max) < 50).length;
    const drop = eggChange <= -18;
    Object.assign(result, { eggChange, tempChange, recentEgg, baseEgg, recentHigh, baseHigh });

    if (drop && (recentHigh >= 85 || hotDays >= 2) && (tempChange >= 5 || hotDays >= 3)) {
      result.kind = "heat";
      result.severity = eggChange <= -30 && (veryHotDays >= 2 || recentHigh >= 93) ? "strong" : "watch";
      result.title = "Possible heat-related production drop";
      result.message = `Egg production is down ${Math.round(Math.abs(eggChange))}% across the last 5 completed days while average highs rose from ${Math.round(baseHigh)}°F to ${Math.round(recentHigh)}°F.`;
      result.detail = `${hotDays} of the recent matched days reached 90°F or hotter. Weather may be contributing, but flock age, molt, stress, illness, daylight, and logging patterns can also affect production.`;
    } else if (drop && (recentHigh <= 55 || coldDays >= 2) && (tempChange <= -7 || coldDays >= 3)) {
      result.kind = "cold";
      result.severity = eggChange <= -30 && (coldDays >= 3 || recentHigh <= 45) ? "strong" : "watch";
      result.title = "Possible cold-weather production drop";
      result.message = `Egg production is down ${Math.round(Math.abs(eggChange))}% across the last 5 completed days while average highs fell from ${Math.round(baseHigh)}°F to ${Math.round(recentHigh)}°F.`;
      result.detail = `${coldDays} of the recent matched days stayed below 50°F. Weather may be contributing, but other flock changes can also affect laying.`;
    } else if (drop && Math.abs(tempChange) >= 8) {
      result.kind = "weather";
      result.severity = "watch";
      result.title = "Production dip during a weather change";
      result.message = `Egg production is down ${Math.round(Math.abs(eggChange))}% across the last 5 completed days while average high temperatures changed by ${Math.round(Math.abs(tempChange))}°F.`;
      result.detail = "That is enough of a change to watch, but the app does not have strong enough evidence to call heat or cold the likely cause yet.";
    }
    return result;
  }

  function styles() {
    if (document.getElementById("weatherTrendCss")) return;
    const s = document.createElement("style");
    s.id = "weatherTrendCss";
    s.textContent = `.weather-trend-card{margin:0 0 16px;padding:15px 16px;border-radius:20px;border:1px solid rgba(31,122,58,.12);background:linear-gradient(145deg,rgba(255,255,255,.94),rgba(245,250,244,.95));box-shadow:0 8px 22px rgba(24,68,36,.07)}.weather-trend-card.watch{border-color:rgba(245,158,11,.28);background:linear-gradient(145deg,rgba(255,249,230,.96),rgba(255,255,255,.94))}.weather-trend-card.strong{border-color:rgba(217,59,59,.22);background:linear-gradient(145deg,rgba(255,239,236,.96),rgba(255,255,255,.94))}.weather-trend-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.weather-trend-icon{font-size:28px;line-height:1}.weather-trend-card h3{margin:0 0 5px;font-size:17px;color:var(--dark)}.weather-trend-card p{margin:0;color:var(--dark);font-size:14px;line-height:1.42;font-weight:720}.weather-trend-detail{margin-top:8px!important;color:var(--muted)!important;font-size:12px!important;font-weight:700!important}.weather-trend-meta{margin-top:9px;font-size:10px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}.farm2-dark .weather-trend-card{background:rgba(28,38,31,.94);border-color:rgba(255,255,255,.09)}.farm2-dark .weather-trend-card.watch{background:rgba(66,54,25,.88)}.farm2-dark .weather-trend-card.strong{background:rgba(70,32,32,.9)}`;
    document.head.appendChild(s);
  }
  function icon(kind) { return kind === "heat" ? "🥵" : kind === "cold" ? "🥶" : kind === "weather" ? "🌦️" : "🌤️"; }

  function render() {
    queued = false;
    styles();
    const home = document.getElementById("perfectHomeSummary");
    if (!home) return;
    let card = document.getElementById("weatherProductionTrend");
    const a = analyze();
    if (a.kind === "none") { card?.remove(); return; }
    if (!card) { card = document.createElement("div"); card.id = "weatherProductionTrend"; home.insertAdjacentElement("afterend", card); }
    card.className = `weather-trend-card ${a.severity}`;
    card.innerHTML = `<div class="weather-trend-top"><div><h3>${a.title}</h3><p>${a.message}</p></div><div class="weather-trend-icon">${icon(a.kind)}</div></div><p class="weather-trend-detail">${a.detail}</p><div class="weather-trend-meta">${a.location} • weather through ${a.latestWeatherDate || "not refreshed"}</div>`;
  }
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(render); }

  window.EggWeatherTrend = { analyze, render };
  window.addEventListener("storage", e => { if ([ENTRIES_KEY, DELUXE_KEY].includes(e.key)) schedule(); });
  window.addEventListener("farm-data-synced", schedule);
  window.addEventListener("core-data-synced", schedule);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });

  function init() {
    render();
    const root = document.querySelector(".app");
    if (root) new MutationObserver(() => { if (!document.getElementById("weatherProductionTrend")) schedule(); }).observe(root, { childList: true, subtree: true });
    console.log("✅ Weather production trend detector active");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1200));
  else setTimeout(init, 1200);
})();
