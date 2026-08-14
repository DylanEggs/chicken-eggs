import("./sync-authority-v2.js?v=2")
  .then(async () => { if (window.EggSyncAuthorityReady) await window.EggSyncAuthorityReady(); })
  .then(() => import("./bird-photo-service-v4.js?v=2"))
  .then(() => import("./flock-manager-v7.js?v=4"))
  .catch(error => console.warn("Shared farm sync/photo system failed to load:", error));