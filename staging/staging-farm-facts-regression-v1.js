(() => {
  "use strict";
  if (window.__StagingFarmFactsRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingFarmFactsRegressionV1 = true;

  const check=(name,pass,detail="")=>({name,pass:!!pass,detail:String(detail||"")});
  function run(){
    const a=window.StagingFarmFactsV1;
    const rows=[];
    rows.push(check("module loaded",!!a?.render));
    rows.push(check("uses Rose Family Poultry branding",a?.brand==="Rose Family Poultry",String(a?.brand||"")));
    rows.push(check("contains a useful fact rotation",Array.isArray(a?.facts)&&a.facts.length>=10,`${a?.facts?.length||0} facts`));
    rows.push(check("morning greeting works",a?.greeting?.(new Date("2026-08-23T08:00:00"))==="Good morning"));
    rows.push(check("afternoon greeting works",a?.greeting?.(new Date("2026-08-23T14:00:00"))==="Good afternoon"));
    rows.push(check("evening greeting works",a?.greeting?.(new Date("2026-08-23T20:00:00"))==="Good evening"));
    rows.push(check("zero Firebase reads",Number(a?.firebaseReads)===0,String(a?.firebaseReads)));
    rows.push(check("zero Firebase writes",Number(a?.firebaseWrites)===0,String(a?.firebaseWrites)));
    rows.push(check("zero network calls",Number(a?.networkCalls)===0,String(a?.networkCalls)));
    rows.push(check("no LLC branding",!String(a?.brand||"").includes("LLC"),String(a?.brand||"")));
    const failed=rows.filter(x=>!x.pass);
    return {suite:"staging-farm-facts-v1",checks:rows,total:rows.length,passed:rows.length-failed.length,failed:failed.length};
  }

  function attach(){
    const base=window.StagingFullTest;
    if(!base?.run){setTimeout(attach,180);return;}
    if(base.__farmFactsV1)return;
    const oldRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){
      const first=await oldRun();
      const extra=run();
      const mapped=extra.checks.map(r=>({name:`Farm Facts: ${r.name}`,pass:r.pass,detail:r.detail}));
      const results=[...(first?.results||[]),...mapped];
      const failed=results.filter(x=>!x.pass);
      return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+farm-facts-v1`};
    },__farmFactsV1:true};
  }

  window.StagingFarmFactsRegressionV1={version:1,run};
  setTimeout(attach,1800);
})();