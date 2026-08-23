(() => {
  "use strict";
  if (window.__StagingEggPricingRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingEggPricingRegressionV1 = true;

  function run(){
    const api=window.StagingEggPricingV1;
    const checks=[];
    const add=(name,ok,detail="")=>checks.push({name,ok:!!ok,detail});
    add("Egg pricing API loaded",!!api);
    if(!api)return {name:"Egg Pricing",checks,passed:false};
    const c=api.calculate({eggsProduced:1200,directCosts:300,desiredMargin:25,dozenPrice:5,pack18Price:8,monthlyDozens:20});
    add("Cost per egg calculation",Math.abs(c.costPerEgg-.25)<.0001,`${c.costPerEgg}`);
    add("Break-even dozen calculation",Math.abs(c.breakEvenDozen-3)<.0001,`${c.breakEvenDozen}`);
    add("Break-even 18-pack calculation",Math.abs(c.breakEven18-4.5)<.0001,`${c.breakEven18}`);
    add("Margin recommendation calculation",Math.abs(c.recommendedDozen-4)<.0001,`${c.recommendedDozen}`);
    add("Profit per dozen calculation",Math.abs(c.profitPerDozen-2)<.0001,`${c.profitPerDozen}`);
    add("Projected monthly profit calculation",Math.abs(c.projectedMonthlyProfit-40)<.0001,`${c.projectedMonthlyProfit}`);
    add("Zero Firebase reads",api.firebaseReads===0,`${api.firebaseReads}`);
    add("Zero Firebase writes",api.firebaseWrites===0,`${api.firebaseWrites}`);
    const html=api.panelHtml(c,{desiredMargin:25,dozenPrice:5,pack18Price:8,monthlyDozens:20});
    add("Rose Family Poultry branding",html.includes("Rose Family Poultry"));
    add("No LLC branding",!html.includes("LLC"));
    return {name:"Egg Pricing",checks,passed:checks.every(x=>x.ok)};
  }
  window.StagingEggPricingRegressionV1={version:1,run};
  window.addEventListener("staging-run-full-test",()=>{
    const result=run();
    window.dispatchEvent(new CustomEvent("staging-regression-result",{detail:result}));
  });
})();