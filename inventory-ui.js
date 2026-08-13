(() => {
  "use strict";
  const KEY="chickenEggInventoryV2", APP2_KEY="chickenEggApp2V1";
  const ENTRIES_KEY="chickenEggEntriesV102", SETTINGS_KEY="chickenEggSettingsV102";
  const CLOUD_DOC_ID="__farm_app_2__";

  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}}
  function n(v){return Math.max(0,Number(v)||0)}
  function state(){return read(KEY,{dozens:0,packs18:3,loose:0})}
  function f2(){return read(APP2_KEY,{orders:[]})}
  function total(){const s=state();return Math.round(n(s.dozens)*12+n(s.packs18)*18+n(s.loose))}
  function reserved(){return (Array.isArray(f2().orders)?f2().orders:[]).filter(o=>o.status==="pending").reduce((sum,o)=>sum+n(o.dozen)*12+n(o.packs18)*18,0)}
  function available(){return Math.max(0,total()-reserved())}

  function cleanFarm2Object(obj){
    if(!obj||typeof obj!=="object")return obj;
    delete obj.goldenEggs;
    if(obj.achievements&&typeof obj.achievements==="object")delete obj.achievements.gold1;
    if(Array.isArray(obj.activity))obj.activity=obj.activity.filter(a=>!/golden egg/i.test(String(a?.text||"")));
    return obj;
  }

  function cleanLocalGoldenData(){
    try{
      const raw=localStorage.getItem(APP2_KEY);
      if(!raw)return;
      localStorage.setItem(APP2_KEY,JSON.stringify(cleanFarm2Object(JSON.parse(raw))));
    }catch{}
  }

  async function cleanCloudGoldenData(){
    try{
      if(window.ChickenEggsDB?.waitUntilReady)await window.ChickenEggsDB.waitUntilReady();
      if(!window.FirestoreDB)return;
      const {doc,getDoc,setDoc}=await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
      const ref=doc(window.FirestoreDB,"entries",CLOUD_DOC_ID);
      const snap=await getDoc(ref);
      if(!snap.exists())return;
      const data=snap.data()||{};
      const farmApp2=cleanFarm2Object({...((data&&data.farmApp2)||{})});
      await setDoc(ref,{farmApp2,updatedAt:Date.now()},{merge:true});
    }catch(err){console.warn("Golden Egg cleanup skipped:",err);}
  }

  function patchEggSaving(){
    if(typeof window.saveEggs!=="function"||window.saveEggs.__goldenRemoved)return;
    const original=window.saveEggs;
    function saveWithoutGolden(){
      const realRandom=Math.random;
      Math.random=function(){
        const v=realRandom();
        if(v>=.012&&v<.055)return .055+((v-.012)/.043)*.12;
        return v;
      };
      try{return original.apply(this,arguments);}finally{Math.random=realRandom;}
    }
    saveWithoutGolden.__goldenRemoved=true;
    window.saveEggs=saveWithoutGolden;
  }

  function removeGoldenUI(){
    document.querySelectorAll("#farm2Hub small").forEach(el=>{
      if(/Achievements\s*&\s*Golden Eggs/i.test(el.textContent||""))el.textContent="Achievements & monthly goals";
    });

    document.querySelectorAll("#farm2Settings .farm2-subtle").forEach(el=>{
      if(/Golden Eggs, rare events & celebrations/i.test(el.textContent||""))el.textContent="Rare events & celebrations";
    });

    document.querySelectorAll("#farm2HubSummary .farm2-badge").forEach(el=>{
      if(/Golden Eggs?/i.test(el.textContent||""))el.remove();
    });

    document.querySelectorAll("#farm2FunSummary .farm2-card").forEach(card=>{
      if(/Golden Eggs?/i.test(card.textContent||""))card.remove();
    });

    const achievements=document.getElementById("farm2AchievementList");
    if(achievements){
      [...achievements.children].forEach(card=>{
        if(/Golden!|Golden Egg/i.test(card.textContent||""))card.remove();
      });
    }

    const activity=document.getElementById("farm2Activity");
    if(activity){
      [...activity.children].forEach(row=>{
        if(/Golden Egg/i.test(row.textContent||""))row.remove();
      });
    }

    document.querySelectorAll("#farm2FunSummary .farm2-card").forEach(card=>{
      const kicker=card.querySelector(".farm2-kicker"),value=card.querySelector(".farm2-moneyBig");
      if(!kicker||!value||!/Unlocked/i.test(kicker.textContent||""))return;
      const m=(value.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
      if(m&&Number(m[2])===9)value.textContent=`${Number(m[1])||0}/8`;
    });
  }

  function patch(){
    const s=state(), av=available(), r=reserved();
    const minis=document.querySelectorAll("#farm2TodayCard .farm2-miniStat");
    if(minis.length>=3){
      const set=(box,val,label)=>{const b=box.querySelector("b"),span=box.querySelector("span");if(b)b.textContent=val;if(span)span.textContent=label;};
      set(minis[0],av,"Eggs available");
      set(minis[1],n(s.packs18),"18-packs");
      set(minis[2],r,"Reserved eggs");
    }
    document.querySelectorAll("#farm2TodayCard .farm2-subtle").forEach(el=>{
      if(el.textContent.trim().startsWith("Inventory:"))el.textContent=`Inventory: ${n(s.dozens)} dozen + ${n(s.packs18)} 18-pack${n(s.packs18)===1?"":"s"} + ${n(s.loose)} loose`;
    });
    const firstHub=document.querySelector("#farm2HubSummary .farm2-grid2 .farm2-card");
    if(firstHub)firstHub.innerHTML=`<div class="farm2-kicker">Sellable Physical Inventory</div><div class="farm2-moneyBig">${av} 🥚</div><div class="farm2-subtle">${n(s.packs18)} 18-pack${n(s.packs18)===1?"":"s"} • ${n(s.dozens)} dozen carton${n(s.dozens)===1?"":"s"} • ${n(s.loose)} loose • ${r} reserved</div>`;
    removeGoldenUI();
  }

  function installBackup(){
    window.backupData=function(){
      cleanLocalGoldenData();
      const backup={
        format:"chicken-eggs-full-backup-v3",
        backupDate:new Date().toISOString(),
        entries:read(ENTRIES_KEY,[]),
        farmSettings:read(SETTINGS_KEY,{}),
        farmApp2:cleanFarm2Object(read(APP2_KEY,{})),
        inventoryV2:read(KEY,{})
      };
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
      const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`chicken-eggs-full-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
    };
  }

  function init(){
    cleanLocalGoldenData();
    installBackup();
    patchEggSaving();
    patch();
    cleanCloudGoldenData();
    const observer=new MutationObserver(()=>removeGoldenUI());
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    setInterval(()=>{patchEggSaving();patch();},1200);
  }

  cleanLocalGoldenData();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,120));else setTimeout(init,120);
})();
