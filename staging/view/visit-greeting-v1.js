(() => {
  "use strict";
  if (window.__StagingCustomerVisitGreetingV1) return;
  window.__StagingCustomerVisitGreetingV1 = true;

  const BRAND = "Rose Family Poultry";
  const n = v => Math.max(0, Number(v) || 0);
  const sum = rows => rows.reduce((s, x) => s + n(x?.eggs), 0);
  const getData = () => window.CustomerViewStaging?.getData?.() || window.StagingCustomerPublicData?.build?.() || null;

  function greeting(hour = new Date().getHours()) {
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  function farmPulse(data = getData()) {
    const daily = Array.isArray(data?.stats?.daily30) ? data.stats.daily30.filter(x => x?.date).slice(-7) : [];
    const eggs = sum(daily);
    const avg = daily.length ? eggs / daily.length : 0;
    const flock = Array.isArray(data?.flock) ? data.flock.length : 0;
    const available = n(data?.availability?.eggs ?? data?.inventory?.availableEggs ?? data?.inventory?.eggs ?? 0);
    return { days: daily.length, eggs, avg, flock, available };
  }

  function css() {
    if (document.getElementById("customerVisitGreetingCss")) return;
    const s = document.createElement("style");
    s.id = "customerVisitGreetingCss";
    s.textContent = `
      .visit-greeting{margin:12px 0 16px;padding:14px 16px;border-radius:20px;background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,248,219,.92));border:1px solid rgba(245,185,28,.22);box-shadow:0 10px 28px rgba(24,68,36,.07);display:flex;align-items:center;justify-content:space-between;gap:14px}
      .visit-greeting-copy{min-width:0}.visit-greeting-copy strong{display:block;font-size:16px;line-height:1.2;color:#17351f}.visit-greeting-copy span{display:block;margin-top:4px;font-size:11px;line-height:1.45;color:#607264;font-weight:750}.visit-greeting-pulse{display:flex;gap:7px;flex:0 0 auto}.visit-pulse-chip{padding:7px 9px;border-radius:999px;background:rgba(31,122,58,.08);font-size:10px;font-weight:900;color:#31543a;white-space:nowrap}
      @media(max-width:560px){.visit-greeting{align-items:flex-start;flex-direction:column}.visit-greeting-pulse{width:100%;overflow:auto;padding-bottom:1px}.visit-pulse-chip{flex:0 0 auto}}
    `;
    document.head.appendChild(s);
  }

  function render() {
    const data = getData();
    const header = document.querySelector(".site-header");
    if (!header || !data) return false;
    css();
    let card = document.getElementById("customerVisitGreeting");
    if (!card) {
      card = document.createElement("section");
      card.id = "customerVisitGreeting";
      card.className = "visit-greeting";
      header.insertAdjacentElement("afterend", card);
    }
    const p = farmPulse(data);
    const history = p.days >= 4 ? `The flock has averaged ${p.avg.toFixed(1)} eggs a day over its last ${p.days} logged days.` : "The flock is still building its recent laying story.";
    card.innerHTML = `<div class="visit-greeting-copy"><strong>🐔 ${greeting()} from ${BRAND}</strong><span>${history} Scroll down to meet the flock and see how today's weather compares with past laying days.</span></div><div class="visit-greeting-pulse"><span class="visit-pulse-chip">🥚 ${p.eggs} eggs / 7 days</span>${p.flock ? `<span class="visit-pulse-chip">🐓 ${p.flock} flock profiles</span>` : ""}</div>`;
    return true;
  }

  function start() {
    render();
    setTimeout(render, 250);
    ["staging-customer-data-ready", "core-data-synced", "farm-data-synced"].forEach(name => window.addEventListener(name, render));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.StagingCustomerVisitGreetingV1 = { version: 1, brand: BRAND, greeting, farmPulse, render, networkCalls: 0, firebaseReads: 0, firebaseWrites: 0 };
})();
