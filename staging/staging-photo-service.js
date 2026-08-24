(() => {
  "use strict";
  if (window.__ChickenEggsStagingPhotoService) return;
  window.__ChickenEggsStagingPhotoService = true;

  const APP = "chickenEggApp2V1";
  const CACHE = "chickenEggLocalBirdPhotosV1";
  const listeners = new Set();
  const publicPhotos = new Map();
  const testPhotos = new Map();
  const removedPhotos = new Set();
  let publicHydratePromise = null;
  let publicHydrated = false;

  // Full-frame high-quality test profile. Do not square-crop chicken portraits.
  // Staging edits stay memory-only, so we can test genuinely sharp images without
  // bloating localStorage or touching LIVE. The final step remains comfortably
  // below a Firestore document-sized payload if this profile is later promoted.
  const PHOTO_PROFILE = Object.freeze({
    targetMaxEdge:1280,
    targetQuality:.92,
    maxDataUrlChars:700000,
    cropMode:"none",
    steps:Object.freeze([
      Object.freeze({maxEdge:1280,quality:.92}),
      Object.freeze({maxEdge:1200,quality:.90}),
      Object.freeze({maxEdge:1080,quality:.89}),
      Object.freeze({maxEdge:960,quality:.88}),
      Object.freeze({maxEdge:840,quality:.86}),
      Object.freeze({maxEdge:720,quality:.84})
    ])
  });

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const image = v => typeof v === "string" && (v.startsWith("data:image/") || /^https?:\/\//i.test(v));
  const liveBrowserPhoto = id => {
    const src = window.StagingLivePhotoSeedV1?.get?.(id) || window.__StagingLiveBirdPhotoSnapshotV1?.[String(id || "")];
    return image(src) ? src : "";
  };

  function installDisplayCss() {
    if (document.getElementById("stagingSharpPhotoDisplayV1")) return;
    const style=document.createElement("style");
    style.id="stagingSharpPhotoDisplayV1";
    style.textContent=`
      .farm-flock-photo-v7,
      #farm2BirdPhotoPreviewV7 img,
      .xphoto img{
        object-fit:contain!important;
        object-position:center center!important;
        background:rgba(31,122,58,.08)!important;
      }
      .farm-flock-photo-v7{
        width:104px!important;
        height:118px!important;
      }
      #farm2BirdPhotoPreviewV7{
        width:96px!important;
        height:112px!important;
      }
      .xphoto img,.xphoto .xph{
        width:112px!important;
        height:132px!important;
        flex:0 0 auto!important;
      }
      @media(max-width:430px){
        .farm-flock-photo-v7{width:98px!important;height:112px!important}
        .xphoto img,.xphoto .xph{width:104px!important;height:124px!important}
      }
    `;
    document.head.appendChild(style);
  }
  installDisplayCss();

  function notify(id) {
    for (const fn of listeners) { try { fn({ birdId:id, staging:true }); } catch {} }
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail:{ birdId:id, staging:true } }));
  }

  function get(id) {
    id = String(id || "");
    if (!id || removedPhotos.has(id)) return "";

    // A freshly selected STAGING photo always wins.
    const staged = testPhotos.get(id);
    if (image(staged)) return staged;

    // Prefer the current same-device LIVE/public sources over an old tiny staging
    // thumbnail so stale 168px test copies cannot make the new UI look blurry.
    const liveLocal = liveBrowserPhoto(id);
    if (liveLocal) return liveLocal;

    const publicSrc = publicPhotos.get(id);
    if (image(publicSrc)) return publicSrc;

    // Last-resort compatibility only for an older staging-only photo.
    const legacyStage = read(CACHE, {})[id];
    return image(legacyStage) ? legacyStage : "";
  }

  function encodePhoto(img, maxEdge, quality) {
    const w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    if (!w || !h) return "";
    const scale=Math.min(1,Number(maxEdge||1280)/Math.max(w,h));
    const width=Math.max(1,Math.round(w*scale));
    const height=Math.max(1,Math.round(h*scale));
    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext("2d",{alpha:false});
    if (!ctx) return "";
    ctx.imageSmoothingEnabled=true;
    try { ctx.imageSmoothingQuality="high"; } catch {}
    ctx.drawImage(img,0,0,w,h,0,0,width,height);
    return canvas.toDataURL("image/jpeg",quality);
  }

  function toJpeg(file) {
    return new Promise(resolve => {
      if (!file) return resolve("");
      let url="";
      try { url=URL.createObjectURL(file); }
      catch { return resolve(""); }
      const img = new Image();
      img.onload = () => {
        try {
          let best="";
          for (const step of PHOTO_PROFILE.steps) {
            const out=encodePhoto(img,step.maxEdge,step.quality);
            if (!out) continue;
            best=out;
            if (out.length<=PHOTO_PROFILE.maxDataUrlChars) break;
          }
          resolve(best);
        } catch { resolve(""); }
        finally { try { URL.revokeObjectURL(url); } catch {} }
      };
      img.onerror=()=>{ try { URL.revokeObjectURL(url); } catch {} resolve(""); };
      img.src=url;
    });
  }

  async function savePrepared(id, src) {
    id=String(id||"");
    if (!id || !image(src)) return {saved:false,synced:false};

    // High-quality staging uploads are MEMORY ONLY. This gives a true visual test
    // of the better photo profile without adding Firebase traffic or local quota risk.
    testPhotos.set(id,src);
    removedPhotos.delete(id);
    notify(id);
    return {saved:true,synced:true,staging:true,memoryOnly:true};
  }

  async function saveFile(id,file) {
    const src=await toJpeg(file);
    return savePrepared(id,src);
  }

  async function saveUrl(id,url) {
    url=String(url||"").trim();
    return /^https?:\/\//i.test(url) ? savePrepared(id,url) : {saved:false,synced:false};
  }

  async function remove(id) {
    id=String(id||"");
    if (!id) return;
    testPhotos.delete(id);
    removedPhotos.add(id);
    notify(id);
  }

  async function hydratePublicPhotosOnce() {
    if (publicHydrated) return publicPhotos.size;
    if (publicHydratePromise) return publicHydratePromise;
    publicHydratePromise=(async()=>{
      try {
        await import("../customer-public-reader-v2.js");
        const reader=window.FarmPublicCustomerReaderV2;
        if(!reader?.load) return 0;
        const snapshot=await reader.load();
        const flock=Array.isArray(snapshot?.flock)?snapshot.flock:[];
        let added=0;
        for(const bird of flock){
          const id=String(bird?.id||"");
          const src=bird?.photo;
          if(id && image(src)){publicPhotos.set(id,src);added++;}
        }
        publicHydrated=true;
        notify("public-hydration");
        try { window.FlockManagerV7?.render?.(); } catch {}
        console.log(`🖼️ STAGING hydrated ${added} sanitized public photos; ${window.StagingLivePhotoSeedV1?.count?.()||0} LIVE browser photos are also available read-only`);
        return added;
      } catch(error) {
        console.warn("STAGING main flock public photo hydration unavailable:",error);
        return 0;
      } finally {
        publicHydratePromise=null;
      }
    })();
    return publicHydratePromise;
  }

  function clearTestPhotoEdits() {
    testPhotos.clear();
    removedPhotos.clear();
    notify("staging-photo-reset");
    try { window.FlockManagerV7?.render?.(); } catch {}
  }

  const service={
    get, saveFile, savePrepared, saveUrl, remove,
    prepareFile:file=>toJpeg(file), flush:async()=>true, ready:async()=>true,
    hydratePublicPhotosOnce,
    clearTestPhotoEdits,
    publicPhotoCount:()=>publicPhotos.size,
    liveBrowserPhotoCount:()=>window.StagingLivePhotoSeedV1?.count?.()||0,
    testPhotoCount:()=>testPhotos.size,
    qualityProfile:PHOTO_PROFILE,
    storageMode:"memory-only-staging-edits",
    firebaseReads:0,firebaseWrites:0,networkWrites:0,
    subscribe(fn){ if(typeof fn==="function")listeners.add(fn); return()=>listeners.delete(fn); }
  };
  window.FarmBirdPhotosV4=service;
  window.FarmBirdPhotosV3=service;
  window.FarmBirdPhotosV2=service;

  function recoveryStats() {
    const flock=read(APP,{}).flock || [];
    const currentIds=new Set(flock.map(b=>String(b?.id||"")));
    const visible=Array.from(currentIds).filter(id=>image(get(id))).length;
    return {
      currentFlock: flock.length,
      cloudActive: publicPhotos.size,
      liveBrowserActive: window.StagingLivePhotoSeedV1?.count?.()||0,
      stagingMemoryActive:testPhotos.size,
      currentMatched: visible,
      orphanActive: 0,
      aliasesInUse: 0,
      recovered: [],
      unresolved: [],
      visibleNow: visible,
      initialScanDone: publicHydrated,
      staging: true
    };
  }

  window.FarmBirdPhotoRecoveryV2={
    scan:async()=>{await hydratePublicPhotosOnce();return recoveryStats();},
    stats:recoveryStats,
    getCloudRecord:()=>null
  };

  void hydratePublicPhotosOnce();
  window.addEventListener("farm-data-synced",()=>void hydratePublicPhotosOnce());
  window.addEventListener("staging-live-source-verified",event=>{
    if(event?.detail?.verified) clearTestPhotoEdits();
  });

  console.log("🧪 STAGING photo service active — full-frame portrait uploads up to 1280px stay memory-only; no square crop; LIVE fallbacks read-only");
})();
