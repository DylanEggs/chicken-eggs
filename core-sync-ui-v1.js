(() => {
  "use strict";
  if (window.__coreSyncUiV1) return;
  window.__coreSyncUiV1 = true;

  let farmReady = false;
  let lastText = "";

  function normalizeStatus(value) {
    const text = String(value || "").trim();
    const lower = text.toLowerCase();

    if (!text) return "";
    if (/offline/.test(lower)) return "Offline — local data shown";
    if (/saved on this device/.test(lower)) return "Saved on this device • waiting for Firebase";
    if (/failed|unavailable|sync paused|retrying|still retrying|live sync paused/.test(lower)) return "Firebase reconnecting…";
    if (/protected farm data|stale-device overwrite/.test(lower)) return "Farm data protected • Firebase synced";
    if (/egg history refresh pending/.test(lower)) return "Farm synced • egg history refreshing";
    if (/loading|checking|connecting|finishing firebase|waiting for sync|internet returned/.test(lower)) return "Connecting to Firebase…";
    if (/firebase synced|firebase updated|firebase loaded|saved to firebase|farm synced|entry deleted from firebase|all entries deleted from firebase/.test(lower)) return "Firebase synced";
    return text;
  }

  window.setSyncStatus = function setSyncStatusStable(value) {
    let next = normalizeStatus(value);
    if (!next) return;

    // Once the protected bootstrap has completed, ignore late "checking/loading"
    // messages from any older code still finishing its startup callback.
    if (farmReady && next === "Connecting to Firebase…") next = "Firebase synced";

    if (next === lastText) return;
    const el = document.getElementById("syncStatus");
    if (el && el.textContent !== next) el.textContent = next;
    lastText = next;
  };

  // script.js used to start its own collection-wide Firestore listener at
  // DOMContentLoaded. Protected Firebase already owns that live listener, so a
  // second listener only caused duplicate renders and alternating status text.
  window.startEntryListener = async function protectedCoreListenerAuthority() {
    return null;
  };

  // script.js also calls cloudLoad() at DOMContentLoaded. Make that call join the
  // protected cloud-first bootstrap rather than launching a second startup read.
  window.cloudLoad = async function protectedCoreCloudLoad() {
    window.setSyncStatus("Connecting to Firebase…");
    const started = Date.now();
    while (Date.now() - started < 22000) {
      if (window.FarmSyncSafety?.ready) {
        try {
          await window.FarmSyncSafety.ready();
          return true;
        } catch {
          return false;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    return false;
  };

  window.addEventListener("farm-sync-ready", () => {
    farmReady = true;
    window.setSyncStatus("Firebase synced");
  });

  window.addEventListener("farm-sync-protected", () => {
    farmReady = true;
    window.setSyncStatus("Farm data protected • Firebase synced");
  });

  console.log("✅ Core sync UI authority active — one live listener and stable status text");
})();
