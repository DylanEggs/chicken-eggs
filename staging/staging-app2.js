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
      .replace('load("inventory-system-v6.js");', 'load("inventory-system-v6.js");\n  load("staging/staging-12-pack-default-v1.js");\n  load("staging/staging-12-pack-full-suite-v1.js");')
      .replace('load("bird-photo-service-v4.js");', 'load("staging/staging-photo-service.js");')
      .replace('load("bird-photo-recovery-v2.js");', '')
      .replace('load("flock-manager-v7.js");', 'load("flock-manager-v7.js");\n  load("bird-sales-v1.js");')
      .replace('load("farm-diagnostics-v1.js");', 'load("staging/staging-diagnostics.js");')
      .replace('load("farm-diagnostics-photo-v2.js");', '')
      .replace('load("app-self-test-v1.js");', '')
      // STAGING MUST NEVER authenticate or publish the real public customer page.
      .replace('load("public-customer-owner-auth-v1.js");', '')
      .replace('load("public-customer-publisher-v1.js");', '')
      .replace('load("public-customer-bird-sales-publisher-v1.js");', '')
      .replace('load("public-customer-sync-ui-v1.js");', '');

    if (source.includes('load("bird-photo-service-v4.js")')) throw new Error("Live photo service was not isolated");
    if (source.includes('load("bird-photo-recovery-v2.js")')) throw new Error("Live photo recovery was not isolated");
    if (source.includes('load("public-customer-publisher-v1.js")')) throw new Error("Live customer publisher remained in staging");
    if (source.includes('load("public-customer-bird-sales-publisher-v1.js")')) throw new Error("Live bird sale publisher remained in staging");
    if (source.includes('load("public-customer-owner-auth-v1.js")')) throw new Error("Live customer owner auth remained in staging");
    if (!source.includes('load("staging/staging-12-pack-default-v1.js")')) throw new Error("12-pack staging layer was not injected");
    if (!source.includes('load("staging/staging-12-pack-full-suite-v1.js")')) throw new Error("12-pack full-suite staging layer was not injected");

    window.__STAGING_PUBLIC_PUBLISH_DISABLED__ = true;
    (0, eval)(`${source}\n//# sourceURL=staging-app2-runtime.js`);
    console.log("🧪 STAGING app2 active — cloud writers/public publishers isolated; 12-pack default experiment active");
  } catch (error) {
    console.error("STAGING app2 loader failed:", error);
  }
})();
