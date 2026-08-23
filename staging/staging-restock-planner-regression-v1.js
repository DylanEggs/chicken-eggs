(() => {
  "use strict";
  if (window.__StagingRestockPlannerRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingRestockPlannerRegressionV1 = true;

  function run(){
    const api=window.StagingRestockPlannerV1,checks=[];
    const check=(name,pass,detail="")=>checks.push({name,pass:!!pass,detail});
    check("Restock planner loads",!!api);
    if(!api)return checks;
    check("Restock planner uses zero Firebase reads",api.firebaseReads===0,String(api.firebaseReads));
    check("Restock planner uses zero Firebase writes",api.firebaseWrites===0,String(api.firebaseWrites));
    const row=api.recommendation({id:"feed",name:"Layer Feed",category:"Feed",quantity:1,unit:"bags",lowAt:2,costEach:18});
    check("Low-stock item is detected",row.low===true,JSON.stringify(row));
    check("Restock target is twice low threshold",row.target===4,JSON.stringify(row));
    check("Suggested quantity restores target",row.buy===3,JSON.stringify(row));
    check("Estimated restock cost is calculated",Math.abs(row.estimatedCost-54)<0.001,String(row.estimatedCost));
    const rows=api.list([
      {id:"a",name:"Feed",quantity:0,unit:"bags",lowAt:1,costEach:20},
      {id:"b",name:"Cartons",quantity:8,unit:"cartons",lowAt:5,costEach:.5},
      {id:"c",name:"Bedding",quantity:1,unit:"bales",lowAt:2,costEach:9}
    ]);
    check("Only low-stock supplies appear",rows.length===2,String(rows.length));
    check("Out-of-stock item sorts first",rows[0]?.name==="Feed",rows.map(x=>x.name).join(","));
    const summary=api.summary(rows);
    check("Restock summary counts out-of-stock items",summary.out===1,JSON.stringify(summary));
    check("Shopping list uses Rose Family Poultry branding",api.text(rows).startsWith("Rose Family Poultry shopping list"),api.text(rows).slice(0,80));
    check("Shopping list does not use LLC branding",!/\bLLC\b/i.test(api.text(rows)),api.text(rows).slice(0,120));
    return checks;
  }

  window.StagingRestockPlannerRegressionV1={version:1,run};
  window.addEventListener("staging-run-full-tests",e=>{
    const checks=run();
    window.dispatchEvent(new CustomEvent("staging-regression-results",{detail:{suite:"Smart Restock Planner",checks,requestId:e.detail?.requestId||""}}));
  });
})();