(() => {
  "use strict";
  if (window.__extrasDashboardSafeLoaderV2) return;
  window.__extrasDashboardSafeLoaderV2 = true;

  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "extras-dashboard-legacy-v1.js?v=20260815-safe1", false);
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) {
      throw new Error(`HTTP ${xhr.status}`);
    }

    let source = String(xhr.responseText || "");
    if (!source.includes('__farm_deluxe_v1__')) {
      throw new Error("Legacy dashboard source did not load");
    }

    // Keep all Home/Insights/Chicken-of-the-Day UI, but local changes are now
    // synchronized only by Firebase Safe v9 through farm_deluxe_v1.
    source = source.replace(
      'function save(){st.updatedAt=Date.now();localStorage.setItem(D,JSON.stringify(st));clearTimeout(timer);timer=setTimeout(cloudSave,500);render()}',
      'function save(){st.updatedAt=Date.now();localStorage.setItem(D,JSON.stringify(st));render()}'
    );

    // Remove the obsolete __farm_deluxe_v1__ startup reader and the permanent
    // 3.5-second redraw interval. Rendering is event/navigation driven instead.
    source = source.replace(
      'function init(){inject();hook();render();cloudLoad();setInterval(()=>{hook();render()},3500)}',
      'function init(){inject();hook();render();window.addEventListener("farm-data-synced",render);window.addEventListener("farm-local-data-changed",render);window.addEventListener("core-data-synced",render);window.addEventListener("farm-sync-ready",render)}'
    );

    if (source.includes('timer=setTimeout(cloudSave,500)')) {
      throw new Error("Legacy Deluxe cloud writer was not removed");
    }
    if (source.includes('cloudLoad();setInterval')) {
      throw new Error("Legacy Deluxe cloud loader/timer was not removed");
    }

    (0, eval)(`${source}\n//# sourceURL=extras-dashboard-safe-runtime.js`);
    console.log("✅ Dashboard/Insights UI active; duplicate Deluxe cloud I/O and polling retired");
  } catch (error) {
    console.error("Safe dashboard loader failed:", error);
  }
})();
