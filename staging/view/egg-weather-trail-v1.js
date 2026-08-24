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

  function friendlyDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!m) return String(value || "");
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  }

  function detailText(row = {}, w = {}) {
    const eggs = Math.max(0, Math.round(Number(row.eggs) || 0));
    const temp = tempFor(w);
    const kind = weatherKind(w);
    return `${friendlyDate(row.date)} • ${eggs} egg${eggs === 1 ? "" : "s"} • ${iconFor(w)} ${kind}${temp == null ? "" : ` • ${temp}°F`}`;
  }

  function css() {
    if (document.getElementById("customerEggWeatherTrailCss")) return;
    const s = document.createElement("style");
    s.id = "customerEggWeatherTrailCss";
    s.textContent = `
      .egg-trail-day{position:relative;cursor:pointer;border-radius:10px;outline:none;transition:background .16s ease,transform .16s ease}.egg-trail-day:focus-visible{box-shadow:0 0 0 3px rgba(31,122,58,.2)}
      @media(hover:hover) and (pointer:fine){.egg-trail-day:hover{background:rgba(31,122,58,.06);transform:translateY(-1px)}}
      .egg-trail-weather{display:block;min-height:16px;margin-top:2px;font-size:12px;line-height:1;text-align:center;filter:saturate(.9)}
      .egg-trail-weather-note{margin:8px 0 0;text-align:center;font-size:10px;font-weight:800;color:#758178}
      .egg-trail-detail{margin:8px auto 0;padding:8px 10px;max-width:420px;border-radius:12px;background:rgba(31,122,58,.07);border:1px solid rgba(31,122,58,.1);text-align:center;font-size:11px;font-weight:850;color:#35513d;line-height:1.35}
      @media(max-width:420px){.egg-trail-weather{font-size:11px}.egg-trail-weather-note{font-size:9px}.egg-trail-detail{font-size:10px}}
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
    let detail = section.querySelector(".egg-trail-detail");

    days.forEach((day, i) => {
      const row = daily[i];
      day.querySelector(".egg-trail-weather")?.remove();
      day.removeAttribute("role");
      day.removeAttribute("tabindex");
      day.onclick = null;
      day.onkeydown = null;
      if (!row?.date) return;
      const w = history[row.date];
      if (!w) return;
      const weather = document.createElement("span");
      weather.className = "egg-trail-weather";
      weather.textContent = iconFor(w);
      const text = detailText(row, w);
      weather.title = text;
      weather.setAttribute("aria-hidden", "true");
      day.appendChild(weather);
      day.setAttribute("role", "button");
      day.setAttribute("tabindex", "0");
      day.setAttribute("aria-label", `${text}. Show day details.`);
      const show = () => {
        if (!detail) {
          detail = document.createElement("div");
          detail.className = "egg-trail-detail";
          detail.setAttribute("aria-live", "polite");
          section.appendChild(detail);
        }
        detail.textContent = text;
      };
      day.onclick = show;
      day.onkeydown = e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          show();
        }
      };
    });

    let note = section.querySelector(".egg-trail-weather-note");
    const matched = daily.filter(x => x?.date && history[x.date]).length;
    if (matched >= 3) {
      if (!note) {
        note = document.createElement("p");
        note.className = "egg-trail-weather-note";
        section.appendChild(note);
      }
      note.textContent = "☀️ ☁️ 🌧️ Tap a laying day to see its eggs + saved farm weather.";
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
    version: 2,
    weatherKind,
    iconFor,
    tempFor,
    friendlyDate,
    detailText,
    render,
    networkCalls: 0,
    firebaseReads: 0,
    firebaseWrites: 0
  };
})();