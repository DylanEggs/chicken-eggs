(() => {
  "use strict";
  if (window.__StagingCustomerWeatherExplorerV1) return;
  window.__StagingCustomerWeatherExplorerV1 = true;

  const BRAND = "Rose Family Poultry";
  const PREFIX = "__chicken_eggs_staging__::";
  const PREVIEW_SESSION = "chickenEggStagingCustomerPreviewV2";
  const ENTRY_KEY = "chickenEggEntriesV102";
  const WEATHER_KEY = "chickenEggWeatherIntelligenceV2";
  const n = v => Number(v) || 0;
  const finite = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const median = values => {
    const a = values.filter(finite).map(Number).sort((x, y) => x - y);
    if (!a.length) return null;
    const i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
  };

  function previewValues() {
    try { return JSON.parse(sessionStorage.getItem(PREVIEW_SESSION) || "null")?.values || {}; }
    catch { return {}; }
  }
  function read(key, fallback) {
    try {
      const values = previewValues();
      if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }
  function eggMap(entries) {
    const map = {};
    for (const e of Array.isArray(entries) ? entries : []) {
      if (e?.type !== "eggs" || !e.date) continue;
      const date = String(e.date).slice(0, 10);
      map[date] = (map[date] || 0) + Math.max(0, Math.round(n(e.eggs)));
    }
    return map;
  }
  function localBaseline(date, map) {
    const t = new Date(`${date}T12:00:00`).getTime();
    const nearby = Object.entries(map)
      .filter(([d, v]) => d !== date && finite(v))
      .map(([d, v]) => ({ v: Number(v), dist: Math.abs((new Date(`${d}T12:00:00`).getTime() - t) / 86400000) }))
      .filter(x => x.dist <= 14)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 12)
      .map(x => x.v);
    if (nearby.length >= 5) return median(nearby);
    const prior = Object.entries(map)
      .filter(([d, v]) => d < date && finite(v))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 10)
      .map(([, v]) => Number(v));
    return prior.length >= 4 ? median(prior) : null;
  }
  function skyKind(w = {}) {
    if (n(w.rain ?? w.precip) >= .05 || n(w.rainHours) >= 2 || n(w.precipProbability) >= 60) return "rainy";
    if (finite(w.cloud) && n(w.cloud) >= 65) return "cloudy";
    return "sunny";
  }
  function tempBand(temp) {
    const t = Number(temp);
    if (t >= 90) return "hot";
    if (t >= 80) return "warm";
    if (t >= 66) return "mild";
    if (t >= 52) return "cool";
    return "cold";
  }
  function recentPace(map) {
    const today = new Date().toISOString().slice(0, 10);
    const values = Object.entries(map)
      .filter(([date, value]) => date < today && finite(value))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 10)
      .map(([, value]) => Number(value));
    return median(values) || 0;
  }
  function rows() {
    const map = eggMap(read(ENTRY_KEY, []));
    const weather = read(WEATHER_KEY, {});
    const history = weather?.history && typeof weather.history === "object" ? weather.history : {};
    const result = [];
    for (const [date, w] of Object.entries(history)) {
      if (!finite(map[date]) || !finite(w?.max)) continue;
      const base = localBaseline(date, map);
      if (!base || base <= 0) continue;
      result.push({ date, eggs: Number(map[date]), ratio: Math.max(.5, Math.min(1.5, Number(map[date]) / base)), sky: skyKind(w), temp: tempBand(w.max) });
    }
    return { map, result };
  }
  function summarizeGroup(list, currentPace) {
    const ratios = list.map(x => x.ratio).filter(finite);
    const ratio = median(ratios);
    if (ratio == null || !currentPace) return null;
    return {
      samples: list.length,
      ratio,
      projected: Math.max(0, Math.round(currentPace * ratio)),
      effect: Math.round((ratio - 1) * 100)
    };
  }
  function analyze() {
    const { map, result } = rows();
    const pace = recentPace(map);
    const sky = ["sunny", "cloudy", "rainy"].map(key => ({ key, ...summarizeGroup(result.filter(x => x.sky === key), pace) })).filter(x => x.samples >= 3 && finite(x.projected));
    const temp = ["hot", "warm", "mild", "cool", "cold"].map(key => ({ key, ...summarizeGroup(result.filter(x => x.temp === key), pace) })).filter(x => x.samples >= 3 && finite(x.projected));
    return { pace, samples: result.length, sky, temp };
  }
  function emoji(type, key) {
    if (type === "sky") return key === "rainy" ? "🌧️" : key === "cloudy" ? "☁️" : "☀️";
    return key === "hot" ? "🥵" : key === "warm" ? "🌤️" : key === "mild" ? "🐔" : key === "cool" ? "🧥" : "❄️";
  }
  function label(key) { return key.charAt(0).toUpperCase() + key.slice(1); }
  function card(type, item) {
    const direction = item.effect > 0 ? `+${item.effect}%` : `${item.effect}%`;
    return `<button type="button" class="weather-history-tile" data-weather-story="${type}:${item.key}"><span class="weather-history-emoji">${emoji(type, item.key)}</span><span><strong>${label(item.key)}</strong><small>${item.samples} similar days</small></span><b>~${item.projected} eggs</b><em>${direction}</em></button>`;
  }
  function render() {
    const anchor = document.getElementById("customerWeatherImpact");
    if (!anchor) return false;
    const data = analyze();
    if (data.samples < 6 || (!data.sky.length && !data.temp.length)) return false;

    let section = document.getElementById("customerWeatherExplorer");
    if (!section) {
      section = document.createElement("section");
      section.id = "customerWeatherExplorer";
      section.className = "weather-history-explorer";
      anchor.insertAdjacentElement("afterend", section);
    }
    section.innerHTML = `<div class="section-heading weather-history-heading"><div><div class="section-kicker">🌦️ Weather & the laying boxes</div><h2>See how this flock lays in different weather</h2><p>${data.samples} weather-linked laying days are ready to explore.</p></div><button type="button" class="weather-history-toggle" id="weatherHistoryToggle" aria-expanded="false" aria-controls="weatherHistoryBody">Explore weather patterns ↓</button></div><div class="weather-history-body" id="weatherHistoryBody" hidden>${data.sky.length ? `<div class="weather-history-label">Sky conditions</div><div class="weather-history-grid">${data.sky.map(x => card("sky", x)).join("")}</div>` : ""}${data.temp.length ? `<div class="weather-history-label">Temperature bands</div><div class="weather-history-grid">${data.temp.map(x => card("temp", x)).join("")}</div>` : ""}<div class="weather-history-detail" id="weatherHistoryDetail">Tap a weather type to see how to read these numbers.</div><p class="weather-impact-note">Projected egg counts scale historical patterns to the flock’s recent pace. These are observations, not proof that weather caused the difference.</p></div>`;

    const body = section.querySelector("#weatherHistoryBody");
    const toggle = section.querySelector("#weatherHistoryToggle");
    toggle?.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.textContent = open ? "Explore weather patterns ↓" : "Hide weather patterns ↑";
      if (body) body.hidden = open;
    });

    section.querySelectorAll("[data-weather-story]").forEach(button => button.addEventListener("click", () => {
      const [type, key] = String(button.dataset.weatherStory || "").split(":");
      const item = (type === "sky" ? data.sky : data.temp).find(x => x.key === key);
      if (!item) return;
      section.querySelectorAll(".weather-history-tile").forEach(x => x.classList.toggle("active", x === button));
      const detail = section.querySelector("#weatherHistoryDetail");
      if (detail) detail.textContent = `${label(key)} days have run about ${Math.abs(item.effect)}% ${item.effect >= 0 ? "above" : "below"} nearby-day production in ${item.samples} comparable records. At the flock’s recent pace, that works out to roughly ${item.projected} eggs.`;
    }));
    return true;
  }
  function css() {
    if (document.getElementById("customerWeatherExplorerCss")) return;
    const style = document.createElement("style");
    style.id = "customerWeatherExplorerCss";
    style.textContent = `
      .weather-history-explorer{margin:18px 0;padding:19px;border-radius:24px;background:rgba(255,255,255,.9);border:1px solid rgba(31,122,58,.12);box-shadow:0 14px 34px rgba(24,68,36,.08)}
      .weather-history-heading{align-items:center}.weather-history-explorer .section-heading p{margin:4px 0 0;color:#718076;font-size:11px;font-weight:750}.weather-history-toggle{width:auto!important;margin:0!important;padding:9px 12px!important;border-radius:999px!important;white-space:nowrap;font-size:10px!important;font-weight:900!important}.weather-history-body[hidden]{display:none!important}.weather-history-label{margin:13px 0 7px;font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;color:#66756b}
      .weather-history-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.weather-history-tile{display:grid;grid-template-columns:auto 1fr;grid-template-areas:'emoji copy' 'value value' 'effect effect';gap:3px 7px;min-width:0;padding:11px;border:1px solid rgba(31,122,58,.11);border-radius:16px;background:#f8fbf8;color:#17351f;text-align:left;cursor:pointer}
      .weather-history-tile.active{outline:3px solid rgba(31,122,58,.16);background:#eef8f0}.weather-history-emoji{grid-area:emoji;font-size:21px}.weather-history-tile>span:nth-child(2){grid-area:copy;min-width:0}.weather-history-tile strong{display:block;font-size:11px}.weather-history-tile small{display:block;font-size:8px;color:#7c897f;white-space:nowrap}.weather-history-tile b{grid-area:value;font-size:17px;margin-top:4px}.weather-history-tile em{grid-area:effect;font-size:9px;font-style:normal;font-weight:900;color:#66756b}.weather-history-detail{margin-top:11px;padding:10px 12px;border-radius:14px;background:rgba(245,185,28,.12);font-size:10px;font-weight:800;line-height:1.45;color:#48554b}
      @media(max-width:560px){.weather-history-heading{align-items:flex-start}.weather-history-toggle{margin-top:9px!important}.weather-history-grid{grid-template-columns:1fr}.weather-history-tile{grid-template-columns:auto 1fr auto;grid-template-areas:'emoji copy value' 'emoji effect effect';align-items:center}.weather-history-tile b{text-align:right;margin:0}.weather-history-tile small{white-space:normal}}
    `;
    document.head.appendChild(style);
  }
  function start() {
    css();
    const run = () => render();
    run();
    setTimeout(run, 220);
    ["staging-customer-data-ready", "core-data-synced", "farm-data-synced"].forEach(name => window.addEventListener(name, run));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.StagingCustomerWeatherExplorerV1 = { version: 1, brand: BRAND, analyze, rows, skyKind, tempBand, render, networkCalls: 0, firebaseReads: 0, firebaseWrites: 0 };
})();