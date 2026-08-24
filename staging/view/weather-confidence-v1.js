(() => {
  "use strict";
  if (window.__StagingCustomerWeatherConfidenceV1) return;
  window.__StagingCustomerWeatherConfidenceV1 = true;

  const PREFIX = "__chicken_eggs_staging__::";
  const PREVIEW_SESSION = "chickenEggStagingCustomerPreviewV2";
  const ENTRY_KEY = "chickenEggEntriesV102";
  const WEATHER_KEY = "chickenEggWeatherIntelligenceV2";
  const finite = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const n = v => Number(v) || 0;
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  function previewValues(){
    try{return JSON.parse(sessionStorage.getItem(PREVIEW_SESSION)||"null")?.values||{};}catch{return {};}
  }
  function read(key,fallback){
    try{
      const values=previewValues();
      if(Object.prototype.hasOwnProperty.call(values,key)) return values[key];
      const raw=localStorage.getItem(PREFIX+key);
      return raw==null?fallback:JSON.parse(raw);
    }catch{return fallback;}
  }
  function data(){return window.CustomerViewStaging?.getData?.() || window.StagingCustomerPublicData?.build?.() || null;}
  function eggDates(){
    const out=new Set();
    for(const e of Array.isArray(read(ENTRY_KEY,[]))?read(ENTRY_KEY,[]):[]){
      if(e?.type==="eggs"&&e.date&&n(e.eggs)>=0) out.add(String(e.date).slice(0,10));
    }
    return out;
  }
  function historyKind(w={}){
    if(n(w.rain??w.precip)>=.05||n(w.rainHours)>=2||n(w.precipProbability)>=60) return "rainy";
    if(finite(w.cloud)&&n(w.cloud)>=65) return "cloudy";
    return "sunny";
  }
  function currentKind(d=data()){
    const w=d?.weather||{}, text=String(w.condition||"").toLowerCase();
    if(/rain|storm|drizzle|shower|thunder/.test(text)||n(w.rainChance)>=60) return "rainy";
    if(/cloud|overcast|fog/.test(text)) return "cloudy";
    return "sunny";
  }
  function currentTemp(d=data()){
    const w=d?.weather||{};
    return finite(w.high)?Number(w.high):finite(w.temperature)?Number(w.temperature):null;
  }
  function sample(){
    const d=data(); if(!d) return {count:0,closeCount:0,confidence:"learning",label:"Learning the flock"};
    const weather=read(WEATHER_KEY,{}), history=weather?.history&&typeof weather.history==="object"?weather.history:{}, dates=eggDates(), kind=currentKind(d), temp=currentTemp(d), today=todayKey();
    let count=0,closeCount=0;
    for(const [date,w] of Object.entries(history)){
      if(date>=today||!dates.has(date)||!finite(w?.max)) continue;
      if(historyKind(w)!==kind) continue;
      count++;
      if(temp==null||Math.abs(Number(w.max)-temp)<=8) closeCount++;
    }
    const effective=closeCount||count;
    if(effective>=8) return {count,closeCount,confidence:"strong",label:`Based on ${effective} similar days`};
    if(effective>=4) return {count,closeCount,confidence:"good",label:`Based on ${effective} similar days`};
    if(effective>=1) return {count,closeCount,confidence:"early",label:`Early estimate • ${effective} similar day${effective===1?"":"s"}`};
    return {count,closeCount,confidence:"learning",label:"Learning this weather pattern"};
  }
  function render(){
    const chip=document.getElementById("forecastConfidence"); if(!chip) return false;
    const s=sample();
    chip.textContent=s.label;
    chip.dataset.weatherConfidence=s.confidence;
    chip.title=s.confidence==="strong"?"This outlook has a larger set of similar historical weather days.":s.confidence==="good"?"This outlook has several similar historical weather days.":s.confidence==="early"?"Only a few similar weather days are in the farm history so far.":"The farm is still building history for weather like today.";
    return true;
  }
  function start(){render();setTimeout(render,320);["staging-customer-data-ready","core-data-synced","farm-data-synced"].forEach(name=>window.addEventListener(name,render));}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();

  window.StagingCustomerWeatherConfidenceV1={version:1,sample,currentKind,currentTemp,historyKind,render,networkCalls:0,firebaseReads:0,firebaseWrites:0};
})();
