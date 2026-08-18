(() => {
  "use strict";
  if(window.__ChickenEggsStagingFullTestV3)return;
  window.__ChickenEggsStagingFullTestV3=true;
  if(!window.__ChickenEggsStagingMode)return;

  const ENTRIES="chickenEggEntriesV102";
  const APP2="chickenEggApp2V1";
  const BUSINESS="chickenEggBusinessV1";
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const n=v=>Number(v)||0;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  const total=s=>n(s?.dozens)*12+n(s?.packs18)*18+n(s?.loose);
  const inv=()=>window.InventorySystemV6?.state?.()||{};
  const eggRevenue=e=>n(e?.dozenSold)*n(e?.dozenPrice)+n(e?.packSold??e?.packs18Sold)*n(e?.packPrice??e?.packs18Price);
  const monthRevenue=()=>read(ENTRIES,[]).filter(e=>e?.type==="sale"&&String(e.date||"").startsWith(today().slice(0,7))).reduce((s,e)=>s+eggRevenue(e),0);

  function storageSnapshot(){const out={};for(const key of window.StagingStorageSandbox?.listKeys?.()||[]){const v=localStorage.getItem(key);if(v!==null)out[key]=v;}return out;}
  function restoreStorage(snap){const old=window.__farmApplyingRemote;window.__farmApplyingRemote=true;try{localStorage.clear();for(const [k,v] of Object.entries(snap||{}))localStorage.setItem(k,v);}finally{window.__farmApplyingRemote=old;}try{window.loadLocal?.();}catch{}try{window.loadFarmSettings?.();}catch{}try{window.__reloadFarm2Memory?.();}catch{}try{window.updateApp?.();}catch{}window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,v3Restore:true}}));window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,v3Restore:true,key:"restore"}}));}
  function fieldsSnapshot(){const ids=["eggDate","eggCount","saleDate","dozenSold","dozenPrice","packSold","packPrice","farm2SaleCustomer","farm2SalePaid","farm2SaleNote"];return Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value??""]));}
  function restoreFields(s){for(const [id,v] of Object.entries(s||{})){const el=document.getElementById(id);if(el)el.value=v;}}
  function set(id,v){const el=document.getElementById(id);if(el)el.value=String(v);return !!el;}
  function newRow(before,after){const ids=new Set(before.map(x=>String(x?.id||"")));return after.find(x=>x?.id&&!ids.has(String(x.id)))||null;}
  async function waitFor(fn,timeout=3000){const start=Date.now();while(Date.now()-start<timeout){try{if(fn())return true;}catch{}await sleep(40);}return false;}
  function check(results,name,pass,detail=""){results.push({name,pass:!!pass,detail:String(detail||"")});if(!pass)console.warn("STAGING V3 FAIL:",name,detail);}
  function setEmptyOrders(){const app=read(APP2,{});app.orders=[];localStorage.setItem(APP2,JSON.stringify(app));try{window.__reloadFarm2Memory?.();}catch{}window.dispatchEvent(new CustomEvent("farm-local-data-changed",{detail:{key:APP2,staging:true,v3:true}}));}
  async function saveEgg(count){const before=read(ENTRIES,[]);set("eggDate",today());set("eggCount",count);window.saveEggs?.();await waitFor(()=>read(ENTRIES,[]).length>before.length);return newRow(before,read(ENTRIES,[]));}
  async function saveSale(dozens,packs,dPrice=5,pPrice=8,note="V3 sale"){const before=read(ENTRIES,[]);set("saleDate",today());set("dozenSold",dozens);set("dozenPrice",dPrice);set("packSold",packs);set("packPrice",pPrice);set("farm2SaleCustomer","");set("farm2SalePaid","paid");set("farm2SaleNote",note);window.saveSale?.();await sleep(220);return {before,after:read(ENTRIES,[]),sale:newRow(before,read(ENTRIES,[]))};}

  async function deepRegression(){
    const results=[],snap=storageSnapshot(),fields=fieldsSnapshot();const oldAlert=window.alert,oldConfirm=window.confirm;let alerts=[];window.alert=m=>alerts.push(String(m||""));window.confirm=()=>true;
    try{
      setEmptyOrders();

      await window.InventorySystemV6?.commitExact?.(2,1,5);await sleep(80);
      const base=inv();check(results,"V3 exact mixed inventory starts at 47 eggs",n(base.dozens)===2&&n(base.packs18)===1&&n(base.loose)===5&&total(base)===47,JSON.stringify(base));
      const e1=await saveEgg(3),e2=await saveEgg(4);await sleep(120);
      let s=inv();check(results,"Two same-day collections create two history rows",!!e1&&!!e2&&String(e1.id)!==String(e2.id));
      check(results,"Two same-day collections add exactly 7 loose eggs",n(s.dozens)===2&&n(s.packs18)===1&&n(s.loose)===12,JSON.stringify(s));
      if(e2){window.editEntry?.(e2.id);set("eggCount",6);window.saveEggs?.();await sleep(180);s=inv();check(results,"Editing second collection from 4 to 6 adds only 2 eggs",n(s.loose)===14,JSON.stringify(s));}
      if(e1){window.deleteEntry?.(e1.id);await sleep(180);s=inv();check(results,"Deleting first collection reverses only its 3 eggs",n(s.loose)===11,JSON.stringify(s));}
      if(e2){window.deleteEntry?.(e2.id);await sleep(180);s=inv();check(results,"Deleting edited second collection restores original 47-egg inventory",n(s.dozens)===2&&n(s.packs18)===1&&n(s.loose)===5&&total(s)===47,JSON.stringify(s));}

      setEmptyOrders();await window.InventorySystemV6?.commitExact?.(1,0,0);await sleep(80);
      const revBeforeExact=monthRevenue();const exactSale=await saveSale(1,0,5,8,"V3 exact stock sale");s=inv();
      check(results,"Sale equal to all available stock succeeds",!!exactSale.sale&&total(s)===0,JSON.stringify({sale:exactSale.sale,inventory:s}));
      check(results,"Exact-stock sale adds revenue once",Math.abs(monthRevenue()-(revBeforeExact+5))<0.005,`${revBeforeExact} -> ${monthRevenue()}`);
      alerts=[];const zeroBefore=read(ENTRIES,[]).length;await saveSale(1,0,5,8,"V3 zero stock oversell");s=inv();
      check(results,"Another sale at zero stock is blocked",read(ENTRIES,[]).length===zeroBefore&&total(s)===0,JSON.stringify(s));
      check(results,"Zero-stock block explains insufficient availability",alerts.some(x=>/sale blocked/i.test(x)&&/available/i.test(x)),alerts.join(" | "));
      if(exactSale.sale){window.deleteEntry?.(exactSale.sale.id);await sleep(180);s=inv();check(results,"Deleting exact-stock sale restores its dozen",n(s.dozens)===1&&total(s)===12,JSON.stringify(s));}

      await window.InventorySystemV6?.commitExact?.(2,2,10);await sleep(80);const mixedStart=JSON.stringify(inv());const mixed=await saveSale(1,1,5,8,"V3 mixed sale");s=inv();
      check(results,"Mixed dozen + 18-pack sale removes one of each",!!mixed.sale&&n(s.dozens)===1&&n(s.packs18)===1&&n(s.loose)===10,JSON.stringify(s));
      if(mixed.sale){
        window.editEntry?.(mixed.sale.id);await sleep(30);set("dozenSold",0);set("packSold",2);set("dozenPrice",5);set("packPrice",8);window.saveSale?.();await sleep(230);s=inv();
        const edited=read(ENTRIES,[]).find(x=>String(x.id)===String(mixed.sale.id));
        check(results,"Editing mixed sale changes existing history instead of duplicating",!!edited&&n(edited.dozenSold)===0&&n(edited.packSold)===2&&read(ENTRIES,[]).filter(x=>String(x.id)===String(mixed.sale.id)).length===1,JSON.stringify(edited||{}));
        check(results,"Editing sale restores old packages before subtracting new packages",n(s.dozens)===2&&n(s.packs18)===0&&n(s.loose)===10,JSON.stringify(s));
        window.deleteEntry?.(mixed.sale.id);await sleep(220);s=inv();check(results,"Deleting edited sale restores exact pre-sale mixed inventory",JSON.stringify(s)===mixedStart,JSON.stringify({expected:mixedStart,actual:s}));
      }

      setEmptyOrders();await window.InventorySystemV6?.commitExact?.(2,0,0);await sleep(80);let app=read(APP2,{});app.orders=[{id:"v3-reservation",status:"pending",dozen:1,packs18:0,date:today()}];localStorage.setItem(APP2,JSON.stringify(app));window.__reloadFarm2Memory?.();window.dispatchEvent(new CustomEvent("farm-local-data-changed",{detail:{key:APP2,staging:true,v3:true}}));await sleep(80);
      check(results,"Pending order reserves 12 without changing physical inventory",total(inv())===24&&n(window.InventorySystemV6?.reservations?.())===12&&n(window.InventorySystemV6?.available?.())===12,JSON.stringify({inventory:inv(),reserved:window.InventorySystemV6?.reservations?.(),available:window.InventorySystemV6?.available?.()}));
      alerts=[];const reservedBefore=read(ENTRIES,[]).length;await saveSale(2,0,5,8,"V3 reserved oversell");check(results,"Sale cannot consume eggs reserved for pending order",read(ENTRIES,[]).length===reservedBefore&&total(inv())===24&&n(window.InventorySystemV6?.available?.())===12);
      const allowed=await saveSale(1,0,5,8,"V3 available around reservation");check(results,"Sale can use only the unreserved dozen",!!allowed.sale&&total(inv())===12&&n(window.InventorySystemV6?.available?.())===0,JSON.stringify(inv()));
      if(allowed.sale){window.deleteEntry?.(allowed.sale.id);await sleep(180);check(results,"Deleting reservation-safe sale restores available dozen",total(inv())===24&&n(window.InventorySystemV6?.available?.())===12);}
      app=read(APP2,{});app.orders=[];localStorage.setItem(APP2,JSON.stringify(app));window.__reloadFarm2Memory?.();window.dispatchEvent(new CustomEvent("farm-local-data-changed",{detail:{key:APP2,staging:true,v3:true}}));await sleep(80);check(results,"Removing pending order releases all 24 eggs for sale",n(window.InventorySystemV6?.available?.())===24);

      await window.InventorySystemV6?.commitExact?.(3,0,0);await sleep(70);
      for(const [label,dz,pk] of [["negative dozen",-1,0],["decimal dozen",1.5,0],["negative 18-pack",0,-1],["decimal 18-pack",0,1.25]]){
        alerts=[];const beforeRows=read(ENTRIES,[]).length,beforeInv=JSON.stringify(inv());await saveSale(dz,pk,5,8,`V3 invalid ${label}`);check(results,`Invalid ${label} sale is rejected`,read(ENTRIES,[]).length===beforeRows&&JSON.stringify(inv())===beforeInv,alerts.join(" | "));
      }

      if(window.FarmPublicCustomerBuilderV2?.build){
        const privateValues=["SECRET CUSTOMER","PRIVATE EXPENSE","PRIVATE NOTE","$999"];
        const syntheticEntries=[];const weatherHistory={};const start=new Date();start.setHours(12,0,0,0);start.setDate(start.getDate()-39);
        for(let i=0;i<40;i++){const d=new Date(start);d.setDate(start.getDate()+i);const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;syntheticEntries.push({id:`v3e${i}`,type:"eggs",date,eggs:i%2?12:8});weatherHistory[date]={max:i%2?94:82,humidity:i%3?62:80,cloud:i%4?35:82,rain:i%5?0:.2};}
        const pub=window.FarmPublicCustomerBuilderV2.build({app2:{customers:[{name:"SECRET CUSTOMER"}],orders:[],expenses:[{description:"PRIVATE EXPENSE",amount:999}],flock:[{id:"v3bird",name:"Test Hen",breed:"Mix",sex:"Hen",hatchDate:"2026-01-01",notes:"PRIVATE NOTE"}]},inventory:{dozens:2,packs18:0,loose:0},entries:syntheticEntries,settings:{farmName:"Rose Family Poultry",dozenPrice:999},weather:{location:"High Point, NC",history:weatherHistory,current:{temperature:80},forecast:{}},deluxe:{}});
        const text=JSON.stringify(pub);check(results,"Public v2 stats contain 30 daily, 8 weekly and 12 monthly chart points",pub.summary.stats?.daily30?.length===30&&pub.summary.stats?.weekly8?.length===8&&pub.summary.stats?.monthly12?.length===12,JSON.stringify({daily:pub.summary.stats?.daily30?.length,weekly:pub.summary.stats?.weekly8?.length,monthly:pub.summary.stats?.monthly12?.length}));
        check(results,"Public v2 records are derived from egg collections",n(pub.summary.stats?.records?.lifetimeEggs)===syntheticEntries.reduce((s,e)=>s+n(e.eggs),0),JSON.stringify(pub.summary.stats?.records||{}));
        check(results,"Public weather insights are derived without raw weather history",n(pub.summary.weatherInsights?.samples)>0&&!Object.prototype.hasOwnProperty.call(pub.summary,"history")&&!Object.prototype.hasOwnProperty.call(pub.summary.weather||{},"history"),JSON.stringify(pub.summary.weatherInsights||{}));
        check(results,"Public v2 snapshot contains no private customer/money values",privateValues.every(v=>!text.includes(v))&&!/"revenue"|"profit"|"expenses"|"customers"|"dozenPrice"|"packPrice"/.test(text),text.slice(0,260));
      }else check(results,"Public customer builder v2 is loaded in staging",false,"FarmPublicCustomerBuilderV2 missing");

    }catch(error){check(results,"V3 deep regression completed without exception",false,String(error?.stack||error));}
    finally{restoreStorage(snap);await sleep(100);restoreFields(fields);window.alert=oldAlert;window.confirm=oldConfirm;}
    return results;
  }

  function install(){
    const base=window.StagingFullTest;
    if(!base?.run||base.__deepV3){setTimeout(install,80);return;}
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){const first=await baseRun();const extra=await deepRegression();const results=[...(first?.results||[]),...extra];const failed=results.filter(x=>!x.pass);const report={...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+deep-v3`};try{localStorage.setItem("chickenEggStagingFullTestReportV3",JSON.stringify(report));}catch{}return report;},last:()=>read("chickenEggStagingFullTestReportV3",null)||base.last?.()||null,__deepV3:true};
    console.log("🧪 STAGING Full Test v3 active — deeper eggs, sales, inventory, reservations and public-data checks added");
  }
  setTimeout(install,1100);
})();
