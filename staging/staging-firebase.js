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

  function localReady(){
    const entries=read(ENTRIES,[]),seed=read(SEED_META,null);
    if(!seed?.completed){
      write(SEED_META,{completed:true,importedAt:Date.now(),coreEntries:Array.isArray(entries)?entries.length:0,photos:0,fullCoreRefresh:false,source:"isolated browser staging copy; zero Firebase reads on startup"});
    }
    readyState=true;refreshAppMemory();unlockSandbox();setStatus("STAGING • isolated local sandbox ready • 0 Firebase reads");
    queueMicrotask(()=>{
      window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,localOnly:true,zeroFirebaseReads:true}}));
      window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,localOnly:true,zeroFirebaseReads:true}}));
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,localOnly:true,zeroFirebaseReads:true}}));
    });
    return Promise.resolve(true);
  }

  async function importLive(){
    if(importPromise)return importPromise;
    importPromise=(async()=>{
      setStatus("STAGING • refreshing compact read-only LIVE snapshot…");
      await ensureAuth();
      const cachedEntries=read(ENTRIES,[]);
      // Explicit live refresh reads only the five compact documents when staging
      // already has egg/sale history. Full core history is fetched only when the
      // staging browser has no history at all.
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
      write(SEED_META,{completed:true,importedAt:Date.now(),coreEntries:entries.length,photos:0,fullCoreRefresh:!!coreSnap,source:"explicit compact live Firebase refresh; legacy photo scan omitted"});
      readyState=true;refreshAppMemory();unlockSandbox();setStatus("STAGING • isolated sandbox refreshed from LIVE");
      window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,imported:true,explicitLiveRefresh:true}}));
      window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,imported:true,explicitLiveRefresh:true}}));
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,explicitLiveRefresh:true}}));
      return true;
    })().catch(error=>{
      console.error("STAGING explicit live snapshot refresh failed; keeping isolated browser copy:",error);
      readyState=true;refreshAppMemory();unlockSandbox();setStatus("STAGING • local sandbox ready (LIVE refresh unavailable)");
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,localOnly:true}}));
      return false;
    }).finally(()=>{importPromise=null;});
    return importPromise;
  }

  async function localSync(){readyState=true;unlockSandbox();setStatus("STAGING • isolated sandbox saved");window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,localOnly:true}}));return true;}

  window.FarmSyncSafety={ready:localReady,isReady:()=>readyState,refresh:localSync,getDirtyKeys:()=>[],version:"STAGING-LOCAL-FIRST-5-ZERO-AUTO-READS"};
  window.EggSyncAuthorityReady=localReady;
  window.syncFarmNow=localSync;
  window.refreshCoreFromFirebase=localSync;
  window.StagingSandbox={environment:"staging",liveFirebaseAccess:"READ ONLY — explicit refresh only",resetFromLive:importLive,seedInfo:()=>read(SEED_META,null)};

  // No Firestore handles are exposed to legacy staging modules, and normal
  // staging startup performs zero Firestore reads. Only the explicit Refresh
  // Test Data From Live control invokes importLive().
  void localReady();
}
