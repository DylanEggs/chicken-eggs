(() => {
  "use strict";
  // Keep the original Farm App 2 code intact as a legacy module, then load the
  // physical-inventory authority immediately after it. document.write is used
  // here intentionally because app2.js is parser-loaded and the legacy script
  // must execute before the rest of the app continues.
  document.write('<script src="app2-legacy-v1.js?v=20260814-1"><\/script>');
  document.write('<script src="inventory-packaging-display-v2.js?v=20260814-1"><\/script>');
})();
