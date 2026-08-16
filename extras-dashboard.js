(() => {
  "use strict";
  if (window.__extrasDashboardSafeLoaderV3) return;
  window.__extrasDashboardSafeLoaderV3 = true;

  try {
    const build = String(window.__ChickenEggsBuild || "20260816-1690");
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `extras-dashboard-legacy-v1.js?v=${encodeURIComponent(build)}`, false);
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) throw new Error(`HTTP ${xhr.status}`);

    let source = String(xhr.responseText || "");
    if (!source.includes('__farm_deluxe_v1__')) throw new Error("Legacy dashboard source did not load");

    source = source.replace(
      'function save(){st.updatedAt=Date.now();localStorage.setItem(D,JSON.stringify(st));clearTimeout(timer);timer=setTimeout(cloudSave,500);render()}',
      'function save(){st.updatedAt=Date.now();localStorage.setItem(D,JSON.stringify(st));render()}'
    );
    source = source.replace(
      'function init(){inject();hook();render();cloudLoad();setInterval(()=>{hook();render()},3500)}',
      'function init(){inject();hook();render();window.addEventListener("farm-data-synced",render);window.addEventListener("farm-local-data-changed",render);window.addEventListener("core-data-synced",render);window.addEventListener("farm-sync-ready",render)}'
    );

    if (source.includes('timer=setTimeout(cloudSave,500)')) throw new Error("Legacy Deluxe cloud writer was not removed");
    if (source.includes('cloudLoad();setInterval')) throw new Error("Legacy Deluxe cloud loader/timer was not removed");

    (0, eval)(`${source}\n//# sourceURL=extras-dashboard-safe-runtime.js`);
    console.log("✅ Dashboard/Insights UI active; duplicate Deluxe cloud I/O and polling retired");
  } catch (error) {
    console.error("Safe dashboard loader failed:", error);
  }
})();
