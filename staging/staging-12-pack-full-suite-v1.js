(() => {
  "use strict";
  if (window.__StagingTwelvePackFullSuiteV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingTwelvePackFullSuiteV1 = true;

  const obsoleteNames = new Set([
    "Exact carton inventory saves",
    "Egg collection adds loose eggs only",
    "Editing collection applies only the +2 inventory delta",
    "Deleting collection reverses its inventory effect",
    "Dozen + 18-pack sale removes matching sealed cartons",
    "Deleting sale restores dozen and 18-pack",
    "$5 egg sale reduces physical inventory by 12 eggs",
    "Deleting test sale restores the dozen to inventory",
    "V3 exact mixed inventory starts at 47 eggs",
    "Two same-day collections add exactly 7 loose eggs",
    "Editing second collection from 4 to 6 adds only 2 eggs",
    "Deleting first collection reverses only its 3 eggs",
    "Deleting edited second collection restores original 47-egg inventory",
    "Mixed dozen + 18-pack sale removes one of each",
    "Editing sale restores old packages before subtracting new packages",
    "Deleting edited sale restores exact pre-sale mixed inventory"
  ]);

  function install() {
    const base = window.StagingFullTest;
    const twelve = window.StagingTwelvePackRegressionV1;
    const ready = base?.run && twelve?.run &&
      base.__deepV3 && base.__reservationV2 && base.__birdSalesV1 &&
      base.__funRaceRegressionV1 && base.__completeBackupRegressionV1 &&
      base.__crossDeviceSyncRegressionV1;
    if (!ready || base.__twelvePackFullSuiteV1) {
      setTimeout(install, 120);
      return;
    }

    const baseRun = base.run.bind(base);
    window.StagingFullTest = {
      ...base,
      async run() {
        const first = await baseRun();
        const kept = (first?.results || []).filter(x => !obsoleteNames.has(String(x?.name || "")));
        const twelveReport = await twelve.run();
        const replacements = (twelveReport?.results || []).map(x => ({
          ...x,
          name: `12-pack rule: ${x.name}`
        }));
        const results = [...kept, ...replacements];
        const failed = results.filter(x => !x.pass);
        const report = {
          ...first,
          total: results.length,
          passed: results.length - failed.length,
          failed: failed.length,
          results,
          suite: `${first?.suite || "staging-full"}+12-pack-full-v1`,
          replacedLegacyLooseChecks: obsoleteNames.size
        };
        try { localStorage.setItem("chickenEggStagingFullTest12PackV1", JSON.stringify(report)); } catch {}
        return report;
      },
      last: () => {
        try { return JSON.parse(localStorage.getItem("chickenEggStagingFullTest12PackV1") || "null") || base.last?.() || null; }
        catch { return base.last?.() || null; }
      },
      __twelvePackFullSuiteV1: true
    };
    console.log("📦 STAGING full suite updated: legacy visible-loose expectations replaced by 12-pack-default checks");
  }

  setTimeout(install, 2200);
})();
