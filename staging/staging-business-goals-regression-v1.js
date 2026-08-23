(() => {
  "use strict";
  if (window.__StagingBusinessGoalsRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingBusinessGoalsRegressionV1 = true;

  async function run(){
    const api=window.StagingBusinessGoalsV1;
    const results=[];
    const check=(name,pass,detail="")=>results.push({name,pass:!!pass,detail});
    check("Business goals module loaded",!!api);
    if(!api)return results;
    check("Business goals makes zero Firebase reads",api.firebaseReads===0,String(api.firebaseReads));
    check("Business goals makes zero Firebase writes",api.firebaseWrites===0,String(api.firebaseWrites));
    check("Business goals makes zero network calls",api.networkCalls===0,String(api.networkCalls));
    check("Progress math reaches 50%",api.pct(50,100)===50,String(api.pct(50,100)));
    check("Progress math caps runaway display",api.pct(1200,100)===999,String(api.pct(1200,100)));
    const s=api.settings();
    check("Default monthly revenue goal is positive",Number(s.monthlyRevenueGoal)>0,String(s.monthlyRevenueGoal));
    check("Default yearly profit goal is positive",Number(s.yearlyProfitGoal)>0,String(s.yearlyProfitGoal));
    const f=api.forecast();
    check("Forecast returns monthly revenue",Number.isFinite(Number(f.revenueMonth)),String(f.revenueMonth));
    check("Forecast returns projected revenue",Number.isFinite(Number(f.projectedRevenue)),String(f.projectedRevenue));
    check("No LLC branding in goals module",!document.documentElement.innerHTML.includes("Rose Family Poultry, LLC"));
    return results;
  }

  window.StagingBusinessGoalsRegressionV1={version:1,run};
  window.addEventListener("staging-run-extra-tests",async e=>{
    const results=await run();
    window.dispatchEvent(new CustomEvent("staging-extra-test-results",{detail:{suite:"business-goals-v1",results,requestId:e.detail?.requestId}}));
  });
})();
