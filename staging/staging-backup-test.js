(() => {
  "use strict";
  if (window.__ChickenEggsStagingBackupTest) return;
  window.__ChickenEggsStagingBackupTest = true;
  if (!window.__ChickenEggsStagingMode) return;

  const KEYS=["chickenEggEntriesV102","chickenEggSettingsV102","chickenEggApp2V1","chickenEggInventoryV2","chickenEggBusinessV1","chickenEggDeluxeV1","chickenEggWeatherIntelligenceV2","chickenEggLocalBirdPhotosV1"];
  const REPORT="chickenEggStagingBackupTestReportV1";
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}};
  const snapshot=()=>Object.fromEntries(KEYS.map(k=>[k,localStorage.getItem(k)]));
  function restoreSnapshot(snap){
    const old=window.__farmApplyingRemote;window.__farmApplyingRemote=true;
    try{for(const [k,v] of Object.entries(snap)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}}
    finally{window.__farmApplyingRemote=old;}
    try{window.loadLocal?.();window.loadFarmSettings?.();window.__reloadFarm2Memory?.();window.updateApp?.();}catch{}
    window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,backupTestRestore:true}}));
    window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,backupTestRestore:true,key:"restore"}}));
  }
  const add=(r,name,pass,detail="")=>r.push({name,pass:!!pass,detail:String(detail||"")});
  async function waitFor(fn,timeout=3500){const start=Date.now();while(Date.now()-start<timeout){try{if(fn())return true;}catch{}await sleep(50);}return false;}

  async function run(){
    const results=[];const snap=snapshot();let captured=null;
    const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldClick=HTMLAnchorElement.prototype.click,oldAlert=window.alert;
    window.alert=msg=>console.log("STAGING backup test alert:",msg);
    try{
      await window.FarmSyncSafety?.ready?.();
      await waitFor(()=>window.backupData?.__x&&typeof window.restoreData==="function",5000);
      add(results,"Current full backup tool is installed",window.backupData?.__x===true);

      URL.createObjectURL=blob=>{captured=blob;return "blob:staging-backup-test";};
      URL.revokeObjectURL=()=>{};
      HTMLAnchorElement.prototype.click=function(){};
      window.backupData();
      await sleep(30);
      add(results,"Backup button generated a Blob",captured instanceof Blob);
      let data=null;
      if(captured){data=JSON.parse(await captured.text());}
      add(results,"Backup format is current v8",data?.format==="chicken-eggs-full-backup-v8",data?.format||"no format");
      add(results,"Backup contains core history",Array.isArray(data?.entries));
      add(results,"Backup contains Farm App2",!!data?.farmApp2&&typeof data.farmApp2==="object");
      add(results,"Backup contains exact inventory",!!data?.inventoryV2&&typeof data.inventoryV2==="object");
      add(results,"Backup contains business records",!!data?.businessV1&&typeof data.businessV1==="object");
      add(results,"Backup contains local flock-photo copy",!!data?.localBirdPhotosV1&&typeof data.localBirdPhotosV1==="object");

      if(data){
        const marker="staging-restore-test-"+Date.now();
        const restored={
          ...data,
          farmSettings:{...(data.farmSettings||{}),farmName:"STAGING RESTORE TEST"},
          farmApp2:{...(data.farmApp2||{}),customers:[...((data.farmApp2||{}).customers||[]),{id:marker,name:"STAGING Restore Customer",createdAt:Date.now()}]},
          inventoryV2:{...(data.inventoryV2||{}),dozens:2,packs18:1,loose:7},
          businessV1:{...(data.businessV1||{}),chickenSales:[...((data.businessV1||{}).chickenSales||[]),{id:marker,date:"2099-12-31",description:"STAGING restore bird",qty:1,price:25,total:25,createdAt:Date.now(),updatedAt:Date.now()}]},
          entries:[...(data.entries||[]),{id:marker,type:"eggs",date:"2099-12-31",eggs:6,dozenSold:0,dozenPrice:0,packSold:0,packPrice:0,createdAt:Date.now(),updatedAt:Date.now()}]
        };
        const file=new Blob([JSON.stringify(restored)],{type:"application/json"});
        const restoreComplete=new Promise(resolve=>{
          let timer=0;
          const done=event=>{
            if(event?.detail?.key!=="restore")return;
            clearTimeout(timer);window.removeEventListener("farm-data-synced",done);resolve(true);
          };
          window.addEventListener("farm-data-synced",done);
          timer=setTimeout(()=>{window.removeEventListener("farm-data-synced",done);resolve(false);},5000);
        });
        window.restoreData({target:{files:[file],value:"test"}});
        await restoreComplete;
        await waitFor(()=>{
          const app=read("chickenEggApp2V1",{}),inv=read("chickenEggInventoryV2",{}),biz=read("chickenEggBusinessV1",{}),settings=read("chickenEggSettingsV102",{}),entries=read("chickenEggEntriesV102",[]);
          return entries.some(x=>x.id===marker)&&settings.farmName==="STAGING RESTORE TEST"&&(app.customers||[]).some(x=>x.id===marker)&&Number(inv.dozens)===2&&Number(inv.packs18)===1&&Number(inv.loose)===7&&(biz.chickenSales||[]).some(x=>x.id===marker);
        },2000);
        const app=read("chickenEggApp2V1",{}),inv=read("chickenEggInventoryV2",{}),biz=read("chickenEggBusinessV1",{}),settings=read("chickenEggSettingsV102",{}),entries=read("chickenEggEntriesV102",[]);
        add(results,"Restore merges test history into staging",entries.some(x=>x.id===marker&&Number(x.eggs)===6));
        add(results,"Restore updates staging settings",settings.farmName==="STAGING RESTORE TEST",settings.farmName);
        add(results,"Restore updates staging Farm App2",(app.customers||[]).some(x=>x.id===marker));
        add(results,"Restore routes exact inventory through InventorySystemV6",Number(inv.dozens)===2&&Number(inv.packs18)===1&&Number(inv.loose)===7,JSON.stringify({dozens:inv.dozens,packs18:inv.packs18,loose:inv.loose}));
        add(results,"Restore updates staging business data",(biz.chickenSales||[]).some(x=>x.id===marker&&Number(x.total)===25));
        add(results,"Restore never exposed live Firestore handle",!window.FirestoreDB&&!window.FirebaseUser);
      }
    }catch(error){
      console.error("STAGING backup test crashed:",error);add(results,"Backup/restore staging test completed without exception",false,error?.stack||error);
    }finally{
      URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;HTMLAnchorElement.prototype.click=oldClick;window.alert=oldAlert;
      try{restoreSnapshot(snap);add(results,"Staging data restored after backup test",true);}catch(error){add(results,"Staging data restored after backup test",false,error);}
      const failed=results.filter(x=>!x.pass);const report={at:Date.now(),total:results.length,passed:results.length-failed.length,failed:failed.length,results};
      for(const row of results)console.log(`${row.pass?"PASS":"FAIL"} STAGING backup: ${row.name}${row.detail?` — ${row.detail}`:""}`);
      try{localStorage.setItem(REPORT,JSON.stringify(report));}catch{}
      window.dispatchEvent(new CustomEvent("staging-backup-test-complete",{detail:report}));
      return report;
    }
  }

  function inject(){
    const farm=document.getElementById("farm2Hub")||document.getElementById("farm");if(!farm||document.getElementById("stagingBackupTestCard"))return;
    const card=document.createElement("div");card.id="stagingBackupTestCard";card.className="farm2-card";card.style.marginTop="14px";
    card.innerHTML=`<div class="farm2-kicker">🧪 Backup / Restore Test</div><h3 style="margin:5px 0">Test a real full backup and restore</h3><div class="farm2-subtle">Runs only against the isolated staging copy, then restores the staging baseline.</div><button type="button" id="stagingBackupTestBtn" style="margin-top:10px">Run Backup / Restore Test</button><div id="stagingBackupTestOut" style="margin-top:8px;font-size:12px"></div>`;
    farm.appendChild(card);
    document.getElementById("stagingBackupTestBtn")?.addEventListener("click",async()=>{
      const b=document.getElementById("stagingBackupTestBtn");b.disabled=true;b.textContent="Testing backup…";const report=await run();
      document.getElementById("stagingBackupTestOut").textContent=report.failed?`❌ ${report.passed}/${report.total} passed`:`✅ ${report.passed}/${report.total} passed`;b.disabled=false;b.textContent="Run Backup / Restore Test";
    });
  }
  window.StagingBackupTest={run,last:()=>read(REPORT,null)};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(inject,1400),{once:true});else setTimeout(inject,1400);
})();
