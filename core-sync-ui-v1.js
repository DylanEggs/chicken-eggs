(() => {
  "use strict";
  if (window.__coreSyncUiV2) return;
  window.__coreSyncUiV2 = true;
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
    if (/loading|checking|connecting|finishing firebase|waiting for sync|internet returned/.test(lower)) return "Connecting to Firebase…";
    if (/firebase synced|firebase updated|firebase loaded|saved to firebase|farm synced|egg history refresh pending|entry deleted from firebase|all entries deleted from firebase/.test(lower)) return "Firebase synced";
    return text;
  }

  window.setSyncStatus = function setSyncStatusStable(value) {
    let next = normalizeStatus(value);
    if (!next) return;

    // After protected bootstrap, all successful background reads/writes use one
    // stable label. Only a true offline/retry/protection state is allowed to
    // change the header, so harmless refreshes cannot make it twitch.
    if (farmReady && (next === "Connecting to Firebase…" || next === "Firebase synced")) {
      next = "Firebase synced";
    }

    if (next === lastText) return;
    const el = document.getElementById("syncStatus");
    if (el && el.textContent !== next) el.textContent = next;
    lastText = next;
  };

  // script.js used to start a second collection-wide Firestore listener. The
  // protected engine is now the sole core listener.
  window.startEntryListener = async function protectedCoreListenerAuthority() {
    return null;
  };

  // script.js also calls cloudLoad at DOMContentLoaded. Join the protected
  // bootstrap instead of launching another independent startup read/status loop.
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

  console.log("✅ Core sync UI v2 active — one listener and stable status text");
})();
