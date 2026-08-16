(() => {
  "use strict";
  // Current app2.js loads Bird Photo Service v4, recovery v2 and Flock Manager v7
  // directly with the live build. This file is kept only for old cached Firebase
  // imports and must not load a second generation of those modules.
  window.__flockPhotoFixV2Retired = true;
  console.log("✅ Duplicate flock-photo compatibility loader retired");
})();
