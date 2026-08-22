(() => {
  "use strict";
  if (window.__StagingRealUserFlowRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingRealUserFlowRegressionV1 = true;

  const ENTRIES="chickenEggEntriesV102";
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  const totalInv=()=>{const s=window.InventorySystemV6?.state?.()||{};return Number(s.dozens||0)*12+Number(s.packs18||0)*18+Number(s.loose||0);};
  const available=()=>Number(window.InventorySystemV6?.available?.()??totalInv())||0;
  const waitFor=async(fn,timeout=3500)=>{const start=Date.now();while(Date.now()-start<timeout){try{if(fn())return true;}catch{}await sleep(50);}return false;};
  const check=(results,name,pass,detail="")=>results.push({name,pass:!!pass,detail:String(detail||"")});

  function snapshot(){const out={};for(const key of window.StagingStorageSandbox?.listKeys?.()||[]){try{const v=localStorage.getItem(key);if(v!==null)out[key]=v;}catch{}}return out;}
  function restore(snap){const old=window.__farmApplyingRemote;window.__farmApplyingRemote=true;try{localStorage.clear();for(const [k,v] of Object.entries(snap||{}))localStorage.setItem(k,v);}finally{window.__farmApplyingRemote=old;}try{window.loadLocal?.();}catch{}try{window.loadFarmSettings?.();}catch{}try{window.__reloadFarm2Memory?.();}catch{}try{window.updateApp?.();}catch{}try{window.InventorySystemV6?.render?.();}catch{}window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,realUserRestore:true}}));window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,realUserRestore:true,key:"real-user-restore"}}));}
  function fields(){const ids=["eggDate","eggCount","saleDate","dozenSold","dozenPrice","packSold","packPrice","farm2SaleCustomer","farm2SalePaid","farm2SaleNote"];return Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value??""]));}
  function restoreFields(saved){for(const [id,v] of Object.entries(saved||{})){const el=document.getElementById(id);if(el)el.value=v;}}
  function setField(id,value){const el=document.getElementById(id);if(!el)return false;el.value=String(value);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true;}
  function buttonForScreen(id){return [...document.querySelectorAll("button")].find(b=>new RegExp(`showScreen\\(['\"]${id}['\"]\\)`).test(b.getAttribute("onclick")||""));}
  function actionButton(screenId,fn){return [...(document.querySelectorAll(`#${screenId} button`)||[])].find(b=>(b.getAttribute("onclick")||"").includes(`${fn}()`));}
  function newRow(before,after,type){const ids=new Set(before.map(x=>String(x?.id||"")));return after.find(x=>x?.type===type&&x?.id&&!ids.has(String(x.id)))||null;}

  async function runChecks(){
    const results=[],snap=snapshot(),savedFields=fields(),activeBefore=document.querySelector(".screen.active")?.id||"dashboard";
    const oldAlert=window.alert,oldConfirm=window.confirm;const alerts=[];window.alert=m=>alerts.push(String(m||""));window.confirm=()=>true;
    try{
      const collectNav=buttonForScreen("collect");
      check(results,"Real-user flow: Collect control exists",!!collectNav);
      collectNav?.click();await sleep(40);
      check(results,"Real-user flow: clicking Collect opens Collect screen",document.querySelector(".screen.active")?.id==="collect",document.querySelector(".screen.active")?.id||"none");

      const beforeEggRows=read(ENTRIES,[]),invBeforeEgg=totalInv();
      setField("eggDate",today());setField("eggCount",5);
      const saveEggBtn=actionButton("collect","saveEggs");
      check(results,"Real-user flow: Save Eggs button exists",!!saveEggBtn);
      saveEggBtn?.click();
      await waitFor(()=>read(ENTRIES,[]).length>beforeEggRows.length);
      const afterEggRows=read(ENTRIES,[]),eggRow=newRow(beforeEggRows,afterEggRows,"eggs");
      check(results,"Real-user flow: Save Eggs click creates a history row",!!eggRow,JSON.stringify(eggRow||{}));
      check(results,"Real-user flow: collected row stores 5 eggs",Number(eggRow?.eggs)===5,JSON.stringify(eggRow||{}));
      check(results,"Real-user flow: collecting 5 eggs increases physical inventory by 5",totalInv()===invBeforeEgg+5,`${invBeforeEgg} -> ${totalInv()}`);

      if(available()<12){
        const needed=Math.ceil(12-available());
        buttonForScreen("collect")?.click();setField("eggDate",today());setField("eggCount",needed);actionButton("collect","saveEggs")?.click();await waitFor(()=>available()>=12);
      }

      const saleNav=buttonForScreen("sale");
      check(results,"Real-user flow: Sale control exists",!!saleNav);
      saleNav?.click();await sleep(40);
      check(results,"Real-user flow: clicking Sale opens Sale screen",document.querySelector(".screen.active")?.id==="sale",document.querySelector(".screen.active")?.id||"none");

      const beforeSaleRows=read(ENTRIES,[]),invBeforeSale=totalInv();
      setField("saleDate",today());setField("dozenSold",1);setField("dozenPrice",5);setField("packSold",0);setField("packPrice",8);
      if(document.getElementById("farm2SaleCustomer"))setField("farm2SaleCustomer","");
      if(document.getElementById("farm2SalePaid"))setField("farm2SalePaid","paid");
      if(document.getElementById("farm2SaleNote"))setField("farm2SaleNote","Automated real-user flow test");
      const saveSaleBtn=actionButton("sale","saveSale");
      check(results,"Real-user flow: Save Sale button exists",!!saveSaleBtn);
      saveSaleBtn?.click();
      await waitFor(()=>read(ENTRIES,[]).length>beforeSaleRows.length);
      const afterSaleRows=read(ENTRIES,[]),saleRow=newRow(beforeSaleRows,afterSaleRows,"sale");
      check(results,"Real-user flow: Save Sale click creates a sale history row",!!saleRow,JSON.stringify(saleRow||{}));
      check(results,"Real-user flow: sale row stores one dozen",Number(saleRow?.dozenSold)===1,JSON.stringify(saleRow||{}));
      check(results,"Real-user flow: one-dozen sale decreases physical inventory by 12",totalInv()===invBeforeSale-12,`${invBeforeSale} -> ${totalInv()}`);

      for(const id of ["stats","farm"]){
        const btn=buttonForScreen(id);check(results,`Real-user flow: ${id} navigation control exists`,!!btn);btn?.click();await sleep(30);check(results,`Real-user flow: clicking ${id} opens its screen`,document.querySelector(".screen.active")?.id===id,document.querySelector(".screen.active")?.id||"none");
      }

      const customerLink=document.querySelector('#stagingSafetyBanner a[href*="staging/view/"]');
      const loginLink=document.querySelector('#stagingSafetyBanner a[href*="staging/owner-login/"]');
      check(results,"Real-user flow: Customer Preview control points to staging customer page",!!customerLink&&String(customerLink.getAttribute("href")||"").includes("staging/view/"));
      check(results,"Real-user flow: Owner Login control points to staging owner login",!!loginLink&&String(loginLink.getAttribute("href")||"").includes("staging/owner-login/"));
      check(results,"Real-user flow: no unexpected alert/error occurred during collect and sale clicks",!alerts.some(x=>/error|failed|could not|blocked/i.test(x)),alerts.join(" | "));
    }catch(error){check(results,"Real-user flow regression completed without exception",false,String(error?.stack||error));}
    finally{restore(snap);restoreFields(savedFields);window.alert=oldAlert;window.confirm=oldConfirm;try{window.showScreen?.(activeBefore);}catch{}}
    return results;
  }

  function install(){
    const base=window.StagingFullTest;
    const ready=base?.run&&base.__twelvePackFullSuiteV1&&base.__historyBackV1&&base.__saleEditBackV1&&base.__customerRequestsV1&&base.__customerRequestsLiveParityV1;
    if(!ready){setTimeout(install,140);return;}
    if(base.__realUserFlowV1)return;
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){const first=await baseRun();const extra=await runChecks();const results=[...(first?.results||[]),...extra];const failed=results.filter(x=>!x.pass);return{...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+real-user-flow-v1`};},__realUserFlowV1:true};
    window.dispatchEvent(new CustomEvent("staging-final-suite-changed"));
    console.log("🖱️ STAGING real-user flow regression active — actual Collect/Sale/Stats/Farm controls are clicked in the isolated sandbox");
  }

  window.StagingRealUserFlowRegressionV1={version:1,run:runChecks};
  setTimeout(install,500);
})();