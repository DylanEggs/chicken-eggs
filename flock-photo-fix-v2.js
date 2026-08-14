import("./bird-photo-service-v3.js?v=2")
  .then(() => import("./bird-photo-fallback-v1.js?v=2"))
  .then(() => import("./flock-manager-v7.js?v=2"))
  .catch(error => console.warn("Shared flock photo system failed to load:", error));