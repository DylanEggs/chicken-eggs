(() => {
  "use strict";
  if (window.__StagingGrowoutReadinessRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingGrowoutReadinessRegressionV1 = true;

  function run(){
    const api=window.StagingGrowoutReadinessV1,checks=[];
    const check=(name,pass,detail="")=>checks.push({name,pass:!!pass,detail});
    check("Grow-out readiness planner loads",!!api);
    if(!api)return checks;
    check("Grow-out planner uses zero Firebase reads",api.firebaseReads===0,String(api.firebaseReads));
    check("Grow-out planner uses zero Firebase writes",api.firebaseWrites===0,String(api.firebaseWrites));
    check("Grow-out planner uses Rose Family Poultry branding",api.brand==="Rose Family Poultry",String(api.brand));
    check("Grow-out planner does not use LLC branding",!/\bLLC\b/i.test(api.panelHtml([])),api.panelHtml([]).slice(0,160));
    check("Age calculation uses whole days",api.ageDays("2026-05-01","2026-08-21")===112,String(api.ageDays("2026-05-01","2026-08-21")));
    const ready=api.analyze({id:"a",name:"Pullets",breed:"Silkie",hatchDate:"2026-05-01",remainingQty:4,cost:40,earned:20},{targetAgeWeeks:16,weeklyFeedCostPerBird:1.5,targetPricePerBird:25},"2026-08-21");
    check("Target-age batch is sale ready",ready.status==="Ready to sell"&&ready.daysUntil===0,JSON.stringify(ready));
    check("Projected remaining revenue is calculated",Math.abs(ready.projectedRevenue-100)<0.001,String(ready.projectedRevenue));
    check("Ready batch has no future feed-to-target estimate",Math.abs(ready.futureFeed)<0.001,String(ready.futureFeed));
    check("Projected batch profit includes earned revenue and saved cost",Math.abs(ready.projectedBatchProfit-80)<0.001,String(ready.projectedBatchProfit));
    const growing=api.analyze({id:"b",name:"Young chicks",hatchDate:"2026-07-24",remainingQty:10,cost:30,earned:0},{targetAgeWeeks:12,weeklyFeedCostPerBird:1.4,targetPricePerBird:15},"2026-08-21");
    check("Young batch remains in growing status",growing.status==="Growing",JSON.stringify(growing));
    check("Days until target age are calculated",growing.daysUntil===56,String(growing.daysUntil));
    check("Future feed estimate is calculated",Math.abs(growing.futureFeed-112)<0.001,String(growing.futureFeed));
    check("Projected grow-out profit includes future feed",Math.abs(growing.projectedBatchProfit-8)<0.001,String(growing.projectedBatchProfit));
    const sum=api.summary([ready,growing]);
    check("Summary counts active birds",sum.birds===14,String(sum.birds));
    check("Summary counts ready birds",sum.readyBirds===4,String(sum.readyBirds));
    return checks;
  }

  window.StagingGrowoutReadinessRegressionV1={version:1,run};
  window.addEventListener("staging-run-full-tests",e=>{
    const checks=run();
    window.dispatchEvent(new CustomEvent("staging-regression-results",{detail:{suite:"Grow-Out Sale Readiness",checks,requestId:e.detail?.requestId||""}}));
  });
})();