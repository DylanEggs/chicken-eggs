(() => {
  "use strict";
  if (window.__legacyApp2SafeLoaderV3) return;
  window.__legacyApp2SafeLoaderV3 = true;
  try {
    const build = String(window.__ChickenEggsBuild || "20260816-1690");
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `app2-legacy-v1.js?v=${encodeURIComponent(build)}`, false);
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) throw new Error(`HTTP ${xhr.status}`);
    let source = String(xhr.responseText || "");
    if (!source.includes("CLOUD_DOC_ID")) throw new Error("Farm App 2 source did not load");

    // The protected Firebase runtime is the only Farm App 2 cloud authority.
    source = source.replace(/cloudTimer\s*=\s*setTimeout\(cloudSave2,\s*500\);/g, "cloudTimer = null; /* legacy cloud writer disabled */");
    source = source.replace(/\n\s*cloudLoad2\(\);\s*\n/g, "\n    /* legacy cloud loader disabled; protected Firebase owns sync */\n");

    // Golden Egg was intentionally removed from this app. Remove the random
    // Golden Egg branch before the legacy source is evaluated instead of
    // wrapping Save Eggs later with another compatibility function.
    source = source.replace(
      /if \(roll < \.055\) \{[\s\S]*?title: "GOLDEN EGG!"[\s\S]*?return;\s*\}/,
      'if (false) { /* Golden Egg feature retired */ }'
    );
    if (source.includes('title: "GOLDEN EGG!"')) throw new Error("Golden Egg branch was not removed from legacy Farm UI");

    const marker = '  document.addEventListener("DOMContentLoaded", init);';
    const bridge = `  const protectedFarmReload = () => {\n    if (!initialized) return;\n    loadLocal2();\n    applyTheme();\n    renderFarm2();\n  };\n  window.__reloadFarm2Memory = protectedFarmReload;\n  window.addEventListener("farm-data-synced", event => {\n    if (!event.detail?.key || event.detail.key === APP2_KEY || event.detail.key === "restore") protectedFarmReload();\n  });\n  window.addEventListener("farm-local-data-changed", event => {\n    if (event.detail?.key === APP2_KEY) protectedFarmReload();\n  });\n  window.addEventListener("farm-sync-ready", protectedFarmReload);\n  ${marker}`;
    if (!source.includes(marker)) throw new Error("Farm App 2 sync bridge marker was not found");
    source = source.replace(marker, bridge);

    (0, eval)(`${source}\n//# sourceURL=app2-legacy-safe-runtime.js`);
    console.log("✅ Farm App 2 legacy UI loaded with duplicate cloud I/O and Golden Egg branch retired");
  } catch (error) {
    console.error("Farm App 2 safe loader failed:", error);
  }
})();
