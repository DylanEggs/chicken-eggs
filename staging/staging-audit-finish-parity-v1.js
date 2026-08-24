(() => {
  "use strict";
  if (window.__ChickenEggsStagingAuditFinishParityV1) return;
  window.__ChickenEggsStagingAuditFinishParityV1 = true;

  if (!window.__ChickenEggsStagingMode) {
    throw new Error("Staging backup restore candidate refused to run outside staging");
  }

  const build = String(window.__ChickenEggsBuild || Date.now());
  const sourceUrl = new URL("../audit-finish-v1.js", document.currentScript?.src || location.href);
  sourceUrl.searchParams.set("v", build);
  const xhr = new XMLHttpRequest();
  xhr.open("GET", sourceUrl.href, false);
  xhr.send(null);
  if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) {
    throw new Error(`audit-finish-v1.js HTTP ${xhr.status}`);
  }

  let source = String(xhr.responseText || "");
  const start = source.indexOf("async function restoreFile(file){");
  const end = source.indexOf("\nfunction installSaleMetaEdit", start);
  if (start < 0 || end < 0) {
    throw new Error("Live backup restore signature changed; staging candidate stopped safely");
  }

  const candidate = `async function restoreFile(file){
    let text=await file.text(),data=JSON.parse(text);
    if(!data||typeof data!=="object")throw new Error("Invalid backup");
    let now=Date.now(),oldRemote=window.__farmApplyingRemote,oldInventory=window.__inventoryRestoreV6;
    window.__farmApplyingRemote=true;
    window.__inventoryRestoreV6=true;
    try{
      if(data.farmSettings)localStorage.setItem(S,JSON.stringify(data.farmSettings));
      for(const [key,val] of [[A,data.farmApp2],[B,data.businessV1],[D,data.deluxeV1],[W,data.weatherV2]])if(val&&typeof val==="object")localStorage.setItem(key,JSON.stringify({...val,updatedAt:now++}));
      if(data.localBirdPhotosV1)localStorage.setItem(P,JSON.stringify(data.localBirdPhotosV1));
      let restored=Array.isArray(data.entries)?data.entries.filter(e=>e&&(e.type==="eggs"||e.type==="sale")):[];
      if(restored.length){
        let current=entries(),map=new Map(current.map(e=>[String(e.id),e]));
        restored.forEach(e=>map.set(String(e.id),e));
        localStorage.setItem(E,JSON.stringify([...map.values()]));
        if(window.ChickenEggsDB?.saveEntry)for(const e of restored)await window.ChickenEggsDB.saveEntry(e);
      }
      if(data.farmSettings&&window.ChickenEggsDB?.saveFarmSettings)await window.ChickenEggsDB.saveFarmSettings(data.farmSettings);
      try{window.loadLocal?.();}catch{}
      try{window.loadFarmSettings?.();}catch{}
      try{window.__reloadFarm2Memory?.();}catch{}
      try{window.updateApp?.();}catch{}
      if(data.inventoryV2&&typeof data.inventoryV2==="object"){
        await restoreInventory(data.inventoryV2,now++);
        window.__inventoryRestoreV6=true;
      }
      try{window.loadLocal?.();}catch{}
      try{window.loadFarmSettings?.();}catch{}
      try{window.__reloadFarm2Memory?.();}catch{}
      try{window.updateApp?.();}catch{}
      if(typeof window.syncFarmNow==="function")await window.syncFarmNow();
      if(window.FarmBirdPhotosV4?.flush)void window.FarmBirdPhotosV4.flush();
      if(typeof window.refreshCoreFromFirebase==="function")setTimeout(window.refreshCoreFromFirebase,300);
      window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{key:"restore",staging:true}}));
      window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{key:"restore",staging:true}}));
    }finally{
      window.__farmApplyingRemote=oldRemote;
      window.__inventoryRestoreV6=oldInventory;
    }
    alert("Backup restored and synced. Existing history was preserved unless the backup contained a newer copy of the same entry.");
  }`;

  source = source.slice(0, start) + candidate + source.slice(end);
  if (!source.includes("window.__inventoryRestoreV6=true") || !source.includes("window.__reloadFarm2Memory")) {
    throw new Error("Ordered staging backup restore candidate was not injected");
  }

  (0, eval)(`${source}\n//# sourceURL=staging-audit-finish-parity-runtime.js`);
  window.StagingAuditFinishParityV1 = {
    version: 1,
    source: "live-audit-finish-v1",
    restoreOrder: "app-history-memory-inventory"
  };
  console.log("🪞 STAGING backup restore candidate active — live UI source with ordered sandbox restore");
})();
