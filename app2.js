(() => {
  "use strict";
  // Install the stable runtime before Farm App 2 renders so legacy inventory
  // math never paints to the screen and cached correction helpers stay disabled.
  document.write('<script src="app2-stable-runtime-v1.js?v=20260814-2"><\/script>');
  document.write('<script src="app2-legacy-v1.js?v=20260814-1"><\/script>');

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
