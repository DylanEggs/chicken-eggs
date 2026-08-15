(() => {
  "use strict";
  // Lock stale startup writes before any Farm App 2 code can touch local data.
  document.write('<script src="sync-safety-preload-v1.js?v=20260815-6"><\/script>');

  // script.js is older core UI code. Install a tiny compatibility authority
  // before DOMContentLoaded so it cannot start a second Firestore listener or
  // fight the protected sync engine over the status text.
  document.write('<script src="core-sync-ui-v1.js?v=20260815-1"><\/script>');

  // firebase.js in older cached pages may still point at an earlier generation.
  // The preload makes old farm authorities inert; v9 is the single cloud owner.
  document.write('<script type="module" src="firebase-safe-v9.js?v=20260815-2"><\/script>');

  // Install the stable runtime before Farm App 2 renders so legacy inventory
  // math never paints to the screen and cached correction helpers stay disabled.
  document.write('<script src="app2-stable-runtime-v1.js?v=20260815-4"><\/script>');

  // Load the existing Farm App 2 UI, but strip its obsolete direct Firebase
  // reader/writer. Protected Firebase is the only cloud owner.
  document.write('<script src="app2-legacy-safe-loader-v1.js?v=20260815-4"><\/script>');

  // Flock/photo controls must NEVER wait on Firebase bootstrap. The photo service
  // can show its local cache immediately and sync to Firebase whenever ready.
  document.write('<script src="bird-photo-service-v4.js?v=20260815-3"><\/script>');
  document.write('<script src="flock-manager-v7.js?v=20260815-5"><\/script>');

  document.write('<script src="insights-calendar-v2.js?v=20260815-3"><\/script>');
  document.write('<script src="flock-photo-viewer-v1.js?v=20260815-4"><\/script>');

  // One navigation authority for screens opened from the Farm hub.
  // This avoids hard-coded legacy Back buttons sending users to Home/Sale.
  let chickenSalesReturn = "farm2Hub";

  function activeScreenId() {
    return document.querySelector(".screen.active")?.id || "dashboard";
  }

  function go(screen) {
    if (typeof window.showScreen === "function") window.showScreen(screen);
  }

  document.addEventListener("click", event => {
    const button = event.target.closest?.("button");
    if (!button) return;

    // Remember whether Chicken Sales was opened from Farm or Record Sale.
    const opensChickenSales =
      button.id === "bizChickenButton" ||
      button.id === "bizChickenHubBtn" ||
      /showScreen\(['\"]bizChickenSales['\"]\)/.test(button.getAttribute("onclick") || "");
    if (opensChickenSales) {
      chickenSalesReturn = activeScreenId() === "sale" ? "sale" : "farm2Hub";
      return;
    }

    const screen = button.closest(".screen");
    if (!screen) return;
    const isBack = button.classList.contains("backMini") ||
      (button.classList.contains("secondary") && button.textContent.trim() === "Back");
    if (!isBack) return;

    let destination = "";
    if (["farm", "history", "records"].includes(screen.id)) destination = "farm2Hub";
    if (screen.id === "bizChickenSales") destination = chickenSalesReturn || "farm2Hub";
    if (!destination) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    go(destination);
  }, true);
})();
