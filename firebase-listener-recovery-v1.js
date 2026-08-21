(() => {
  "use strict";
  if (window.__firebaseListenerRecoveryV1) return;
  if (window.__ChickenEggsStagingMode) return;
  window.__firebaseListenerRecoveryV1 = true;

  const SESSION_KEY = "chickenEggFirebaseListenerRecoveryV1";
  const MAX_WINDOW_MS = 10 * 60 * 1000;
  const RELOAD_COOLDOWN_MS = 30000;
  const BACKOFF = [5000, 15000, 30000, 60000, 120000, 300000];

  let timer = null;
  let probing = false;
  let attempt = 0;

  function statusText() {
    return String(document.getElementById("syncStatus")?.textContent || "").trim();
  }

  function isReconnectState() {
    return /reconnecting|sync paused|retrying|live sync paused|waiting for firebase/i.test(statusText());
  }

  function readSession() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeSession(value) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }

  function schedule(delay) {
    clearTimeout(timer);
    if (!navigator.onLine || !isReconnectState()) return;
    const wait = Number.isFinite(Number(delay)) ? Number(delay) : BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
    timer = setTimeout(() => void probeAndRecover("status"), Math.max(1000, wait));
  }

  async function probeAndRecover(reason = "status") {
    if (probing || !navigator.onLine || !isReconnectState()) return false;
    probing = true;
    try {
      const db = window.FirestoreDB;
      if (!db) throw new Error("Firestore is not ready");
      const f = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
      const probe = f.getDoc(f.doc(db, "farm", "core_signal_v1"));
      await Promise.race([
        probe,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase recovery probe timed out")), 8000))
      ]);

      // Firebase is reachable again, but an onSnapshot error permanently closes
      // that listener. Reload once so the existing v10 sync engine recreates all
      // three scoped listeners from a clean state.
      const now = Date.now();
      const prior = readSession();
      const windowStart = Number(prior.windowStart) || now;
      const insideWindow = now - windowStart < MAX_WINDOW_MS;
      const count = insideWindow ? (Number(prior.count) || 0) : 0;
      const lastReload = insideWindow ? (Number(prior.lastReload) || 0) : 0;

      if (lastReload && now - lastReload < RELOAD_COOLDOWN_MS) {
        schedule(RELOAD_COOLDOWN_MS - (now - lastReload));
        return true;
      }

      if (count >= 2) {
        // Never create an uncontrolled reload loop. At this point Firebase itself
        // answered successfully, so leave the app usable and surface a clear state.
        try { window.setSyncStatus?.("Firebase available • reconnecting app safely"); } catch {}
        schedule(120000);
        return true;
      }

      writeSession({
        windowStart: insideWindow ? windowStart : now,
        count: count + 1,
        lastReload: now,
        reason,
        build: String(window.__ChickenEggsBuild || "")
      });
      try { window.setSyncStatus?.("Firebase available • reconnecting app safely"); } catch {}
      setTimeout(() => location.reload(), 350);
      return true;
    } catch (error) {
      attempt += 1;
      console.warn("Firebase listener recovery probe waiting:", error);
      schedule();
      return false;
    } finally {
      probing = false;
    }
  }

  function observeStatus() {
    const el = document.getElementById("syncStatus");
    if (!el) {
      setTimeout(observeStatus, 500);
      return;
    }
    const observer = new MutationObserver(() => {
      if (isReconnectState()) schedule(2500);
      else if (/firebase synced/i.test(statusText())) {
        attempt = 0;
        clearSession();
        clearTimeout(timer);
      }
    });
    observer.observe(el, { childList:true, subtree:true, characterData:true });
    if (isReconnectState()) schedule(2500);
  }

  window.addEventListener("online", () => {
    if (isReconnectState()) schedule(1200);
  });
  window.addEventListener("farm-sync-ready", () => {
    attempt = 0;
    clearSession();
    clearTimeout(timer);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeStatus, { once:true });
  else observeStatus();

  window.FirebaseListenerRecoveryV1 = {
    version: 1,
    probeNow: () => probeAndRecover("manual"),
    isReconnectState,
    statusText
  };

  console.log("✅ Firebase listener recovery v1 active — dead listeners self-heal after Firebase returns");
})();
