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
    source = source.replace(/cloudTimer\s*=\s*setTimeout\(cloudSave2,\s*500\);/g, "cloudTimer = null; /* legacy cloud writer disabled */");
    source = source.replace(/\n\s*cloudLoad2\(\);\s*\n/g, "\n    /* legacy cloud loader disabled; protected Firebase owns sync */\n");
    (0, eval)(`${source}\n//# sourceURL=app2-legacy-safe-runtime.js`);
    console.log("✅ Farm App 2 legacy UI loaded with its old Firebase writer disabled");
  } catch (error) {
    console.error("Farm App 2 safe loader failed:", error);
  }
})();
