(() => {
  "use strict";
  if (window.__ChickenEggsStagingApp2Loader) return;
  window.__ChickenEggsStagingApp2Loader = true;

  try {
    const build = String(window.__ChickenEggsBuild || Date.now());
    const rootUrl = new URL("../app2.js", document.currentScript?.src || location.href);
    rootUrl.searchParams.set("v", build);
    const xhr = new XMLHttpRequest();
    xhr.open("GET", rootUrl.href, false);
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) throw new Error(`app2 HTTP ${xhr.status}`);

    let source = String(xhr.responseText || "");
    if (!source.includes('load("inventory-system-v6.js")')) throw new Error("Current app2 loader signature not found");

    // Keep the same live feature code but replace any module that can reach the
    // real Firebase/photo cloud with staging-only adapters.
    source = source
      .replace('load("bird-photo-service-v4.js");', 'load("staging/staging-photo-service.js");')
      .replace('load("bird-photo-recovery-v2.js");', '')
      .replace('load("farm-diagnostics-v1.js");', 'load("staging/staging-diagnostics.js");')
      .replace('load("farm-diagnostics-photo-v2.js");', '')
      .replace('load("app-self-test-v1.js");', '');

    if (source.includes('load("bird-photo-service-v4.js")')) throw new Error("Live photo service was not isolated");
    if (source.includes('load("bird-photo-recovery-v2.js")')) throw new Error("Live photo recovery was not isolated");

    (0, eval)(`${source}\n//# sourceURL=staging-app2-runtime.js`);
    console.log("🧪 STAGING app2 active — live feature code with cloud writers isolated");
  } catch (error) {
    console.error("STAGING app2 loader failed:", error);
  }
})();
