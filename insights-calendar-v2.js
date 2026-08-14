(() => {
  "use strict";

  const ENTRY_KEY = "chickenEggEntriesV102";
  const WEATHER_KEY = "chickenEggWeatherIntelligenceV2";
  const DELUXE_KEY = "chickenEggDeluxeV1";
  let selectedDate = "";
  let hookInstalled = false;
  let bound = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function finite(v) { return v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)); }
  function money(v) { return `$${n(v).toFixed(2)}`; }
  function saleRevenue(e) { return n(e?.dozenSold) * n(e?.dozenPrice) + n(e?.packSold) * n(e?.packPrice); }
  function entries() { const x = read(ENTRY_KEY, []); return Array.isArray(x) ? x : []; }
  function eggMap() {
    const map = {};
    entries().forEach(e => { if (e?.type === "eggs" && e.date) map[e.date] = (map[e.date] || 0) + n(e.eggs); });
    return map;
  }
  function weatherFor(date) {
    const wx = read(WEATHER_KEY, {});
    const detailed = wx?.history?.[date] || wx?.forecast?.[date];
    if (detailed) return detailed;
    const deluxe = read(DELUXE_KEY, {});
    return deluxe?.weatherCache?.[date] || null;
  }
  function dateLabel(date) {
    const d = new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime()) ? String(date) : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  }
  function condition(code) {
    const c = Number(code);
    if (c === 0) return "☀️ Clear";
    if ([1, 2].includes(c)) return "🌤️ Partly clear";
    if (c === 3) return "☁️ Overcast";
    if ([45, 48].includes(c)) return "🌫️ Fog";
    if ([51, 53, 55, 56, 57].includes(c)) return "🌦️ Drizzle";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "🌧️ Rain";
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "🌨️ Snow";
    if ([95, 96, 99].includes(c)) return "⛈️ Thunderstorms";
    return "";
  }

  function addCss() {
    if (document.getElementById("xCalendarV2Css")) return;
    const s = document.createElement("style");
    s.id = "xCalendarV2Css";
    s.textContent = `
      .xheat-weekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;margin:13px 0 7px;text-align:center;color:var(--muted);font-size:11px;font-weight:950;letter-spacing:.04em;text-transform:uppercase}
      .xheat{grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:7px!important}
      .xheat .xday{position:relative;aspect-ratio:1!important;border-radius:10px!important;cursor:pointer;min-width:0;outline:none;transition:transform .12s ease,box-shadow .12s ease}
      .xheat .xday:first-child{grid-column-start:var(--xheat-start,1)}
      .xheat .xday:active{transform:scale(.94)}
      .xheat .xday:focus-visible,.xheat .xday.xday-selected{box-shadow:0 0 0 3px rgba(245,185,28,.88)}
      .xheat .xday::after{content:attr(data-day);position:absolute;right:5px;bottom:3px;font-size:10px;font-weight:950;color:rgba(255,255,255,.88);text-shadow:0 1px 2px rgba(0,0,0,.25)}
      .xheat .xday[data-l="0"]::after{color:var(--muted);text-shadow:none}
      .xheat-detail{margin-top:12px;padding:13px 14px;border-radius:16px;background:rgba(31,122,58,.08);border:1px solid rgba(31,122,58,.12);min-height:58px}
      .xheat-detail b{display:block;font-size:15px;margin-bottom:5px}.xheat-detail-row{display:flex;flex-wrap:wrap;gap:7px 14px;font-size:13px;font-weight:800;color:var(--muted)}
      .xheat-missing{margin-top:7px;font-size:11px;font-weight:850;color:#c28500}.farm2-dark .xheat-missing{color:#f4c95d}
      .farm2-dark .xheat-detail{background:rgba(255,255,255,.045);border-color:rgba(255,255,255,.08)}
      .xsale-daytotal{display:block;margin-top:4px;font-size:10px;font-weight:850;color:var(--muted)}
      @media(max-width:650px){.xheat{grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:6px!important}.xheat-weekdays{gap:6px}.xheat .xday{border-radius:9px!important}.xheat .xday::after{right:4px;bottom:2px;font-size:9px}}
    `;
    document.head.appendChild(s);
  }

  function parseCell(cell) {
    const title = String(cell?.getAttribute("title") || "");
    const m = title.match(/^(\d{4}-\d{2}-\d{2}):\s*([\d.]+)\s*eggs?/i);
    return m ? { date: m[1], eggs: n(m[2]) } : null;
  }

  function showDay(date, eggCount) {
    selectedDate = date;
    const box = document.getElementById("xHeatDetail");
    if (!box) return;
    const map = eggMap();
    const hasEggEntry = Object.prototype.hasOwnProperty.call(map, date);
    const w = weatherFor(date);
    const pieces = [];
    pieces.push(`🥚 ${hasEggEntry ? `${eggCount} egg${eggCount === 1 ? "" : "s"}` : "No egg entry recorded"}`);
    if (w && finite(w.max)) {
      let temp = `🌡️ ${Math.round(n(w.max))}°F high`;
      if (finite(w.min)) temp += ` / ${Math.round(n(w.min))}° low`;
      pieces.push(temp);
      if (finite(w.rain) || finite(w.precip)) pieces.push(`🌧️ ${n(w.rain ?? w.precip).toFixed(2)} in`);
      if (finite(w.humidity)) pieces.push(`💧 ${Math.round(n(w.humidity))}% humidity`);
      if (finite(w.cloud)) pieces.push(`☁️ ${Math.round(n(w.cloud))}% cloud`);
      const c = condition(w.code);
      if (c) pieces.push(c);
    } else {
      pieces.push("🌤️ Weather not loaded for this day");
    }
    box.innerHTML = `<b>${dateLabel(date)}</b><div class="xheat-detail-row">${pieces.map(x => `<span>${x}</span>`).join("")}</div>${!hasEggEntry ? '<div class="xheat-missing">⚠️ No egg collection was recorded for this date. If eggs were collected, this may be a missed entry.</div>' : ""}`;
    document.querySelectorAll("#xHeat .xday").forEach(c => c.classList.toggle("xday-selected", c.dataset.date === date));
  }

  function enhanceHeatmap() {
    const h = document.getElementById("xHeat");
    if (!h) return;
    const card = h.closest(".xcard");
    const sub = card?.querySelector("h3 + .farm2-subtle");
    if (sub) sub.textContent = "Last 84 days • brighter green = more eggs • tap a day for eggs + weather.";

    let weekdays = card?.querySelector(".xheat-weekdays");
    if (!weekdays) {
      weekdays = document.createElement("div");
      weekdays.className = "xheat-weekdays";
      weekdays.setAttribute("aria-hidden", "true");
      weekdays.innerHTML = "<span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>";
      h.before(weekdays);
    }

    let detail = document.getElementById("xHeatDetail");
    if (!detail) {
      detail = document.createElement("div");
      detail.id = "xHeatDetail";
      detail.className = "xheat-detail";
      detail.innerHTML = '<div class="farm2-subtle">Tap any day to see the date, egg count, and stored weather.</div>';
      h.after(detail);
    }

    const cells = [...h.querySelectorAll(".xday")];
    cells.forEach(c => {
      const p = parseCell(c);
      if (!p) return;
      c.dataset.date = p.date;
      c.dataset.eggs = String(p.eggs);
      c.dataset.day = String(Number(p.date.slice(8, 10)));
      c.setAttribute("role", "button");
      c.setAttribute("tabindex", "0");
      c.setAttribute("aria-label", `${dateLabel(p.date)}: ${p.eggs} eggs`);
    });
    const first = cells.map(parseCell).find(Boolean);
    if (first) {
      const d = new Date(`${first.date}T12:00:00`);
      h.style.setProperty("--xheat-start", String(d.getDay() + 1));
    }
    if (selectedDate) {
      const found = cells.find(c => c.dataset.date === selectedDate);
      if (found) showDay(selectedDate, n(found.dataset.eggs));
    }
  }

  function enhanceSalesRecord() {
    const sales = entries().filter(e => e?.type === "sale");
    if (!sales.length) return;
    const largest = sales.reduce((best, e) => saleRevenue(e) > saleRevenue(best) ? e : best, sales[0]);
    const date = String(largest?.date || "");
    const dayTotal = sales.filter(e => String(e?.date || "") === date).reduce((s, e) => s + saleRevenue(e), 0);
    ["xRec", "xRecords"].forEach(id => {
      const root = document.getElementById(id);
      if (!root) return;
      const span = [...root.querySelectorAll(".xstat span")].find(x => /^Largest (single )?sale\s*•/i.test((x.textContent || "").trim()));
      if (!span) return;
      span.innerHTML = `Largest single sale • ${date || "—"}<small class="xsale-daytotal">All sales that day: ${money(dayTotal)}</small>`;
    });
  }

  function enhance() {
    addCss();
    enhanceHeatmap();
    enhanceSalesRecord();
  }
  function schedule(ms = 55) { setTimeout(enhance, ms); }

  function installShowHook() {
    if (hookInstalled || typeof window.showScreen !== "function") return;
    hookInstalled = true;
    const original = window.showScreen;
    const wrapped = function() {
      const result = original.apply(this, arguments);
      schedule(70);
      return result;
    };
    wrapped.__insightsCalendarV2 = true;
    window.showScreen = wrapped;
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener("click", e => {
      const c = e.target?.closest?.("#xHeat .xday");
      if (!c) return;
      const p = parseCell(c) || { date: c.dataset.date, eggs: n(c.dataset.eggs) };
      if (p?.date) showDay(p.date, p.eggs);
    });
    document.addEventListener("keydown", e => {
      const c = e.target?.closest?.("#xHeat .xday");
      if (!c || !(e.key === "Enter" || e.key === " ")) return;
      e.preventDefault();
      const p = parseCell(c) || { date: c.dataset.date, eggs: n(c.dataset.eggs) };
      if (p?.date) showDay(p.date, p.eggs);
    });
  }

  function init() {
    addCss();
    installShowHook();
    bind();
    schedule(700);
    window.addEventListener("core-data-synced", () => schedule(90));
    window.addEventListener("farm-data-synced", () => schedule(90));
    window.addEventListener("weather-intelligence-updated", () => schedule(90));
    window.addEventListener("storage", e => { if ([ENTRY_KEY, WEATHER_KEY, DELUXE_KEY].includes(e.key)) schedule(90); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schedule(90); });
  }

  window.InsightsCalendarV2 = { refresh: enhance, showDay };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();