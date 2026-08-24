(() => {
  "use strict";
  if (window.__StagingCustomerFlockTriviaV1) return;
  window.__StagingCustomerFlockTriviaV1 = true;

  const $ = id => document.getElementById(id);
  let index = 0;

  const clean = value => String(value ?? "").trim();
  const sexGroup = bird => ["Hen", "Pullet"].includes(clean(bird?.sex)) ? "hen" : ["Rooster", "Cockerel"].includes(clean(bird?.sex)) ? "rooster" : "other";

  function validDate(value) {
    const text = clean(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const date = new Date(`${text}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function buildFacts(data = window.CustomerViewStaging?.getData?.()) {
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

  function pool() {
    const data = window.CustomerViewStaging?.getData?.();
    const flockFacts = buildFacts(data);
    const general = Array.isArray(data?.facts) ? data.facts.filter(Boolean) : [];
    return [...flockFacts, ...general];
  }

  function render(next = false) {
    const facts = pool();
    if (!facts.length) return false;
    if (next) index = (index + 1) % facts.length;
    else index = Math.abs(Number(index) || 0) % facts.length;
    const text = $("factText");
    const title = $("factTitle");
    if (text) text.textContent = facts[index];
    if (title) title.textContent = index < buildFacts().length ? "A fact about this flock" : "Chicken fact of the visit";
    return true;
  }

  function install() {
    const button = $("nextFact");
    if (!button || button.dataset.flockTriviaInstalled === "1") return false;
    button.dataset.flockTriviaInstalled = "1";
    button.addEventListener("click", () => setTimeout(() => render(true), 0));
    render(false);
    return true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(install, 0), { once: true });
  else setTimeout(install, 0);

  window.StagingCustomerFlockTriviaV1 = {
    version: 1,
    environment: "staging-customer-preview",
    firebaseReads: 0,
    firebaseWrites: 0,
    networkCalls: 0,
    buildFacts,
    pool,
    render,
    install
  };
})();
