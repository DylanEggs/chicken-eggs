(() => {
  "use strict";
  // Retained only because older cached app shells may still request inventory.js.
  // InventorySystemV6 is the sole active physical-inventory authority.
  window.__legacyInventoryRuntimeRetired = true;
  console.log("✅ Legacy inventory.js retired; InventorySystemV6 owns inventory");
})();
