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
  function hash(value){
    const text=stableString(value);let h=2166136261;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(36);
  }
  function safeDocId(id){return String(id||"").replace(/[^A-Za-z0-9_-]/g,"_").slice(0,120)||"bird";}
  function photoResolver(id){
    const svc=window.FarmBirdPhotosV4||window.FarmBirdPhotosV3||window.FarmBirdPhotosV2;
    const fromService=svc?.get?.(String(id||""));
    if(typeof fromService==="string"&&fromService)return fromService;
    const map=read(KEYS.photos,{});const value=map?.[String(id||"")];
    return typeof value==="string"?value:"";
  }
  async function waitBuilder(timeout=8000){
    const start=Date.now();
    while(Date.now()-start<timeout){if(window.FarmPublicCustomerBuilderV1?.build)return true;await new Promise(r=>setTimeout(r,50));}
    return false;
  }
  async function owner(){
    if(window.FarmOwnerAuth?.requireSignIn){const user=await window.FarmOwnerAuth.requireSignIn();return user&&String(user.uid||"")===OWNER_UID?user:null;}
    const user=window.FirebaseUser;
    return user&&!user.isAnonymous&&String(user.uid||"")===OWNER_UID?user:null;
  }
  async function firestore(){
    if(api)return api;
    const start=Date.now();
    while(Date.now()-start<10000){if(window.FirestoreDB)break;await new Promise(r=>setTimeout(r,75));}
    if(!window.FirestoreDB)throw new Error("Private farm Firestore is not ready");
    api=await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return api;
  }
  function build(){
    if(!window.FarmPublicCustomerBuilderV1?.build)throw new Error("Public customer builder is not ready");
    return window.FarmPublicCustomerBuilderV1.build({
      app2:read(KEYS.app2,{}),inventory:read(KEYS.inventory,{}),entries:read(KEYS.entries,[]),settings:read(KEYS.settings,{}),weather:read(KEYS.weather,{}),deluxe:read(KEYS.deluxe,{}),photoResolver
    });
  }
  async function publishNow(reason="manual"){
    if(running)return lastResult||{ok:false,busy:true};
    running=true;
    try{
      if(!(await waitBuilder()))throw new Error("Public customer sanitizer unavailable");
      const user=await owner();
      if(!user)throw new Error("Authorized owner login required before publishing customer data");
      const f=await firestore();
      const out=build();
      const hashes=readHashes();if(!hashes.flock||typeof hashes.flock!=="object")hashes.flock={};
      let writes=0;
      const summaryHash=hash(out.summary);
      if(hashes.summary!==summaryHash){
        await f.setDoc(f.doc(window.FirestoreDB,"public_customer","current"),{...out.summary,publishedAt:Date.now(),serverUpdatedAt:f.serverTimestamp()});
        hashes.summary=summaryHash;writes++;
      }
      for(const bird of out.flock){
        const birdHash=hash(bird),key=String(bird.id||"");
        if(hashes.flock[key]===birdHash)continue;
        await f.setDoc(f.doc(window.FirestoreDB,"public_flock",safeDocId(key)),{...bird,birdId:key,publishedAt:Date.now(),serverUpdatedAt:f.serverTimestamp()});
        hashes.flock[key]=birdHash;writes++;
      }
      writeHashes(hashes);
      lastResult={ok:true,writes,reason,flock:out.flock.length,available:out.summary.availability.eggs,publishedAt:Date.now()};
      window.dispatchEvent(new CustomEvent("customer-public-published",{detail:lastResult}));
      return lastResult;
    } catch(error){
      lastResult={ok:false,error:String(error?.message||error),reason};
      console.warn("Customer public snapshot publish waiting:",error);
      return lastResult;
    } finally {running=false;}
  }
  function schedule(reason="event",delay=900){clearTimeout(timer);timer=setTimeout(()=>void publishNow(reason),delay);}
  function install(){
    const events=["farm-sync-ready","core-data-synced","farm-data-synced","farm-local-data-changed","bird-photos-changed"];
    for(const name of events)window.addEventListener(name,()=>schedule(name));
    window.addEventListener("online",()=>schedule("online",1200));
    setTimeout(()=>schedule("startup",0),2200);
  }

  window.FarmPublicCustomerPublisherV1={version:1,publishNow,schedule,buildPreview:build,last:()=>lastResult,ownerUid:()=>OWNER_UID};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
