import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

if(!window.__eggAppLegacyIntervalGuard){
  window.__eggAppLegacyIntervalGuard=true;
  const nativeSetInterval=window.setInterval.bind(window);
  window.setInterval=function(fn,delay,...args){
    const ms=Number(delay)||0;
    let source="";
    try{source=typeof fn==="function"?Function.prototype.toString.call(fn):String(fn||"");}catch{}
    const legacyFun=ms===3000&&source.includes("hook();renderFun()");
    const legacyInsights=ms===3500&&source.includes("hook();render()");
    const legacyBusiness=ms===3500&&source.includes("hookScreen();render()");
    if(legacyFun||legacyInsights||legacyBusiness){console.log("✅ Blocked legacy background redraw timer");return 0;}
    return nativeSetInterval(fn,delay,...args);
  };
}

const firebaseConfig = {
  apiKey: "AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
  authDomain: "chicken-eggs-53358.firebaseapp.com",
  projectId: "chicken-eggs-53358",
  storageBucket: "chicken-eggs-53358.firebasestorage.app",
  messagingSenderId: "461720066101",
  appId: "1:461720066101:web:6b19a7c4d245f399cf797c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
window.FirebaseApp = app;
window.FirestoreDB = db;
window.FirebaseAuth = auth;

const DATASETS = [
  { key:"chickenEggApp2V1", id:"farm_app_2_v1", field:"farmApp2", kind:"app2" },
  { key:"chickenEggInventoryV2", id:"farm_inventory_v2", field:"inventory", kind:"inventory" },
  { key:"chickenEggDeluxeV1", id:"farm_deluxe_v1", field:"deluxe", kind:"plain" },
  { key:"chickenEggBusinessV1", id:"farm_business_v1", field:"business", kind:"business" }
];
const CORE_ENTRIES_KEY = "chickenEggEntriesV102";
const CORE_SETTINGS_KEY = "chickenEggSettingsV102";
let farmSyncing = false;
let coreSyncing = false;
let listenerStarted = false;
let suppressLocalHook = false;
const timers = new Map();

function readLocal(key){ try{return JSON.parse(localStorage.getItem(key)||"null");}catch{return null;} }
function stamp(v){ return Number(v?.updatedAt)||0; }
function clean(v){
  if(Array.isArray(v))return v.map(clean);
  if(!v||typeof v!=="object")return v;
  const out={};
  Object.keys(v).sort().forEach(k=>{if(k!=="updatedAt"&&k!=="serverUpdatedAt")out[k]=clean(v[k]);});
  return out;
}
function same(a,b){try{return JSON.stringify(clean(a))===JSON.stringify(clean(b));}catch{return false;}}
function writeLocal(key,value){
  suppressLocalHook=true;
  try{localStorage.setItem(key,JSON.stringify(value));}
  finally{suppressLocalHook=false;}
  window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{key}}));
}

async function writeCloud(ds,value){
  const version=Math.max(Date.now(),stamp(value)+1);
  const payload={...(value||{}),updatedAt:version};
  await setDoc(doc(db,"entries",ds.id),{
    type:ds.kind,
    [ds.field]:payload,
    updatedAt:version,
    serverUpdatedAt:serverTimestamp()
  },{merge:true});
  writeLocal(ds.key,payload);
  return payload;
}

async function syncDataset(ds){
  if(!auth.currentUser)return;
  const snap=await getDoc(doc(db,"entries",ds.id));
  const local=readLocal(ds.key);
  const remote=snap.exists()?(snap.data()?.[ds.field]||null):null;
  if(!local&&!remote)return;
  if(local&&!remote){await writeCloud(ds,local);return;}
  if(!local&&remote){writeLocal(ds.key,remote);return;}

  const lt=stamp(local), rt=stamp(remote);
  if(lt>rt){await writeCloud(ds,local);return;}
  if(rt>lt){writeLocal(ds.key,remote);return;}
  if(!same(local,remote)){
    writeLocal(ds.key,remote);
  }
}

async function syncAllFarmData(){
  if(farmSyncing||!auth.currentUser)return;
  farmSyncing=true;
  try{for(const ds of DATASETS)await syncDataset(ds);}
  catch(e){console.warn("Farm cross-device sync error:",e);}
  finally{farmSyncing=false;}
}
function scheduleDatasetSync(ds){
  clearTimeout(timers.get(ds.key));
  timers.set(ds.key,setTimeout(async()=>{
    timers.delete(ds.key);
    try{await syncDataset(ds);}catch(e){console.warn(`${ds.kind} immediate sync error:`,e);}
  },250));
}

const nativeSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
  nativeSetItem.call(this,key,value);
  if(suppressLocalHook||this!==window.localStorage)return;
  const ds=DATASETS.find(x=>x.key===String(key));
  if(ds)scheduleDatasetSync(ds);
};

async function loadCoreFromCloud(){
  if(coreSyncing||!window.ChickenEggsDB)return;
  coreSyncing=true;
  try{
    if(typeof window.setSyncStatus==="function")window.setSyncStatus("Checking Firebase...");
    const [settings,allRows]=await Promise.all([
      window.ChickenEggsDB.loadFarmSettings(),
      window.ChickenEggsDB.loadEntries()
    ]);
    const rows=(Array.isArray(allRows)?allRows:[]).filter(r=>r&&(r.type==="eggs"||r.type==="sale"));
    nativeSetItem.call(localStorage,CORE_ENTRIES_KEY,JSON.stringify(rows));
    if(settings)nativeSetItem.call(localStorage,CORE_SETTINGS_KEY,JSON.stringify(settings));
    if(typeof window.loadLocal==="function")window.loadLocal();
    if(typeof window.loadFarmSettings==="function")window.loadFarmSettings();
    if(typeof window.updateApp==="function")window.updateApp();
    window.dispatchEvent(new CustomEvent("core-data-synced"));
    if(typeof window.setSyncStatus==="function")window.setSyncStatus("Firebase synced "+new Date().toLocaleTimeString());
  }catch(e){
    console.warn("Core Firebase refresh failed:",e);
    if(typeof window.setSyncStatus==="function")window.setSyncStatus("Offline/local data shown");
  }finally{coreSyncing=false;}
}

function installCoreAuthority(){
  if(typeof window.cloudLoad==="function")window.cloudLoad=loadCoreFromCloud;
  if(typeof window.startEntryListener==="function")window.startEntryListener=async()=>null;
  if(window.ChickenEggsDB?.subscribeEntries){window.ChickenEggsDB.subscribeEntries=async()=>()=>{};}
}
installCoreAuthority();

function startListener(){
  if(listenerStarted)return;
  listenerStarted=true;
  let first=true;
  onSnapshot(collection(db,"entries"),snap=>{
    const changes=snap.docChanges();
    if(changes.some(c=>{const d=c.doc.data()||{};return d.type==="eggs"||d.type==="sale";}))loadCoreFromCloud();
    for(const change of changes){
      const ds=DATASETS.find(x=>x.id===change.doc.id);
      if(!ds)continue;
      const remote=change.doc.data()?.[ds.field]||null;
      const local=readLocal(ds.key);
      if(remote&&(!local||stamp(remote)>stamp(local)||(stamp(remote)===stamp(local)&&!same(remote,local))))writeLocal(ds.key,remote);
      else if(local&&remote&&stamp(local)>stamp(remote)&&!first)scheduleDatasetSync(ds);
    }
    first=false;
  },e=>console.warn("Firebase change listener error:",e));
}

function installDailyRecordsFix(){
  let queued=false;
  const value=v=>Number(v)||0;
  const rev=e=>value(e.dozenSold)*value(e.dozenPrice)+value(e.packSold)*value(e.packPrice);
  function readEntries(){try{const x=JSON.parse(localStorage.getItem(CORE_ENTRIES_KEY)||"[]");return Array.isArray(x)?x:[];}catch{return[];}}
  function best(map){let date="",v=0;for(const[d,x]of Object.entries(map))if(!date||x>v){date=d;v=x;}return{date,v};}
  function patch(title,text,note){const root=document.getElementById("recordsTotals");if(!root)return;const card=[...root.querySelectorAll(".totalBox")].find(x=>(x.querySelector("h3")?.textContent||"").includes(title));if(!card)return;const a=card.querySelector(".totalValue"),b=card.querySelector("p");if(a&&a.textContent!==text)a.textContent=text;if(b&&b.textContent!==note)b.textContent=note;}
  function render(){queued=false;const eggs={},moneyByDay={};for(const e of readEntries()){const d=String(e?.date||"").slice(0,10);if(!d)continue;if(e.type==="eggs")eggs[d]=(eggs[d]||0)+value(e.eggs);if(e.type==="sale")moneyByDay[d]=(moneyByDay[d]||0)+rev(e);}const a=best(eggs),b=best(moneyByDay);patch("Highest Egg Day",String(Math.round(a.v||0)),a.date||"No data yet");patch("Highest Revenue Day","$"+(b.v||0).toFixed(2),b.date||"No data yet");}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(render);}
  const attach=()=>{const root=document.getElementById("recordsTotals");if(!root){setTimeout(attach,300);return;}new MutationObserver(schedule).observe(root,{childList:true,subtree:true,characterData:true});render();};
  window.addEventListener("core-data-synced",schedule);
  attach();
}

onAuthStateChanged(auth,user=>{
  if(!user)return;
  window.FirebaseUser=user;
  installCoreAuthority();
  startListener();
  setTimeout(syncAllFarmData,250);
  setTimeout(loadCoreFromCloud,350);
  console.log("✅ Firebase signed in:",user.uid);
});

signInAnonymously(auth).catch(e=>console.error("❌ Firebase anonymous sign-in failed:",e));
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installDailyRecordsFix);else installDailyRecordsFix();

window.syncFarmNow=syncAllFarmData;
window.refreshCoreFromFirebase=loadCoreFromCloud;
import("./farm-consistency-v2.js?v=5")
  .then(()=>import("./app-audit-v1.js?v=1"))
  .then(()=>import("./audit-finish-v1.js?v=1"))
  .catch(e=>console.warn("Farm audit layer failed to load:",e));
import("./dom-loop-guard-v3.js?v=1").catch(e=>console.warn("Current redraw guard failed to load:",e));
import("./flock-photo-fix-v2.js?v=4").catch(e=>console.warn("Shared flock photo system failed to load:",e));
console.log("✅ Firebase initialized with authoritative cross-device sync");