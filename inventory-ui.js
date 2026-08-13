(() => {
  "use strict";
  const KEY="chickenEggInventoryV2", APP2_KEY="chickenEggApp2V1";
  const ENTRIES_KEY="chickenEggEntriesV102", SETTINGS_KEY="chickenEggSettingsV102";
  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}}
  function n(v){return Math.max(0,Number(v)||0)}
  function state(){return read(KEY,{dozens:0,packs18:3,loose:0})}
  function f2(){return read(APP2_KEY,{orders:[]})}
  function total(){const s=state();return Math.round(n(s.dozens)*12+n(s.packs18)*18+n(s.loose))}
  function reserved(){return (Array.isArray(f2().orders)?f2().orders:[]).filter(o=>o.status==="pending").reduce((sum,o)=>sum+n(o.dozen)*12+n(o.packs18)*18,0)}
  function available(){return Math.max(0,total()-reserved())}
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
      if(el.textContent.trim().startsWith("Inventory:")) el.textContent=`Inventory: ${n(s.dozens)} dozen + ${n(s.packs18)} 18-pack${n(s.packs18)===1?"":"s"} + ${n(s.loose)} loose`;
    });
    const firstHub=document.querySelector("#farm2HubSummary .farm2-grid2 .farm2-card");
    if(firstHub) firstHub.innerHTML=`<div class="farm2-kicker">Sellable Physical Inventory</div><div class="farm2-moneyBig">${av} 🥚</div><div class="farm2-subtle">${n(s.packs18)} 18-pack${n(s.packs18)===1?"":"s"} • ${n(s.dozens)} dozen carton${n(s.dozens)===1?"":"s"} • ${n(s.loose)} loose • ${r} reserved</div>`;
  }
  function installBackup(){
    window.backupData=function(){
      const backup={
        format:"chicken-eggs-full-backup-v3",
        backupDate:new Date().toISOString(),
        entries:read(ENTRIES_KEY,[]),
        farmSettings:read(SETTINGS_KEY,{}),
        farmApp2:read(APP2_KEY,{}),
        inventoryV2:read(KEY,{})
      };
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
      const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`chicken-eggs-full-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
    };
  }
  function init(){installBackup();patch();setInterval(patch,1200)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,120));else setTimeout(init,120);
})();
