import("./bird-photo-service-v2.js?v=1")
  .then(() => import("./flock-manager-v6.js?v=1"))
  .catch(error => console.warn("Flock Manager compatibility loader failed:", error));