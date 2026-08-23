(() => {
  "use strict";
  if (window.__StagingFarmFactsV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingFarmFactsV1 = true;

  const BRAND = "Rose Family Poultry";
  const FACTS = [
    "🥚 A hen usually needs about 24–26 hours to build an egg, so laying time can drift later from one day to the next.",
    "🐔 Chickens use more than a dozen distinct calls to communicate things like food, alarm, contact, and nesting.",
    "🪶 Dust bathing helps chickens maintain their feathers and skin by working fine material through the plumage.",
    "🌞 Day length strongly influences laying activity, which is why production often changes with the seasons.",
    "🥚 Eggshell color comes from breed genetics; shell color does not determine the nutritional quality of the egg.",
    "🐓 Roosters can use different alarm calls depending on whether a threat is on the ground or overhead.",
    "👀 Chickens have excellent color vision and can see a wider range of colors than people can.",
    "🏡 A flock's routine matters: chickens quickly learn regular feeding, ranging, and roosting times.",
    "🥬 Grit and calcium serve different jobs: grit helps grind food, while calcium supports strong eggshells and bones.",
    "🐣 Chicks begin communicating with their mother before hatch through tiny peeps from inside the egg.",
    "🪺 Hens often prefer a nest that feels sheltered and dim, even when several suitable boxes are available.",
    "🐔 Chickens can recognize many individual flockmates and remember their social relationships over time."
  ];
  let offset = 0;

  function dayIndex(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / 86400000) % FACTS.length;
  }
  function greeting(date = new Date()) {
    const h = date.getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }
  function currentFact() {
    return FACTS[(dayIndex() + offset) % FACTS.length];
  }
  function nextFact() {
    offset = (offset + 1) % FACTS.length;
    render();
    return currentFact();
  }

  function css() {
    if (document.getElementById("rfpFarmFactsCss")) return;
    const s = document.createElement("style");
    s.id = "rfpFarmFactsCss";
    s.textContent = `
      .rfp-fact-card{margin:14px 0;padding:15px 16px;border-radius:20px;background:rgba(255,255,255,.86);border:1px solid rgba(31,122,58,.12);box-shadow:0 10px 28px rgba(24,68,36,.08)}
      .farm2-dark .rfp-fact-card{background:rgba(255,255,255,.05)}
      .rfp-fact-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.rfp-fact-head strong{font-size:14px}.rfp-fact-head button{width:auto!important;margin:0!important;padding:7px 10px!important;font-size:10px!important;white-space:nowrap}
      .rfp-fact-text{font-size:12px;font-weight:750;line-height:1.45}.rfp-fact-foot{margin-top:7px;font-size:10px;font-weight:800;opacity:.62}
    `;
    document.head.appendChild(s);
  }

  function render() {
    const dash = document.getElementById("dashboard");
    if (!dash) return false;
    css();
    let card = document.getElementById("rfpFarmFactCard");
    if (!card) {
      card = document.createElement("section");
      card.id = "rfpFarmFactCard";
      card.className = "rfp-fact-card";
      const wins = document.getElementById("rfpFarmWins");
      if (wins) wins.insertAdjacentElement("afterend", card);
      else dash.appendChild(card);
    }
    card.innerHTML = `<div class="rfp-fact-head"><strong>🐔 ${greeting()}, ${BRAND}</strong><button type="button" id="rfpAnotherFact">Another fact ↻</button></div><div class="rfp-fact-text">${currentFact()}</div><div class="rfp-fact-foot">Rotating flock fact • STAGING local-only • zero Firebase calls</div>`;
    card.querySelector("#rfpAnotherFact")?.addEventListener("click", nextFact);
    return true;
  }

  ["core-data-synced","farm-data-synced","farm-local-data-changed"].forEach(name => window.addEventListener(name, render));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(render, 250), {once:true});
  else setTimeout(render, 250);

  window.StagingFarmFactsV1 = {version:1, brand:BRAND, facts:FACTS.slice(), greeting, dayIndex, currentFact, nextFact, render, networkCalls:0, firebaseReads:0, firebaseWrites:0};
})();