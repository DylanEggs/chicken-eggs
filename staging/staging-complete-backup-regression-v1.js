(() => {
  "use strict";
  if (window.__StagingCompleteBackupRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingCompleteBackupRegressionV1 = true;

  const KEYS={
    inventory:"chickenEggInventoryV2",
    photos:"chickenEggLocalBirdPhotosV1",
    photoMeta:"chickenEggBirdPhotoMetaV4",
    business:"chickenEggBusinessV1",
    weather:"chickenEggWeatherIntelligenceV2"
  };
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function snapshotStorage(){const out={};for(const key of window.StagingStorageSandbox?.listKeys?.()||[]){const v=localStorage.getItem(key);if(v!==null)out[key]=v;}return out;}
  function restoreStorage(snap){const oldRemote=window.__farmApplyingRemote,oldRestore=window.__inventoryRestoreV6;window.__farmApplyingRemote=true;window.__inventoryRestoreV6=true;try{localStorage.clear();for(const [k,v] of Object.entries(snap||{}))localStorage.setItem(k,v);}finally{window.__farmApplyingRemote=oldRemote;window.__inventoryRestoreV6=oldRestore;}try{window.loadLocal?.();}catch{}try{window.loadFarmSettings?.();}catch{}try{window.__reloadFarm2Memory?.();}catch{}try{window.updateApp?.();}catch{}window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,completeBackupRestore:true}}));window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,completeBackupRestore:true,key:"restore"}}));}

  // The full torture suite runs inside StagingStorageSandbox's in-memory overlay.
  // Storage.key() is virtualized there, but the browser's native Storage.length is not.
  // CompleteSafetyBackupV3 correctly enumerates normal LIVE localStorage with length+key();
  // this temporary STAGING-only shim makes length match the virtual key list while this
  // regression runs, so the test exercises the real backup API without touching LIVE.
  function patchVirtualStorageLength(){
    const proto=Storage.prototype;
    const descriptor=Object.getOwnPropertyDescriptor(proto,"length");
    const nativeGet=descriptor?.get;
    if(!nativeGet||descriptor?.configurable===false) return ()=>{};
    try{
      Object.defineProperty(proto,"length",{
        configurable:descriptor.configurable,
        enumerable:descriptor.enumerable,
        get(){
          if(this===window.localStorage&&window.__ChickenEggsStagingMode&&window.StagingStorageSandbox?.overlayActive?.()){
            return (window.StagingStorageSandbox.listKeys?.()||[]).length;
          }
          return nativeGet.call(this);
        }
      });
      return ()=>{try{Object.defineProperty(proto,"length",descriptor);}catch{}};
    }catch{
      return ()=>{};
    }
  }

  async function runBackupRegression(){
    const results=[];
    const check=(name,pass,detail="")=>results.push({name,pass:!!pass,detail:String(detail||"")});
    const snap=snapshotStorage();
    const restoreLength=patchVirtualStorageLength();
    try{
      const api=window.CompleteSafetyBackupV3;
      check("Complete Safety Backup v3 API is loaded",!!api?.build&&!!api?.applyBackup&&!!api?.validate);
      if(!api?.build) return results;

      await window.InventorySystemV6?.commitExact?.(2,1,7);
      const oldRestore=window.__inventoryRestoreV6;window.__inventoryRestoreV6=true;
      try{
        localStorage.setItem(KEYS.photos,JSON.stringify({"backup-test-hen":"data:image/jpeg;base64,VEVTVDE=","backup-test-roo":"data:image/jpeg;base64,VEVTVDI="}));
        localStorage.setItem(KEYS.photoMeta,JSON.stringify({"backup-test-hen":{updatedAt:1},"backup-test-roo":{updatedAt:2}}));
        localStorage.setItem(KEYS.business,JSON.stringify({backupMarker:"business-preserved",chickenSales:[]}));
        localStorage.setItem(KEYS.weather,JSON.stringify({backupMarker:"weather-preserved",history:{"2026-08-17":{max:88}}}));
      }finally{window.__inventoryRestoreV6=oldRestore;}

      const expectedInventory=localStorage.getItem(KEYS.inventory);
      const expectedPhotos=localStorage.getItem(KEYS.photos);
      const backup=api.build("staging-complete-backup-regression");
      const validation=api.validate(backup);
      check("Complete backup validates",validation.ok,validation.errors?.join(" | "));
      check("Complete backup captures exact inventory",backup.datasets?.[KEYS.inventory]===expectedInventory);
      check("Complete backup captures flock photo data",backup.datasets?.[KEYS.photos]===expectedPhotos);
      check("Complete backup counts saved flock photos",Number(backup.photos?.count)===2,`count ${backup.photos?.count}`);
      check("Complete backup captures business dataset",String(backup.datasets?.[KEYS.business]||"").includes("business-preserved"));
      check("Complete backup captures weather history",String(backup.datasets?.[KEYS.weather]||"").includes("weather-preserved"));

      await window.InventorySystemV6?.commitExact?.(0,0,0);
      const mutRestore=window.__inventoryRestoreV6;window.__inventoryRestoreV6=true;
      try{localStorage.setItem(KEYS.photos,"{}");localStorage.setItem(KEYS.business,"{}");localStorage.setItem(KEYS.weather,"{}");}finally{window.__inventoryRestoreV6=mutRestore;}
      api.applyBackup(backup);
      await sleep(80);
      check("Complete restore returns exact carton inventory",localStorage.getItem(KEYS.inventory)===expectedInventory);
      check("Complete restore returns flock photos",localStorage.getItem(KEYS.photos)===expectedPhotos);
      check("Complete restore returns business data",String(localStorage.getItem(KEYS.business)||"").includes("business-preserved"));
      check("Complete restore returns weather history",String(localStorage.getItem(KEYS.weather)||"").includes("weather-preserved"));

      const unsafe=JSON.parse(JSON.stringify(backup));
      unsafe.datasets["firebase-auth-token"]="nope";
      check("Restore validation rejects non-farm storage keys",api.validate(unsafe).ok===false);
    }catch(error){check("Complete backup regression completed without exception",false,String(error?.stack||error));}
    finally{restoreLength();restoreStorage(snap);await sleep(100);}
    return results;
  }

  function install(){
    const base=window.StagingFullTest;
    if(!base?.run||base.__completeBackupRegressionV1){setTimeout(install,100);return;}
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){const first=await baseRun();const extra=await runBackupRegression();const results=[...(first?.results||[]),...extra];const failed=results.filter(x=>!x.pass);return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+complete-backup-v1`};},__completeBackupRegressionV1:true};
    console.log("🧪 STAGING complete backup regression active — inventory, weather, business, and flock photos must round-trip");
  }
  setTimeout(install,1450);
})();
