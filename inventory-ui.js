(() => {
  "use strict";
  if (window.__eggAppLegacyIntervalGuard) return;
  window.__eggAppLegacyIntervalGuard = true;
  const nativeSetInterval = window.setInterval.bind(window);
  window.setInterval = function(fn, delay, ...args) {
    const ms = Number(delay) || 0;
    let source = "";
    try { source = typeof fn === "function" ? Function.prototype.toString.call(fn) : String(fn || ""); } catch {}
    const legacyFun = ms === 3000 && source.includes("hook();renderFun()");
    const legacyInsights = ms === 3500 && source.includes("hook();render()");
    const legacyBusiness = ms === 3500 && source.includes("hookScreen();render()");
    if (legacyFun || legacyInsights || legacyBusiness) {
      console.log("✅ Blocked legacy background redraw timer");
      return 0;
    }
    return nativeSetInterval(fn, delay, ...args);
  };
})();

(() => {
  "use strict";
  const KEY="chickenEggInventoryV2", APP2_KEY="chickenEggApp2V1";
  const ENTRIES_KEY="chickenEggEntriesV102", SETTINGS_KEY="chickenEggSettingsV102", BUSINESS_KEY="chickenEggBusinessV1", DELUXE_KEY="chickenEggDeluxeV1", WEATHER_KEY="chickenEggWeatherIntelligenceV2";

  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}}
  function cleanFarm2Object(obj){
    if(!obj||typeof obj!=="object")return {changed:false,value:obj};
    let changed=false;
    if(Object.prototype.hasOwnProperty.call(obj,"goldenEggs")){delete obj.goldenEggs;changed=true;}
    if(obj.achievements&&typeof obj.achievements==="object"&&Object.prototype.hasOwnProperty.call(obj.achievements,"gold1")){delete obj.achievements.gold1;changed=true;}
    if(Array.isArray(obj.activity)){
      const next=obj.activity.filter(a=>!/golden egg/i.test(String(a?.text||"")));
      if(next.length!==obj.activity.length){obj.activity=next;changed=true;}
    }
    return {changed,value:obj};
  }
  function cleanLocalGoldenData(){
    try{
      const raw=localStorage.getItem(APP2_KEY);if(!raw)return;
      const result=cleanFarm2Object(JSON.parse(raw));
      if(!result.changed)return;
      result.value.updatedAt=Date.now();
      localStorage.setItem(APP2_KEY,JSON.stringify(result.value));
    }catch{}
  }
  function patchEggSaving(){
    if(typeof window.saveEggs!=="function"||window.saveEggs.__goldenRemoved)return;
    const original=window.saveEggs;
    function saveWithoutGolden(){
      const realRandom=Math.random;
      Math.random=function(){const v=realRandom();if(v>=.012&&v<.055)return .055+((v-.012)/.043)*.12;return v;};
      try{return original.apply(this,arguments);}finally{Math.random=realRandom;}
    }
    saveWithoutGolden.__goldenRemoved=true;
    window.saveEggs=saveWithoutGolden;
  }
  function removeGoldenUI(){
    document.querySelectorAll("#farm2Hub small").forEach(el=>{if(/Achievements\s*&\s*Golden Eggs/i.test(el.textContent||""))el.textContent="Achievements & monthly goals";});
    document.querySelectorAll("#farm2Settings .farm2-subtle").forEach(el=>{if(/Golden Eggs, rare events & celebrations/i.test(el.textContent||""))el.textContent="Rare events & celebrations";});
    document.querySelectorAll("#farm2HubSummary .farm2-badge").forEach(el=>{if(/Golden Eggs?/i.test(el.textContent||""))el.remove();});
    document.querySelectorAll("#farm2FunSummary .farm2-card").forEach(card=>{if(/Golden Eggs?/i.test(card.textContent||""))card.remove();});
    const achievements=document.getElementById("farm2AchievementList");if(achievements)[...achievements.children].forEach(card=>{if(/Golden!|Golden Egg/i.test(card.textContent||""))card.remove();});
    const activity=document.getElementById("farm2Activity");if(activity)[...activity.children].forEach(row=>{if(/Golden Egg/i.test(row.textContent||""))row.remove();});
    document.querySelectorAll("#farm2FunSummary .farm2-card").forEach(card=>{const k=card.querySelector(".farm2-kicker"),v=card.querySelector(".farm2-moneyBig");if(!k||!v||!/Unlocked/i.test(k.textContent||""))return;const m=(v.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);if(m&&Number(m[2])===9)v.textContent=`${Number(m[1])||0}/8`;});
  }
  function installBackup(){
    const backup=function(){
      cleanLocalGoldenData();
      const backup={format:"chicken-eggs-full-backup-v5",backupDate:new Date().toISOString(),entries:read(ENTRIES_KEY,[]),farmSettings:read(SETTINGS_KEY,{}),farmApp2:cleanFarm2Object(read(APP2_KEY,{})).value,inventoryV2:read(KEY,{}),businessV1:read(BUSINESS_KEY,{}),deluxeV1:read(DELUXE_KEY,{}),weatherV2:read(WEATHER_KEY,{})};
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`chicken-eggs-full-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
    };
    backup.__inventoryAuditBackup=true;window.backupData=backup;
  }
  function init(){
    cleanLocalGoldenData();patchEggSaving();removeGoldenUI();installBackup();
    window.addEventListener("farm-data-synced",e=>{if(e.detail?.key===APP2_KEY){cleanLocalGoldenData();removeGoldenUI();}});
    window.addEventListener("core-data-synced",()=>{patchEggSaving();removeGoldenUI();});
    console.log("✅ Golden Egg cleanup is event-driven; no DOM observer");
  }
  cleanLocalGoldenData();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,140));else setTimeout(init,140);
})();
import("./sync-authority-v2.js?v=2").catch(error=>console.warn("Hardened sync authority failed to load:",error));
import("./audit-finish-v1.js?v=1").catch(error=>console.warn("Final audit safeguards failed to load:",error));
import("./app-polish-v1.js?v=1").catch(error=>console.warn("App polish failed to load:",error));
import("./weather-intelligence-v2.js?v=20260814-1").catch(error=>console.warn("Farm Weather Intelligence failed to load:",error));
import("./prediction-fix-v1.js?v=1").catch(error=>console.warn("Adaptive egg forecast failed to load:",error));