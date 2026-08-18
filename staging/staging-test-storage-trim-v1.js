(() => {
  "use strict";
  if (window.__StagingTestStorageTrimV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingTestStorageTrimV1 = true;

  const PHOTO_CACHE = "chickenEggLocalBirdPhotosV1";
  const PHOTO_META4 = "chickenEggBirdPhotoMetaV4";
  const PHOTO_META3 = "chickenEggBirdPhotoMetaV3";
  const PHOTO_QUEUE = "chickenEggBirdPhotoQueueV3";
  const DELUXE = "chickenEggDeluxeV1";
  let trimmed = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function trim() {
    if (trimmed) return;
    trimmed = true;
    const oldRemote = window.__farmApplyingRemote;
    window.__farmApplyingRemote = true;
    try {
      // The torture suite tests photo add/remove with its own tiny fixtures.
      // Keeping every full-resolution live flock photo in the isolated staging
      // copy only wastes browser quota and can make restore tests fail for the
      // wrong reason. This never touches live Firebase or the live app keys.
      localStorage.removeItem(PHOTO_CACHE);
      localStorage.removeItem(PHOTO_META4);
      localStorage.removeItem(PHOTO_META3);
      localStorage.removeItem(PHOTO_QUEUE);

      const deluxe = read(DELUXE, null);
      if (deluxe && typeof deluxe === "object" && deluxe.birdPhotoUrls) {
        localStorage.setItem(DELUXE, JSON.stringify({ ...deluxe, birdPhotoUrls:{} }));
      }
    } finally {
      window.__farmApplyingRemote = oldRemote;
    }
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail:{ staging:true, testStorageTrim:true } }));
    console.log("🧪 STAGING test storage trimmed — live photo bytes omitted from sandbox torture runs");
  }

  window.StagingTestStorageTrimV1 = { trim, isTrimmed:() => trimmed };
  window.addEventListener("farm-sync-ready", () => setTimeout(trim, 60));
  [1800, 3200].forEach(ms => setTimeout(() => {
    if (window.FarmSyncSafety?.isReady?.()) trim();
  }, ms));
})();
