(() => {
  "use strict";
  if (window.__StagingCustomerMilestoneV1) return;
  window.__StagingCustomerMilestoneV1 = true;

  const BRAND = "Rose Family Poultry";
  const n = v => Math.max(0, Math.round(Number(v) || 0));

  function data() {
    return window.CustomerViewStaging?.getData?.() || window.StagingCustomerPublicData?.build?.() || null;
  }

  function milestoneFor(lifetime) {
    const total = n(lifetime);
    const step = total < 1000 ? 250 : 500;
    const next = Math.max(step, Math.ceil((total + 1) / step) * step);
    const previous = Math.max(0, next - step);
    const progress = Math.max(0, Math.min(100, Math.round(((total - previous) / step) * 100)));
    return { total, step, next, previous, remaining: Math.max(0, next - total), progress };
  }

  function render() {
    const d = data();
    const trail = document.getElementById("customerEggTrail");
    const lifetime = d?.stats?.records?.lifetimeEggs;
    if (!trail || !Number.isFinite(Number(lifetime))) return false;

    const m = milestoneFor(lifetime);
    let card = document.getElementById("customerEggMilestone");
    if (!card) {
      card = document.createElement("div");
      card.id = "customerEggMilestone";
      card.className = "egg-milestone";
      trail.appendChild(card);
    }

    const message = m.remaining === 0
      ? `The flock just reached ${m.next.toLocaleString()} lifetime eggs!`
      : `${m.remaining.toLocaleString()} eggs to the next ${m.next.toLocaleString()}-egg milestone.`;

    card.innerHTML = `<div class="egg-milestone-copy"><span>🎉 Flock milestone</span><strong>${message}</strong><small>${BRAND} has logged ${m.total.toLocaleString()} eggs so far.</small></div><div class="egg-milestone-meter" role="progressbar" aria-label="Progress to next flock egg milestone" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.progress}"><i style="width:${m.progress}%"></i></div>`;
    return true;
  }

  function css() {
    if (document.getElementById("customerEggMilestoneCss")) return;
    const s = document.createElement("style");
    s.id = "customerEggMilestoneCss";
    s.textContent = `
      .egg-milestone{margin-top:12px;padding:12px 13px;border-radius:16px;background:rgba(255,249,225,.72);border:1px solid rgba(245,185,28,.2)}
      .egg-milestone-copy{display:grid;gap:2px}.egg-milestone-copy>span{font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.06em;color:#8b6810}.egg-milestone-copy>strong{font-size:13px;line-height:1.3;color:#17351f}.egg-milestone-copy>small{font-size:10px;font-weight:750;color:#6f7d72}
      .egg-milestone-meter{height:8px;margin-top:9px;border-radius:999px;background:rgba(31,122,58,.1);overflow:hidden}.egg-milestone-meter i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#f5b91c,#4fcb75);transition:width .45s ease}
      @media (prefers-reduced-motion:reduce){.egg-milestone-meter i{transition:none}}
    `;
    document.head.appendChild(s);
  }

  function start() {
    css();
    render();
    setTimeout(render, 220);
    ["staging-customer-data-ready", "core-data-synced", "farm-data-synced"].forEach(name => window.addEventListener(name, render));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();

  window.StagingCustomerMilestoneV1 = {
    version: 1,
    brand: BRAND,
    milestoneFor,
    render,
    networkCalls: 0,
    firebaseReads: 0,
    firebaseWrites: 0
  };
})();