(() => {
  "use strict";
  if (window.FarmPublicBirdSalesPublisherV1) return;

  const OWNER_UID = "aLvjMpXgMJf5W3YUjQM6wqKagLo2";
  const APP2_KEY = "chickenEggApp2V1";
  const HASH_KEY = "chickenEggPublicBirdSalesHashV1";
  const DOC_ID = "bird_sales";
  let api = null;
  let timer = null;
  let running = false;
  let lastResult = null;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }
  function stable(value) {
    try { return JSON.stringify(value); } catch { return ""; }
  }
  function hash(value) {
    const text = stable(value);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  function mainReady() { return !!window.FarmSyncSafety?.isReady?.(); }
  function photoResolver(id) {
    const svc = window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;
    try {
      const src = svc?.get?.(String(id || ""));
      return typeof src === "string" ? src : "";
    } catch { return ""; }
  }
  async function firestoreApi() {
    if (api) return api;
    api = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return api;
  }
  async function ownerContext() {
    if (window.PublicCustomerOwnerAuth?.currentOwner) {
      const user = await window.PublicCustomerOwnerAuth.currentOwner();
      if (user && String(user.uid || "") === OWNER_UID) {
        const db = await window.PublicCustomerOwnerAuth.publisherDb?.();
        if (db) return { user, db, source:"isolated-public-owner" };
      }
    }
    if (window.FarmOwnerAuth?.requireSignIn) {
      const user = await window.FarmOwnerAuth.requireSignIn();
      if (user && String(user.uid || "") === OWNER_UID && window.FirestoreDB) return { user, db:window.FirestoreDB, source:"farm-owner" };
    }
    const user = window.FirebaseUser;
    return user && !user.isAnonymous && String(user.uid || "") === OWNER_UID && window.FirestoreDB
      ? { user, db:window.FirestoreDB, source:"farm-owner-current" }
      : null;
  }
  function build() {
    const builder = window.FarmPublicCustomerBuilderV3;
    if (!builder?.listings) throw new Error("Bird sale sanitizer is not ready");
    return builder.listings(read(APP2_KEY, {}), photoResolver);
  }
  async function publishNow(reason = "manual") {
    if (running) return lastResult || { ok:false, busy:true };
    if (!mainReady()) return { ok:false, waiting:true, reason:"farm-sync-not-ready" };
    running = true;
    try {
      const owner = await ownerContext();
      if (!owner) throw new Error("Authorized owner publishing session required before bird listings can sync");
      const rows = build();
      const nextHash = hash(rows);
      const oldHash = String(localStorage.getItem(HASH_KEY) || "");
      if (oldHash === nextHash) {
        lastResult = { ok:true, writes:0, reason, listings:rows.length, authSource:owner.source, unchanged:true };
        return lastResult;
      }
      const f = await firestoreApi();
      await f.setDoc(f.doc(owner.db, "public_customer", DOC_ID), {
        schema:"customer-bird-sales-v1",
        publicVersion:1,
        listingCount:rows.length,
        listings:rows,
        publishedAt:Date.now(),
        serverUpdatedAt:f.serverTimestamp()
      });
      try { localStorage.setItem(HASH_KEY, nextHash); } catch {}
      lastResult = { ok:true, writes:1, reason, listings:rows.length, authSource:owner.source, publishedAt:Date.now() };
      window.dispatchEvent(new CustomEvent("customer-bird-sales-published", { detail:lastResult }));
      return lastResult;
    } catch (error) {
      lastResult = { ok:false, reason, error:String(error?.message || error) };
      console.warn("Customer bird sale publish waiting:", error);
      return lastResult;
    } finally { running = false; }
  }
  function schedule(reason = "event", delay = 500) {
    if (!mainReady()) return false;
    clearTimeout(timer);
    timer = setTimeout(() => void publishNow(reason), delay);
    return true;
  }
  function install() {
    window.addEventListener("bird-sale-listings-changed", () => schedule("bird-sale-listings-changed", 250));
    window.addEventListener("bird-photos-changed", event => {
      if (String(event.detail?.birdId || "").startsWith("bird-sale-")) schedule("bird-sale-photo-changed", 350);
    });
    window.addEventListener("farm-data-synced", event => {
      if (event.detail?.key === APP2_KEY) schedule("bird-sale-app2-synced", 650);
    });
    window.addEventListener("public-customer-owner-auth-changed", event => {
      if (event.detail?.connected) schedule("owner-auth-connected", 150);
    });
    window.addEventListener("customer-public-published", () => schedule("main-customer-published", 200));
    window.addEventListener("online", () => schedule("online", 900));
  }

  window.FarmPublicBirdSalesPublisherV1 = { version:1, buildPreview:build, publishNow, schedule, last:()=>lastResult };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once:true });
  else install();
})();
