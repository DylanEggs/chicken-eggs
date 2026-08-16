(() => {
  "use strict";
  const BUILD = String(window.__ChickenEggsBuild || "20260816-1700");
  const load = (src, module = false) => document.write(`<script${module?' type="module"':''} src="${src}?v=${encodeURIComponent(BUILD)}"><\/script>`);

  load("sync-safety-preload-v1.js");
  load("core-sync-ui-v1.js");
  load("legacy-render-observer-guard-v1.js");

  // ONE physical-inventory authority. Older inventory bridges, rebuilders and
  // editors remain in the repository only as harmless compatibility stubs.
  load("inventory-system-v6.js");

  load("audit-finish-v1.js");
  load("app-audit-v1.js");
  load("app2-stable-runtime-v1.js");
  load("app2-legacy-safe-loader-v1.js");

  // Current feature modules are loaded explicitly with the same app build.
  load("app-polish-v1.js");
  load("prediction-fix-v1.js");
  load("weather-intelligence-v2.js");
  load("bird-photo-service-v4.js");
  load("bird-photo-recovery-v2.js");
  load("flock-manager-v7.js");
  load("insights-calendar-v2.js");
  load("flock-photo-viewer-v1.js");
  load("farm-diagnostics-v1.js");
  load("farm-diagnostics-photo-v2.js");
  load("app-self-test-v1.js");

  let chickenSalesReturn = "farm2Hub";
  function activeScreenId(){return document.querySelector(".screen.active")?.id||"dashboard";}
  function go(screen){if(typeof window.showScreen==="function")window.showScreen(screen);}

  document.addEventListener("click",event=>{
    const button=event.target.closest?.("button");if(!button)return;
    const opensChickenSales=button.id==="bizChickenButton"||button.id==="bizChickenHubBtn"||/showScreen\(['\"]bizChickenSales['\"]\)/.test(button.getAttribute("onclick")||"");
    if(opensChickenSales){chickenSalesReturn=activeScreenId()==="sale"?"sale":"farm2Hub";return;}
    const screen=button.closest(".screen");if(!screen)return;
    const isBack=button.classList.contains("backMini")||(button.classList.contains("secondary")&&button.textContent.trim()==="Back");
    if(!isBack)return;
    let destination="";
    if(["farm","history","records"].includes(screen.id))destination="farm2Hub";
    if(screen.id==="bizChickenSales")destination=chickenSalesReturn||"farm2Hub";
    if(!destination)return;
    event.preventDefault();event.stopImmediatePropagation();go(destination);
  },true);
})();
