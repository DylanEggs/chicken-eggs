import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

if (!window.__ChickenEggsStagingFirebase) {
  window.__ChickenEggsStagingFirebase = true;
  window.__STAGING_FIREBASE_READONLY__ = true;

  const firebaseConfig = {
    apiKey:"AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
    authDomain:"chicken-eggs-53358.firebaseapp.com",
    projectId:"chicken-eggs-53358",
    storageBucket:"chicken-eggs-53358.firebasestorage.app",
    messagingSenderId:"461720066101",
    appId:"1:461720066101:web:6b19a7c4d245f399cf797c"
  };

  const app=getApps().length?getApp():initializeApp(firebaseConfig);
  const db=getFirestore(app);
  const auth=getAuth(app);

  const SEED_META="chickenEggStagingSeedV1";
  const APP2="chickenEggApp2V1";
  const INVENTORY="chickenEggInventoryV2";
  const DELUXE="chickenEggDeluxeV1";
  const BUSINESS="chickenEggBusinessV1";
  const ENTRIES="chickenEggEntriesV102";
  const SETTINGS="chickenEggSettingsV102";
  let readyState=false;
  let importPromise=null;

  const read=(key,fallback)=>{
    try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}
    catch{return fallback;}
  };
  function write(key,value){
    const doWrite=()=>localStorage.setItem(key,JSON.stringify(value));
    const oldRemote=window.__farmApplyingRemote;
    window.__farmApplyingRemote=true;
    try{
      const pre=window.FarmBootstrapSafety;
      if(pre?.runBypass)return pre.runBypass(doWrite);
      return doWrite();
    }finally{window.__farmApplyingRemote=oldRemote;}
  }
  function unlockSandbox(){try{window.FarmBootstrapSafety?.unlock?.();}catch{}}
  function refreshAppMemory(){
    try{window.loadLocal?.();}catch{}
    try{window.loadFarmSettings?.();}catch{}
    try{window.__reloadFarm2Memory?.();}catch{}
    try{window.updateApp?.();}catch{}
  }
  const setStatus=text=>{
    try{
      if(typeof window.setSyncStatus==="function")window.setSyncStatus(text);
      else{const el=document.getElementById("syncStatus");if(el)el.textContent=text;}
    }catch{}
  };

  async function ensureAuth(){
    if(auth.currentUser)return auth.currentUser;
    const result=await signInAnonymously(auth);
    return result?.user||auth.currentUser;
  }

  async function importLive(force=false){
    if(importPromise)return importPromise;
    if(!force&&read(SEED_META,null)?.completed){
      readyState=true;
      refreshAppMemory();
      unlockSandbox();
      return true;
    }

    importPromise=(async()=>{
      setStatus("STAGING • copying low-read live snapshot…");
      await ensureAuth();

      const cachedEntries=read(ENTRIES,[]);
      const needCoreFetch=force||!Array.isArray(cachedEntries)||!cachedEntries.length;
      const corePromise=needCoreFetch
        ? getDocs(query(collection(db,"entries"),where("type","in",["eggs","sale"])))
        : Promise.resolve(null);

      // Low-read staging copy: only five compact live documents are always read.
      // Full historical egg/sale rows are read only for an explicit Refresh Test
      // Data action (or when this browser has no staged/local history yet).
      // Legacy bird-photo collections are never scanned in staging anymore.
      const [app2Snap,invSnap,deluxeSnap,businessSnap,settingsSnap,coreSnap]=await Promise.all([
        getDoc(doc(db,"entries","farm_app_2_v1")),
        getDoc(doc(db,"entries","farm_inventory_v2")),
        getDoc(doc(db,"entries","farm_deluxe_v1")),
        getDoc(doc(db,"entries","farm_business_v1")),
        getDoc(doc(db,"farm","settings")),
        corePromise
      ]);

      const app2=app2Snap.exists()?app2Snap.data()?.farmApp2:null;
      const inventory=invSnap.exists()?invSnap.data()?.inventory:null;
      const deluxe=deluxeSnap.exists()?deluxeSnap.data()?.deluxe:null;
      const business=businessSnap.exists()?businessSnap.data()?.business:null;
      const settings=settingsSnap.exists()?settingsSnap.data():null;
      const entries=coreSnap
        ? coreSnap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x&&(x.type==="eggs"||x.type==="sale"))
        : (Array.isArray(cachedEntries)?cachedEntries:[]);

      if(app2)write(APP2,app2);
      if(inventory)write(INVENTORY,inventory);
      if(deluxe)write(DELUXE,deluxe);
      if(business)write(BUSINESS,business);
      if(settings)write(SETTINGS,settings);
      if(coreSnap)write(ENTRIES,entries);

      write(SEED_META,{
        completed:true,
        importedAt:Date.now(),
        coreEntries:entries.length,
        photos:0,
        fullCoreRefresh:!!coreSnap,
        source:"low-read live Firebase snapshot; legacy photo scan omitted"
      });

      readyState=true;
      refreshAppMemory();
      unlockSandbox();
      setStatus("STAGING • isolated low-read sandbox ready");
      window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,imported:true,lowRead:true}}));
      window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,imported:true,lowRead:true}}));
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,lowRead:true}}));
      return true;
    })().catch(error=>{
      console.error("STAGING low-read live snapshot import failed; using isolated browser copy:",error);
      readyState=true;
      refreshAppMemory();
      unlockSandbox();
      setStatus("STAGING • local sandbox ready (live refresh unavailable)");
      window.dispatchEvent(new CustomEvent("farm-sync-ready",{detail:{staging:true,localOnly:true}}));
      return false;
    }).finally(()=>{importPromise=null;});

    return importPromise;
  }

  async function localSync(){
    readyState=true;
    unlockSandbox();
    setStatus("STAGING • isolated sandbox saved");
    window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,localOnly:true}}));
    return true;
  }

  window.FarmSyncSafety={
    ready:()=>importLive(false),
    isReady:()=>readyState,
    refresh:localSync,
    getDirtyKeys:()=>[],
    version:"STAGING-READONLY-4-LOW-READ"
  };
  window.EggSyncAuthorityReady=()=>importLive(false);
  window.syncFarmNow=localSync;
  window.refreshCoreFromFirebase=localSync;
  window.StagingSandbox={
    environment:"staging",
    liveFirebaseAccess:"READ ONLY",
    resetFromLive:()=>importLive(true),
    seedInfo:()=>read(SEED_META,null)
  };

  // Deliberately DO NOT expose FirestoreDB/FirebaseUser. Any legacy module that
  // tries a direct cloud write therefore cannot reach the real database here.
  void importLive(false);
}
