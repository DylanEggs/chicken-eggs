(() => {
  "use strict";
  if (window.__StagingTwelvePackRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingTwelvePackRegressionV1 = true;

  const KEY="chickenEggInventoryV2";
  const ENTRIES="chickenEggEntriesV102";
  const APP2="chickenEggApp2V1";
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const whole=v=>Math.max(0,Math.round(Number(v)||0));
  const readRaw=k=>localStorage.getItem(k);
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}};
  const total=s=>whole(s?.dozens)*12+whole(s?.packs18)*18+whole(s?.loose);
  const shape=s=>({dozens:whole(s?.dozens),packs18:whole(s?.packs18),remainder:whole(s?.loose),total:total(s)});
  const check=(r,name,pass,detail="")=>r.push({name,pass:!!pass,detail:String(detail||"")});
  const waitFor=async(fn,timeout=3000)=>{const start=Date.now();while(Date.now()-start<timeout){try{if(fn())return true;}catch{}await sleep(40);}return false;};

  function restore(snapshot){
    const oldRemote=window.__farmApplyingRemote;
    window.__farmApplyingRemote=true;
    try{for(const [k,v] of Object.entries(snapshot)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}}
    finally{window.__farmApplyingRemote=oldRemote;}
    try{window.loadLocal?.();}catch{}
    try{window.__reloadFarm2Memory?.();}catch{}
    try{window.updateApp?.();}catch{}
    window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,twelvePackRestore:true}}));
    window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,twelvePackRestore:true,key:"restore"}}));
    setTimeout(()=>window.StagingTwelvePackDefaultV1?.refresh?.(),0);
  }

  async function setExactTotal(totalEggs,packs18=0){
    const api=window.StagingTwelvePackDefaultV1;
    const s=api.setManual18(totalEggs,packs18);
    await window.InventorySystemV6.commitExact(s.dozens,s.packs18,s.loose);
    await sleep(80);
    return window.InventorySystemV6.state();
  }

  async function run(){
    const results=[];
    const snap={ [KEY]:readRaw(KEY), [ENTRIES]:readRaw(ENTRIES), [APP2]:readRaw(APP2) };
    const beforeEntries=readRaw(ENTRIES),beforeApp=readRaw(APP2);
    try{
      const api=window.StagingTwelvePackDefaultV1;
      check(results,"12-pack staging layer is active",!!api?.setManual18&&!!api?.packageText);
      if(!api?.setManual18)return {total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results};

      const cases=[
        [0,0,{dozens:0,packs18:0,remainder:0,total:0}],
        [1,0,{dozens:0,packs18:0,remainder:1,total:1}],
        [11,0,{dozens:0,packs18:0,remainder:11,total:11}],
        [12,0,{dozens:1,packs18:0,remainder:0,total:12}],
        [17,0,{dozens:1,packs18:0,remainder:5,total:17}],
        [18,0,{dozens:1,packs18:0,remainder:6,total:18}],
        [23,0,{dozens:1,packs18:0,remainder:11,total:23}],
        [24,0,{dozens:2,packs18:0,remainder:0,total:24}],
        [36,0,{dozens:3,packs18:0,remainder:0,total:36}]
      ];
      for(const [eggs,packs,expected] of cases){
        const s=api.setManual18(eggs,packs);
        check(results,`${eggs} eggs defaults to 12-packs without automatic 18-pack`,JSON.stringify(shape(s))===JSON.stringify(expected),JSON.stringify(shape(s)));
      }

      const manual18=api.setManual18(30,1);
      check(results,"Manual 18-pack is preserved inside exact 30-egg total",JSON.stringify(shape(manual18))===JSON.stringify({dozens:1,packs18:1,remainder:0,total:30}),JSON.stringify(shape(manual18)));
      const manual18Remainder=api.setManual18(35,1);
      check(results,"Manual 18-pack plus 12-pack keeps hidden exact remainder",JSON.stringify(shape(manual18Remainder))===JSON.stringify({dozens:1,packs18:1,remainder:5,total:35}),JSON.stringify(shape(manual18Remainder)));
      check(results,"18-packs never appear automatically at 18 eggs",shape(api.setManual18(18,0)).packs18===0);
      check(results,"18-packs never appear automatically at 36 eggs",shape(api.setManual18(36,0)).packs18===0);

      let s=await setExactTotal(11,0);
      check(results,"11 eggs stores exact total with no full 12-pack",JSON.stringify(shape(s))===JSON.stringify({dozens:0,packs18:0,remainder:11,total:11}),JSON.stringify(shape(s)));
      const before=read(ENTRIES,[]);
      const egg={id:`twelve-pack-${Date.now()}`,type:"eggs",eggs:1,date:"2099-12-31",createdAt:Date.now(),updatedAt:Date.now()};
      await window.InventorySystemV6.applyEntryDiff(before,[...before,egg],"12-pack boundary test");
      s=window.InventorySystemV6.state();
      check(results,"11 + 1 collected automatically becomes one 12-pack",JSON.stringify(shape(s))===JSON.stringify({dozens:1,packs18:0,remainder:0,total:12}),JSON.stringify(shape(s)));

      s=await setExactTotal(17,0);
      const before17=read(ENTRIES,[]);
      const egg7={id:`twelve-pack-seven-${Date.now()}`,type:"eggs",eggs:7,date:"2099-12-31",createdAt:Date.now(),updatedAt:Date.now()};
      await window.InventorySystemV6.applyEntryDiff(before17,[...before17,egg7],"24 egg boundary test");
      s=window.InventorySystemV6.state();
      check(results,"17 + 7 collected automatically becomes two 12-packs",JSON.stringify(shape(s))===JSON.stringify({dozens:2,packs18:0,remainder:0,total:24}),JSON.stringify(shape(s)));

      s=await setExactTotal(42,1);
      check(results,"42 eggs can be packaged as two 12-packs plus one manual 18-pack",JSON.stringify(shape(s))===JSON.stringify({dozens:2,packs18:1,remainder:0,total:42}),JSON.stringify(shape(s)));
      const sale={id:`twelve-sale-${Date.now()}`,type:"sale",dozenSold:1,packSold:0,date:"2099-12-31",createdAt:Date.now(),updatedAt:Date.now()};
      const rows=read(ENTRIES,[]);
      await window.InventorySystemV6.applyEntryDiff(rows,[...rows,sale],"12-pack sale test");
      s=window.InventorySystemV6.state();
      check(results,"Selling one 12-pack keeps the manual 18-pack intact",JSON.stringify(shape(s))===JSON.stringify({dozens:1,packs18:1,remainder:0,total:30}),JSON.stringify(shape(s)));
      await window.InventorySystemV6.applyEntryDiff([...rows,sale],rows,"Delete 12-pack sale test");
      s=window.InventorySystemV6.state();
      check(results,"Deleting 12-pack sale restores exact 42-egg packaging",JSON.stringify(shape(s))===JSON.stringify({dozens:2,packs18:1,remainder:0,total:42}),JSON.stringify(shape(s)));

      const text=api.packageText(api.setManual18(17,0));
      check(results,"Owner package text shows 12-packs and exact total",/1 12-pack/.test(text)&&/17 eggs total/.test(text),text);
      check(results,"Owner package text never says loose or extra",!/loose|extra|remainder/i.test(text),text);
      const with18=api.packageText(api.setManual18(42,1));
      check(results,"Owner package text shows manual 18-pack only when present",/2 12-packs/.test(with18)&&/1 18-pack/.test(with18)&&/42 eggs total/.test(with18),with18);

      check(results,"12-pack test never changes egg/sale history",readRaw(ENTRIES)===beforeEntries);
      check(results,"12-pack test never changes Farm App 2/customer/order data",readRaw(APP2)===beforeApp);
    }catch(error){
      check(results,"12-pack regression completed without exception",false,String(error?.stack||error));
    }finally{
      restore(snap);
    }
    const failed=results.filter(x=>!x.pass);
    return {at:Date.now(),total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:"staging-12-pack-default-v1"};
  }

  function installButton(){
    if(document.getElementById("stagingTwelvePackTest"))return;
    const banner=document.querySelector(".staging-controls")||document.querySelector(".staging-banner")||document.querySelector("header");
    if(!banner){setTimeout(installButton,150);return;}
    const btn=document.createElement("button");
    btn.id="stagingTwelvePackTest";
    btn.type="button";
    btn.textContent="📦 Test 12-Pack Inventory";
    btn.addEventListener("click",async()=>{
      if(btn.disabled)return;
      btn.disabled=true;btn.textContent="Testing 12-pack inventory…";
      try{
        const report=await run();
        const failed=report.results.filter(x=>!x.pass);
        if(!failed.length) alert(`✅ 12-pack inventory test passed ${report.passed}/${report.total} checks.\n\nCustomer preview was not changed.`);
        else alert(`❌ 12-pack inventory test: ${report.passed}/${report.total} passed, ${report.failed} failed.\n\nFAILED:\n${failed.slice(0,8).map((x,i)=>`${i+1}. ${x.name}${x.detail?`\n   ${x.detail}`:""}`).join("\n")}`);
      }finally{btn.disabled=false;btn.textContent="📦 Test 12-Pack Inventory";}
    });
    banner.appendChild(btn);
  }

  window.StagingTwelvePackRegressionV1={run};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(installButton,300),{once:true});else setTimeout(installButton,300);
})();
