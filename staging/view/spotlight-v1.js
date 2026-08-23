(() => {
  "use strict";
  if (window.__StagingCustomerSpotlightV1) return;
  window.__StagingCustomerSpotlightV1 = true;

  const BRAND = "Rose Family Poultry";
  let cursor = 0;

  function getData() {
    return window.CustomerViewStaging?.getData?.() || window.StagingCustomerPublicData?.build?.() || null;
  }

  function eligibleBirds() {
    const data = getData();
    return Array.isArray(data?.flock) ? data.flock.filter(b => b?.id && b?.name) : [];
  }

  function install() {
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

  function css() {
    if (document.getElementById("customerSpotlightCss")) return;
    const style = document.createElement("style");
    style.id = "customerSpotlightCss";
    style.textContent = `
      .customer-spotlight-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:12px}
      .customer-spotlight-actions button{width:auto;margin:0;padding:9px 12px;border:0;border-radius:999px;background:#17351f;color:#fff;font-size:11px;font-weight:950;cursor:pointer;box-shadow:0 8px 18px rgba(23,53,31,.16)}
      .customer-spotlight-actions button:focus-visible{outline:3px solid rgba(31,122,58,.28);outline-offset:2px}
      .customer-spotlight-actions small{font-size:9px;font-weight:800;color:#7c897f}
      @media(max-width:520px){.customer-spotlight-actions{align-items:stretch}.customer-spotlight-actions button{width:100%}.customer-spotlight-actions small{width:100%;text-align:center}}
    `;
    document.head.appendChild(style);
  }

  function start() {
    css();
    if (!install()) {
      const observer = new MutationObserver(() => {
        if (install()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 10000);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.StagingCustomerSpotlightV1 = {
    version: 1,
    brand: BRAND,
    eligibleBirds,
    install,
    networkCalls: 0,
    firebaseReads: 0,
    firebaseWrites: 0
  };
})();
