(() => {
  "use strict";
  if (window.__HistoryBackV1) return;
  window.__HistoryBackV1 = true;

  function patch() {
    const history = document.getElementById("history");
    if (!history) return false;
    const top = history.querySelector(".screenTitle .backMini");
    const bottom = [...history.querySelectorAll("button.secondary")]
      .find(button => button.textContent.trim() === "Back");

    for (const button of [top, bottom]) {
      if (!button) continue;
      button.setAttribute("onclick", "showScreen('farm2Hub')");
      button.dataset.historyBackTarget = "farm2Hub";
    }
    return !!top && !!bottom;
  }

  function init() {
    patch();
    window.addEventListener("farm-data-synced", patch);
    window.addEventListener("core-data-synced", patch);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();
