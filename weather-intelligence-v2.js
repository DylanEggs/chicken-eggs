(() => {
  "use strict";

  const WEATHER_KEY = "chickenEggWeatherIntelligenceV2";
  const ENTRIES_KEY = "chickenEggEntriesV102";
  const DELUXE_KEY = "chickenEggDeluxeV1";
  const WEATHER_DOC = "farm_weather_v2";
  const FIREBASE_VERSION = "11.10.0";
  const RAIN_THRESHOLD = 0.05;
  let state = loadState();
  let firebaseApiCache = null;
  let firebaseUnsub = null;
  let refreshPromise = null;
  let renderQueued = false;
  let showHookInstalled = false;
  let refreshOverrideInstalled = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function finite(v) { return v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v, digits = 0) {
    if (!finite(v)) return null;
    const p = 10 ** digits;
    return Math.round(Number(v) * p) / p;
  }
  function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function dateAdd(date, amount) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + amount);
    return localDate(d);
  }
  function median(values) {
    const a = values.filter(finite).map(Number).sort((x, y) => x - y);
    if (!a.length) return null;
    const i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
  }
  function mean(values) {
    const a = values.filter(finite).map(Number);
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  }
  function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }

  function defaultState() {
    const deluxe = read(DELUXE_KEY, {});
    return {
      version: 2,
      location: deluxe.weatherLocation || "High Point, NC",
      label: deluxe.weatherLabel || "",
      latitude: null,
      longitude: null,
      timezone: "",
      history: {},
      forecast: {},
      current: null,
      lastRefreshAt: 0,
      lastHistoricalAt: 0,
      lastForecastAt: 0,
      historyThrough: "",
      forecastThrough: "",
      updatedAt: 0
    };
  }

  function migrateLegacy(base) {
    const deluxe = read(DELUXE_KEY, {});
    const legacy = deluxe.weatherCache && typeof deluxe.weatherCache === "object" ? deluxe.weatherCache : {};
    const history = { ...(base.history || {}) };
    for (const [date, w] of Object.entries(legacy)) {
      if (!w || typeof w !== "object") continue;
      history[date] = {
        ...(history[date] || {}),
        max: finite(w.max) ? Number(w.max) : history[date]?.max,
        mean: finite(w.mean) ? Number(w.mean) : history[date]?.mean,
        min: finite(w.min) ? Number(w.min) : history[date]?.min,
        source: history[date]?.source || "legacy"
      };
    }
    return {
      ...base,
      location: base.location || deluxe.weatherLocation || "High Point, NC",
      label: base.label || deluxe.weatherLabel || "",
      history
    };
  }

  function loadState() {
    const raw = read(WEATHER_KEY, {});
    return migrateLegacy({ ...defaultState(), ...(raw && typeof raw === "object" ? raw : {}), history: raw?.history || {}, forecast: raw?.forecast || {} });
  }

  function store(next, { bump = true, sync = false } = {}) {
    state = { ...defaultState(), ...next, history: next.history || {}, forecast: next.forecast || {} };
    if (bump) state.updatedAt = Date.now();
    localStorage.setItem(WEATHER_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("weather-intelligence-updated", { detail: { updatedAt: state.updatedAt } }));
    scheduleRender();
    if (sync) void cloudSave();
    return state;
  }

  function eggMap() {
    const map = {};
    const entries = read(ENTRIES_KEY, []);
    (Array.isArray(entries) ? entries : []).forEach(e => {
      if (e?.type === "eggs" && e.date && finite(e.eggs)) map[e.date] = (map[e.date] || 0) + Number(e.eggs);
    });
    return map;
  }

  function weatherCode(code) {
    const c = Number(code);
    if (c === 0) return { emoji: "☀️", text: "Clear" };
    if (c === 1) return { emoji: "🌤️", text: "Mainly clear" };
    if (c === 2) return { emoji: "⛅", text: "Partly cloudy" };
    if (c === 3) return { emoji: "☁️", text: "Overcast" };
    if ([45, 48].includes(c)) return { emoji: "🌫️", text: "Foggy" };
    if ([51, 53, 55, 56, 57].includes(c)) return { emoji: "🌦️", text: "Drizzle" };
    if ([61, 63, 65, 66, 67].includes(c)) return { emoji: "🌧️", text: "Rain" };
    if ([71, 73, 75, 77].includes(c)) return { emoji: "🌨️", text: "Snow" };
    if ([80, 81, 82].includes(c)) return { emoji: "🌦️", text: "Rain showers" };
    if ([85, 86].includes(c)) return { emoji: "🌨️", text: "Snow showers" };
    if ([95, 96, 99].includes(c)) return { emoji: "⛈️", text: "Thunderstorms" };
    return { emoji: "🌤️", text: "Weather" };
  }

  function isRainy(w) {
    return n(w?.rain ?? w?.precip) >= RAIN_THRESHOLD || n(w?.rainHours) >= 2 || n(w?.precipProbability) >= 60;
  }

  function localBaseline(date, eggs) {
    const target = new Date(`${date}T12:00:00`).getTime();
    if (!Number.isFinite(target)) return null;
    const near = Object.entries(eggs)
      .filter(([d, v]) => d !== date && finite(v))
      .map(([d, v]) => ({ v: Number(v), dist: Math.abs((new Date(`${d}T12:00:00`).getTime() - target) / 86400000) }))
      .filter(x => x.dist <= 14)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 12)
      .map(x => x.v);
    if (near.length >= 5) return median(near);

    const prior = Object.entries(eggs)
      .filter(([d, v]) => d < date && finite(v))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 10)
      .map(([, v]) => Number(v));
    return prior.length >= 4 ? median(prior) : null;
  }

  function normalizedRows() {
    const eggs = eggMap();
    const dates = Object.keys(eggs).sort();
    const recentCut = dates.length > 130 ? dates[dates.length - 130] : "";
    const rows = [];
    for (const date of dates) {
      if (recentCut && date < recentCut) continue;
      const w = state.history?.[date];
      if (!w || !finite(w.max)) continue;
      const baseline = localBaseline(date, eggs);
      if (!baseline || baseline <= 0) continue;
      const rawRatio = Number(eggs[date]) / baseline;
      if (!Number.isFinite(rawRatio)) continue;
      rows.push({ date, eggs: Number(eggs[date]), baseline, ratio: clamp(rawRatio, 0.45, 1.65), ...w });
    }
    return rows;
  }

  function factor(rows, label, emoji, predicate, counterpart = r => !predicate(r)) {
    const yes = rows.filter(predicate);
    const no = rows.filter(counterpart);
    if (yes.length < 5 || no.length < 7) return null;
    const ya = mean(yes.map(r => r.ratio));
    const na = mean(no.map(r => r.ratio));
    if (!ya || !na) return null;
    const effect = (ya / na - 1) * 100;
    return { label, emoji, effect, yes: yes.length, no: no.length };
  }

  function trendAnalysis() {
    const rows = normalizedRows();
    const factors = [
      factor(rows, "Rainy days", "🌧️", r => isRainy(r), r => !isRainy(r)),
      factor(rows, "90°F+ days", "🥵", r => n(r.max) >= 90, r => n(r.max) < 88),
      factor(rows, "Humid days", "💧", r => finite(r.humidity) && n(r.humidity) >= 75, r => finite(r.humidity) && n(r.humidity) < 70),
      factor(rows, "Cloudy days", "☁️", r => finite(r.cloud) && n(r.cloud) >= 70, r => finite(r.cloud) && n(r.cloud) < 45)
    ].filter(Boolean);
    return { rows, factors };
  }

  function productionContext() {
    const eggs = eggMap();
    const today = new Date(`${localDate()}T12:00:00`);
    const recentStart = new Date(today); recentStart.setDate(recentStart.getDate() - 30);
    const priorStart = new Date(today); priorStart.setDate(priorStart.getDate() - 60);
    const recent = [], prior = [];
    for (const [date, value] of Object.entries(eggs)) {
      const d = new Date(`${date}T12:00:00`);
      if (d >= recentStart && d < today) recent.push(Number(value));
      else if (d >= priorStart && d < recentStart) prior.push(Number(value));
    }
    const r = mean(recent), p = mean(prior);
    if (r === null || p === null || p <= 0 || recent.length < 10 || prior.length < 10) return null;
    return { recent: r, prior: p, change: (r / p - 1) * 100, recentDays: recent.length, priorDays: prior.length };
  }

  function recentBaseline() {
    const eggs = eggMap();
    const today = localDate();
    const completed = Object.entries(eggs)
      .filter(([d, v]) => d < today && finite(v))
      .sort((a, b) => b[0].localeCompare(a[0]));
    const last7 = completed.slice(0, 7).map(([, v]) => Number(v));
    const last3 = completed.slice(0, 3).map(([, v]) => Number(v));
    if (!last7.length) return null;
    const a7 = mean(last7);
    const a3 = mean(last3);
    return a3 !== null && a7 !== null ? a7 * 0.6 + a3 * 0.4 : a7;
  }

  function similarWeather(todayWeather, rows) {
    if (!todayWeather || !finite(todayWeather.max)) return [];
    const rainy = isRainy(todayWeather);
    return rows
      .map(r => {
        let score = Math.abs(n(r.max) - n(todayWeather.max));
        if (isRainy(r) !== rainy) score += 10;
        if (finite(todayWeather.humidity) && finite(r.humidity)) score += Math.abs(n(r.humidity) - n(todayWeather.humidity)) * 0.12;
        if (finite(todayWeather.cloud) && finite(r.cloud)) score += Math.abs(n(r.cloud) - n(todayWeather.cloud)) * 0.04;
        return { ...r, score };
      })
      .filter(r => r.score <= 16)
      .sort((a, b) => a.score - b.score)
      .slice(0, 14);
  }

  function outlook() {
    const today = localDate();
    const f = state.forecast?.[today];
    if (!f) return null;
    const { rows, factors } = trendAnalysis();
    const similar = similarWeather(f, rows);
    const base = recentBaseline();
    const similarRatio = similar.length >= 4 ? mean(similar.map(r => r.ratio)) : null;
    const adjustment = similarRatio === null ? 1 : clamp(similarRatio, 0.82, 1.18);
    const estimate = base ? base * adjustment : null;
    const already = n(eggMap()[today]);
    let low = estimate ? Math.max(0, Math.round(estimate * 0.88)) : null;
    let high = estimate ? Math.max(low, Math.round(estimate * 1.12)) : null;
    if (already > 0 && high !== null && already > high) high = already;
    if (already > 0 && low !== null && already > low) low = Math.min(already, high);
    const currentFactor = factors
      .filter(x => (x.label === "Rainy days" && isRainy(f)) || (x.label === "90°F+ days" && n(f.max) >= 90) || (x.label === "Humid days" && n(f.humidity) >= 75) || (x.label === "Cloudy days" && n(f.cloud) >= 70))
      .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))[0] || null;
    return {
      forecast: f,
      current: state.current,
      similar,
      base,
      adjustment,
      estimate,
      low,
      high,
      already,
      currentFactor,
      confidence: similar.length >= 10 ? "Good" : similar.length >= 6 ? "Moderate" : similar.length >= 4 ? "Early" : "Learning"
    };
  }

  async function firebaseApi() {
    if (firebaseApiCache) return firebaseApiCache;
    const start = Date.now();
    while (Date.now() - start < 12000) {
      if (window.FirestoreDB && window.FirebaseUser) break;
      await new Promise(r => setTimeout(r, 100));
    }
    if (!window.FirestoreDB || !window.FirebaseUser) return null;
    firebaseApiCache = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
    return firebaseApiCache;
  }

  async function cloudSave() {
    try {
      const f = await firebaseApi();
      if (!f) return false;
      await f.setDoc(f.doc(window.FirestoreDB, "entries", WEATHER_DOC), {
        type: "weatherV2",
        weather: state,
        updatedAt: n(state.updatedAt),
        serverUpdatedAt: f.serverTimestamp()
      });
      return true;
    } catch (error) {
      console.warn("Weather Intelligence cloud save skipped:", error);
      return false;
    }
  }

  function applyRemote(remote) {
    if (!remote || typeof remote !== "object") return false;
    if (n(remote.updatedAt) < n(state.updatedAt)) return false;
    store(migrateLegacy({ ...defaultState(), ...remote, history: remote.history || {}, forecast: remote.forecast || {} }), { bump: false, sync: false });
    return true;
  }

  async function startCloud() {
    try {
      const f = await firebaseApi();
      if (!f) return false;
      const ref = f.doc(window.FirestoreDB, "entries", WEATHER_DOC);
      const snap = await f.getDoc(ref);
      const remote = snap.exists() ? snap.data()?.weather : null;
      if (remote && n(remote.updatedAt) >= n(state.updatedAt)) applyRemote(remote);
      else if (state.updatedAt) await cloudSave();
      firebaseUnsub?.();
      firebaseUnsub = f.onSnapshot(ref, s => {
        if (s.exists()) applyRemote(s.data()?.weather);
      }, error => console.warn("Weather Intelligence live sync failed:", error));
      return true;
    } catch (error) {
      console.warn("Weather Intelligence startup sync failed:", error);
      return false;
    }
  }

  async function geocode(location) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Location lookup failed (${response.status})`);
    const json = await response.json();
    const p = json?.results?.[0];
    if (!p) throw new Error("Location not found");
    return {
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      timezone: p.timezone || "auto",
      label: [p.name, p.admin1, p.country_code].filter(Boolean).join(", ")
    };
  }

  function dailyRecord(daily, i, source) {
    return {
      max: finite(daily?.temperature_2m_max?.[i]) ? Number(daily.temperature_2m_max[i]) : null,
      mean: finite(daily?.temperature_2m_mean?.[i]) ? Number(daily.temperature_2m_mean[i]) : null,
      min: finite(daily?.temperature_2m_min?.[i]) ? Number(daily.temperature_2m_min[i]) : null,
      precip: finite(daily?.precipitation_sum?.[i]) ? Number(daily.precipitation_sum[i]) : 0,
      rain: finite(daily?.rain_sum?.[i]) ? Number(daily.rain_sum[i]) : 0,
      rainHours: finite(daily?.precipitation_hours?.[i]) ? Number(daily.precipitation_hours[i]) : 0,
      precipProbability: finite(daily?.precipitation_probability_max?.[i]) ? Number(daily.precipitation_probability_max[i]) : null,
      code: finite(daily?.weather_code?.[i]) ? Number(daily.weather_code[i]) : null,
      humidity: finite(daily?.relative_humidity_2m_mean?.[i]) ? Number(daily.relative_humidity_2m_mean[i]) : null,
      cloud: finite(daily?.cloud_cover_mean?.[i]) ? Number(daily.cloud_cover_mean[i]) : null,
      sunshineHours: finite(daily?.sunshine_duration?.[i]) ? Number(daily.sunshine_duration[i]) / 3600 : null,
      windMax: finite(daily?.wind_speed_10m_max?.[i]) ? Number(daily.wind_speed_10m_max[i]) : null,
      source,
      fetchedAt: Date.now()
    };
  }

  async function fetchHistorical(latitude, longitude) {
    const eggs = eggMap();
    const dates = Object.keys(eggs).sort();
    const start = dates[0] || dateAdd(localDate(), -120);
    const end = dateAdd(localDate(), -1);
    if (start > end) return { history: state.history || {}, through: state.historyThrough || "" };
    const daily = [
      "weather_code", "temperature_2m_mean", "temperature_2m_max", "temperature_2m_min",
      "precipitation_sum", "rain_sum", "precipitation_hours", "sunshine_duration",
      "relative_humidity_2m_mean", "cloud_cover_mean", "wind_speed_10m_max"
    ].join(",");
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&start_date=${start}&end_date=${end}&daily=${daily}&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Historical weather failed (${response.status})`);
    const json = await response.json();
    if (!Array.isArray(json?.daily?.time)) throw new Error("Historical weather response was incomplete");
    const history = { ...(state.history || {}) };
    json.daily.time.forEach((date, i) => { history[date] = { ...(history[date] || {}), ...dailyRecord(json.daily, i, "historical") }; });
    return { history, through: json.daily.time.at(-1) || end };
  }

  async function fetchForecast(latitude, longitude) {
    const daily = [
      "weather_code", "temperature_2m_mean", "temperature_2m_max", "temperature_2m_min",
      "precipitation_sum", "rain_sum", "precipitation_hours", "precipitation_probability_max",
      "sunshine_duration", "relative_humidity_2m_mean", "cloud_cover_mean", "wind_speed_10m_max"
    ].join(",");
    const current = ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "precipitation", "rain", "weather_code", "cloud_cover", "wind_speed_10m"].join(",");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=${current}&daily=${daily}&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph&timezone=auto&forecast_days=7`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Forecast weather failed (${response.status})`);
    const json = await response.json();
    if (!Array.isArray(json?.daily?.time)) throw new Error("Forecast weather response was incomplete");
    const forecast = {};
    json.daily.time.forEach((date, i) => { forecast[date] = dailyRecord(json.daily, i, "forecast"); });
    const c = json.current || {};
    const currentRecord = {
      time: c.time || "",
      temperature: finite(c.temperature_2m) ? Number(c.temperature_2m) : null,
      humidity: finite(c.relative_humidity_2m) ? Number(c.relative_humidity_2m) : null,
      apparent: finite(c.apparent_temperature) ? Number(c.apparent_temperature) : null,
      precip: finite(c.precipitation) ? Number(c.precipitation) : 0,
      rain: finite(c.rain) ? Number(c.rain) : 0,
      code: finite(c.weather_code) ? Number(c.weather_code) : null,
      cloud: finite(c.cloud_cover) ? Number(c.cloud_cover) : null,
      wind: finite(c.wind_speed_10m) ? Number(c.wind_speed_10m) : null
    };
    return { forecast, current: currentRecord, through: json.daily.time.at(-1) || "", timezone: json.timezone || state.timezone || "" };
  }

  function setButton(text, disabled = false) {
    const input = document.getElementById("xLoc");
    const button = input?.nextElementSibling;
    if (!button || button.tagName !== "BUTTON") return;
    button.textContent = text;
    button.disabled = disabled;
  }

  async function refresh({ manual = true, forecastOnly = false } = {}) {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      try {
        const input = document.getElementById("xLoc");
        const requestedLocation = ((manual ? input?.value : state.location) || state.location || "High Point, NC").trim();
        if (!requestedLocation) throw new Error("Enter a city or ZIP code");
        if (manual) setButton("Finding your farm…", true);

        let geo = null;
        const locationChanged = requestedLocation.toLowerCase() !== String(state.location || "").toLowerCase();
        if (locationChanged || !finite(state.latitude) || !finite(state.longitude)) geo = await geocode(requestedLocation);
        const latitude = geo?.latitude ?? Number(state.latitude);
        const longitude = geo?.longitude ?? Number(state.longitude);
        if (!finite(latitude) || !finite(longitude)) throw new Error("Farm coordinates are unavailable");

        const base = {
          ...state,
          location: requestedLocation,
          label: geo?.label || state.label || requestedLocation,
          latitude,
          longitude,
          timezone: geo?.timezone || state.timezone || "auto"
        };

        let historyResult = { history: base.history || {}, through: base.historyThrough || "" };
        if (!forecastOnly) {
          if (manual) setButton("Updating historical weather…", true);
          historyResult = await fetchHistorical(latitude, longitude);
        }
        if (manual) setButton("Loading today’s forecast…", true);
        const forecastResult = await fetchForecast(latitude, longitude);
        const now = Date.now();
        store({
          ...base,
          history: historyResult.history,
          forecast: forecastResult.forecast,
          current: forecastResult.current,
          timezone: forecastResult.timezone || base.timezone,
          historyThrough: historyResult.through || base.historyThrough,
          forecastThrough: forecastResult.through,
          lastHistoricalAt: forecastOnly ? base.lastHistoricalAt : now,
          lastForecastAt: now,
          lastRefreshAt: now
        }, { bump: true, sync: false });
        await cloudSave();
        if (manual) setButton("✓ Weather updated", false);
        render();
        setTimeout(() => { if (manual) setButton("Refresh Weather Comparison", false); }, 1600);
        return true;
      } catch (error) {
        console.warn("Weather Intelligence refresh failed:", error);
        if (manual) setButton("Refresh Weather Comparison", false);
        renderError(error?.message || "Weather update failed");
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  }

  function renderError(message) {
    const root = document.getElementById("xWeather");
    if (!root) return;
    root.innerHTML = `<div class="wx-error">⚠️ ${escapeHtml(message)}</div>`;
  }

  function factorSentence(f) {
    if (!f) return "";
    if (Math.abs(f.effect) < 4) return `${f.emoji} ${f.label}: no meaningful difference yet (${f.yes} matched days).`;
    return `${f.emoji} ${f.label}: production has run about <b>${Math.abs(Math.round(f.effect))}% ${f.effect < 0 ? "lower" : "higher"}</b> than the nearby flock baseline (${f.yes} matched days).`;
  }

  function injectCss() {
    if (document.getElementById("weatherIntelV2Css")) return;
    const s = document.createElement("style");
    s.id = "weatherIntelV2Css";
    s.textContent = `
      .wx-status{margin:11px 0;padding:10px 12px;border-radius:14px;background:rgba(31,122,58,.08);font-size:12px;font-weight:850;color:var(--muted)}
      .wx-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}
      .wx-stat{padding:12px 8px;border-radius:16px;text-align:center;background:rgba(31,122,58,.07);min-width:0}.wx-stat b{display:block;font-size:21px;color:var(--dark)}.wx-stat span{display:block;margin-top:5px;font-size:10px;line-height:1.25;font-weight:850;color:var(--muted)}
      .wx-outlook,.wx-learn{margin-top:11px;padding:14px;border-radius:18px;border:1px solid rgba(31,122,58,.12);background:rgba(255,255,255,.58)}
      .wx-outlook h4,.wx-learn h4{margin:0 0 7px;font-size:16px;color:var(--dark)}.wx-outlook p,.wx-learn p{margin:5px 0;font-size:13px;line-height:1.45;font-weight:720;color:var(--dark)}
      .wx-big{font-size:29px;font-weight:950;color:var(--green);margin:4px 0}.wx-note{font-size:11px!important;color:var(--muted)!important;font-weight:700!important}.wx-error{margin-top:10px;padding:12px;border-radius:14px;background:rgba(217,59,59,.1);font-weight:850;color:#b33131}
      #weatherProductionTrend.weather-trend-card{margin:0 0 16px;padding:15px 16px;border-radius:20px;border:1px solid rgba(31,122,58,.12);background:linear-gradient(145deg,rgba(255,255,255,.94),rgba(245,250,244,.95));box-shadow:0 8px 22px rgba(24,68,36,.07)}
      #weatherProductionTrend h3{margin:0 0 5px;font-size:17px;color:var(--dark)}#weatherProductionTrend p{margin:4px 0;color:var(--dark);font-size:13px;line-height:1.4;font-weight:720}.wx-home-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.wx-home-icon{font-size:30px}.wx-home-meta{margin-top:7px;font-size:10px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
      .farm2-dark .wx-outlook,.farm2-dark .wx-learn{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.08)}.farm2-dark #weatherProductionTrend.weather-trend-card{background:rgba(28,38,31,.94);border-color:rgba(255,255,255,.09)}
      @media(max-width:650px){.wx-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.wx-stat b{font-size:20px}}
    `;
    document.head.appendChild(s);
  }

  function renderInsights() {
    const root = document.getElementById("xWeather");
    if (!root) return;
    const input = document.getElementById("xLoc");
    if (input && document.activeElement !== input) input.value = state.location || "High Point, NC";
    const today = localDate();
    const f = state.forecast?.[today];
    const analysis = trendAnalysis();
    const out = outlook();
    const matched = analysis.rows.length;
    const refreshed = state.lastRefreshAt ? new Date(state.lastRefreshAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not refreshed yet";
    if (!f) {
      root.innerHTML = `<div class="wx-status">${escapeHtml(state.label || state.location)} • ${matched} weather/egg days ready • ${escapeHtml(refreshed)}</div><div class="wx-outlook"><h4>🌤️ Farm Weather Intelligence</h4><p>Tap <b>Refresh Weather Comparison</b> to load today’s forecast plus detailed historical rain, humidity, cloud cover, temperature, and weather conditions.</p></div>`;
      return;
    }
    const cond = weatherCode(f.code);
    const rainText = finite(f.precipProbability) ? `${Math.round(n(f.precipProbability))}%` : `${round(n(f.rain), 2)} in`;
    const context = productionContext();
    const contextHtml = context ? `<p>📈 Recent flock pace: <b>${context.recent.toFixed(1)} eggs/logged day</b>, ${Math.abs(Math.round(context.change))}% ${context.change >= 0 ? "higher" : "lower"} than the prior 30-day window. The weather model treats that as a changing flock baseline, not proof of a weather effect.</p>` : "";
    const patterns = analysis.factors.length ? contextHtml + analysis.factors.map(x => `<p>${factorSentence(x)}</p>`).join("") : contextHtml + `<p>Still building enough comparable weather days for reliable flock-specific patterns.</p>`;
    let outlookHtml = `<p class="wx-note">The estimate uses your recent egg pace plus comparable weather days. It is an association, not a guarantee—molt, new layers, stress, daylight, health, and missed entries can also move production.</p>`;
    if (out?.estimate) {
      const range = out.low === out.high ? `${out.low}` : `${out.low}–${out.high}`;
      const similarText = out.similar.length >= 4 ? `${out.similar.length} similar historical weather days` : "your recent flock pace while the app learns";
      const already = out.already ? ` You’ve already logged ${out.already} today.` : "";
      outlookHtml = `<div class="wx-big">🥚 ${range} eggs</div><p>Weather-adjusted full-day outlook based on ${similarText}.${already}</p>${out.currentFactor ? `<p>${factorSentence(out.currentFactor)}</p>` : ""}${outlookHtml}`;
    }
    root.innerHTML = `
      <div class="wx-status">✓ Updated ${escapeHtml(refreshed)} • ${matched} adjusted weather/egg days • history through ${escapeHtml(state.historyThrough || "—")} • forecast through ${escapeHtml(state.forecastThrough || "—")}</div>
      <div class="wx-grid">
        <div class="wx-stat"><b>${cond.emoji} ${Math.round(n(f.max))}°</b><span>${escapeHtml(cond.text)} • high</span></div>
        <div class="wx-stat"><b>${Math.round(n(f.min))}°</b><span>Forecast low</span></div>
        <div class="wx-stat"><b>${rainText}</b><span>Rain chance / amount</span></div>
        <div class="wx-stat"><b>${finite(f.humidity) ? `${Math.round(n(f.humidity))}%` : "—"}</b><span>Mean humidity</span></div>
      </div>
      <div class="wx-outlook"><h4>🔮 Today’s egg outlook</h4>${outlookHtml}</div>
      <div class="wx-learn"><h4>🐔 What your flock history says</h4>${patterns}<p class="wx-note">These comparisons are normalized against egg production around each date, which helps prevent your older small laying flock from being compared directly with your newer, larger laying flock.</p></div>`;
  }

  function renderHome() {
    const home = document.getElementById("perfectHomeSummary");
    if (!home) return;
    let card = document.getElementById("weatherProductionTrend");
    if (!card) {
      card = document.createElement("div");
      card.id = "weatherProductionTrend";
      home.insertAdjacentElement("afterend", card);
    }
    card.className = "weather-trend-card";
    const out = outlook();
    const today = localDate();
    const f = state.forecast?.[today];
    if (!f) {
      card.innerHTML = `<div class="wx-home-top"><div><h3>🌤️ Farm weather learning</h3><p>Open Farm → Insights and refresh weather to add today’s forecast and flock-specific weather trends.</p></div><div class="wx-home-icon">🐔</div></div>`;
      return;
    }
    const cond = weatherCode(f.code);
    const rain = finite(f.precipProbability) ? `${Math.round(n(f.precipProbability))}% rain` : `${round(n(f.rain), 2)} in rain`;
    const range = out?.estimate ? ` • egg outlook ${out.low === out.high ? out.low : `${out.low}–${out.high}`}` : "";
    const factorText = out?.currentFactor && Math.abs(out.currentFactor.effect) >= 4
      ? `${out.currentFactor.label} have run about ${Math.abs(Math.round(out.currentFactor.effect))}% ${out.currentFactor.effect < 0 ? "lower" : "higher"} than nearby production.`
      : `The app is comparing today with your own similar-weather egg days.`;
    card.innerHTML = `<div class="wx-home-top"><div><h3>${cond.emoji} Today’s farm weather</h3><p>${Math.round(n(f.max))}°F high • ${rain}${range}</p><p>${escapeHtml(factorText)}</p></div><div class="wx-home-icon">${cond.emoji}</div></div><div class="wx-home-meta">${escapeHtml(state.label || state.location)} • confidence ${escapeHtml(out?.confidence || "learning")}</div>`;
  }

  function render() {
    renderQueued = false;
    injectCss();
    renderInsights();
    renderHome();
    if (window.InsightsCalendarV2?.refresh) window.InsightsCalendarV2.refresh();
  }
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
  }

  function installRefreshOverride() {
    if (refreshOverrideInstalled) return;
    refreshOverrideInstalled = true;
    window.xWeather = () => refresh({ manual: true, forecastOnly: false });
    window.xWeather.__weatherIntelV2 = true;
  }

  function installShowHook() {
    if (showHookInstalled || typeof window.showScreen !== "function") return;
    showHookInstalled = true;
    const original = window.showScreen;
    const wrapped = function(screen) {
      const result = original.apply(this, arguments);
      if (screen === "farm2Insights" || screen === "dashboard") setTimeout(scheduleRender, 60);
      return result;
    };
    wrapped.__weatherIntelV2 = true;
    window.showScreen = wrapped;
  }

  function maybeAutoRefresh() {
    if (!navigator.onLine || refreshPromise) return;
    const now = Date.now();
    const forecastStale = now - n(state.lastForecastAt) > 3 * 60 * 60 * 1000;
    const historyStale = now - n(state.lastHistoricalAt) > 20 * 60 * 60 * 1000;
    if (historyStale) void refresh({ manual: false, forecastOnly: false });
    else if (forecastStale) void refresh({ manual: false, forecastOnly: true });
  }

  async function init() {
    injectCss();
    installShowHook();
    installRefreshOverride();
    render();
    await startCloud();
    render();
    maybeAutoRefresh();
    window.addEventListener("online", () => { void startCloud(); maybeAutoRefresh(); });
    window.addEventListener("storage", e => {
      if (e.key === WEATHER_KEY) { state = loadState(); scheduleRender(); }
      if (e.key === ENTRIES_KEY) scheduleRender();
    });
    window.addEventListener("core-data-synced", scheduleRender);
    window.addEventListener("farm-data-synced", scheduleRender);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) { state = loadState(); installRefreshOverride(); installShowHook(); scheduleRender(); maybeAutoRefresh(); }
    });
    console.log("✅ Farm Weather Intelligence v2 active");
  }

  window.FarmWeatherIntelligence = {
    refresh: () => refresh({ manual: true, forecastOnly: false }),
    analyze: trendAnalysis,
    outlook,
    getState: () => state,
    render
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 700));
  else setTimeout(init, 700);
})();
