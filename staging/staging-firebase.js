import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

if (!window.__ChickenEggsStagingFirebase) {
  window.__ChickenEggsStagingFirebase = true;
  window.__STAGING_FIREBASE_READONLY__ = true;

  const firebaseConfig={apiKey:"AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",authDomain:"chicken-eggs-53358.firebaseapp.com",projectId:"chicken-eggs-53358",storageBucket:"chicken-eggs-53358.firebasestorage.app",messagingSenderId:"461720066101",appId:"1:461720066101:web:6b19a7c4d245f399cf797c"};
  const app=getApps().length?getApp():initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);

  const SEED_META="chickenEggStagingSeedV1",APP2="chickenEggApp2V1",INVENTORY="chickenEggInventoryV2",DELUXE="chickenEggDeluxeV1",BUSINESS="chickenEggBusinessV1",ENTRIES="chickenEggEntriesV102",SETTINGS="chickenEggSettingsV102";
  const REQUIRED=[APP2,INVENTORY,ENTRIES,SETTINGS];
  let readyState=false,importPromise=null,lastLiveSourceResult=null;

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  function write(key,value){
    const doWrite=()=>localStorage.setItem(key,JSON.stringify(value)),oldRemote=window.__farmApplyingRemote;
    window.__farmApplyingRemote=true;
    try{const pre=window.FarmBootstrapSafety;if(pre?.runBypass)return pre.runBypass(doWrite);return doWrite();}
    finally{window.__farmApplyingRemote=oldRemote;}
  }
  function unlockSandbox(){try{window.FarmBootstrapSafety?.unlock?.();}catch{}}
  function refreshAppMemory(){try{window.loadLocal?.();}catch{}try{window.loadFarmSettings?.();}catch{}try{window.__reloadFarm2Memory?.();}catch{}try{window.updateApp?.();}catch{}try{window.InventorySystemV6?.render?.();}catch{}try{window.StagingCustomerRequestsV1?.render?.();}catch{}}
  const setStatus=text=>{try{if(typeof window.setSyncStatus==="function")window.setSyncStatus(text);else{const el=document.getElementById("syncStatus");if(el)el.textContent=text;}}catch{}};
  async function ensureAuth(){if(auth.currentUser)return auth.currentUser;const result=await signInAnonymously(auth);return result?.user||auth.currentUser;}
  function same(a,b){try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;}}

  function mirrorLiveBrowser(){
    try{return window.StagingLocalSeedV1?.syncFromLiveBrowser?.()||{copied:0,eligible:0,verified:false,hasLiveBrowserData:false};}
    catch(error){console.warn("STAGING live-browser mirror unavailable:",error);return{copied:0,eligible:0,verified:false,hasLiveBrowserData:false};}
  }

  function publishSourceResult(result){
    lastLiveSourceResult=result||null;
    window.__StagingLiveSourceResult=lastLiveSourceResult;
    if(window.StagingLocalSeedV1&&result)window.StagingLocalSeedV1.result={...result,hasLiveBrowserData:!!result.verified};
    window.dispatchEvent(new CustomEvent("staging-live-source-verified",{detail:result||{}}));
    window.dispatchEvent(new CustomEvent("staging-live-browser-mirrored",{detail:result||{}}));
  }

  function localReady(){
    if(window.StagingStorageSandbox?.overlayActive?.() && lastLiveSourceResult?.verified){
      readyState=true;refreshAppMemory();unlockSandbox();
      setStatus(`STAGING • verified LIVE Firebase snapshot • ${Number(lastLiveSourceResult.copied)||0}/${Number(lastLiveSourceResult.eligible)||0} datasets • memory sandbox`);
      return Promise.resolve(true);
    }
    const mirror=mirrorLiveBrowser();
    if(mirror?.verified)publishSourceResult({...mirror,source:"live-browser"});
    readyState=true;refreshAppMemory();unlockSandbox();
    setStatus(mirror?.verified?`STAGING • verified current LIVE browser copy • ${Number(mirror.copied)||0} datasets`:`STAGING • test sandbox ready • use Refresh Test Data From Live`);
    queueMicrotask(()=>{
      window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,localOnly:true}}));
      window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,localOnly:true}}));
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,localOnly:true}}));
    });
    return Promise.resolve(true);
  }

  async function fetchLiveFirebaseSnapshot(){
    await ensureAuth();
    const [app2Snap,invSnap,deluxeSnap,businessSnap,settingsSnap,coreSnap]=await Promise.all([
      getDoc(doc(db,"entries","farm_app_2_v1")),
      getDoc(doc(db,"entries","farm_inventory_v2")),
      getDoc(doc(db,"entries","farm_deluxe_v1")),
      getDoc(doc(db,"entries","farm_business_v1")),
      getDoc(doc(db,"farm","settings")),
      getDocs(query(collection(db,"entries"),where("type","in",["eggs","sale"])))
    ]);
    if(!app2Snap.exists())throw new Error("LIVE Firebase is missing farm_app_2_v1.");
    if(!invSnap.exists())throw new Error("LIVE Firebase is missing farm_inventory_v2.");
    if(!settingsSnap.exists())throw new Error("LIVE Firebase is missing farm/settings.");
    return {
      [APP2]:app2Snap.data()?.farmApp2||{},
      [INVENTORY]:invSnap.data()?.inventory||{},
      [DELUXE]:deluxeSnap.exists()?(deluxeSnap.data()?.deluxe||{}):{},
      [BUSINESS]:businessSnap.exists()?(businessSnap.data()?.business||{}):{},
      [SETTINGS]:settingsSnap.data()||{},
      [ENTRIES]:coreSnap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x&&(x.type==="eggs"||x.type==="sale"))
    };
  }

  function startQuotaFreeTestMemory(){
    const storage=window.StagingStorageSandbox;
    if(!storage?.beginMemoryOverlay||!storage?.resetVirtualStorage)throw new Error("STAGING memory sandbox is not available.");
    try{storage.resetVirtualStorage();}catch{}
    if(!storage.overlayActive?.())storage.beginMemoryOverlay();
    try{storage.resetVirtualStorage();}catch{}
    return storage.diagnostics?.()||{memoryOverlay:true};
  }

  async function importLiveFirebaseSnapshot(){
    if(importPromise)return importPromise;
    importPromise=(async()=>{
      setStatus("STAGING • reading current LIVE Firebase snapshot…");
      const live=await fetchLiveFirebaseSnapshot();
      startQuotaFreeTestMemory();

      const keys=[APP2,INVENTORY,DELUXE,BUSINESS,SETTINGS,ENTRIES];
      let copied=0;const mismatchedKeys=[];
      for(const key of keys){
        write(key,live[key]);
        const staged=read(key,null);
        if(!same(staged,live[key]))mismatchedKeys.push(key);
        else copied++;
      }
      const requiredPresent=REQUIRED.every(key=>localStorage.getItem(key)!==null);
      const verified=requiredPresent&&mismatchedKeys.length===0&&copied===keys.length;
      if(!verified)throw new Error(`TEST memory-copy verification failed after Firebase read (copied ${copied}/${keys.length}; mismatches ${mismatchedKeys.join(", ")||"none"}).`);

      const result={source:"firebase-read-only-memory",verified:true,hasLiveData:true,hasLiveBrowserData:true,inMemory:true,copied,eligible:keys.length,skipped:0,mismatchedKeys:[],remainingStale:[],at:Date.now(),coreEntries:Array.isArray(live[ENTRIES])?live[ENTRIES].length:0};
      write(SEED_META,{completed:true,importedAt:result.at,coreEntries:result.coreEntries,photos:0,fullCoreRefresh:true,source:"verified read-only LIVE Firebase snapshot in staging memory",localMirror:false,inMemory:true,copiedKeys:copied,eligibleKeys:keys.length,skippedKeys:0,mismatchedKeys:0,coreVerified:true,authoritativeVerified:true});
      publishSourceResult(result);
      readyState=true;refreshAppMemory();unlockSandbox();
      setStatus(`STAGING • verified LIVE Firebase snapshot • ${copied}/${keys.length} datasets • ${result.coreEntries} entries • memory sandbox`);
      window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,imported:true,firebaseReadOnly:true,verified:true,inMemory:true}}));
      window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,imported:true,firebaseReadOnly:true,verified:true,inMemory:true}}));
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,firebaseReadOnly:true,verified:true,inMemory:true}}));
      return true;
    })().catch(error=>{
      console.error("STAGING read-only LIVE Firebase refresh failed:",error);
      publishSourceResult({source:"firebase-read-only-memory",verified:false,hasLiveData:false,hasLiveBrowserData:false,inMemory:true,copied:0,eligible:6,skipped:0,mismatchedKeys:[],remainingStale:[],at:Date.now(),error:String(error?.message||error)});
      readyState=true;refreshAppMemory();unlockSandbox();
      setStatus("STAGING • LIVE Firebase refresh failed — LIVE data unchanged");
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,refreshFailed:true}}));
      return false;
    }).finally(()=>{importPromise=null;});
    return importPromise;
  }

  async function refreshFromLiveApp(){return importLiveFirebaseSnapshot();}
  async function localSync(){readyState=true;unlockSandbox();setStatus("STAGING • isolated memory sandbox saved");window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,localOnly:true,inMemory:true}}));return true;}

  window.FarmSyncSafety={ready:localReady,isReady:()=>readyState,refresh:localSync,getDirtyKeys:()=>[],version:"STAGING-READONLY-LIVE-FIREBASE-MEMORY-3"};
  window.EggSyncAuthorityReady=localReady;
  window.syncFarmNow=localSync;
  window.refreshCoreFromFirebase=localSync;
  window.StagingSandbox={environment:"staging",liveFirebaseAccess:"READ ONLY — explicit refresh reads authoritative LIVE Firebase and keeps the TEST copy only in the staging memory sandbox",resetFromLive:refreshFromLiveApp,resetFromCloud:importLiveFirebaseSnapshot,mirrorLiveBrowser,liveSourceResult:()=>lastLiveSourceResult||window.__StagingLiveSourceResult||null,seedInfo:()=>read(SEED_META,null)};

  void localReady();
}