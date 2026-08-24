(() => {
  "use strict";
  if (window.__StagingCustomerEggWeatherTrailV1) return;
  window.__StagingCustomerEggWeatherTrailV1 = true;

  const PREFIX = "__chicken_eggs_staging__::";
  const PREVIEW_SESSION = "chickenEggStagingCustomerPreviewV2";
  const WEATHER_KEY = "chickenEggWeatherIntelligenceV2";
  const finite = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const n = v => Math.max(0, Number(v) || 0);

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

  function weatherKind(w = {}) {
    if (n(w.rain ?? w.precip) >= .05 || n(w.rainHours) >= 2 || n(w.precipProbability) >= 60) return "rainy";
    if (finite(w.cloud) && n(w.cloud) >= 65) return "cloudy";
    return "sunny";
  }

  function iconFor(w = {}) {
    const kind = weatherKind(w);
    return kind === "rainy" ? "🌧️" : kind === "cloudy" ? "☁️" : "☀️";
  }

  function tempFor(w = {}) {
    if (finite(w.max)) return Math.round(Number(w.max));
    if (finite(w.high)) return Math.round(Number(w.high));
    if (finite(w.temperature)) return Math.round(Number(w.temperature));
    return null;
  }

  function css() {
    if (document.getElementById("customerEggWeatherTrailCss")) return;
    const s = document.createElement("style");
    s.id = "customerEggWeatherTrailCss";
    s.textContent = `
      .egg-trail-day{position:relative}.egg-trail-weather{display:block;min-height:16px;margin-top:2px;font-size:12px;line-height:1;text-align:center;filter:saturate(.9)}
      .egg-trail-weather-note{margin:8px 0 0;text-align:center;font-size:10px;font-weight:800;color:#758178}
      @media(max-width:420px){.egg-trail-weather{font-size:11px}.egg-trail-weather-note{font-size:9px}}
    `;
    document.head.appendChild(s);
  }

  function render() {
    const data = window.CustomerViewStaging?.getData?.() || window.StagingCustomerPublicData?.build?.();
    const section = document.getElementById("customerEggTrail");
    if (!data?.stats || !section) return false;

    css();
    const daily = Array.isArray(data.stats.daily30) ? data.stats.daily30.slice(-14) : [];
    const history = read(WEATHER_KEY, {})?.history || {};
    const days = Array.from(section.querySelectorAll(".egg-trail-day"));

    days.forEach((day, i) => {
      const row = daily[i];
      if (!row?.date) return;
      const w = history[row.date];
      day.querySelector(".egg-trail-weather")?.remove();
      if (!w) return;
      const weather = document.createElement("span");
      weather.className = "egg-trail-weather";
      weather.textContent = iconFor(w);
      const temp = tempFor(w);
      const eggs = Math.max(0, Math.round(Number(row.eggs) || 0));
      weather.title = `${row.date}: ${eggs} eggs • ${weatherKind(w)}${temp == null ? "" : ` • ${temp}°F`}`;
      weather.setAttribute("aria-label", `${weatherKind(w)} weather${temp == null ? "" : `, ${temp} degrees`}`);
      day.appendChild(weather);
    });

    let note = section.querySelector(".egg-trail-weather-note");
    const matched = daily.filter(x => x?.date && history[x.date]).length;
    if (matched >= 3) {
      if (!note) {
        note = document.createElement("p");
        note.className = "egg-trail-weather-note";
        section.appendChild(note);
      }
      note.textContent = "☀️ ☁️ 🌧️ Weather icons line up each laying day with the farm’s saved weather history.";
    } else if (note) note.remove();
    return true;
  }

  function start() {
    const run = () => setTimeout(render, 40);
    run();
    ["staging-customer-data-ready", "core-data-synced", "farm-data-synced"].forEach(name => window.addEventListener(name, run));
    const observer = new MutationObserver(() => {
      if (document.getElementById("customerEggTrail")) run();
    });
    const app = document.getElementById("customerApp");
    if (app) observer.observe(app, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 12000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.StagingCustomerEggWeatherTrailV1 = {
    version: 1,
    weatherKind,
    iconFor,
    tempFor,
    render,
    networkCalls: 0,
    firebaseReads: 0,
    firebaseWrites: 0
  };
})();