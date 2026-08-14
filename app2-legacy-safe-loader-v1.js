(() => {
  "use strict";
  if (window.__legacyApp2SafeLoader) return;
  window.__legacyApp2SafeLoader = true;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "app2-legacy-v1.js?v=20260814-safe1", false);
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) throw new Error(`HTTP ${xhr.status}`);
    let source = String(xhr.responseText || "");
    if (!source.includes("CLOUD_DOC_ID")) throw new Error("Farm App 2 source did not load");

    // Keep the existing Farm App 2 UI and features, but remove both obsolete
    // direct-cloud paths. Protected Firebase is the only cloud authority.
    source = source.replace(/cloudTimer\s*=\s*setTimeout\(cloudSave2,\s*500\);/g, "cloudTimer = null; /* legacy cloud writer disabled */");
    source = source.replace(/\n\s*cloudLoad2\(\);\s*\n/g, "\n    /* legacy cloud loader disabled; protected Firebase owns sync */\n");

    // Farm App 2 keeps a closure-local copy called farm2. Whenever protected
    // sync changes the authoritative local record, reload that in-memory copy
    // before any later Farm action can save stale arrays back over it.
    const marker = '  document.addEventListener("DOMContentLoaded", init);';
    const bridge = `  const protectedFarmReload = () => {\n    if (!initialized) return;\n    loadLocal2();\n    applyTheme();\n    renderFarm2();\n  };\n  window.addEventListener("farm-data-synced", event => {\n    if (!event.detail?.key || event.detail.key === APP2_KEY || event.detail.key === "restore") protectedFarmReload();\n  });\n  window.addEventListener("farm-sync-ready", protectedFarmReload);\n  ${marker}`;
    if (!source.includes(marker)) throw new Error("Farm App 2 sync bridge marker was not found");
    source = source.replace(marker, bridge);

    (0, eval)(`${source}\n//# sourceURL=app2-legacy-safe-runtime.js`);
    console.log("✅ Farm App 2 legacy UI loaded with old cloud I/O disabled and protected reload bridge active");
  } catch (error) {
    console.error("Farm App 2 safe loader failed:", error);
  }
})();
