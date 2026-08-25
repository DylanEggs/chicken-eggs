(() => {
  "use strict";
  if (window.__StagingManualInventoryRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingManualInventoryRegressionV1 = true;

  const KEY="chickenEggInventoryV2";
  const ENTRIES="chickenEggEntriesV102";
  const whole=v=>Math.max(0,Math.round(Number(v)||0));
  const readRaw=k=>localStorage.getItem(k);
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}};
  const shape=s=>({dozens:whole(s?.dozens),packs18:whole(s?.packs18),individual:whole(s?.loose),total:whole(s?.dozens)*12+whole(s?.packs18)*18+whole(s?.loose)});
  const row=(name,pass,detail="")=>({name,pass:!!pass,detail:String(detail||"")});
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function restore(raw){
    const oldRemote=window.__farmApplyingRemote;
    window.__farmApplyingRemote=true;
    try{if(raw===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,raw);}
    finally{window.__farmApplyingRemote=oldRemote;}
    try{window.InventorySystemV6?.render?.();}catch{}
    try{window.StagingTwelvePackDefaultV1?.refresh?.();}catch{}
    window.dispatchEvent(new CustomEvent("inventory-authority-changed",{detail:{staging:true,manualInventoryRestore:true}}));
  }

  async function run(){
    const checks=[];
    const savedInventory=readRaw(KEY);
    const beforeEntries=readRaw(ENTRIES);
    try{
      const api=window.StagingTwelvePackDefaultV1;
      checks.push(row("manual inventory editor API is active",Number(api?.version)>=2&&typeof api?.saveManualExact==="function"));
      if(typeof api?.saveManualExact!=="function")return {checks,total:checks.length,passed:0,failed:checks.length};

      let s=await api.saveManualExact(2,1,5);
      checks.push(row("manual save keeps exact 12-pack, 18-pack and individual counts",JSON.stringify(shape(s))===JSON.stringify({dozens:2,packs18:1,individual:5,total:47}),JSON.stringify(shape(s))));
      const text=api.packageText(s);
      checks.push(row("inventory text shows individual eggs",/5 individual eggs/.test(text)&&/47 eggs total/.test(text),text));

      s=await api.saveManualExact(0,0,11);
      const before=read(ENTRIES,[]);
      const egg={id:`manual-inventory-${Date.now()}`,type:"eggs",eggs:1,date:"2099-12-31",createdAt:Date.now(),updatedAt:Date.now()};
      await window.InventorySystemV6.applyEntryDiff(before,[...before,egg],"manual inventory 12-pack default test");
      await sleep(60);
      s=window.InventorySystemV6.state();
      checks.push(row("after manual entry, next collection defaults back to a 12-pack",JSON.stringify(shape(s))===JSON.stringify({dozens:1,packs18:0,individual:0,total:12}),JSON.stringify(shape(s))));

      s=await api.saveManualExact(1,1,5); // 35 total
      const before35=read(ENTRIES,[]);
      const egg7={id:`manual-inventory-seven-${Date.now()}`,type:"eggs",eggs:7,date:"2099-12-31",createdAt:Date.now(),updatedAt:Date.now()};
      await window.InventorySystemV6.applyEntryDiff(before35,[...before35,egg7],"manual inventory preserve 18-pack test");
      await sleep(60);
      s=window.InventorySystemV6.state();
      checks.push(row("automatic 12-pack default preserves a manually designated 18-pack",JSON.stringify(shape(s))===JSON.stringify({dozens:2,packs18:1,individual:0,total:42}),JSON.stringify(shape(s))));
      checks.push(row("manual inventory regression never changes egg or sale history",readRaw(ENTRIES)===beforeEntries));
    }catch(error){
      checks.push(row("manual inventory regression completed without exception",false,String(error?.stack||error)));
    }finally{
      restore(savedInventory);
    }
    const failed=checks.filter(x=>!x.pass);
    return {suite:"staging-manual-inventory-v1",checks,total:checks.length,passed:checks.length-failed.length,failed:failed.length};
  }

  let tries=0;
  function attach(){
    const base=window.StagingFullTest;
    const ready=base?.run&&base.__twelvePackFullSuiteV1&&base.__simpleBusinessV1;
    if(!ready){if(tries++<50)setTimeout(attach,180);return;}
    if(base.__manualInventoryRegressionV1)return;
    const oldRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){
      const first=await oldRun();
      const extra=await run();
      const mapped=extra.checks.map(r=>({name:`Manual Inventory: ${r.name}`,pass:r.pass,detail:r.detail}));
      const results=[...(first?.results||[]),...mapped];
      const failed=results.filter(x=>!x.pass);
      return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+manual-inventory-v1`};
    },__manualInventoryRegressionV1:true};
    console.log("📦 STAGING full suite includes exact manual inventory + 12-pack-default regression");
  }

  window.StagingManualInventoryRegressionV1={version:1,run};
  setTimeout(attach,2600);
})();
