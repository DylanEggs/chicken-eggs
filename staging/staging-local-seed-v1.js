(() => {
  "use strict";
  if (window.__ChickenEggsStagingLocalSeedV1) return;
  window.__ChickenEggsStagingLocalSeedV1 = true;

  const PREFIX = "__chicken_eggs_staging__::";
  const COMPACT_KEYS = [
    "chickenEggApp2V1",
    "chickenEggInventoryV2",
    "chickenEggSettingsV102",
    "chickenEggBusinessV1",
    "chickenEggDeluxeV1",
    "chickenEggWeatherIntelligenceV2"
  ];
  const CORE = ["chickenEggApp2V1", "chickenEggInventoryV2"];
  const stageKey = key => PREFIX + key;

  function hasStagingCore() {
    return CORE.some(key => {
      try { return !!localStorage.getItem(stageKey(key)); }
      catch { return false; }
    });
  }

  function copyCompactLiveBrowserState() {
    if (hasStagingCore()) return { copied:0, alreadyReady:true };
    let copied = 0;
    for (const key of COMPACT_KEYS) {
      try {
        const value = localStorage.getItem(key);
        if (value == null) continue;
        // Avoid duplicating unexpectedly huge values into staging storage.
        if (String(value).length > 350000) continue;
        localStorage.setItem(stageKey(key), value);
        copied += 1;
      } catch (error) {
        console.warn("STAGING compact local seed skipped", key, error);
      }
    }
    try {
      if (copied > 0) {
        localStorage.setItem(stageKey("chickenEggStagingSeedV1"), JSON.stringify({
          completed:true,
          importedAt:Date.now(),
          coreEntries:0,
          photos:0,
          fullCoreRefresh:false,
          source:"compact same-browser LIVE copy; zero Firebase reads",
          localSeed:true,
          copiedKeys:copied
        }));
      }
    } catch {}
    return { copied, alreadyReady:false };
  }

  const result = copyCompactLiveBrowserState();
  window.StagingLocalSeedV1 = { version:1, hasStagingCore, copyCompactLiveBrowserState, result };
  console.log(`🧪 STAGING local seed ready — ${result.copied || 0} compact live-browser keys copied; 0 Firebase reads`);
})();
