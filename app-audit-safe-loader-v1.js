(() => {
  "use strict";
  if (window.__appAuditSafeLoaderV2) return;
  window.__appAuditSafeLoaderV2 = true;

  try {
    const build = String(window.__ChickenEggsBuild || "20260816-1690");
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `app-audit-legacy-v1.js?v=${encodeURIComponent(build)}`, false);
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) throw new Error(`HTTP ${xhr.status}`);

    let source = String(xhr.responseText || "");
    if (!source.includes("watchOldRenderers")) throw new Error("Legacy farm audit source did not load");

    source = source.replace(
      'function init(){installCoreGuard();installAppActions();installBusinessActions();installShowHook();renderAll();watchOldRenderers();window.addEventListener("farm-data-synced",scheduleRender);window.addEventListener("core-data-synced",scheduleRender);window.addEventListener("storage",e=>{if([APP2_KEY,INVENTORY_KEY,BUSINESS_KEY,ENTRIES_KEY].includes(e.key))scheduleRender();});console.log("✅ Full farm audit guard active");}',
      'function init(){if(window.__appAuditActionsV2)return;window.__appAuditActionsV2=true;installCoreGuard();installAppActions();installBusinessActions();installShowHook();renderAll();window.addEventListener("farm-data-synced",scheduleRender);window.addEventListener("farm-local-data-changed",scheduleRender);window.addEventListener("core-data-synced",scheduleRender);window.addEventListener("storage",e=>{if([APP2_KEY,INVENTORY_KEY,BUSINESS_KEY,ENTRIES_KEY].includes(e.key))scheduleRender();});console.log("✅ Farm audit actions active — event driven, no list observers");}'
    );

    if (source.includes('renderAll();watchOldRenderers();')) throw new Error("Legacy audit observers were not removed");
    (0, eval)(`${source}\n//# sourceURL=app-audit-safe-runtime.js`);
  } catch (error) {
    console.error("Safe farm audit loader failed:", error);
  }
})();
