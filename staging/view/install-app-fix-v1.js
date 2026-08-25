(() => {
  "use strict";
  if (window.__StagingInstallAppFixV1) return;
  window.__StagingInstallAppFixV1 = true;

  const STYLE_ID = "stagingInstallAppFixStyleV1";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .install-card{margin-top:18px;padding:22px;border-radius:28px;background:linear-gradient(145deg,#fff8dc,#eef8ee);border:1px solid rgba(31,122,58,.12);box-shadow:0 18px 42px rgba(24,68,36,.1);scroll-margin-top:82px}
      .install-heading{display:flex;gap:15px;align-items:flex-start}.install-icon{width:54px;height:54px;display:grid;place-items:center;flex:0 0 auto;border-radius:18px;background:#fff;font-size:28px;box-shadow:0 10px 24px rgba(31,122,58,.12)}
      .install-heading h2{margin:2px 0 6px;font-size:clamp(22px,4vw,31px);line-height:1.08}.install-heading p{margin:0;color:#647066;line-height:1.5}.install-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}
      .install-device{padding:17px;border-radius:20px;background:rgba(255,255,255,.82);border:1px solid rgba(31,122,58,.1)}.install-device-title{display:flex;gap:9px;align-items:center;font-size:17px;margin-bottom:9px}.install-device-title span{font-size:22px}.install-device ol{margin:0;padding-left:22px;color:#526057;line-height:1.55}.install-device li+li{margin-top:5px}.install-symbol{font-size:15px}.install-note{margin-top:13px;padding:11px 13px;border-radius:15px;background:rgba(31,122,58,.08);color:#2f613b;font-size:13px;font-weight:800;line-height:1.45}.install-footer-link{display:inline-flex;align-items:center;justify-content:center;padding:9px 13px;border-radius:999px;background:rgba(31,122,58,.1);color:#1f7a3a;font-size:12px;font-weight:900;text-decoration:none}.install-footer-link:hover{text-decoration:none;background:rgba(31,122,58,.16)}
      @media(max-width:680px){.install-card{padding:18px}.install-heading{align-items:center}.install-grid{grid-template-columns:1fr}.install-icon{width:48px;height:48px;border-radius:16px;font-size:24px}.install-heading h2{font-size:23px}}
    `;
    document.head.appendChild(style);
  }

  function installMarkup() {
    return `
      <div class="install-heading">
        <div class="install-icon" aria-hidden="true">📲</div>
        <div><div class="section-kicker">Keep the flock one tap away</div><h2 id="installAppTitle">Add Rose Family Poultry to your Home Screen</h2><p>Save this live farm page like an app. It will open directly to the current egg availability, flock and stats.</p></div>
      </div>
      <div class="install-grid">
        <article class="install-device">
          <div class="install-device-title"><span>🍎</span><strong>iPhone / iPad</strong></div>
          <ol>
            <li>Open this page in <strong>Safari</strong>.</li>
            <li>Tap the <strong>•••</strong> button at the bottom of Safari.</li>
            <li>Tap <strong>Share</strong> <span class="install-symbol">⬆️</span>.</li>
            <li>Choose <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>.</li>
          </ol>
        </article>
        <article class="install-device">
          <div class="install-device-title"><span>🤖</span><strong>Android</strong></div>
          <ol><li>Open this page in <strong>Chrome</strong>.</li><li>Tap the <strong>⋮ menu</strong>.</li><li>Choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li><li>Confirm <strong>Add / Install</strong>.</li></ol>
        </article>
      </div>
      <div class="install-note">✨ After that, just tap the Rose Poultry icon on your Home Screen whenever you want to check the flock.</div>
    `;
  }

  function ensureInstallSection() {
    ensureStyles();
    const app = document.getElementById("customerApp");
    const footer = app?.querySelector(".site-footer");
    if (!app || !footer) return null;

    let card = document.getElementById("installApp");
    if (!card) {
      card = document.createElement("section");
      card.id = "installApp";
      card.className = "install-card";
      card.setAttribute("aria-labelledby", "installAppTitle");
      footer.insertAdjacentElement("beforebegin", card);
    }
    card.innerHTML = installMarkup();

    let footerLink = footer.querySelector('.install-footer-link[href="#installApp"]');
    if (!footerLink) {
      footerLink = document.createElement("a");
      footerLink.className = "install-footer-link";
      footerLink.href = "#installApp";
      footerLink.textContent = "📲 Add this farm to your Home Screen";
      const small = footer.querySelector("small");
      footer.insertBefore(footerLink, small || null);
    }

    const tabs = document.getElementById("customerTabs");
    if (tabs && !tabs.querySelector('a[href="#installApp"]')) {
      tabs.insertAdjacentHTML("beforeend", '<a href="#installApp">📲 Add App</a>');
    }
    return card;
  }

  function moveToInstall(behavior = "smooth") {
    const card = ensureInstallSection();
    if (!card) return;
    card.scrollIntoView({ behavior, block: "start" });
  }

  function scheduleStableScroll() {
    moveToInstall("smooth");
    [180, 600, 1200].forEach(ms => setTimeout(() => {
      if (location.hash === "#installApp") moveToInstall("auto");
    }, ms));
  }

  document.addEventListener("click", event => {
    const link = event.target.closest?.('a[href="#installApp"]');
    if (!link) return;
    event.preventDefault();
    try { history.pushState(null, "", "#installApp"); } catch { location.hash = "installApp"; }
    scheduleStableScroll();
  });

  function start() {
    ensureInstallSection();
    setTimeout(ensureInstallSection, 250);
    setTimeout(ensureInstallSection, 900);
    if (location.hash === "#installApp") setTimeout(scheduleStableScroll, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.addEventListener("staging-customer-data-ready", ensureInstallSection);
  window.addEventListener("core-data-synced", ensureInstallSection);
})();
