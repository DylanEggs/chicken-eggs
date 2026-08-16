(() => {
  "use strict";
  if (window.__birdPhotoRecoveryV2) return;
  window.__birdPhotoRecoveryV2 = true;

  const APP = "chickenEggApp2V1";
  const SNAPSHOTS = "chickenEggApp2SnapshotsV1";
  const TYPE4 = "birdPhotoV4";
  const PHOTO_TYPES = new Set(["birdPhotoV2", "birdPhotoV3", "birdPhotoV4"]);
  const LEGACY_APP_DOC = "__farm_app_2__";
  const CURRENT_APP_DOC = "farm_app_2_v1";
  const FALLBACK_DOC = "farm_deluxe_v1";
  const FALLBACK_FIELD = "birdPhotosV3Fallback";

  const cloud = new Map();
  const aliases = new Map();
  const recovered = new Map();
  const unresolved = new Map();
  let api = null;
  let unsubscribe = null;
  let running = false;
  let initialScanDone = false;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const n = v => Number(v) || 0;
  const image = v => typeof v === "string" && (v.startsWith("data:image/") || /^https?:\/\//i.test(v));
  const norm = v => String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const currentFlock = () => {
    const a = read(APP, {});
    return Array.isArray(a?.flock) ? a.flock.filter(Boolean) : [];
  };
  const currentIds = () => new Set(currentFlock().map(b => String(b?.id || "")).filter(Boolean));

  function record(data, rank = 4) {
    const birdId = String(data?.birdId || "");
    if (!birdId) return null;
    const deleted = !!data.deleted;
    const dataUrl = typeof data.dataUrl === "string" ? data.dataUrl : "";
    if (!deleted && !image(dataUrl)) return null;
    return { birdId, dataUrl:deleted ? "" : dataUrl, deleted, updatedAt:n(data.updatedAt) || 1, sourceRank:n(data.sourceRank) || rank };
  }

  function better(a, b) {
    if (!a) return b;
    if (!b) return a;
    const at=n(a.updatedAt), bt=n(b.updatedAt);
    if (bt !== at) return bt > at ? b : a;
    const ar=a.deleted ? 2 : (image(a.dataUrl) ? 3 : 0);
    const br=b.deleted ? 2 : (image(b.dataUrl) ? 3 : 0);
    return br >= ar ? b : a;
  }

  function remember(r) {
    if (!r?.birdId) return;
    cloud.set(r.birdId, better(cloud.get(r.birdId), r));
  }

  async function firebase() {
    if (api) return api;
    const start = Date.now();
    while (Date.now() - start < 18000) {
      if (window.FirestoreDB && window.FirebaseUser) break;
      await new Promise(r => setTimeout(r, 80));
    }
    if (!window.FirestoreDB || !window.FirebaseUser) return null;
    api = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return api;
  }

  function patchGet() {
    const service = window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;
    if (!service || service.__cloudFirstGetV2) return false;
    const oldGet = typeof service.get === "function" ? service.get.bind(service) : () => "";
    service.get = id => {
      id = String(id || "");
      const direct = cloud.get(id);
      if (direct) {
        if (direct.deleted) return "";
        if (image(direct.dataUrl)) return direct.dataUrl;
      }
      const alias = aliases.get(id);
      const via = alias ? cloud.get(alias) : null;
      if (via) {
        if (via.deleted) return "";
        if (image(via.dataUrl)) return via.dataUrl;
      }
      return oldGet(id) || "";
    };
    service.__cloudFirstGetV2 = true;
    window.FarmBirdPhotosV4 = service;
    window.FarmBirdPhotosV3 = service;
    window.FarmBirdPhotosV2 = service;
    return true;
  }

  function addHistoryBird(map, bird, source) {
    const id=String(bird?.id || "");
    const name=String(bird?.name || "").trim();
    if (!id || !name) return;
    const existing=map.get(id);
    const next={ id, name, breed:String(bird?.breed || ""), hatchDate:String(bird?.hatchDate || ""), sex:String(bird?.sex || ""), source };
    if (!existing || source === "current") map.set(id,next);
  }

  async function historicalBirds(f) {
    const map = new Map();
    currentFlock().forEach(b => addHistoryBird(map,b,"current"));

    const shots = read(SNAPSHOTS, []);
    if (Array.isArray(shots)) {
      for (const s of shots) {
        const flock = s?.farmApp2?.flock;
        if (Array.isArray(flock)) flock.forEach(b => addHistoryBird(map,b,"local snapshot"));
      }
    }

    if (!f) return map;
    for (const docId of [LEGACY_APP_DOC, CURRENT_APP_DOC]) {
      try {
        const snap=await f.getDoc(f.doc(window.FirestoreDB,"entries",docId));
        if (!snap.exists()) continue;
        const data=snap.data() || {};
        const flock=data?.farmApp2?.flock;
        if (Array.isArray(flock)) flock.forEach(b => addHistoryBird(map,b,docId));
      } catch (error) {
        console.warn("Historical flock photo map read failed:",docId,error);
      }
    }
    return map;
  }

  function matchCurrent(oldBird, flock) {
    if (!oldBird?.name) return null;
    const sameName=flock.filter(b => norm(b?.name) && norm(b?.name) === norm(oldBird.name));
    if (sameName.length === 1) return sameName[0];
    if (!sameName.length) return null;

    const scored=sameName.map(b => {
      let score=0;
      if (oldBird.breed && norm(b?.breed) === norm(oldBird.breed)) score += 4;
      if (oldBird.hatchDate && String(b?.hatchDate || "") === oldBird.hatchDate) score += 4;
      if (oldBird.sex && norm(b?.sex) === norm(oldBird.sex)) score += 2;
      return { bird:b, score };
    }).sort((a,b)=>b.score-a.score);
    if (scored[0]?.score > (scored[1]?.score ?? -1)) return scored[0].bird;
    return null;
  }

  async function loadCloud(f) {
    cloud.clear();
    const snap=await f.getDocs(f.collection(window.FirestoreDB,"entries"));
    for (const d of snap.docs) {
      const data=d.data() || {};
      if (PHOTO_TYPES.has(data.type)) remember(record(data,data.type===TYPE4?4:3));
    }
    try {
      const fb=await f.getDoc(f.doc(window.FirestoreDB,"entries",FALLBACK_DOC));
      const map=fb.exists() && fb.data()?.[FALLBACK_FIELD] && typeof fb.data()[FALLBACK_FIELD] === "object" ? fb.data()[FALLBACK_FIELD] : {};
      for (const data of Object.values(map)) remember(record(data,3));
    } catch (error) {
      console.warn("Fallback flock photo scan failed:",error);
    }
  }

  async function recoverAliases(f) {
    aliases.clear();
    unresolved.clear();
    const flock=currentFlock();
    const ids=new Set(flock.map(b=>String(b?.id || "")).filter(Boolean));
    const history=await historicalBirds(f);
    const service=window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;

    for (const [oldId,photo] of cloud) {
      if (!photo || photo.deleted || !image(photo.dataUrl) || ids.has(oldId)) continue;
      const oldBird=history.get(oldId);
      if (!oldBird) {
        unresolved.set(oldId,{reason:"No historical flock profile found for this photo ID"});
        continue;
      }
      const target=matchCurrent(oldBird,flock);
      if (!target) {
        unresolved.set(oldId,{reason:`Could not uniquely match historical profile ${oldBird.name}`,name:oldBird.name,source:oldBird.source});
        continue;
      }
      const targetId=String(target.id || "");
      if (!targetId || targetId === oldId) continue;
      const existing=cloud.get(targetId);
      if (existing && !existing.deleted && image(existing.dataUrl)) continue;

      aliases.set(targetId,oldId);
      if (recovered.has(oldId)) continue;

      if (service?.savePrepared) {
        try {
          const result=await service.savePrepared(targetId,photo.dataUrl);
          if (result?.saved) {
            recovered.set(oldId,{from:oldId,to:targetId,name:String(target.name || oldBird.name),at:Date.now(),synced:!!result.synced});
            const copied={...photo,birdId:targetId,updatedAt:Date.now(),sourceRank:5};
            cloud.set(targetId,copied);
            aliases.delete(targetId);
          }
        } catch (error) {
          console.warn("Historical flock photo copy failed:",oldId,"->",targetId,error);
        }
      }
    }
  }

  function stats() {
    const flock=currentFlock();
    const ids=new Set(flock.map(b=>String(b?.id || "")).filter(Boolean));
    let currentMatched=0, activeCloud=0, orphanActive=0;
    for (const [id,r] of cloud) {
      if (!r || r.deleted || !image(r.dataUrl)) continue;
      activeCloud++;
      if (ids.has(id)) currentMatched++; else orphanActive++;
    }
    let visibleNow=0;
    const service=window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;
    for (const b of flock) if (service?.get?.(String(b?.id || ""))) visibleNow++;
    return {
      currentFlock:flock.length,
      cloudActive:activeCloud,
      currentMatched,
      orphanActive,
      aliasesInUse:aliases.size,
      recovered:[...recovered.values()],
      unresolved:[...unresolved.entries()].map(([birdId,x])=>({birdId,...x})),
      visibleNow,
      initialScanDone
    };
  }

  function notify(source="cloud") {
    window.dispatchEvent(new CustomEvent("bird-photos-changed",{detail:{source,recoveryV2:true}}));
    window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{key:APP,photoOnly:true,source}}));
  }

  async function scanAndRecover() {
    if (running) return stats();
    running=true;
    try {
      patchGet();
      const f=await firebase();
      if (!f) return stats();
      await loadCloud(f);
      patchGet();
      notify("firebase-photo-memory");
      await recoverAliases(f);
      initialScanDone=true;
      notify("firebase-photo-recovery");
      return stats();
    } catch (error) {
      console.warn("Flock photo recovery scan failed:",error);
      return stats();
    } finally {
      running=false;
    }
  }

  async function startListener() {
    const f=await firebase();
    if (!f) return;
    try { unsubscribe?.(); } catch {}
    unsubscribe=f.onSnapshot(f.collection(window.FirestoreDB,"entries"), snap => {
      let changed=false;
      for (const change of snap.docChanges()) {
        if (change.type === "removed") continue;
        const data=change.doc.data() || {};
        if (!PHOTO_TYPES.has(data.type)) continue;
        const r=record(data,data.type===TYPE4?4:3);
        if (!r) continue;
        remember(r); changed=true;
      }
      if (changed) {
        patchGet();
        notify("firebase-photo-listener");
      }
    },error=>console.warn("Flock photo recovery listener failed:",error));
  }

  window.FarmBirdPhotoRecoveryV2={
    scan:scanAndRecover,
    stats,
    getCloudRecord:id=>cloud.get(String(id || "")) || null
  };

  async function init() {
    const start=Date.now();
    while (Date.now()-start < 8000) {
      if (window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2) break;
      await new Promise(r=>setTimeout(r,50));
    }
    patchGet();
    await scanAndRecover();
    await startListener();
    window.addEventListener("online",()=>{ void scanAndRecover(); void startListener(); });
    window.addEventListener("farm-data-synced",e=>{
      if (e.detail?.key === APP && !e.detail?.photoOnly) setTimeout(()=>void scanAndRecover(),250);
    });
    console.log("✅ Flock photo recovery v2 active — Firebase memory display + historical ID recovery");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>void init(),300),{once:true});
  else setTimeout(()=>void init(),300);
})();
