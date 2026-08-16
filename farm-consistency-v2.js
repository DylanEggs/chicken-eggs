(() => {
  "use strict";
  // Retired compatibility file. Older Firebase generations may still request it,
  // but it must never rewrite physical inventory or wrap core egg actions again.
  window.__farmConsistencyV2Retired = true;
  console.log("✅ Obsolete farm-consistency inventory repacker retired");
})();
