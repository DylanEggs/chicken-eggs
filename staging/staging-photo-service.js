(() => {
  "use strict";
  if (window.__ChickenEggsStagingPhotoService) return;
  window.__ChickenEggsStagingPhotoService = true;

  const APP = "chickenEggApp2V1";
  const CACHE = "chickenEggLocalBirdPhotosV1";
  const META = "chickenEggBirdPhotoMetaV4";
  const listeners = new Set();
  const publicPhotos = new Map();
  let publicHydratePromise = null;
  let publicHydrated = false;

  // High-quality but storage-conscious profile. Most iPhone photos should remain
  // at 480x480 / 82% JPEG. Only unusually detailed images step down enough to
  // keep dozens of flock photos from exhausting browser storage.
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
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const image = v => typeof v === "string" && (v.startsWith("data:image/") || /^https?:\/\//i.test(v));

  function notify(id) {
    for (const fn of listeners) { try { fn({ birdId:id, staging:true }); } catch {} }
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail:{ birdId:id, staging:true } }));
  }
  function get(id) {
    id = String(id || "");
    const src = read(CACHE, {})[id];
    if (image(src)) return src;
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
    const cache=read(CACHE,{}), meta=read(META,{});
    cache[id]=src;
    meta[id]={updatedAt:Date.now(),deleted:false,sourceRank:99,stagingOnly:true};
    write(CACHE,cache); write(META,meta); notify(id);
    return {saved:true,synced:true,staging:true};
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
    const cache=read(CACHE,{}), meta=read(META,{});
    delete cache[id];
    publicPhotos.delete(id);
    meta[id]={updatedAt:Date.now(),deleted:true,sourceRank:99,stagingOnly:true};
    write(CACHE,cache); write(META,meta); notify(id);
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
        console.log(`🖼️ STAGING main flock hydrated ${added} sanitized public photos with one one-time public snapshot load`);
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

  const service={
    get, saveFile, savePrepared, saveUrl, remove,
    prepareFile:file=>toJpeg(file), flush:async()=>true, ready:async()=>true,
    hydratePublicPhotosOnce,
    publicPhotoCount:()=>publicPhotos.size,
    qualityProfile:PHOTO_PROFILE,
    firebaseReads:0,firebaseWrites:0,networkWrites:0,
    subscribe(fn){ if(typeof fn==="function")listeners.add(fn); return()=>listeners.delete(fn); }
  };
  window.FarmBirdPhotosV4=service;
  window.FarmBirdPhotosV3=service;
  window.FarmBirdPhotosV2=service;

  function recoveryStats() {
    const flock=read(APP,{}).flock || [];
    const cache=read(CACHE,{});
    const currentIds=new Set(flock.map(b=>String(b?.id||"")));
    const visible=Array.from(currentIds).filter(id=>image(cache[id]) || image(publicPhotos.get(id))).length;
    return {
      currentFlock: flock.length,
      cloudActive: publicPhotos.size,
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

  // Main STAGING keeps its flock/egg test data isolated in memory. Photos are not part
  // of that six-dataset mirror, so pull only the already-sanitized public flock photos
  // once per page session. Nothing is copied to LIVE and no Firebase listener is opened.
  void hydratePublicPhotosOnce();
  window.addEventListener("farm-data-synced",()=>void hydratePublicPhotosOnce());

  console.log("🧪 STAGING photo service active — high-quality 480px flock uploads stay in sandbox; public flock photos hydrate read-only once");
})();
