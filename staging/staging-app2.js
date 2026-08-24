(() => {
  "use strict";
  if (window.__ChickenEggsStagingApp2Loader) return;
  window.__ChickenEggsStagingApp2Loader = true;

  try {
    const build = String(window.__ChickenEggsBuild || Date.now());
    const stageBuild = String(window.__ChickenEggsStagingBuild || Date.now());
    const runtimeBuild = `${build}-${stageBuild}`;
    const rootUrl = new URL("../app2.js", document.currentScript?.src || location.href);
    rootUrl.searchParams.set("v", build);
    const xhr = new XMLHttpRequest();
    xhr.open("GET", rootUrl.href, false);
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) throw new Error(`app2 HTTP ${xhr.status}`);

    let source = String(xhr.responseText || "");
    if (!source.includes('load("inventory-system-v6.js")')) throw new Error("Current app2 loader signature not found");

    source = source.replace(
      /const BUILD = String\(window\.__ChickenEggsBuild \|\| "[^"]+"\);/,
      `const BUILD = ${JSON.stringify(runtimeBuild)};`
    );

    source = source.replace('load("storage-health-v1.js");', 'load("staging/staging-storage-health-v1.js");');

    if (source.includes('load("twelve-pack-default-v1.js");')) {
      source = source.replace('load("twelve-pack-default-v1.js");', 'load("staging/staging-12-pack-default-v1.js");\n  load("staging/staging-12-pack-full-suite-v1.js");\n  load("staging/staging-sale-edit-back-regression-v1.js");');
    } else {
      source = source.replace('load("inventory-system-v6.js");', 'load("inventory-system-v6.js");\n  load("staging/staging-12-pack-default-v1.js");\n  load("staging/staging-12-pack-full-suite-v1.js");\n  load("staging/staging-sale-edit-back-regression-v1.js");');
    }

    const requestStack='load("staging/staging-customer-requests-live-parity-v1.js");\n  load("staging/staging-customer-requests-parity-compat-v1.js");\n  load("staging/staging-customer-request-status-test-v1.js");\n  load("staging/staging-customer-requests-regression-v1.js");\n  load("staging/staging-test-ready-gate-v1.js");\n  load("staging/staging-test-memory-runner-v1.js");\n  load("staging/staging-app-polish-refresh-v1.js");';
    if (source.includes('load("history-back-v1.js");')) {
      source = source.replace('load("history-back-v1.js");', `load("history-back-v1.js");\n  ${requestStack}`);
    } else {
      source = source.replace('load("app2-legacy-safe-loader-v1.js");', `load("app2-legacy-safe-loader-v1.js");\n  ${requestStack}`);
    }

    source = source
      .replace('load("sale-edit-back-v1.js");', '')
      .replace('load("receipts-expenses-v1.js");', '')
      .replace('load("bird-photo-service-v4.js");', 'load("staging/staging-photo-service.js");')
      .replace('load("bird-photo-recovery-v2.js");', '')
      .replace('load("flock-manager-v7.js");', 'load("flock-manager-v7.js");\n  load("bird-sales-v1.js");')
      .replace('load("farm-diagnostics-v1.js");', 'load("staging/staging-diagnostics.js");')
      .replace('load("farm-diagnostics-photo-v2.js");', '')
      .replace('load("app-self-test-v1.js");', '')
      .replace('load("customer-requests-owner-v1.js");', '')
      .replace('load("public-customer-owner-auth-v1.js");', '')
      .replace('load("public-customer-publisher-v1.js");', '')
      .replace('load("public-customer-bird-sales-publisher-v1.js");', '')
      .replace('load("public-customer-sync-ui-v1.js");', '');

    if (source.includes('load("storage-health-v1.js")')) throw new Error("Live storage health remained in staging");
    if (!source.includes('load("staging/staging-storage-health-v1.js")')) throw new Error("Staging-safe storage health was not injected");
    if (source.includes('load("receipts-expenses-v1.js")')) throw new Error("Live receipts module remained duplicated in staging");
    if (source.includes('load("staging/staging-customer-requests-owner-v1.js")')) throw new Error("Old homemade staging Customer Requests UI remained loaded");
    if (source.includes('load("customer-requests-owner-v1.js")')) throw new Error("Live Customer Requests owner module remained directly connected in staging");
    if (source.includes('load("sale-edit-back-v1.js")')) throw new Error("Live sale edit back module remained in staging");
    if (source.includes('load("bird-photo-service-v4.js")')) throw new Error("Live photo service was not isolated");
    if (source.includes('load("bird-photo-recovery-v2.js")')) throw new Error("Live photo recovery was not isolated");
    if (source.includes('load("public-customer-publisher-v1.js")')) throw new Error("Live customer publisher remained in staging");
    if (source.includes('load("public-customer-bird-sales-publisher-v1.js")')) throw new Error("Live bird sale publisher remained in staging");
    if (source.includes('load("public-customer-owner-auth-v1.js")')) throw new Error("Live customer owner auth remained in staging");
    if (source.includes('load("twelve-pack-default-v1.js")')) throw new Error("Live 12-pack module remained in staging");
    if (!source.includes('load("staging/staging-12-pack-default-v1.js")')) throw new Error("12-pack staging layer was not injected");
    if (!source.includes('load("staging/staging-12-pack-full-suite-v1.js")')) throw new Error("12-pack full-suite staging layer was not injected");
    if (!source.includes('load("staging/staging-sale-edit-back-regression-v1.js")')) throw new Error("Sale edit return staging regression was not injected");
    if (!source.includes('load("staging/staging-customer-requests-live-parity-v1.js")')) throw new Error("Live-parity Customer Requests owner layer was not injected");
    if (!source.includes('load("staging/staging-customer-requests-parity-compat-v1.js")')) throw new Error("Customer Requests parity test bridge was not injected");
    if (!source.includes('load("staging/staging-customer-request-status-test-v1.js")')) throw new Error("Customer Requests status parity helper was not injected");
    if (!source.includes('load("staging/staging-customer-requests-regression-v1.js")')) throw new Error("Customer Requests regression was not injected");
    if (!source.includes('load("staging/staging-test-ready-gate-v1.js")')) throw new Error("Final staging test readiness gate was not injected");
    if (!source.includes('load("staging/staging-test-memory-runner-v1.js")')) throw new Error("In-memory staging test runner was not injected");
    if (!source.includes('load("staging/staging-app-polish-refresh-v1.js")')) throw new Error("Staging app-polish refresh bridge was not injected");

    window.__STAGING_PUBLIC_PUBLISH_DISABLED__ = true;
    (0, eval)(`${source}\n//# sourceURL=staging-app2-runtime.js`);
    console.log(`🧪 STAGING app2 active — build ${runtimeBuild}; live Customer Requests UI runs only through sandbox adapters; Customer Preview guard is loaded once by the staging shell; full torture suite uses an in-memory storage overlay`);
  } catch (error) {
    console.error("STAGING app2 loader failed:", error);
  }
})();
