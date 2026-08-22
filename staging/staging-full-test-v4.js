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
    install();
  }

  function install(){
    const base=window.StagingFullTest;
    const farm=window.StagingFarmManagerRegressionV1;
    const smart=window.StagingSmartInsightsRegressionV1;
    const delight=window.StagingDelightRegressionV1;
    if(!base?.run||!farm?.run||!smart?.run||!delight?.run){setTimeout(install,100);return;}
    if(base.__farmManagerV4)return;
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){
      const first=await baseRun();
      const farmResult=await farm.run();
      const smartResult=await smart.run();
      const delightResult=await delight.run();
      const farmMapped=(farmResult?.rows||[]).map(r=>({name:`Farm Manager: ${r.name}`,pass:!!r.ok,detail:r.detail||""}));
      const smartMapped=(smartResult?.checks||[]).map(r=>({name:`Smart Insights: ${r.name}`,pass:!!r.pass,detail:r.detail||""}));
      const delightMapped=(delightResult?.checks||[]).map(r=>({name:`Home Delight: ${r.name}`,pass:!!r.pass,detail:r.detail||""}));
      const results=[...(first?.results||[]),...farmMapped,...smartMapped,...delightMapped];
      const failed=results.filter(x=>!x.pass);
      const report={...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+farm-manager+smart-insights+home-delight-v6`};
      try{localStorage.setItem("chickenEggStagingFullTestReportV6",JSON.stringify(report));}catch{}
      return report;
    },last:()=>{try{return JSON.parse(localStorage.getItem("chickenEggStagingFullTestReportV6")||"null")||base.last?.()||null;}catch{return base.last?.()||null;}},__farmManagerV4:true,__smartInsightsV5:true,__delightV6:true};
    console.log("🧪 STAGING Full Test v6 active — farm management + Smart Insights + Home Delight regressions added");
  }

  setTimeout(bootstrap,900);
})();
