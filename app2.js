(() => {
  "use strict";
  const BUILD = String(window.__ChickenEggsBuild || "20260821-1950");
  const load = (src, module = false) => document.write(`<script${module?' type="module"':''} src="${src}?v=${encodeURIComponent(BUILD)}"><\/script>`);

  load("sync-safety-preload-v1.js");
  load("core-sync-ui-v1.js");
  load("firebase-listener-recovery-v1.js");
  load("legacy-render-observer-guard-v1.js");

  // Critical farm data gets first claim on browser storage. This can reclaim
  // only photo copies already verified in Firebase if localStorage is full.
  load("storage-health-v1.js");

  // ONE physical-inventory authority. The 12-pack layer changes only owner-side
  // packaging/display: exact total remains authoritative, 12-packs are automatic,
  // 18-packs are owner-designated, and the hidden remainder is never displayed.
  load("inventory-system-v6.js");
  load("twelve-pack-default-v1.js");

  load("audit-finish-v1.js");
  load("app-audit-v1.js");
  load("app2-stable-runtime-v1.js");
  load("app2-legacy-safe-loader-v1.js");
  load("history-back-v1.js");
  load("sale-edit-back-v1.js");

  // Current feature modules are loaded explicitly with the same app build.
  load("app-polish-v1.js");
  load("who-owes.js");
  load("business-lifetime-v1.js");
  load("records-daily-totals-v1.js");
  load("prediction-fix-v1.js");
  load("weather-intelligence-v2.js");
  load("bird-photo-service-v4.js");
  // Historical photo recovery remains in the repository for manual recovery,
  // but is no longer auto-loaded on every owner-app startup. The current photo
  // service already owns normal photo sync and avoids duplicate scans/listeners.
  load("flock-manager-v7.js");
  load("bird-sales-v1.js");
  load("insights-calendar-v2.js");
  load("flock-photo-viewer-v1.js");
  load("farm-diagnostics-v1.js");
  load("farm-diagnostics-photo-v2.js");
  load("app-self-test-v1.js");

  // Read-only until the user explicitly downloads/restores a file. This gives
  // the live farm a complete off-device backup path before customer publishing.
  load("complete-safety-backup-v3.js");

  // Customer publishing is deliberately isolated from the normal Egg App auth.
  // The pure builders sanitize private farm data first; only the exact owner UID
  // can connect the separate publisher session and write public_customer/public_flock.
  load("customer-public-builder-v1.js");
  load("customer-public-builder-v2.js");
  load("customer-public-builder-v3.js");
  load("customer-public-builder-v4.js");
  load("public-customer-owner-auth-v1.js");
  load("customer-requests-owner-v1.js");
  load("public-customer-publisher-v1.js");
  load("public-customer-bird-sales-publisher-v1.js");
  load("public-customer-sync-ui-v1.js");

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
