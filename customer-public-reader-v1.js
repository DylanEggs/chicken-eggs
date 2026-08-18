import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

if (!window.FarmPublicCustomerReaderV1) {
  const firebaseConfig = {
    apiKey: "AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
    authDomain: "chicken-eggs-53358.firebaseapp.com",
    projectId: "chicken-eggs-53358",
    storageBucket: "chicken-eggs-53358.firebasestorage.app",
    messagingSenderId: "461720066101",
    appId: "1:461720066101:web:6b19a7c4d245f399cf797c"
  };
  const app=getApps().length?getApp():initializeApp(firebaseConfig);
  const db=getFirestore(app);
  const listeners=new Set();
  let summary=null,flock=[],summaryUnsub=null,flockUnsub=null;

  const n=v=>Number(v)||0;
  const whole=v=>Math.max(0,Math.round(n(v)));
  const str=(v,fallback="")=>typeof v==="string"?v:fallback;
  const image=v=>typeof v==="string"&&(v.startsWith("data:image/")||/^https?:\/\//i.test(v))?v:"";
  function safeSummary(data){
    data=data&&typeof data==="object"?data:{};
    const a=data.availability&&typeof data.availability==="object"?data.availability:{};
    const p=data.production&&typeof data.production==="object"?data.production:{};
    const w=data.weather&&typeof data.weather==="object"?data.weather:{};
    const farm=data.farm&&typeof data.farm==="object"?data.farm:{};
    return {
      schema:"customer-public-v1",
      farm:{name:str(farm.name,"Rose Family Poultry"),location:str(farm.location,"High Point, NC")},
      availability:{eggs:whole(a.eggs),dozenEquivalent:whole(a.dozenEquivalent),remainder:whole(a.remainder),label:str(a.label,"Availability updating"),tone:str(a.tone,"good"),updatedAt:whole(a.updatedAt)},
      production:{todayCollected:whole(p.todayCollected),todayLow:whole(p.todayLow),todayHigh:whole(p.todayHigh),dailyPace:Math.max(0,n(p.dailyPace)),weekCollected:whole(p.weekCollected),predictedWeek:whole(p.predictedWeek),monthCollected:whole(p.monthCollected),predictedMonth:whole(p.predictedMonth),year:whole(p.year),yearCollected:whole(p.yearCollected),predictedYear:whole(p.predictedYear),confidence:str(p.confidence,"Learning the flock")},
      weather:{location:str(w.location,"High Point, NC"),emoji:str(w.emoji,"🌤️"),condition:str(w.condition,"Weather"),temperature:Number.isFinite(Number(w.temperature))?Math.round(Number(w.temperature)):null,feelsLike:Number.isFinite(Number(w.feelsLike))?Math.round(Number(w.feelsLike)):null,high:Number.isFinite(Number(w.high))?Math.round(Number(w.high)):null,low:Number.isFinite(Number(w.low))?Math.round(Number(w.low)):null,rainChance:Number.isFinite(Number(w.rainChance))?Math.round(Number(w.rainChance)):null,humidity:Number.isFinite(Number(w.humidity))?Math.round(Number(w.humidity)):null,updatedAt:whole(w.updatedAt)},
      chickenOfTheDayId:str(data.chickenOfTheDayId),flockIds:Array.isArray(data.flockIds)?data.flockIds.map(x=>String(x||"")).filter(Boolean):[],flockCount:whole(data.flockCount),publishedAt:whole(data.publishedAt)
    };
  }
  function safeBird(data){
    data=data&&typeof data==="object"?data:{};
    const id=str(data.birdId||data.id);
    if(!id)return null;
    return {id,name:str(data.name,"Chicken"),breed:str(data.breed,"Breed not listed"),sex:str(data.sex,"Unknown"),hatchDate:/^\d{4}-\d{2}-\d{2}$/.test(str(data.hatchDate))?str(data.hatchDate):"",age:str(data.age,"Age unknown"),photo:image(data.photo)};
  }
  function current(){
    const ids=new Set(summary?.flockIds||[]);
    const filtered=ids.size?flock.filter(b=>ids.has(b.id)):flock.slice();
    const byId=new Map(filtered.map(b=>[b.id,b]));
    return {summary,flock:filtered,chickenOfTheDay:byId.get(summary?.chickenOfTheDayId)||filtered[0]||null};
  }
  function notify(){const value=current();for(const fn of listeners){try{fn(value);}catch{}}return value;}
  async function load(){
    const [sumSnap,flockSnap]=await Promise.all([getDoc(doc(db,"public_customer","current")),getDocs(collection(db,"public_flock"))]);
    summary=sumSnap.exists()?safeSummary(sumSnap.data()):null;
    flock=flockSnap.docs.map(d=>safeBird(d.data())).filter(Boolean);
    return notify();
  }
  function subscribe(callback,errorCallback){
    if(typeof callback==="function")listeners.add(callback);
    if(!summaryUnsub){
      summaryUnsub=onSnapshot(doc(db,"public_customer","current"),snap=>{summary=snap.exists()?safeSummary(snap.data()):null;notify();},error=>{if(errorCallback)errorCallback(error);});
    }
    if(!flockUnsub){
      flockUnsub=onSnapshot(collection(db,"public_flock"),snap=>{flock=snap.docs.map(d=>safeBird(d.data())).filter(Boolean);notify();},error=>{if(errorCallback)errorCallback(error);});
    }
    return ()=>{if(typeof callback==="function")listeners.delete(callback);};
  }
  function stop(){try{summaryUnsub?.();}catch{}try{flockUnsub?.();}catch{}summaryUnsub=null;flockUnsub=null;listeners.clear();}

  window.FarmPublicCustomerReaderV1={version:1,load,subscribe,current,stop};
}
