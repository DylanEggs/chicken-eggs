(() => {
  "use strict";
  if (window.__ChickenEggsStagingPhotoService) return;
  window.__ChickenEggsStagingPhotoService = true;

  const APP = "chickenEggApp2V1";
  const CACHE = "chickenEggLocalBirdPhotosV1";
  const META = "chickenEggBirdPhotoMetaV4";
  const listeners = new Set();

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
    const src = read(CACHE, {})[String(id || "")];
    return image(src) ? src : "";
  }
  function toJpeg(file, size=168, quality=.46) {
    return new Promise(resolve => {
      if (!file) return resolve("");
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
          const side=Math.min(w,h), sx=Math.max(0,(w-side)/2), sy=Math.max(0,(h-side)/2);
          const canvas=document.createElement("canvas");
          canvas.width=size; canvas.height=size;
          const ctx=canvas.getContext("2d",{alpha:false});
          ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
          resolve(canvas.toDataURL("image/jpeg",quality));
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
    meta[id]={updatedAt:Date.now(),deleted:true,sourceRank:99,stagingOnly:true};
    write(CACHE,cache); write(META,meta); notify(id);
  }
  const service={
    get, saveFile, savePrepared, saveUrl, remove,
    prepareFile:file=>toJpeg(file), flush:async()=>true, ready:async()=>true,
    subscribe(fn){ if(typeof fn==="function")listeners.add(fn); return()=>listeners.delete(fn); }
  };
  window.FarmBirdPhotosV4=service;
  window.FarmBirdPhotosV3=service;
  window.FarmBirdPhotosV2=service;

  function recoveryStats() {
    const flock=read(APP,{}).flock || [];
    const cache=read(CACHE,{});
    const currentIds=new Set(flock.map(b=>String(b?.id||"")));
    const visible=Object.keys(cache).filter(id=>currentIds.has(id) && image(cache[id])).length;
    return {
      currentFlock: flock.length,
      cloudActive: 0,
      currentMatched: visible,
      orphanActive: 0,
      aliasesInUse: 0,
      recovered: [],
      unresolved: [],
      visibleNow: visible,
      initialScanDone: true,
      staging: true
    };
  }
  window.FarmBirdPhotoRecoveryV2={
    scan:async()=>recoveryStats(),
    stats:recoveryStats,
    // Returning null prevents storage cleanup from treating a staging-only photo
    // as a verified cloud copy and deleting it.
    getCloudRecord:()=>null
  };

  console.log("🧪 STAGING photo service active — photo edits stay in sandbox");
})();
