(() => {
  "use strict";

  const ENTRIES_KEY = "chickenEggEntriesV102";
  const SETTINGS_KEY = "chickenEggSettingsV102";
  const APP2_KEY = "chickenEggApp2V1";
  const BUSINESS_KEY = "chickenEggBusinessV1";
  let renderQueued = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function money(v) { return "$" + n(v).toFixed(2); }
  function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function eggRevenue(e) { return n(e.dozenSold) * n(e.dozenPrice) + n(e.packSold) * n(e.packPrice); }

  function weekStart(offsetWeeks = 0) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + offsetWeeks * 7);
    return d;
  }
  function dateInRange(date, start, end) {
    const d = new Date(String(date || "") + "T12:00:00");
    return d >= start && d < end;
  }

  function stats() {
    const entries = read(ENTRIES_KEY, []).filter(e => e && (e.type === "eggs" || e.type === "sale"));
    const settings = read(SETTINGS_KEY, {});
    const app2 = read(APP2_KEY, { expenses: [], flock: [] });
    const business = read(BUSINESS_KEY, { chickenSales: [] });
    const today = localDate();
    const month = today.slice(0, 7);
    const start = weekStart(0);
    const next = weekStart(1);
    const prev = weekStart(-1);

    let todayEggs = 0;
    let weekEggs = 0;
    let previousWeekEggs = 0;
    let monthEggSales = 0;

    entries.forEach(e => {
      if (e.type === "eggs") {
        if (e.date === today) todayEggs += n(e.eggs);
        if (dateInRange(e.date, start, next)) weekEggs += n(e.eggs);
        if (dateInRange(e.date, prev, start)) previousWeekEggs += n(e.eggs);
      } else if (String(e.date || "").startsWith(month)) {
        monthEggSales += eggRevenue(e);
      }
    });

    const chickenSales = Array.isArray(business.chickenSales) ? business.chickenSales : [];
    const monthChickenSales = chickenSales
      .filter(s => String(s.date || "").startsWith(month))
      .reduce((sum, s) => sum + n(s.total), 0);

    const expenses = Array.isArray(app2.expenses) ? app2.expenses : [];
    const monthExpenses = expenses
      .filter(e => String(e.date || "").startsWith(month))
      .reduce((sum, e) => sum + n(e.amount), 0);

    const profit = monthEggSales + monthChickenSales - monthExpenses;
    const hens = n(settings.hens);
    const roosters = n(settings.roosters);
    const profileCount = Array.isArray(app2.flock) ? app2.flock.length : 0;
    const flock = hens + roosters || profileCount;
    const trend = previousWeekEggs > 0 ? ((weekEggs - previousWeekEggs) / previousWeekEggs) * 100 : null;

    return { todayEggs, weekEggs, previousWeekEggs, monthEggSales, monthChickenSales, monthExpenses, profit, flock, hens, roosters, profileCount, trend };
  }

  function injectStyles() {
    if (document.getElementById("perfectFarmPolishCss")) return;
    const style = document.createElement("style");
    style.id = "perfectFarmPolishCss";
    style.textContent = `
      :root{--polish-ring:rgba(31,122,58,.16);--polish-border:rgba(31,122,58,.11)}
      html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
      body{padding-top:max(12px,env(safe-area-inset-top));padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right));padding-bottom:calc(118px + env(safe-area-inset-bottom));overflow-x:hidden}
      .app{width:100%}
      .appHeader{position:relative;min-height:82px}
      .appHeader>div:nth-child(2){min-width:0;flex:1}
      #syncStatus{display:inline-flex;align-items:center;min-height:24px;padding:4px 9px;border-radius:999px;background:rgba(31,122,58,.08);line-height:1.25}
      section{overflow:visible}
      .screen.active{animation:polishIn .2s ease-out}
      @keyframes polishIn{from{opacity:.35;transform:translateY(5px)}to{opacity:1;transform:none}}
      button,input,select,textarea{-webkit-tap-highlight-color:transparent}
      button{transition:transform .12s ease,box-shadow .12s ease,filter .12s ease;touch-action:manipulation;min-height:50px}
      button:active{transform:scale(.985);box-shadow:0 6px 14px rgba(31,122,58,.18)}
      button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:none;box-shadow:0 0 0 5px var(--polish-ring)}
      input,select,textarea{min-height:52px;max-width:100%;border-radius:17px!important;background:rgba(255,255,255,.94);border:1.5px solid var(--polish-border)!important}
      select{width:100%;padding:14px;font-size:17px;color:var(--dark)}
      .screenTitle{position:sticky;top:max(6px,env(safe-area-inset-top));z-index:20;padding:7px 0 10px;background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,0));backdrop-filter:blur(8px)}
      .farm2-dark .screenTitle{background:linear-gradient(180deg,rgba(22,29,24,.94),rgba(22,29,24,0))}
      .backMini{flex:0 0 46px;min-height:46px}
      .heroCard{position:relative;overflow:hidden;margin-bottom:14px}
      .chartCard,.farm2-card,.xcard,.biz-card{border:1px solid var(--polish-border)!important;box-shadow:0 10px 28px rgba(24,68,36,.09)!important}
      #dashboardTotals{display:none!important}
      #perfectHomeSummary{margin:14px 0 16px}
      .perfect-summaryTop{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:0 2px 10px}
      .perfect-summaryTop h3{font-size:20px;color:var(--dark);margin:2px 0 0}
      .perfect-summaryMonth{font-size:11px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
      .perfect-trend{white-space:nowrap;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:900;background:rgba(31,122,58,.09);color:var(--green)}
      .perfect-trend.down{background:rgba(217,59,59,.08);color:#b33131}
      .perfect-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .perfect-stat{position:relative;min-width:0;padding:15px 14px;border-radius:20px;background:rgba(255,255,255,.88);border:1px solid var(--polish-border);box-shadow:0 8px 22px rgba(24,68,36,.07)}
      .perfect-stat .icon{font-size:20px;line-height:1;margin-bottom:9px}
      .perfect-stat b{display:block;overflow:hidden;text-overflow:ellipsis;font-size:25px;line-height:1.05;letter-spacing:-.5px;color:var(--dark)}
      .perfect-stat span{display:block;margin-top:6px;font-size:11px;line-height:1.25;font-weight:850;color:var(--muted)}
      .perfect-stat.profit{background:linear-gradient(145deg,rgba(230,249,234,.97),rgba(255,255,255,.93))}
      .perfect-stat.loss{background:linear-gradient(145deg,rgba(255,235,235,.96),rgba(255,255,255,.93))}
      .perfect-stat.profit b{color:#187035}.perfect-stat.loss b{color:#b52e2e}
      .mainActions{gap:10px!important}
      .mainActions button{border-radius:18px!important}
      .entry{border-left-width:5px!important;border-radius:19px!important}
      .filterButtons button{min-height:44px}
      .bottomNav{bottom:max(10px,env(safe-area-inset-bottom));width:min(calc(100% - 18px),760px);padding:7px;gap:3px;border-radius:24px}
      .bottomNav button{min-width:0;min-height:54px;padding:8px 3px!important;border-radius:17px!important}
      .bottomNav span{font-size:10px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .navActive{box-shadow:inset 0 0 0 1px rgba(31,122,58,.08)!important}
      .farm2-hubGrid{gap:10px!important}
      .farm2-hubButton{min-height:128px!important}
      .farm2-list>*{margin-bottom:10px}
      .farm2-toast{bottom:calc(92px + env(safe-area-inset-bottom))!important}
      .farm2-dark .perfect-stat{background:rgba(28,38,31,.94);border-color:rgba(255,255,255,.08)}
      .farm2-dark .perfect-stat.profit{background:linear-gradient(145deg,rgba(25,61,36,.96),rgba(28,38,31,.96))}
      .farm2-dark .perfect-stat.loss{background:linear-gradient(145deg,rgba(70,32,32,.96),rgba(28,38,31,.96))}
      .farm2-dark input,.farm2-dark select,.farm2-dark textarea{background:rgba(26,34,29,.96)!important;color:#f5f7f3!important;border-color:rgba(255,255,255,.1)!important}
      @media(max-width:760px){
        body{padding-bottom:calc(130px + env(safe-area-inset-bottom))}
        .appHeader{padding:12px 2px 16px}.logo{box-shadow:0 8px 22px rgba(150,105,0,.13)}
        section{padding:15px!important;border-radius:26px!important}
        .heroCard{padding:18px!important;border-radius:23px!important}
        .perfect-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .perfect-stat{padding:14px 13px;border-radius:18px}.perfect-stat b{font-size:24px}
        .chartCard{padding:14px!important;border-radius:20px!important;overflow:hidden}
        .chartCard canvas{max-height:240px}
        .mainActions{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .mainActions button{font-size:15px!important;padding:14px 10px!important}
        .farm2-formRow{grid-template-columns:1fr!important}
      }
      @media(max-width:390px){
        h1{font-size:28px!important}.logo{width:56px!important;height:56px!important;font-size:34px!important}
        .perfect-grid{gap:8px}.perfect-stat{padding:12px}.perfect-stat b{font-size:21px}.perfect-stat span{font-size:10px}
        .mainActions{grid-template-columns:1fr!important}
      }
      @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function card(icon, value, label, extraClass = "") {
    return `<div class="perfect-stat ${extraClass}"><div class="icon">${icon}</div><b>${value}</b><span>${label}</span></div>`;
  }

  function render() {
    renderQueued = false;
    injectStyles();
    const dashboard = document.getElementById("dashboard");
    const totals = document.getElementById("dashboardTotals");
    if (!dashboard || !totals) return;

    let box = document.getElementById("perfectHomeSummary");
    if (!box) {
      box = document.createElement("div");
      box.id = "perfectHomeSummary";
      totals.insertAdjacentElement("beforebegin", box);
    }

    const s = stats();
    const monthName = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
    let trendText = "New week";
    let trendClass = "";
    if (s.trend !== null) {
      const rounded = Math.round(Math.abs(s.trend));
      trendText = `${s.trend >= 0 ? "↑" : "↓"} ${rounded}% vs last week`;
      if (s.trend < 0) trendClass = "down";
    }
    const flockNote = s.hens + s.roosters > 0 ? `${s.hens} hens • ${s.roosters} roosters` : `${s.profileCount} flock profiles`;
    const profitClass = s.profit >= 0 ? "profit" : "loss";
    const profitValue = `${s.profit >= 0 ? "+" : "−"}${money(Math.abs(s.profit))}`;

    box.innerHTML = `
      <div class="perfect-summaryTop">
        <div><div class="perfect-summaryMonth">Farm at a glance • ${monthName}</div><h3>Your farm today</h3></div>
        <div class="perfect-trend ${trendClass}">${trendText}</div>
      </div>
      <div class="perfect-grid">
        ${card("🥚", s.todayEggs, "Eggs today")}
        ${card("📅", s.weekEggs, "Eggs this week")}
        ${card("💰", money(s.monthEggSales), "Egg sales this month")}
        ${card("🐔", money(s.monthChickenSales), "Chicken sales this month")}
        ${card("🧾", money(s.monthExpenses), "Expenses this month")}
        ${card("📈", profitValue, s.profit >= 0 ? "Profit this month" : "Loss this month", profitClass)}
        ${card("🐓", s.flock, `Flock • ${flockNote}`)}
      </div>`;

    const hero = document.querySelector("#dashboard .heroCard");
    if (hero) hero.setAttribute("aria-label", "Farm dashboard summary");
    document.querySelectorAll(".bottomNav button").forEach(btn => btn.setAttribute("aria-label", btn.textContent.trim().replace(/\s+/g, " ")));
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
  }

  window.addEventListener("storage", e => {
    if ([ENTRIES_KEY, SETTINGS_KEY, APP2_KEY, BUSINESS_KEY].includes(e.key)) scheduleRender();
  });
  window.addEventListener("farm-data-synced", scheduleRender);
  window.addEventListener("core-data-synced", scheduleRender);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRender(); });

  function init() {
    render();
    const app = document.querySelector(".app");
    if (app) {
      const observer = new MutationObserver(() => {
        if (!document.getElementById("perfectHomeSummary")) scheduleRender();
      });
      observer.observe(app, { childList: true, subtree: true });
    }
    console.log("✅ App polish and home command center active");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 850));
  else setTimeout(init, 850);
})();
