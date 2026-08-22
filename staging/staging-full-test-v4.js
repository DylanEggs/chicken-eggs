(() => {
  "use strict";
  if(window.__ChickenEggsStagingFullTestV4||!window.__ChickenEggsStagingMode)return;
  window.__ChickenEggsStagingFullTestV4=true;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function install(){
    const base=window.StagingFullTest;
    const farm=window.StagingFarmManagerRegressionV1;
    if(!base?.run||!farm?.run){setTimeout(install,100);return;}
    if(base.__farmManagerV4)return;
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){
      const first=await baseRun();
      const extra=await farm.run();
      const mapped=(extra?.rows||[]).map(r=>({name:`Farm Manager: ${r.name}`,pass:!!r.ok,detail:r.detail||""}));
      const results=[...(first?.results||[]),...mapped];
      const failed=results.filter(x=>!x.pass);
      const report={...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+farm-manager-v4`};
      try{localStorage.setItem("chickenEggStagingFullTestReportV4",JSON.stringify(report));}catch{}
      return report;
    },last:()=>{try{return JSON.parse(localStorage.getItem("chickenEggStagingFullTestReportV4")||"null")||base.last?.()||null;}catch{return base.last?.()||null;}},__farmManagerV4:true};
    console.log("🧪 STAGING Full Test v4 active — farm-management regression added");
  }
  setTimeout(install,1400);
})();
