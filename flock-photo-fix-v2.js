import("./bird-photo-service-v3.js?v=1")
  .then(() => import("./flock-manager-v7.js?v=1"))
  .catch(error => console.warn("Shared flock photo system failed to load:", error));