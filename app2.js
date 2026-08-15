(() => {
  "use strict";
  document.write('<script src="sync-safety-preload-v1.js?v=20260815-7"><\/script>');
  document.write('<script src="core-sync-ui-v1.js?v=20260815-2"><\/script>');
  document.write('<script src="legacy-render-observer-guard-v1.js?v=20260815-2"><\/script>');
  document.write('<script src="audit-finish-v1.js?v=20260815-6"><\/script>');
  document.write('<script src="app-audit-v1.js?v=20260815-4"><\/script>');
  document.write('<script type="module" src="firebase-safe-v9.js?v=20260815-3"><\/script>');
  document.write('<script src="app2-stable-runtime-v1.js?v=20260815-4"><\/script>');
  document.write('<script src="app2-legacy-safe-loader-v1.js?v=20260815-4"><\/script>');

  document.write('<script src="bird-photo-service-v4.js?v=20260815-3"><\/script>');
  document.write('<script src="flock-manager-v7.js?v=20260815-5"><\/script>');
  document.write('<script src="insights-calendar-v2.js?v=20260815-3"><\/script>');
  document.write('<script src="flock-photo-viewer-v1.js?v=20260815-5"><\/script>');

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
