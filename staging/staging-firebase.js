import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

if (!window.__ChickenEggsStagingFirebase) {
  window.__ChickenEggsStagingFirebase = true;
  window.__STAGING_FIREBASE_READONLY__ = true;

  const firebaseConfig={apiKey:"AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",authDomain:"chicken-eggs-53358.firebaseapp.com",projectId:"chicken-eggs-53358",storageBucket:"chicken-eggs-53358.firebasestorage.app",messagingSenderId:"461720066101",appId:"1:461720066101:web:6b19a7c4d245f399cf797c"};
  const app=getApps().length?getApp():initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);

  const SEED_META="chickenEggStagingSeedV1",APP2="chickenEggApp2V1",INVENTORY="chickenEggInventoryV2",DELUXE="chickenEggDeluxeV1",BUSINESS="chickenEggBusinessV1",ENTRIES="chickenEggEntriesV102",SETTINGS="chickenEggSettingsV102";
  let readyState=false,importPromise=null;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  function write(key,value){const doWrite=()=>localStorage.setItem(key,JSON.stringify(value)),oldRemote=window.__farmApplyingRemote;window.__farmApplyingRemote=true;try{const pre=window.FarmBootstrapSafety;if(pre?.runBypass)return pre.runBypass(doWrite);return doWrite();}finally{window.__farmApplyingRemote=oldRemote;}}
  function unlockSandbox(){try{window.FarmBootstrapSafety?.unlock?.();}catch{}}
  function refreshAppMemory(){try{window.loadLocal?.();}catch{}try{window.loadFarmSettings?.();}catch{}try{window.__reloadFarm2Memory?.();}catch{}try{window.updateApp?.();}catch{}}
  const setStatus=text=>{try{if(typeof window.setSyncStatus==="function")window.setSyncStatus(text);else{const el=document.getElementById("syncStatus");if(el)el.textContent=text;}}catch{}};
  async function ensureAuth(){if(auth.currentUser)return auth.currentUser;const result=await signInAnonymously(auth);return result?.user||auth.currentUser;}

  function mirrorLiveBrowser(){
    try{return window.StagingLocalSeedV1?.syncFromLiveBrowser?.()||{copied:0,hasLiveBrowserData:false};}
    catch(error){console.warn("STAGING live-browser mirror unavailable:",error);return{copied:0,hasLiveBrowserData:false};}
  }

  function localReady(){
    const mirror=mirrorLiveBrowser();
    const entries=read(ENTRIES,[]),seed=read(SEED_META,null);
    if(!seed?.completed){
      write(SEED_META,{completed:true,importedAt:Date.now(),coreEntries:Array.isArray(entries)?entries.length:0,photos:0,fullCoreRefresh:false,source:mirror?.hasLiveBrowserData?"current LIVE app browser mirror; zero Firebase reads":"isolated browser staging copy; zero Firebase reads",localMirror:!!mirror?.hasLiveBrowserData,copiedKeys:Number(mirror?.copied)||0});
    }
    readyState=true;refreshAppMemory();unlockSandbox();
    setStatus(mirror?.hasLiveBrowserData?`STAGING • mirrored current LIVE app • ${Number(mirror.copied)||0} keys • 0 Firebase reads`:`STAGING • isolated local sandbox ready • 0 Firebase reads`);
    queueMicrotask(()=>{
      window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,localOnly:true,zeroFirebaseReads:true,liveBrowserMirror:!!mirror?.hasLiveBrowserData}}));
      window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,localOnly:true,zeroFirebaseReads:true,liveBrowserMirror:!!mirror?.hasLiveBrowserData}}));
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,localOnly:true,zeroFirebaseReads:true,liveBrowserMirror:!!mirror?.hasLiveBrowserData}}));
    });
    return Promise.resolve(true);
  }

  // Cloud fallback exists only for a browser that has no usable LIVE app state.
  // Normal staging startup and normal "Refresh Test Data From Live" use the
  // same-origin live browser mirror and therefore cost zero Firestore reads.
  async function importLiveCloudFallback(){
    if(importPromise)return importPromise;
    importPromise=(async()=>{
      setStatus("STAGING • no LIVE browser state found; refreshing compact read-only Firebase snapshot…");
      await ensureAuth();
      const cachedEntries=read(ENTRIES,[]);
      const needCoreFetch=!Array.isArray(cachedEntries)||!cachedEntries.length;
      const corePromise=needCoreFetch?getDocs(query(collection(db,"entries"),where("type","in",["eggs","sale"]))):Promise.resolve(null);
      const [app2Snap,invSnap,deluxeSnap,businessSnap,settingsSnap,coreSnap]=await Promise.all([
        getDoc(doc(db,"entries","farm_app_2_v1")),
        getDoc(doc(db,"entries","farm_inventory_v2")),
        getDoc(doc(db,"entries","farm_deluxe_v1")),
        getDoc(doc(db,"entries","farm_business_v1")),
        getDoc(doc(db,"farm","settings")),
        corePromise
      ]);
      const app2=app2Snap.exists()?app2Snap.data()?.farmApp2:null,inventory=invSnap.exists()?invSnap.data()?.inventory:null,deluxe=deluxeSnap.exists()?deluxeSnap.data()?.deluxe:null,business=businessSnap.exists()?businessSnap.data()?.business:null,settings=settingsSnap.exists()?settingsSnap.data():null;
      const entries=coreSnap?coreSnap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x&&(x.type==="eggs"||x.type==="sale")):(Array.isArray(cachedEntries)?cachedEntries:[]);
      if(app2)write(APP2,app2);if(inventory)write(INVENTORY,inventory);if(deluxe)write(DELUXE,deluxe);if(business)write(BUSINESS,business);if(settings)write(SETTINGS,settings);if(coreSnap)write(ENTRIES,entries);
      write(SEED_META,{completed:true,importedAt:Date.now(),coreEntries:entries.length,photos:0,fullCoreRefresh:!!coreSnap,source:"compact read-only Firebase fallback because LIVE browser state was unavailable"});
      readyState=true;refreshAppMemory();unlockSandbox();setStatus("STAGING • isolated sandbox refreshed from Firebase fallback");
      window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,imported:true,firebaseFallback:true}}));
      window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,imported:true,firebaseFallback:true}}));
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,firebaseFallback:true}}));
      return true;
    })().catch(error=>{
      console.error("STAGING Firebase fallback failed; keeping isolated browser copy:",error);
      readyState=true;refreshAppMemory();unlockSandbox();setStatus("STAGING • local sandbox ready (Firebase fallback unavailable)");
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,localOnly:true}}));
      return false;
    }).finally(()=>{importPromise=null;});
    return importPromise;
  }

  async function refreshFromLiveApp(){
    const mirror=mirrorLiveBrowser();
    if(mirror?.hasLiveBrowserData){
      readyState=true;refreshAppMemory();unlockSandbox();
      setStatus(`STAGING • refreshed from current LIVE app • ${Number(mirror.copied)||0} keys • 0 Firebase reads`);
      window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,liveBrowserMirror:true,explicitRefresh:true,zeroFirebaseReads:true}}));
      window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,liveBrowserMirror:true,explicitRefresh:true,zeroFirebaseReads:true}}));
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,liveBrowserMirror:true,explicitRefresh:true,zeroFirebaseReads:true}}));
      return true;
    }
    return importLiveCloudFallback();
  }

  async function localSync(){readyState=true;unlockSandbox();setStatus("STAGING • isolated sandbox saved");window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,localOnly:true}}));return true;}

  window.FarmSyncSafety={ready:localReady,isReady:()=>readyState,refresh:localSync,getDirtyKeys:()=>[],version:"STAGING-LIVE-BROWSER-MIRROR-6"};
  window.EggSyncAuthorityReady=localReady;
  window.syncFarmNow=localSync;
  window.refreshCoreFromFirebase=localSync;
  window.StagingSandbox={
    environment:"staging",
    liveFirebaseAccess:"READ ONLY — fallback only when LIVE browser state is unavailable",
    resetFromLive:refreshFromLiveApp,
    resetFromCloud:importLiveCloudFallback,
    mirrorLiveBrowser,
    seedInfo:()=>read(SEED_META,null)
  };

  // No Firestore handles are exposed to legacy staging modules. Normal staging
  // startup mirrors the current LIVE app's same-origin browser state at zero cost.
  void localReady();
}
