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

  // High-quality but storage-conscious profile. Most iPhone photos should remain
  // at 480x480 / 82% JPEG. Only unusually detailed images step down enough to
  // keep the per-photo payload reasonable.
  const PHOTO_PROFILE = Object.freeze({
    targetSize:480,
    targetQuality:.82,
    maxDataUrlChars:90000,
    steps:Object.freeze([
      Object.freeze({size:480,quality:.82}),
      Object.freeze({size:480,quality:.76}),
      Object.freeze({size:440,quality:.74}),
      Object.freeze({size:400,quality:.72}),
      Object.freeze({size:360,quality:.70}),
      Object.freeze({size:340,quality:.64})
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

  function notify(id) {
    for (const fn of listeners) { try { fn({ birdId:id, staging:true }); } catch {} }
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail:{ birdId:id, staging:true } }));
  }

  function get(id) {
    id = String(id || "");
    if (!id || removedPhotos.has(id)) return "";
    const staged = testPhotos.get(id);
    if (image(staged)) return staged;

    // Preserve compatibility with any tiny staging photo left from an older build,
    // but never depend on the persistent cache for new high-quality test uploads.
    const legacyStage = read(CACHE, {})[id];
    if (image(legacyStage)) return legacyStage;

    // Best zero-read fallback on the same device: the LIVE browser photo cache was
    // captured before staging localStorage isolation was installed.
    const liveLocal = liveBrowserPhoto(id);
    if (liveLocal) return liveLocal;

    // Final fallback is the already-sanitized public Customer View snapshot.
    const publicSrc = publicPhotos.get(id);
    return image(publicSrc) ? publicSrc : "";
  }

  function encodeSquare(img, size, quality) {
    const w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    if (!w || !h) return "";
    const side=Math.min(w,h), sx=Math.max(0,(w-side)/2), sy=Math.max(0,(h-side)/2);
    const canvas=document.createElement("canvas");
    canvas.width=size; canvas.height=size;
    const ctx=canvas.getContext("2d",{alpha:false});
    if (!ctx) return "";
    ctx.imageSmoothingEnabled=true;
    try { ctx.imageSmoothingQuality="high"; } catch {}
    ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
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
            const out=encodeSquare(img,step.size,step.quality);
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

    // High-quality staging uploads are intentionally MEMORY ONLY. The staging
    // storage sandbox protects LIVE by compacting large photo caches, so persisting
    // 480px data URLs there can make later photos disappear. Memory avoids that.
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
    // Returning null prevents storage cleanup from treating a staging-only photo
    // as a verified cloud copy and deleting it.
    getCloudRecord:()=>null
  };

  // Pull only the already-sanitized public snapshot once. Same-device LIVE photos
  // are available from the zero-write pre-storage memory capture. No Firebase
  // listener or direct photo query is opened by this STAGING service.
  void hydratePublicPhotosOnce();
  window.addEventListener("farm-data-synced",()=>void hydratePublicPhotosOnce());
  window.addEventListener("staging-live-source-verified",event=>{
    if(event?.detail?.verified) clearTestPhotoEdits();
  });

  console.log("🧪 STAGING photo service active — sharp 480px uploads stay memory-only; LIVE photo fallbacks are read-only");
})();
