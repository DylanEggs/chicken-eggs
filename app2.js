(() => {
  "use strict";
  // Keep Farm App 2 intact, then load one quiet physical-inventory hub authority.
  // The authority is event-driven and never watches/re-writes its own DOM changes.
  document.write('<script src="app2-legacy-v1.js?v=20260814-1"><\/script>');
  document.write('<script src="inventory-packaging-display-v2.js?v=20260814-2"><\/script>');
})();
