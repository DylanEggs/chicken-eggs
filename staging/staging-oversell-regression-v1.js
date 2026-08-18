(() => {
  "use strict";
  if (window.__StagingOversellRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingOversellRegressionV1 = true;

  const ENTRIES="chickenEggEntriesV102";
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  const n=v=>Number(v)||0;
  const eggRevenue=e=>n(e?.dozenSold)*n(e?.dozenPrice)+n(e?.packSold??e?.packs18Sold)*n(e?.packPrice??e?.packs18Price);

  function snapshotStorage(){
    const out={};
    for(const key of window.StagingStorageSandbox?.listKeys?.()||[]){
      const value=localStorage.getItem(key);
      if(value!==null)out[key]=value;
    }
    return out;
  }

  function restoreStorage(snap){
    const oldRemote=window.__farmApplyingRemote;
    window.__farmApplyingRemote=true;
    try{
      localStorage.clear();
      for(const [key,value] of Object.entries(snap||{}))localStorage.setItem(key,value);
    } finally {
      window.__farmApplyingRemote=oldRemote;
    }
    try{window.loadLocal?.();}catch{}
    try{window.loadFarmSettings?.();}catch{}
    try{window.__reloadFarm2Memory?.();}catch{}
    try{window.updateApp?.();}catch{}
    window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,oversellRestore:true}}));
    window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,oversellRestore:true,key:"restore"}}));
  }

  function snapshotFields(){
    const ids=["saleDate","dozenSold","dozenPrice","packSold","packPrice","farm2SaleCustomer","farm2SalePaid","farm2SaleNote"];
    return Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value??""]));
  }

  function restoreFields(fields){
    for(const [id,value] of Object.entries(fields||{})){
      const el=document.getElementById(id);if(el)el.value=value;
    }
  }

  function inventoryShape(){
    const s=window.InventorySystemV6?.state?.()||{};
    return {dozens:n(s.dozens),packs18:n(s.packs18),loose:n(s.loose)};
  }

  function revenueTotal(){
    return read(ENTRIES,[]).filter(e=>e?.type==="sale").reduce((sum,e)=>sum+eggRevenue(e),0);
  }

  async function runOversellRegression(){
    const results=[];
    const storage=snapshotStorage();
    const fields=snapshotFields();
    const oldAlert=window.alert;
    let alertText="";
    window.alert=msg=>{alertText=String(msg||"");console.warn("STAGING oversell test alert:",alertText);};

    const check=(name,pass,detail="")=>results.push({name,pass:!!pass,detail:String(detail||"")});

    try{
      await window.InventorySystemV6?.commitExact?.(1,0,0);
      await sleep(100);
      const beforeRows=read(ENTRIES,[]);
      const beforeInv=inventoryShape();
      const beforeRevenue=revenueTotal();

      const values={dozenSold:"2",dozenPrice:"5",packSold:"0",packPrice:"8",farm2SalePaid:"paid",farm2SaleCustomer:"",farm2SaleNote:"STAGING impossible oversell"};
      for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(el)el.value=value;}

      window.saveSale?.();
      await sleep(250);

      const afterRows=read(ENTRIES,[]);
      const afterInv=inventoryShape();
      const afterRevenue=revenueTotal();

      check("Oversized egg sale is blocked before history is written",afterRows.length===beforeRows.length,`${beforeRows.length} -> ${afterRows.length}`);
      check("Blocked oversized sale leaves inventory unchanged",JSON.stringify(afterInv)===JSON.stringify(beforeInv),JSON.stringify({beforeInv,afterInv}));
      check("Blocked oversized sale leaves revenue unchanged",Math.abs(afterRevenue-beforeRevenue)<0.005,`${beforeRevenue} -> ${afterRevenue}`);
      check("Oversized sale explains available-stock problem",/sale blocked/i.test(alertText)&&/available/i.test(alertText),alertText);
    } catch(error){
      check("Oversell protection regression completed without exception",false,String(error?.stack||error));
    } finally {
      restoreStorage(storage);
      await sleep(100);
      restoreFields(fields);
      window.alert=oldAlert;
    }

    return results;
  }

  function install(){
    const base=window.StagingFullTest;
    if(!base?.run){setTimeout(install,25);return;}
    if(base.__oversellRegressionV1)return;
    const baseRun=base.run.bind(base);

    const wrapped={
      ...base,
      async run(){
        const first=await baseRun();
        const extra=await runOversellRegression();
        const results=[...(first?.results||[]),...extra];
        const failed=results.filter(x=>!x.pass);
        return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+oversell-v1`};
      },
      __oversellRegressionV1:true
    };
    window.StagingFullTest=wrapped;
    console.log("🧪 STAGING oversell regression active — impossible sales must leave history, inventory, and revenue unchanged");
  }

  install();
})();