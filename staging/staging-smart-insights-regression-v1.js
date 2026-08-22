(() => {
  "use strict";
  if (window.__StagingSmartInsightsRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingSmartInsightsRegressionV1 = true;

  const checks=[];
  const add=(name,pass,detail="")=>checks.push({name,pass:!!pass,detail:String(detail||"")});
  function run(){
    checks.length=0;
    const api=window.StagingSmartInsightsV1;
    add("Smart Insights module loaded",!!api);
    add("Smart Insights declares zero network calls",api?.networkCalls===0,api?.networkCalls);
    add("Smart Insights cannot write Firebase",api?.writesFirebase===false,String(api?.writesFirebase));
    add("Smart Insights branding omits LLC",!String(document.getElementById("rfpSmartInsightsCard")?.textContent||"").includes("LLC"));
    add("Smart Farm Snapshot renders",!!document.getElementById("rfpSmartInsightsCard"));
    if(api){
      const a7=api.average(7),a30=api.average(30),month=api.monthStats(),heat=api.heatmap();
      add("7-day production average is numeric",Number.isFinite(Number(a7)),a7);
      add("30-day production average is numeric",Number.isFinite(Number(a30)),a30);
      add("Month total is non-negative",Number(month?.total)>=0,month?.total);
      add("Heatmap contains exactly 35 days",Array.isArray(heat?.cells)&&heat.cells.length===35,heat?.cells?.length);
      const oldGoal=api.goal();
      api.setGoal(321);
      add("Monthly goal can be staged locally",api.goal()===321,api.goal());
      api.setGoal(oldGoal||0);
      const birthdays=api.upcomingBirthdays();
      add("Birthday helper returns a list",Array.isArray(birthdays),birthdays?.length);
      const customers=api.customerStats();
      add("Customer loyalty helper returns a list",Array.isArray(customers),customers?.length);
      add("Customer badges use allowed labels",customers.every(x=>["New","Regular","VIP"].includes(x.badge)),customers.map(x=>x.badge).join(","));
    }
    const result={suite:"staging-smart-insights-v1",passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,total:checks.length,checks:checks.slice(),at:Date.now()};
    window.__StagingSmartInsightsRegressionResult=result;
    window.dispatchEvent(new CustomEvent("staging-regression-result",{detail:result}));
    return result;
  }
  window.StagingSmartInsightsRegressionV1={run};
  setTimeout(run,1200);
})();
