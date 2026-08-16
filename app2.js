(() => {
  "use strict";
  const BUILD = String(window.__ChickenEggsBuild || "20260816-1630");
  const load = (src, module = false) => document.write(`<script${module?' type="module"':''} src="${src}?v=${encodeURIComponent(BUILD)}"><\/script>`);

  load("sync-safety-preload-v1.js");
  load("core-sync-ui-v1.js");
  load("legacy-render-observer-guard-v1.js");
  load("audit-finish-v1.js");
  load("app-audit-v1.js");

  // Inventory v3 rebuilds from the last trusted exact count and exposes a direct
  // core-entry delta API. The bridge below calls that API from the core actions.
  load("core-inventory-authority-v3.js");
  load("core-action-inventory-bridge-v1.js");
  load("inventory-missed-entry-repair-v1.js");

  load("firebase-safe-v9.js", true);
  load("app2-stable-runtime-v1.js");
  load("app2-legacy-safe-loader-v1.js");
  load("bird-photo-service-v4.js");
  load("flock-manager-v7.js");
  load("insights-calendar-v2.js");
  load("flock-photo-viewer-v1.js");
  load("farm-diagnostics-v1.js");

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
