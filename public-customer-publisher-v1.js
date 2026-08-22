(() => {
  "use strict";
  if (window.FarmPublicCustomerPublisherV1) return;

  const OWNER_UID="aLvjMpXgMJf5W3YUjQM6wqKagLo2";
  const HASH_KEY="chickenEggPublicPublisherHashV1";
  const PHOTO_REPAIR_MARKER="chickenEggPublicPhotoRepairV1";
  const KEYS={app2:"chickenEggApp2V1",inventory:"chickenEggInventoryV2",entries:"chickenEggEntriesV102",settings:"chickenEggSettingsV102",weather:"chickenEggWeatherIntelligenceV2",deluxe:"chickenEggDeluxeV1",photos:"chickenEggLocalBirdPhotosV1"};
  let api=null,running=false,timer=null,lastResult=null,repairRunning=false;

  function read(key,fallback){try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw);}catch{return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
  function readHashes(){const x=read(HASH_KEY,{});return x&&typeof x==="object"?x:{summary:"",flock:{}};}
  function writeHashes(value){write(HASH_KEY,value);}
  function stableString(value){try{return JSON.stringify(value);}catch{return "";}}
  function hash(value){const text=stableString(value);let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function safeDocId(id){return String(id||"").replace(/[^A-Za-z0-9_-]/g,"_").slice(0,120)||"bird";}
  function isImage(v){return typeof v==="string"&&(v.startsWith("data:image/")||/^https?:\/\//i.test(v));}
  function mainReady(){return !!window.FarmSyncSafety?.isReady?.();}

  function photoResolver(id){
    id=String(id||"");
    const svc=window.FarmBirdPhotosV4||window.FarmBirdPhotosV3||window.FarmBirdPhotosV2;
    const fromService=svc?.get?.(id);
    if(isImage(fromService))return fromService;
    const recovered=window.FarmBirdPhotoRecoveryV2?.getCloudRecord?.(id);
    if(recovered&&!recovered.deleted&&isImage(recovered.dataUrl))return recovered.dataUrl;
    const map=read(KEYS.photos,{});const value=map?.[id];
    return isImage(value)?value:"";
  }

  async function waitBuilder(timeout=8000){
    const start=Date.now();
    while(Date.now()-start<timeout){if(window.FarmPublicCustomerBuilderV2?.build||window.FarmPublicCustomerBuilderV1?.build)return true;await new Promise(r=>setTimeout(r,50));}
    return false;
  }
  async function firestoreApi(){
    if(api)return api;
    api=await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return api;
  }
  async function ownerContext(){
    if(window.PublicCustomerOwnerAuth?.currentOwner){
      const user=await window.PublicCustomerOwnerAuth.currentOwner();
      if(user&&String(user.uid||"")===OWNER_UID){
        const db=await window.PublicCustomerOwnerAuth.publisherDb?.();
        if(db)return {user,db,source:"isolated-public-owner"};
      }
    }
    if(window.FarmOwnerAuth?.requireSignIn){
      const user=await window.FarmOwnerAuth.requireSignIn();
      if(user&&String(user.uid||"")===OWNER_UID&&window.FirestoreDB)return {user,db:window.FirestoreDB,source:"farm-owner"};
    }
    const user=window.FirebaseUser;
    return user&&!user.isAnonymous&&String(user.uid||"")===OWNER_UID&&window.FirestoreDB?{user,db:window.FirestoreDB,source:"farm-owner-current"}:null;
  }
  async function currentOwnerContext(){
    try{
      if(window.PublicCustomerOwnerAuth?.currentOwner){
        const user=await window.PublicCustomerOwnerAuth.currentOwner();
        if(user&&String(user.uid||"")===OWNER_UID){
          const db=await window.PublicCustomerOwnerAuth.publisherDb?.();
          if(db)return {user,db,source:"isolated-public-owner"};
        }
      }
    }catch{}
    const user=window.FirebaseUser;
    return user&&!user.isAnonymous&&String(user.uid||"")===OWNER_UID&&window.FirestoreDB?{user,db:window.FirestoreDB,source:"farm-owner-current"}:null;
  }
  function build(){
    const builder=window.FarmPublicCustomerBuilderV2||window.FarmPublicCustomerBuilderV1;
    if(!builder?.build)throw new Error("Public customer builder is not ready");
    return builder.build({
      app2:read(KEYS.app2,{}),inventory:read(KEYS.inventory,{}),entries:read(KEYS.entries,[]),settings:read(KEYS.settings,{}),weather:read(KEYS.weather,{}),deluxe:read(KEYS.deluxe,{}),photoResolver
    });
  }

  async function publishNow(reason="manual"){
    if(running)return lastResult||{ok:false,busy:true};
    running=true;
    try{
      if(!(await waitBuilder()))throw new Error("Public customer sanitizer unavailable");
      const owner=await ownerContext();
      if(!owner)throw new Error("Authorized owner publishing session required before customer data can sync");
      const f=await firestoreApi();
      const db=owner.db;
      const out=build();
      const hashes=readHashes();if(!hashes.flock||typeof hashes.flock!=="object")hashes.flock={};
      let writes=0,preservedPhotos=0;
      const summaryHash=hash(out.summary);
      if(hashes.summary!==summaryHash){
        await f.setDoc(f.doc(db,"public_customer","current"),{...out.summary,publishedAt:Date.now(),serverUpdatedAt:f.serverTimestamp()});
        hashes.summary=summaryHash;writes++;
      }

      const activeKeys=new Set();
      for(const bird of out.flock){
        const key=String(bird.id||"");
        if(!key)continue;
        activeKeys.add(key);
        let publishBird={...bird};
        let birdHash=hash(publishBird);

        // Never erase an already-published customer photo just because this device's
        // local cache is temporarily missing that bird. Only read the existing public
        // document when the local candidate is blank AND the hash says a write may be needed.
        if(!isImage(publishBird.photo)&&hashes.flock[key]!==birdHash){
          try{
            const ref=f.doc(db,"public_flock",safeDocId(key));
            const existing=await f.getDoc(ref);
            const existingPhoto=existing.exists()?existing.data()?.photo:"";
            if(isImage(existingPhoto)){
              publishBird.photo=existingPhoto;
              birdHash=hash(publishBird);
              preservedPhotos++;
            }
          }catch(error){
            console.warn("Could not check existing public flock photo:",key,error);
          }
        }

        if(hashes.flock[key]===birdHash)continue;
        await f.setDoc(f.doc(db,"public_flock",safeDocId(key)),{...publishBird,birdId:key,publishedAt:Date.now(),serverUpdatedAt:f.serverTimestamp()});
        hashes.flock[key]=birdHash;writes++;
      }
      for(const key of Object.keys(hashes.flock)){
        if(activeKeys.has(key))continue;
        await f.deleteDoc(f.doc(db,"public_flock",safeDocId(key)));
        delete hashes.flock[key];writes++;
      }

      writeHashes(hashes);
      lastResult={ok:true,writes,preservedPhotos,reason,flock:out.flock.length,photos:out.flock.filter(b=>isImage(b.photo)).length,available:out.summary.availability.eggs,publicVersion:Number(out.summary.publicVersion)||1,authSource:owner.source,publishedAt:Date.now()};
      window.dispatchEvent(new CustomEvent("customer-public-published",{detail:lastResult}));
      return lastResult;
    } catch(error){
      lastResult={ok:false,error:String(error?.message||error),reason};
      console.warn("Customer public snapshot publish waiting:",error);
      return lastResult;
    } finally {running=false;}
  }
  function schedule(reason="event",delay=700){
    if(!mainReady())return false;
    clearTimeout(timer);
    timer=setTimeout(()=>void publishNow(reason),delay);
    return true;
  }

  function loadRecoveryModule(){
    if(window.FarmBirdPhotoRecoveryV2?.scan)return Promise.resolve(true);
    return new Promise(resolve=>{
      const existing=[...document.scripts].find(s=>String(s.src||"").includes("bird-photo-recovery-v2.js"));
      if(existing){
        const start=Date.now();
        const wait=()=>{if(window.FarmBirdPhotoRecoveryV2?.scan)return resolve(true);if(Date.now()-start>8000)return resolve(false);setTimeout(wait,100);};
        wait();return;
      }
      const s=document.createElement("script");
      s.src=`bird-photo-recovery-v2.js?v=${encodeURIComponent(String(window.__ChickenEggsBuild||Date.now()))}`;
      s.async=true;s.onload=()=>resolve(!!window.FarmBirdPhotoRecoveryV2?.scan);s.onerror=()=>resolve(false);
      document.body.appendChild(s);
    });
  }

  async function repairCustomerPhotos(force=false){
    if(repairRunning)return {ok:false,busy:true};
    const marker=read(PHOTO_REPAIR_MARKER,{});
    if(!force&&marker?.completed===true)return {ok:true,skipped:true,marker};
    if(!mainReady())return {ok:false,waiting:"farm-sync"};
    const owner=await currentOwnerContext();
    if(!owner)return {ok:false,waiting:"owner-auth"};
    repairRunning=true;
    try{
      const loaded=await loadRecoveryModule();
      if(!loaded)throw new Error("Photo recovery module could not load");
      const recovered=await window.FarmBirdPhotoRecoveryV2.scan();
      await new Promise(r=>setTimeout(r,250));
      // Force a fresh comparison against the rebuilt photo resolver while keeping
      // summary hashing intact. Existing public photos are protected by publishNow().
      const hashes=readHashes();hashes.flock={};writeHashes(hashes);
      const result=await publishNow("one-time-public-photo-repair");
      if(!result?.ok)throw new Error(result?.error||"Public photo republish did not complete");
      const done={completed:true,at:Date.now(),visibleNow:Number(recovered?.visibleNow)||0,recovered:Number(recovered?.recovered?.length)||0,publishedPhotos:Number(result.photos)||0,writes:Number(result.writes)||0};
      write(PHOTO_REPAIR_MARKER,done);
      window.dispatchEvent(new CustomEvent("customer-public-photo-repair-complete",{detail:done}));
      return {ok:true,...done};
    }catch(error){
      console.warn("One-time customer photo repair waiting:",error);
      return {ok:false,error:String(error?.message||error)};
    }finally{repairRunning=false;}
  }

  function maybeRepairSoon(){
    const marker=read(PHOTO_REPAIR_MARKER,{});
    if(marker?.completed===true)return;
    setTimeout(()=>void repairCustomerPhotos(false),1800);
  }

  function install(){
    const events=["core-data-synced","farm-data-synced","farm-local-data-changed","bird-photos-changed","weather-intelligence-updated","inventory-authority-changed"];
    for(const name of events)window.addEventListener(name,()=>{if(mainReady())schedule(name,700);});
    window.addEventListener("public-customer-owner-auth-changed",e=>{if(e.detail?.connected&&mainReady()){schedule("owner-auth-connected",150);maybeRepairSoon();}});
    window.addEventListener("online",()=>{if(mainReady()){schedule("online",1200);maybeRepairSoon();}});
    window.addEventListener("farm-sync-ready",maybeRepairSoon,{once:true});
    if(mainReady())maybeRepairSoon();
  }

  window.FarmPublicCustomerPublisherV1={version:6,publishNow,schedule,repairCustomerPhotos,buildPreview:build,last:()=>lastResult,ownerUid:()=>OWNER_UID};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();