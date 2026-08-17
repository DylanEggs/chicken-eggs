(() => {
  "use strict";
  if (window.__birdPhotoServiceV4) return;
  window.__birdPhotoServiceV4 = true;

  const APP = "chickenEggApp2V1";
  const CACHE = "chickenEggLocalBirdPhotosV1";
  const META = "chickenEggBirdPhotoMetaV4";
  const OLD_META = "chickenEggBirdPhotoMetaV3";
  const FALLBACK_DOC = "farm_deluxe_v1";
  const FALLBACK_FIELD = "birdPhotosV3Fallback";
  const TYPE = "birdPhotoV4";
  const PHOTO_TYPES = ["birdPhotoV2", "birdPhotoV3", TYPE];
  const listeners = new Set();
  const remote = new Map();
  let api = null;
  let unsubscribe = null;
  let readyPromise = null;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { console.warn("Photo storage write failed:", key, error); return false; }
  };
  const now = () => Date.now();
  const isImage = v => typeof v === "string" && (v.startsWith("data:image/") || /^https?:\/\//i.test(v));
  const birdIds = () => new Set((read(APP, {}).flock || []).map(b => String(b?.id || "")).filter(Boolean));
  const docId = id => "bird_photo_v4_" + String(id || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);

  function status(message, kind = "info") {
    window.dispatchEvent(new CustomEvent("bird-photo-status", { detail:{ message, kind } }));
  }
  function notify(detail = {}) {
    for (const fn of listeners) { try { fn(detail); } catch {} }
    window.dispatchEvent(new CustomEvent("bird-photos-changed", { detail }));
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ key:APP, photoOnly:true } }));
  }
  function cache() { const x=read(CACHE,{}); return x&&typeof x==="object"?x:{}; }
  function meta() { const x=read(META,{}); return x&&typeof x==="object"?x:{}; }
  function get(id) { const v=cache()[String(id||"")]; return typeof v==="string"?v:""; }

  async function firebaseApi() {
    if (api) return api;
    const start = now();
    while (now() - start < 15000) {
      if (window.FirestoreDB && window.FirebaseUser) break;
      await new Promise(r => setTimeout(r, 75));
    }
    if (!window.FirestoreDB || !window.FirebaseUser) return null;
    api = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return api;
  }

  function imageToJpeg(source, size=168, quality=.46) {
    return new Promise(resolve => {
      const image = new Image();
      let objectUrl = "";
      const done = value => {
        try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch {}
        resolve(value || "");
      };
      image.onload = () => {
        try {
          const w=image.naturalWidth||image.width, h=image.naturalHeight||image.height;
          const side=Math.min(w,h), sx=Math.max(0,(w-side)/2), sy=Math.max(0,(h-side)/2);
          const canvas=document.createElement("canvas");
          canvas.width=size; canvas.height=size;
          const ctx=canvas.getContext("2d",{alpha:false});
          ctx.drawImage(image,sx,sy,side,side,0,0,size,size);
          let out=canvas.toDataURL("image/jpeg",quality);
          if (out.length>60000) out=canvas.toDataURL("image/jpeg",.34);
          done(out);
        } catch (error) { console.warn("Photo conversion failed:",error); done(""); }
      };
      image.onerror=()=>done("");
      try {
        if (source instanceof Blob) { objectUrl=URL.createObjectURL(source); image.src=objectUrl; }
        else image.src=String(source||"");
      } catch { done(""); }
    });
  }

  async function prepareFile(file) {
    if (!file) return "";
    let out=await imageToJpeg(file,168,.46);
    if (out) return out;
    const raw=await new Promise(resolve=>{
      try { const r=new FileReader(); r.onload=e=>resolve(String(e.target?.result||"")); r.onerror=()=>resolve(""); r.readAsDataURL(file); }
      catch { resolve(""); }
    });
    return raw ? await imageToJpeg(raw,156,.4) : "";
  }

  function setLocal(id, record) {
    id=String(id||"");
    if (!id) return false;
    const c=cache(), m=meta();
    if (record.deleted) delete c[id];
    else if (isImage(record.dataUrl)) c[id]=record.dataUrl;
    else return false;
    m[id]={updatedAt:Number(record.updatedAt)||now(),deleted:!!record.deleted,sourceRank:Number(record.sourceRank)||4};
    const ok1=write(CACHE,c), ok2=write(META,m);
    if (ok1&&ok2) notify({birdId:id,deleted:!!record.deleted});
    return ok1&&ok2;
  }

  function candidateBetter(a,b) {
    if (!a) return b;
    if (!b) return a;
    const at=Number(a.updatedAt)||0, bt=Number(b.updatedAt)||0;
    if (bt!==at) return bt>at?b:a;
    const ar=a.deleted?2:(isImage(a.dataUrl)?3:0);
    const br=b.deleted?2:(isImage(b.dataUrl)?3:0);
    return br>=ar?b:a;
  }

  function normalizeRecord(data, rank=3) {
    const id=String(data?.birdId||"");
    if (!id) return null;
    const deleted=!!data.deleted;
    const src=typeof data.dataUrl==="string"?data.dataUrl:"";
    if (!deleted && !isImage(src)) return null;
    return {birdId:id,dataUrl:deleted?"":src,deleted,updatedAt:Number(data.updatedAt)||1,sourceRank:Number(data.sourceRank)||rank};
  }

  function sameRecord(a,b) {
    if (!a || !b) return false;
    return String(a.birdId||"")===String(b.birdId||"") &&
      !!a.deleted===!!b.deleted &&
      Number(a.updatedAt||0)===Number(b.updatedAt||0) &&
      String(a.dataUrl||"")===String(b.dataUrl||"");
  }

  function rememberRemote(record) {
    if (!record?.birdId) return;
    remote.set(record.birdId, candidateBetter(remote.get(record.birdId), record));
  }

  async function collectMigrationCandidates() {
    const ids=birdIds();
    const best=new Map();
    const take=record=>{
      if (!record || !ids.has(record.birdId)) return;
      best.set(record.birdId,candidateBetter(best.get(record.birdId),record));
    };

    const c=cache(), m4=meta(), m3=read(OLD_META,{});
    for (const id of Object.keys(c)) {
      const src=c[id];
      if (!ids.has(id)||!isImage(src)) continue;
      const info=m4[id]||m3[id]||{};
      take({birdId:id,dataUrl:src,deleted:false,updatedAt:Number(info.updatedAt)||1,sourceRank:Number(info.sourceRank)||4});
    }
    for (const [id,info] of Object.entries(m4)) if (ids.has(id)&&info?.deleted) take({birdId:id,dataUrl:"",deleted:true,updatedAt:Number(info.updatedAt)||1,sourceRank:4});
    for (const [id,info] of Object.entries(m3)) if (ids.has(id)&&info?.deleted) take({birdId:id,dataUrl:"",deleted:true,updatedAt:Number(info.updatedAt)||1,sourceRank:3});

    const f=await firebaseApi();
    if (!f) return best;
    try {
      const photoQuery=f.query(
        f.collection(window.FirestoreDB,"entries"),
        f.where("type","in",PHOTO_TYPES)
      );
      const snap=await f.getDocs(photoQuery);
      for (const d of snap.docs) {
        const data=d.data()||{};
        const record=normalizeRecord(data,data.type===TYPE?4:3);
        if (!record) continue;
        rememberRemote(record);
        take(record);
      }
      const fb=await f.getDoc(f.doc(window.FirestoreDB,"entries",FALLBACK_DOC));
      const map=fb.exists()&&fb.data()?.[FALLBACK_FIELD]&&typeof fb.data()[FALLBACK_FIELD]==="object"?fb.data()[FALLBACK_FIELD]:{};
      for (const data of Object.values(map)) take(normalizeRecord(data,3));
    } catch (error) { console.warn("Photo migration scan failed:",error); }
    return best;
  }

  async function writeCloud(record) {
    const f=await firebaseApi();
    if (!f) throw new Error("Firebase not ready");
    const id=String(record.birdId||"");
    const known=remote.get(id);
    if (known && sameRecord(known,record)) return "already-synced";

    const ref=f.doc(window.FirestoreDB,"entries",docId(id));
    const snap=await f.getDoc(ref);
    const existing=snap.exists()?normalizeRecord(snap.data(),4):null;
    if (existing && Number(existing.updatedAt)>Number(record.updatedAt)) {
      setLocal(id,existing); remote.set(id,existing); return "remote-newer";
    }
    if (existing && sameRecord(existing,record)) {
      remote.set(id,existing);
      return "already-synced";
    }
    await f.setDoc(ref,{
      type:TYPE,birdId:id,dataUrl:record.deleted?"":record.dataUrl,deleted:!!record.deleted,
      updatedAt:Number(record.updatedAt)||now(),sourceRank:4,serverUpdatedAt:f.serverTimestamp()
    },{merge:true});
    const verify=await f.getDoc(ref);
    const saved=verify.exists()?normalizeRecord(verify.data(),4):null;
    if (!saved || Number(saved.updatedAt)!==Number(record.updatedAt) || !!saved.deleted!==!!record.deleted || (!record.deleted&&saved.dataUrl!==record.dataUrl)) {
      throw new Error("Firebase photo verification failed");
    }
    remote.set(id,saved);
    return "written";
  }

  async function reconcile() {
    const best=await collectMigrationCandidates();
    for (const [id,record] of best) {
      setLocal(id,record);
      const known=remote.get(id);
      if (known && sameRecord(known,record)) continue;
      try { await writeCloud(record); }
      catch (error) { console.warn("Photo migration write waiting:",id,error); }
    }
  }

  function applyRemote(data) {
    const record=normalizeRecord(data,4);
    if (!record) return;
    const id=record.birdId;
    remote.set(id,record);
    const localInfo=meta()[id]||{};
    const localSrc=get(id);
    const local={birdId:id,dataUrl:localInfo.deleted?"":localSrc,deleted:!!localInfo.deleted,updatedAt:Number(localInfo.updatedAt)||0,sourceRank:4};
    const winner=candidateBetter(local,record);
    if (winner===record || Number(record.updatedAt)>=Number(local.updatedAt)) setLocal(id,record);
  }

  async function startListener() {
    const f=await firebaseApi();
    if (!f) return;
    unsubscribe?.();
    const currentPhotoQuery=f.query(
      f.collection(window.FirestoreDB,"entries"),
      f.where("type","==",TYPE)
    );
    unsubscribe=f.onSnapshot(currentPhotoQuery,snap=>{
      for (const change of snap.docChanges()) {
        if (change.type==="removed") continue;
        applyRemote(change.doc.data()||{});
      }
    },error=>console.warn("Photo v4 listener failed:",error));
  }

  async function savePrepared(id,src) {
    id=String(id||"");
    if (!id||!isImage(src)) return {saved:false,synced:false};
    const record={birdId:id,dataUrl:src,deleted:false,updatedAt:now(),sourceRank:4};
    if (!setLocal(id,record)) {
      status("Photo could not be saved because browser storage is full.","error");
      return {saved:false,synced:false};
    }
    try {
      await writeCloud(record);
      status("Photo saved and synced.","success");
      return {saved:true,synced:true};
    } catch (error) {
      console.warn("Photo v4 sync failed:",error);
      status("Photo saved on this device but is waiting for Firebase sync.","warning");
      return {saved:true,synced:false};
    }
  }

  async function saveFile(id,file) {
    status("Preparing photo…","info");
    const src=await prepareFile(file);
    if (!src) { status("Browser could not read that image. Try another photo.","error"); return {saved:false,synced:false}; }
    return savePrepared(id,src);
  }

  async function saveUrl(id,url) {
    url=String(url||"").trim();
    if (!/^https?:\/\//i.test(url)) return {saved:false,synced:false};
    return savePrepared(id,url);
  }

  async function remove(id) {
    id=String(id||""); if(!id)return;
    const record={birdId:id,dataUrl:"",deleted:true,updatedAt:now(),sourceRank:4};
    setLocal(id,record);
    try { await writeCloud(record); status("Photo removed and synced.","success"); }
    catch(error){console.warn("Photo remove sync failed:",error);status("Photo removed here; Firebase removal is waiting to sync.","warning");}
  }

  async function flush() { await reconcile(); }

  async function initWork() {
    await reconcile();
    await startListener();
    window.addEventListener("online",async()=>{await reconcile();await startListener();});
    console.log("✅ Bird photo service v4 active — scoped photo-only Firebase sync");
  }
  function ready(){if(!readyPromise)readyPromise=initWork();return readyPromise;}

  function startAfterFarmSync() {
    const start=()=>{ if (window.FarmSyncSafety?.isReady?.()) { void ready(); return true; } return false; };
    if (start()) return;
    window.addEventListener("farm-sync-ready",()=>void ready(),{once:true});
    window.addEventListener("online",()=>{ if (window.FarmSyncSafety?.isReady?.()) void ready(); });
    setTimeout(start,5000);
  }

  const service={get,prepareFile,saveFile,savePrepared,saveUrl,remove,flush,ready,subscribe(fn){if(typeof fn==="function")listeners.add(fn);return()=>listeners.delete(fn);}};
  window.FarmBirdPhotosV4=service;
  window.FarmBirdPhotosV3=service;
  window.FarmBirdPhotosV2=service;
  startAfterFarmSync();
})();