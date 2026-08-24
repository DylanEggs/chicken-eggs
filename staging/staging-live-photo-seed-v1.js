(() => {
  "use strict";
  if (window.__ChickenEggsStagingLivePhotoSeedV1) return;
  window.__ChickenEggsStagingLivePhotoSeedV1 = true;

  const CACHE = "chickenEggLocalBirdPhotosV1";
  const image = value => typeof value === "string" && (value.startsWith("data:image/") || /^https?:\/\//i.test(value));
  const photos = Object.create(null);

  try {
    // This script runs before staging-storage.js replaces localStorage access.
    // It reads the LIVE browser photo cache once into memory only. Nothing is
    // copied into staging localStorage and absolutely nothing is written to LIVE.
    const raw = localStorage.getItem(CACHE);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") {
      for (const [id, src] of Object.entries(parsed)) {
        if (id && image(src)) photos[String(id)] = src;
      }
    }
  } catch (error) {
    console.warn("STAGING live photo seed unavailable:", error);
  }

  window.__StagingLiveBirdPhotoSnapshotV1 = photos;
  window.StagingLivePhotoSeedV1 = {
    version:1,
    count:()=>Object.keys(photos).length,
    get:id=>photos[String(id || "")] || "",
    firebaseReads:0,
    firebaseWrites:0,
    liveWrites:0
  };

  console.log(`🖼️ STAGING captured ${Object.keys(photos).length} LIVE browser flock photos read-only into memory`);
})();
