import("./sync-authority-v1.js?v=1")
  .then(() => import("./bird-photo-service-v4.js?v=1"))
  .then(() => import("./flock-manager-v7.js?v=3"))
  .catch(error => console.warn("Shared farm sync/photo system failed to load:", error));