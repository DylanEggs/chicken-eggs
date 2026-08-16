(() => {
  "use strict";
  if (window.__appSelfTestV1) return;
  window.__appSelfTestV1 = true;

  function run() {
    const checks = [];
    const check = (name, pass, detail = "") => checks.push({ name, pass:!!pass, detail:String(detail || "") });
    const build = String(window.__ChickenEggsBuild || "");

    check("Current build is defined", /^\d{8}-\d+$/.test(build), build);
    check("Firebase authority exists", !!window.FarmSyncSafety?.ready, window.FarmSyncSafety?.version || "missing");
    check("InventorySystemV6 loaded", !!window.InventorySystemV6, window.InventorySystemV6?.authority || "missing");
    check("Old inventory runtime retired", window.__legacyInventoryRuntimeRetired === true, String(window.__legacyInventoryRuntimeRetired));
    check("Old farm consistency repacker retired", window.__farmConsistencyV2Retired === true, String(window.__farmConsistencyV2Retired));
    check("Old core inventory v3 not active", !window.__coreInventoryAuthorityV3, String(!!window.__coreInventoryAuthorityV3));
    check("Old core-action inventory bridge not active", !window.__coreActionInventoryBridgeV1, String(!!window.__coreActionInventoryBridgeV1));
    check("Old isolated inventory editor not active", !window.__inventoryEditorV2, String(!!window.__inventoryEditorV2));

    const inventoryTest = window.InventorySystemV6?.selfTest?.() || { pass:false, failures:["Inventory self-test unavailable"] };
    check("Inventory math self-test", inventoryTest.pass, (inventoryTest.failures || []).join(", "));

    const state = window.InventorySystemV6?.state?.();
    if (state) {
      const calculated = (Number(state.dozens)||0)*12 + (Number(state.packs18)||0)*18 + (Number(state.loose)||0);
      check("Inventory state is internally consistent", calculated === window.InventorySystemV6.total(), `${state.dozens} dozen + ${state.packs18} 18-packs + ${state.loose} loose = ${calculated}`);
      check("Inventory authority version is current", Number(state.authorityVersion) === 6, String(state.authorityVersion));
    }

    const localScripts = performance.getEntriesByType?.("resource")
      ?.map(x => String(x.name || ""))
      ?.filter(x => /chicken-eggs\/.+\.js(?:\?|$)/.test(x)) || [];
    const compatibilityOnly = /app2-legacy-v1|app-audit-legacy-v1|extras-(?:dashboard|fun)-legacy-v1|farm-consistency-v2|dom-loop-guard-v3|flock-photo-fix-v2/;
    const wrongBuild = build ? localScripts.filter(url => {
      const m = url.match(/[?&]v=([^&]+)/);
      return m && decodeURIComponent(m[1]) !== build && !compatibilityOnly.test(url);
    }) : [];
    check("Active feature scripts use one build", wrongBuild.length === 0, wrongBuild.slice(0,8).join(" | "));

    const failed = checks.filter(x => !x.pass);
    const result = {
      version:"1.1",
      generatedAt:new Date().toISOString(),
      build,
      pass:failed.length===0,
      checks,
      failed:failed.map(x => x.name)
    };
    window.AppSelfTestV1 = { run, result };
    window.__appSelfTestResultV1 = result;
    window.dispatchEvent(new CustomEvent("app-self-test-complete", { detail:result }));
    console[result.pass ? "log" : "error"]("Chicken Eggs app self-test", result);
    return result;
  }

  const start = () => setTimeout(run, 3200);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
