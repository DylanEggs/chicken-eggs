(() => {
  "use strict";
  if (window.__StagingCustomerFlockTriviaV1) return;
  window.__StagingCustomerFlockTriviaV1 = true;

  const $ = id => document.getElementById(id);
  let mode = "fun";
  const indexes = { fun: 0, flock: 0 };

  const clean = value => String(value ?? "").trim();
  const sexGroup = bird => ["Hen", "Pullet"].includes(clean(bird?.sex)) ? "hen" : ["Rooster", "Cockerel"].includes(clean(bird?.sex)) ? "rooster" : "other";

  function validDate(value) {
    const text = clean(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const date = new Date(`${text}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getData() {
    return window.CustomerViewStaging?.getData?.() || window.StagingCustomerPublicData?.build?.() || null;
  }

  function buildFacts(data = getData()) {
    const flock = Array.isArray(data?.flock) ? data.flock.filter(Boolean) : [];
    if (!flock.length) return [];

    const facts = [];
    const hens = flock.filter(b => sexGroup(b) === "hen").length;
    const roosters = flock.filter(b => sexGroup(b) === "rooster").length;
    const breeds = new Map();

    flock.forEach(bird => {
      const breed = clean(bird?.breed) || "Unknown breed";
      breeds.set(breed, (breeds.get(breed) || 0) + 1);
    });

    facts.push(`🐔 The public flock currently has ${flock.length} profile${flock.length === 1 ? "" : "s"} to explore.`);
    if (hens || roosters) facts.push(`🥚 Among the public profiles, there are ${hens} hen${hens === 1 ? "" : "s"}/pullet${hens === 1 ? "" : "s"} and ${roosters} rooster${roosters === 1 ? "" : "s"}/cockerel${roosters === 1 ? "" : "s"}.`);
    if (breeds.size) facts.push(`🪶 The public flock represents ${breeds.size} different breed${breeds.size === 1 ? "" : "s"} or crosses.`);

    const topBreed = [...breeds.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (topBreed && topBreed[1] > 1) facts.push(`⭐ ${topBreed[0]} is the most represented breed/cross in the public flock right now, with ${topBreed[1]} birds.`);

    const dated = flock
      .map(bird => ({ bird, date: validDate(bird?.hatchDate) }))
      .filter(x => x.date)
      .sort((a, b) => a.date - b.date);
    if (dated.length) {
      const oldest = dated[0];
      facts.push(`🎂 ${clean(oldest.bird?.name) || "One flock member"} has the earliest listed hatch date in the public flock: ${oldest.date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`);
    }

    return facts;
  }

  function funFacts(data = getData()) {
    return Array.isArray(data?.facts) ? data.facts.filter(Boolean).map(String) : [];
  }

  function factsForMode(which = mode, data = getData()) {
    const flock = buildFacts(data);
    const fun = funFacts(data);
    if (which === "flock") return flock.length ? flock : fun;
    return fun.length ? fun : flock;
  }

  function pool() {
    const data = getData();
    return [...buildFacts(data), ...funFacts(data)];
  }

  function updateSwitch() {
    document.querySelectorAll("[data-fact-mode]").forEach(button => {
      const active = button.dataset.factMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function render(next = false) {
    const facts = factsForMode(mode);
    if (!facts.length) return false;
    if (next) indexes[mode] = (indexes[mode] + 1) % facts.length;
    else indexes[mode] = Math.abs(Number(indexes[mode]) || 0) % facts.length;

    const text = $("factText");
    const title = $("factTitle");
    const nextButton = $("nextFact");
    const emoji = document.querySelector(".fact-card .fact-emoji");
    const index = indexes[mode];

    if (text) text.textContent = facts[index];
    if (title) title.textContent = mode === "flock" ? "A fact about this flock" : "Chicken fact of the visit";
    if (nextButton) nextButton.textContent = mode === "flock" ? "Another flock fact 🐔" : "Another fun fact ✨";
    if (emoji) emoji.textContent = mode === "flock" ? "🐔🥚" : "💡🐓";
    updateSwitch();
    return true;
  }

  function setMode(nextMode) {
    if (nextMode !== "fun" && nextMode !== "flock") return false;
    mode = nextMode;
    render(false);
    return true;
  }

  function injectCss() {
    if ($("customerFactModeCss")) return;
    const style = document.createElement("style");
    style.id = "customerFactModeCss";
    style.textContent = `
      .fact-mode-switch{display:inline-flex;gap:4px;margin-top:12px;padding:4px;border-radius:999px;background:rgba(23,53,31,.07);border:1px solid rgba(23,53,31,.08)}
      .fact-mode-switch button{border:0;border-radius:999px;padding:8px 10px;background:transparent;color:#5f6559;font:inherit;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}
      .fact-mode-switch button.active{background:#17351f;color:#fff;box-shadow:0 5px 12px rgba(23,53,31,.14)}
      .fact-mode-switch button:focus-visible{outline:3px solid rgba(31,122,58,.24);outline-offset:2px}
      @media(max-width:430px){.fact-mode-switch{display:grid;grid-template-columns:1fr 1fr;width:100%}.fact-mode-switch button{width:100%;padding:9px 7px}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    const button = $("nextFact");
    const copy = document.querySelector(".fact-card .fact-copy");
    if (!button || !copy) return false;

    injectCss();
    if (!$("customerFactModeSwitch")) {
      const switcher = document.createElement("div");
      switcher.id = "customerFactModeSwitch";
      switcher.className = "fact-mode-switch";
      switcher.setAttribute("role", "group");
      switcher.setAttribute("aria-label", "Choose fact type");
      switcher.innerHTML = `<button type="button" data-fact-mode="fun" aria-pressed="true">💡 Fun facts</button><button type="button" data-fact-mode="flock" aria-pressed="false">🐔 Flock facts</button>`;
      copy.appendChild(switcher);
      switcher.querySelectorAll("[data-fact-mode]").forEach(item => item.addEventListener("click", () => setMode(item.dataset.factMode)));
    }

    if (button.dataset.flockTriviaInstalled !== "2") {
      button.dataset.flockTriviaInstalled = "2";
      button.addEventListener("click", () => setTimeout(() => render(true), 0));
    }
    render(false);
    return true;
  }

  function start() {
    if (install()) return;
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0), { once: true });
  else setTimeout(start, 0);

  window.StagingCustomerFlockTriviaV1 = {
    version: 2,
    environment: "staging-customer-preview",
    firebaseReads: 0,
    firebaseWrites: 0,
    networkCalls: 0,
    buildFacts,
    funFacts,
    factsForMode,
    pool,
    render,
    install,
    setMode,
    currentMode: () => mode
  };
})();
