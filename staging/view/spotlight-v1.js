(() => {
  "use strict";
  if (window.__StagingCustomerSpotlightV1) return;
  window.__StagingCustomerSpotlightV1 = true;

  const BRAND = "Rose Family Poultry";
  let cursor = 0;
  const n = v => Math.max(0, Number(v) || 0);
  const sum = rows => rows.reduce((s, x) => s + n(x?.eggs), 0);
  const avg = rows => rows.length ? sum(rows) / rows.length : 0;

  function getData() {
    return window.CustomerViewStaging?.getData?.() || window.StagingCustomerPublicData?.build?.() || null;
  }

  function eligibleBirds() {
    const data = getData();
    return Array.isArray(data?.flock) ? data.flock.filter(b => b?.id && b?.name) : [];
  }

  function weeklySummary(data = getData()) {
    const daily = Array.isArray(data?.stats?.daily30) ? data.stats.daily30.filter(x => x?.date).slice(-14) : [];
    const current = daily.slice(-7);
    const prior = daily.slice(-14, -7);
    const currentTotal = sum(current);
    const priorTotal = sum(prior);
    const currentAvg = avg(current);
    const trend = priorTotal > 0 ? ((currentTotal - priorTotal) / priorTotal) * 100 : (currentTotal > 0 ? 100 : 0);
    return {
      days: current.length,
      currentTotal,
      priorTotal,
      currentAvg,
      trend,
      dozens: currentTotal / 12,
      enough: current.length >= 4,
      priorEnough: prior.length >= 4
    };
  }

  function installSpotlight() {
    const copy = document.querySelector(".celebrity-card .celebrity-copy");
    if (!copy || document.getElementById("customerMeetAnotherBird")) return false;

    const wrap = document.createElement("div");
    wrap.className = "customer-spotlight-actions";
    wrap.innerHTML = `<button type="button" id="customerMeetAnotherBird">🎲 Meet another flock member</button><small>Opens a surprise public flock profile.</small>`;
    copy.appendChild(wrap);

    const button = wrap.querySelector("button");
    button?.addEventListener("click", () => {
      const birds = eligibleBirds();
      if (!birds.length) return;
      const featuredId = String(getData()?.chickenOfTheDay?.id || "");
      if (birds.length > 1 && String(birds[cursor % birds.length]?.id || "") === featuredId) cursor += 1;
      const bird = birds[cursor % birds.length];
      cursor += 1;
      window.CustomerViewStaging?.openProfile?.(bird.id);
    });
    return true;
  }

  function simplifyCoopReport(data) {
    const week = document.getElementById("weekForecast");
    const month = document.getElementById("monthForecast");
    const daily = Array.isArray(data?.stats?.daily30) ? data.stats.daily30.slice(-7) : [];
    const sevenDayAvg = avg(daily);
    if (week) {
      week.textContent = daily.length ? sevenDayAvg.toFixed(1) : "—";
      const label = week.parentElement?.querySelector("span:last-child");
      if (label) label.textContent = "7-day laying average";
    }
    if (month?.parentElement) month.parentElement.classList.add("rfp-hide-customer-metric");
    const note = document.getElementById("forecastNote");
    if (note) note.textContent = "Today's outlook follows today's weather; the 7-day average shows what the flock has actually been laying lately.";
  }

  function renderWeeklyStory() {
    const data = getData();
    if (!data) return false;
    simplifyCoopReport(data);
    const s = weeklySummary(data);
    let card = document.getElementById("customerWeeklyStory");
    if (!card) {
      card = document.createElement("section");
      card.id = "customerWeeklyStory";
      card.className = "weekly-story";
      const trail = document.getElementById("customerEggTrail");
      const fact = document.querySelector(".fact-card");
      if (trail) trail.insertAdjacentElement("afterend", card);
      else if (fact) fact.insertAdjacentElement("beforebegin", card);
      else document.getElementById("customerApp")?.appendChild(card);
    }
    let story;
    if (!s.enough) story = "The flock is still building enough recent laying history for a weekly story. Check back after a few more collection days.";
    else {
      const trendText = !s.priorEnough ? "" : s.trend > 5 ? ` That's about ${Math.round(Math.abs(s.trend))}% more than the week before.` : s.trend < -5 ? ` That's about ${Math.round(Math.abs(s.trend))}% less than the week before.` : " That's almost exactly in line with the week before.";
      story = `Over the last ${s.days} days, the flock laid ${s.currentTotal} eggs — an average of ${s.currentAvg.toFixed(1)} per day.${trendText}`;
    }
    const dozenText = s.enough ? `${s.dozens.toFixed(1)} dozen-equivalent eggs` : "More laying days needed";
    const trendChip = s.priorEnough ? (s.trend > 5 ? `📈 ${Math.round(s.trend)}% vs prior week` : s.trend < -5 ? `📉 ${Math.round(Math.abs(s.trend))}% vs prior week` : "➖ Steady week to week") : "📚 Building comparison history";
    card.innerHTML = `<div class="section-kicker">🌻 This week at ${BRAND}</div><h2>${s.enough ? `${s.currentTotal} eggs from the flock this week` : "The weekly flock story is growing"}</h2><p>${story}</p><div class="weekly-story-line"><span class="weekly-story-chip">🥚 ${dozenText}</span><span class="weekly-story-chip">${trendChip}</span></div>`;
    return true;
  }

  function css() {
    if (document.getElementById("customerSpotlightCss")) return;
    const style = document.createElement("style");
    style.id = "customerSpotlightCss";
    style.textContent = `
      .customer-spotlight-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:12px}
      .customer-spotlight-actions button{width:auto;margin:0;padding:9px 12px;border:0;border-radius:999px;background:#17351f;color:#fff;font-size:11px;font-weight:950;cursor:pointer;box-shadow:0 8px 18px rgba(23,53,31,.16)}
      .customer-spotlight-actions button:focus-visible{outline:3px solid rgba(31,122,58,.28);outline-offset:2px}
      .customer-spotlight-actions small{font-size:9px;font-weight:800;color:#7c897f}
      .rfp-hide-customer-metric{display:none!important}
      .weekly-story{margin:16px 0;padding:15px 16px;border-radius:20px;background:linear-gradient(135deg,rgba(255,249,225,.96),rgba(241,250,241,.96));border:1px solid rgba(31,122,58,.12);box-shadow:0 10px 30px rgba(24,68,36,.08)}
      .weekly-story h2{margin:3px 0 6px;font-size:19px;line-height:1.2}.weekly-story p{margin:0;font-size:12px;line-height:1.55;color:#4c6252}.weekly-story strong{color:#17351f}.weekly-story-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}.weekly-story-chip{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border-radius:999px;background:rgba(255,255,255,.78);border:1px solid rgba(31,122,58,.11);font-size:11px;font-weight:800;color:#35543e}
      @media(max-width:520px){.customer-spotlight-actions{align-items:stretch}.customer-spotlight-actions button{width:100%}.customer-spotlight-actions small{width:100%;text-align:center}.weekly-story{padding:13px 14px}.weekly-story h2{font-size:17px}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    css();
    installSpotlight();
    renderWeeklyStory();
  }

  function start() {
    render();
    setTimeout(render, 240);
    ["staging-customer-data-ready", "core-data-synced", "farm-data-synced"].forEach(name => window.addEventListener(name, render));
    if (!installSpotlight()) {
      const observer = new MutationObserver(() => {
        if (installSpotlight()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 10000);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.StagingCustomerSpotlightV1 = {
    version: 2,
    brand: BRAND,
    eligibleBirds,
    weeklySummary,
    renderWeeklyStory,
    install: installSpotlight,
    networkCalls: 0,
    firebaseReads: 0,
    firebaseWrites: 0
  };
})();
