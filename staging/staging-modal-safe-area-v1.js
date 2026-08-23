(() => {
  "use strict";
  if (window.__StagingModalSafeAreaV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingModalSafeAreaV1 = true;

  const ROOT_VAR = "--staging-banner-safe-top";

  function installCss() {
    if (document.getElementById("stagingModalSafeAreaCss")) return;
    const style = document.createElement("style");
    style.id = "stagingModalSafeAreaCss";
    style.textContent = `
      html{${ROOT_VAR}:0px}
      .rfp-biz-modal,.rfp-chore-modal{
        padding-top:calc(var(${ROOT_VAR}, 0px) + 14px)!important;
        scroll-padding-top:calc(var(${ROOT_VAR}, 0px) + 14px)!important;
      }
      .rfp-biz-sheet,.rfp-chore-sheet{margin-top:0!important}
    `;
    document.head.appendChild(style);
  }

  function updateSafeTop() {
    const banner = document.getElementById("stagingSafetyBanner");
    const height = banner ? Math.max(0, Math.ceil(banner.getBoundingClientRect().height)) : 0;
    document.documentElement.style.setProperty(ROOT_VAR, `${height}px`);
    return height;
  }

  function resetOpenModalScroll() {
    const business = document.getElementById("rfpBusinessModal");
    const chores = document.getElementById("rfpChoreModal");
    if (business && !business.hidden) business.scrollTop = 0;
    if (chores && !chores.hidden) chores.scrollTop = 0;
  }

  function start() {
    installCss();
    updateSafeTop();

    const banner = document.getElementById("stagingSafetyBanner");
    if (banner && "ResizeObserver" in window) {
      const ro = new ResizeObserver(() => {
        updateSafeTop();
        resetOpenModalScroll();
      });
      ro.observe(banner);
      window.__StagingModalSafeAreaResizeObserver = ro;
    }

    window.addEventListener("resize", () => {
      updateSafeTop();
      resetOpenModalScroll();
    }, { passive:true });

    document.addEventListener("click", event => {
      if (!event.target?.closest?.("#rfpBusinessLauncher,#rfpChoreLauncher")) return;
      setTimeout(() => {
        updateSafeTop();
        resetOpenModalScroll();
      }, 0);
    }, true);

    setTimeout(updateSafeTop, 250);
    setTimeout(updateSafeTop, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();

  window.StagingModalSafeAreaV1 = {
    version:1,
    update:updateSafeTop,
    safeTop:() => parseInt(getComputedStyle(document.documentElement).getPropertyValue(ROOT_VAR), 10) || 0
  };
})();
