(() => {
  "use strict";
  if (window.__LiveInstallAppFixV1) return;
  window.__LiveInstallAppFixV1 = true;

  const STYLE_ID = "liveInstallAppFixStyleV1";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .install-card{scroll-margin-top:82px}
      .site-footer .install-footer-link{display:inline-flex!important;align-items:center!important;justify-content:center!important;margin:8px auto 6px!important;padding:9px 13px!important;border-radius:999px!important;background:rgba(31,122,58,.10)!important;color:#1f7a3a!important;font-size:12px!important;font-weight:900!important;line-height:1.2!important;text-decoration:none!important;border:0!important;box-shadow:none!important;-webkit-text-decoration:none!important}
      .site-footer .install-footer-link:visited,.site-footer .install-footer-link:hover,.site-footer .install-footer-link:active{color:#1f7a3a!important;text-decoration:none!important}
    `;
    document.head.appendChild(style);
  }

  function installCard() {
    ensureStyles();
    return document.getElementById("installApp");
  }

  function moveToInstall(behavior = "smooth") {
    const card = installCard();
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
    ensureStyles();
    if (location.hash === "#installApp") setTimeout(scheduleStableScroll, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.addEventListener("load", () => {
    if (location.hash === "#installApp") scheduleStableScroll();
  }, { once: true });
})();
