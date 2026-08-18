(() => {
  "use strict";
  if (window.CustomerYearForecastV1) return;

  const PREFIX = "__chicken_eggs_staging__::";
  const ENTRIES_KEY = PREFIX + "chickenEggEntriesV102";

  function n(v) { return Number(v) || 0; }
  function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function readEntries() {
    try {
      const value = JSON.parse(localStorage.getItem(ENTRIES_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
  function calculate() {
    const base = window.CustomerViewStaging?.getData?.();
    const today = localDate();
    const year = today.slice(0,4);
    const entries = readEntries();
    const yearCollected = entries
      .filter(e => e?.type === "eggs" && String(e.date || "").slice(0,4) === year && String(e.date || "").slice(0,10) <= today)
      .reduce((sum,e) => sum + Math.max(0, Math.round(n(e.eggs))), 0);

    const current = new Date(`${today}T12:00:00`);
    const end = new Date(Number(year), 11, 31, 12, 0, 0, 0);
    const remainingDays = Math.max(0, Math.round((end - current) / 86400000));
    const dailyPace = Math.max(0, n(base?.production?.dailyPace));
    const predictedYear = Math.max(yearCollected, Math.round(yearCollected + dailyPace * remainingDays));

    return { year: Number(year), yearCollected, remainingDays, dailyPace, predictedYear };
  }

  function injectStyle() {
    if (document.getElementById("customerYearForecastCss")) return;
    const style = document.createElement("style");
    style.id = "customerYearForecastCss";
    style.textContent = `
      .metric-card.year{background:linear-gradient(145deg,#ffe6ee,#fff9fb)}
      @media(min-width:761px){.metric-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    injectStyle();
    const grid = document.querySelector(".metric-grid");
    if (!grid) return null;
    let card = document.getElementById("yearForecastCard");
    if (!card) {
      card = document.createElement("article");
      card.id = "yearForecastCard";
      card.className = "metric-card year";
      card.innerHTML = `<span class="metric-icon">🌻</span><strong id="yearForecast">—</strong><span>predicted this year</span>`;
      grid.appendChild(card);
    }
    const result = calculate();
    const value = document.getElementById("yearForecast");
    if (value) value.textContent = String(result.predictedYear);
    card.title = `${result.yearCollected} eggs collected so far in ${result.year}; forecast uses the current adaptive flock pace for the remaining ${result.remainingDays} days.`;
    return result;
  }

  window.CustomerYearForecastV1 = { version:1, calculate, render };

  const start = () => {
    render();
    setTimeout(render, 100);
    setInterval(render, 15000);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
