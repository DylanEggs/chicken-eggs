(() => {
  "use strict";
  if(window.__ChickenEggsStagingFullTestV4||!window.__ChickenEggsStagingMode)return;
  window.__ChickenEggsStagingFullTestV4=true;

  const stage=String(window.__ChickenEggsStagingBuild||Date.now());
  const app=String(window.__ChickenEggsBuild||Date.now());
  const scriptSrc=path=>`${path}?stage=${encodeURIComponent(stage)}&app=${encodeURIComponent(app)}`;
  function load(path,guard){
    if(guard?.())return Promise.resolve(true);
    return new Promise(resolve=>{
      const s=document.createElement("script");s.src=scriptSrc(path);s.async=false;
      s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.body.appendChild(s);
    });
  }

  async function bootstrap(){
    await load("staging/staging-smart-insights-v1.js",()=>!!window.StagingSmartInsightsV1);
    await load("staging/staging-smart-insights-regression-v1.js",()=>!!window.StagingSmartInsightsRegressionV1);
    await load("staging/staging-delight-v1.js",()=>!!window.StagingDelightV1);
    await load("staging/staging-delight-regression-v1.js",()=>!!window.StagingDelightRegressionV1);
    await load("staging/staging-action-center-v1.js",()=>!!window.StagingActionCenterV1);
    await load("staging/staging-action-center-regression-v1.js",()=>!!window.StagingActionCenterRegressionV1);
    await load("staging/staging-unit-economics-v1.js",()=>!!window.StagingUnitEconomicsV1);
    await load("staging/staging-unit-economics-regression-v1.js",()=>!!window.StagingUnitEconomicsRegressionV1);
    await load("staging/staging-customer-ledger-v1.js",()=>!!window.StagingCustomerLedgerV1);
    await load("staging/staging-customer-ledger-regression-v1.js",()=>!!window.StagingCustomerLedgerRegressionV1);
    await load("staging/staging-egg-safety-v1.js",()=>!!window.StagingEggSafetyV1);
    await load("staging/staging-egg-safety-regression-v1.js",()=>!!window.StagingEggSafetyRegressionV1);
    install();
  }

  function install(){
    const base=window.StagingFullTest;
    const farm=window.StagingFarmManagerRegressionV1;
    const smart=window.StagingSmartInsightsRegressionV1;
    const delight=window.StagingDelightRegressionV1;
    const actions=window.StagingActionCenterRegressionV1;
    const economics=window.StagingUnitEconomicsRegressionV1;
    const ledger=window.StagingCustomerLedgerRegressionV1;
    const eggSafety=window.StagingEggSafetyRegressionV1;
    if(!base?.run||!farm?.run||!smart?.run||!delight?.run||!actions?.run||!economics?.run||!ledger?.run||!eggSafety?.run){setTimeout(install,100);return;}
    if(base.__eggSafetyV10)return;
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){
      const first=await baseRun();
      const farmResult=await farm.run();
      const smartResult=await smart.run();
      const delightResult=await delight.run();
      const actionResult=await actions.run();
      const economicsResult=await economics.run();
      const ledgerResult=await ledger.run();
      const safetyResult=await eggSafety.run();
      const farmMapped=(farmResult?.rows||[]).map(r=>({name:`Farm Manager: ${r.name}`,pass:!!r.ok,detail:r.detail||""}));
      const smartMapped=(smartResult?.checks||[]).map(r=>({name:`Smart Insights: ${r.name}`,pass:!!r.pass,detail:r.detail||""}));
      const delightMapped=(delightResult?.checks||[]).map(r=>({name:`Home Delight: ${r.name}`,pass:!!r.pass,detail:r.detail||""}));
      const actionMapped=(actionResult?.checks||[]).map(r=>({name:`Farm Today: ${r.name}`,pass:!!r.pass,detail:r.detail||""}));
      const economicsMapped=(economicsResult?.checks||[]).map(r=>({name:`Egg Cost: ${r.name}`,pass:!!r.pass,detail:r.detail||""}));
      const ledgerMapped=(ledgerResult?.tests||[]).map(r=>({name:`Customer Ledger: ${r.name}`,pass:!!r.ok,detail:r.detail||""}));
      const safetyMapped=(Array.isArray(safetyResult)?safetyResult:[]).map(r=>({name:`Egg Safety: ${r.name}`,pass:!!r.pass,detail:r.detail||""}));
      const results=[...(first?.results||[]),...farmMapped,...smartMapped,...delightMapped,...actionMapped,...economicsMapped,...ledgerMapped,...safetyMapped];
      const failed=results.filter(x=>!x.pass);
      const report={...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+farm-manager+smart-insights+home-delight+farm-today+egg-cost+customer-ledger+egg-safety-v10`};
      try{localStorage.setItem("chickenEggStagingFullTestReportV10",JSON.stringify(report));}catch{}
      return report;
    },last:()=>{try{return JSON.parse(localStorage.getItem("chickenEggStagingFullTestReportV10")||"null")||base.last?.()||null;}catch{return base.last?.()||null;}},__farmManagerV4:true,__smartInsightsV5:true,__delightV6:true,__farmTodayV7:true,__eggCostV8:true,__customerLedgerV9:true,__eggSafetyV10:true};
    console.log("🧪 STAGING Full Test v10 active — Egg Treatment Safety regression added");
  }

  setTimeout(bootstrap,900);
})();
