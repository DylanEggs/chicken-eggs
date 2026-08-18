(() => {
  "use strict";
  if (window.__StagingWriteProbeUiV1) return;
  if (!window.__ChickenEggsStagingMode || window.__ChickenEggsStagingOwnerMode) return;
  window.__StagingWriteProbeUiV1 = true;

  function inject() {
    const row = document.querySelector("#stagingSafetyBanner .st-row");
    if (!row) { setTimeout(inject, 120); return; }
    if (document.getElementById("stagingFirebaseWriteProbe")) return;

    const btn = document.createElement("button");
    btn.id = "stagingFirebaseWriteProbe";
    btn.type = "button";
    btn.textContent = "🔬 Test Firebase Write";
    btn.style.background = "#eef2ff";
    btn.style.color = "#3730a3";
    btn.style.borderColor = "#c7d2fe";
    row.appendChild(btn);

    btn.addEventListener("click", async () => {
      const ok = confirm(
        "Run a temporary Firebase WRITE diagnostic?\n\n" +
        "This creates ONE temporary document in the separate sync_diagnostics collection, " +
        "tests a normal write and transaction, then deletes it and verifies it is gone.\n\n" +
        "It does NOT touch eggs, inventory, flock, customers, sales, photos, or customer-page data."
      );
      if (!ok) return;

      btn.disabled = true;
      btn.textContent = "Testing Firebase write…";
      try {
        const api = window.StagingLiveFirebaseWriteProbeV1;
        if (!api?.run) throw new Error("Firebase write probe has not loaded yet. Refresh staging and try again.");
        const result = await api.run();
        window.__lastStagingFirebaseWriteProbe = result;
        if (result?.ok) {
          alert(
            `✅ Firebase WRITE diagnostic passed.\n\n` +
            `Normal write: PASS\nTransaction: PASS\nDelete/cleanup: PASS\n` +
            `Anonymous session: ${result.anonymous ? "YES" : "NO"}\n` +
            `Time: ${result.elapsedMs} ms\n\n` +
            `No farm data was changed.`
          );
        } else {
          alert(
            `❌ Firebase WRITE diagnostic failed.\n\n` +
            `Code: ${result?.code || "none"}\n` +
            `Error: ${result?.message || "Unknown Firebase error"}\n` +
            `Time: ${result?.elapsedMs || 0} ms\n\n` +
            `The temporary diagnostic document was cleaned up if it had been created. Farm data was not touched.`
          );
        }
      } catch (error) {
        alert(`❌ Firebase WRITE diagnostic could not run.\n\n${String(error?.message || error)}\n\nFarm data was not touched.`);
      } finally {
        btn.disabled = false;
        btn.textContent = "🔬 Test Firebase Write";
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject, { once:true });
  else inject();
})();
