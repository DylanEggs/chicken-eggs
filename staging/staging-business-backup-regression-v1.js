(() => {
  "use strict";
  if (window.__StagingBusinessBackupRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingBusinessBackupRegressionV1 = true;

  const api = () => window.StagingBusinessBackupV1;
  const check = (name, pass, detail="") => ({name, pass:!!pass, detail:String(detail||"")});

  function run(){
    const a=api();
    const rows=[];
    rows.push(check("backup module loaded",!!a?.buildPayload));
    rows.push(check("backup makes zero Firebase reads",Number(a?.firebaseReads)===0,String(a?.firebaseReads)));
    rows.push(check("backup makes zero Firebase writes",Number(a?.firebaseWrites)===0,String(a?.firebaseWrites)));
    rows.push(check("branding omits LLC",a?.brand==="Rose Family Poultry",String(a?.brand||"")));
    if(!a?.buildPayload)return {checks:rows,total:rows.length,passed:rows.filter(x=>x.pass).length,failed:rows.filter(x=>!x.pass).length};

    const payload=a.buildPayload();
    rows.push(check("backup schema is staging-only",payload?.schema==="rose-family-poultry-staging-business-backup-v1"&&payload?.environment==="staging",`${payload?.schema||""} / ${payload?.environment||""}`));
    const valid=a.validatePayload(payload);
    rows.push(check("generated backup validates",!!valid?.ok,valid?.error||`${valid?.keys?.length||0} sections`));
    rows.push(check("backup size calculation works",Number(a.payloadBytes(payload))>0,String(a.payloadBytes(payload))));

    const bad=a.validatePayload({schema:"wrong",version:1,data:{rfpBusinessSuiteV1:{}}});
    rows.push(check("wrong backup schema is rejected",bad?.ok===false,bad?.error||""));

    const storeKeys=new Set((a.stores?.()||[]).map(x=>x.key));
    const expected=["rfpBusinessSuiteV1","rfpFarmManagerV1","rfpRecurringChoresV1","rfpBusinessIdentityV2","rfpFeedRunwayV1"];
    rows.push(check("all staging business stores are covered",expected.every(k=>storeKeys.has(k)),`${storeKeys.size} stores`));

    const total=rows.length,failed=rows.filter(x=>!x.pass).length;
    return {suite:"staging-business-backup-v1",checks:rows,total,passed:total-failed,failed};
  }

  function attach(){
    const base=window.StagingFullTest;
    if(!base?.run){setTimeout(attach,150);return;}
    if(base.__businessBackupV11)return;
    const oldRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){
      const first=await oldRun();
      const extra=run();
      const mapped=extra.checks.map(r=>({name:`Business Backup: ${r.name}`,pass:r.pass,detail:r.detail}));
      const results=[...(first?.results||[]),...mapped];
      const failed=results.filter(x=>!x.pass);
      const report={...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+business-backup-v11`};
      try{localStorage.setItem("chickenEggStagingFullTestReportV11",JSON.stringify(report));}catch{}
      return report;
    },last:()=>{try{return JSON.parse(localStorage.getItem("chickenEggStagingFullTestReportV11")||"null")||base.last?.()||null;}catch{return base.last?.()||null;}},__businessBackupV11:true};
    console.log("🧪 STAGING Full Test v11 active — Business Backup regression added");
  }

  window.StagingBusinessBackupRegressionV1={version:1,run};
  setTimeout(attach,1400);
})();
