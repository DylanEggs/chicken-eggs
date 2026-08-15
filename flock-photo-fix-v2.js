// Keep the legacy sync-compat shim available for older modules, but do not
// wait for Firebase before loading the flock/photo UI. Local photos and photo
// buttons must remain usable even while cloud sync is reconnecting.
import("./sync-authority-v2.js?v=3")
  .catch(error => console.warn("Protected farm sync compatibility failed to load:", error));

import("./bird-photo-service-v4.js?v=3")
  .then(() => import("./flock-manager-v7.js?v=5"))
  .catch(error => console.warn("Shared flock photo system failed to load:", error));
