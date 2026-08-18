(() => {
  "use strict";
  if (window.FarmPublicCustomerPublisherV1) return;

  const OWNER_UID="aLvjMpXgMJf5W3YUjQM6wqKagLo2";
  const HASH_KEY="chickenEggPublicPublisherHashV1";
  const KEYS={app2:"chickenEggApp2V1",inventory:"chickenEggInventoryV2",entries:"chickenEggEntriesV102",settings:"chickenEggSettingsV102",weather:"chickenEggWeatherIntelligenceV2",deluxe:"chickenEggDeluxeV1",photos:"chickenEggLocalBirdPhotosV1"};
  let api=null,running=false,timer=null,lastResult=null;

  function read(key,fallback){try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw);}catch{return fallback;}}
  function readHashes(){const x=read(HASH_KEY,{});return x&&typeof x==="object"?x:{summary:"",flock:{}};}
  function writeHashes(value){try{localStorage.setItem(HASH_KEY,JSON.stringify(value));}catch{}}
  function stableString(value){try{return JSON.stringify(value);}catch{return "";}}
  function hash(value){const text=stableString(value);let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function safeDocId(id){return String(id||"").replace(/[^A-Za-z0-9_-]/g,"_").slice(0,120)||"bird";}
  function mainReady(){return !!window.FarmSyncSafety?.isReady?.();}
  function photoResolver(id){
    const svc=window.FarmBirdPhotosV4||window.FarmBirdPhotosV3||window.FarmBirdPhotosV2;
    const fromService=svc?.get?.(String(id||""));
    if(typeof fromService==="string"&&fromService)return fromService;
    const map=read(KEYS.photos,{});const value=map?.[String(id||"")];
    return typeof value==="string"?value:"";
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
      let writes=0;
      const summaryHash=hash(out.summary);
      if(hashes.summary!==summaryHash){
        await f.setDoc(f.doc(db,"public_customer","current"),{...out.summary,publishedAt:Date.now(),serverUpdatedAt:f.serverTimestamp()});
        hashes.summary=summaryHash;writes++;
      }

      const activeKeys=new Set();
      for(const bird of out.flock){
        const birdHash=hash(bird),key=String(bird.id||"");
        if(!key)continue;
        activeKeys.add(key);
        if(hashes.flock[key]===birdHash)continue;
        await f.setDoc(f.doc(db,"public_flock",safeDocId(key)),{...bird,birdId:key,publishedAt:Date.now(),serverUpdatedAt:f.serverTimestamp()});
        hashes.flock[key]=birdHash;writes++;
      }
      for(const key of Object.keys(hashes.flock)){
        if(activeKeys.has(key))continue;
        await f.deleteDoc(f.doc(db,"public_flock",safeDocId(key)));
        delete hashes.flock[key];writes++;
      }

      writeHashes(hashes);
      lastResult={ok:true,writes,reason,flock:out.flock.length,available:out.summary.availability.eggs,publicVersion:Number(out.summary.publicVersion)||1,authSource:owner.source,publishedAt:Date.now()};
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
  function install(){
    // These events fire both during startup bootstrap and during real later changes.
    // Ignore every bootstrap event so customer publishing cannot compete with the
    // main Firebase connection. Once main sync is ready, the same events publish normally.
    const events=["core-data-synced","farm-data-synced","farm-local-data-changed","bird-photos-changed","weather-intelligence-updated","inventory-authority-changed"];
    for(const name of events)window.addEventListener(name,()=>{if(mainReady())schedule(name,700);});
    window.addEventListener("public-customer-owner-auth-changed",e=>{if(e.detail?.connected&&mainReady())schedule("owner-auth-connected",150);});
    window.addEventListener("online",()=>{if(mainReady())schedule("online",1200);});
    // No farm-sync-ready/startup publish. If nothing changed, the existing public
    // snapshot is already current and there is no reason to start a second Firebase app.
  }

  window.FarmPublicCustomerPublisherV1={version:5,publishNow,schedule,buildPreview:build,last:()=>lastResult,ownerUid:()=>OWNER_UID};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
