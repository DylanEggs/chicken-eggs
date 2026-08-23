(() => {
  "use strict";
  if (window.__StagingCashFlowRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingCashFlowRegressionV1 = true;
  function run(){
    const api=window.StagingCashFlowV1,checks=[];
    const add=(name,ok,detail="")=>checks.push({name,ok:!!ok,detail});
    add("Cash flow API loaded",!!api);
    if(!api)return {name:"Monthly Cash Flow",checks,passed:false};
    const rows=[
      {month:"2026-01",eggSales:100,chickenSales:50,income:150,expenses:90,net:60},
      {month:"2026-02",eggSales:80,chickenSales:0,income:80,expenses:100,net:-20},
      {month:"2026-03",eggSales:120,chickenSales:30,income:150,expenses:50,net:100}
    ];
    const s=api.summarize(rows);
    add("YTD income total",Math.abs(s.income-380)<.001,`${s.income}`);
    add("YTD expense total",Math.abs(s.expenses-240)<.001,`${s.expenses}`);
    add("YTD net total",Math.abs(s.net-140)<.001,`${s.net}`);
    add("Best month identified",s.best?.month==="2026-03",s.best?.month||"");
    add("Worst month identified",s.worst?.month==="2026-02",s.worst?.month||"");
    add("Profitable month count",s.profitable===2,`${s.profitable}`);
    add("Egg sale amount supports totals",api.eggSaleAmount({type:"sale",total:42})===42);
    add("Bird sale amount avoids double-multiplying total",api.birdSaleAmount({total:60,quantity:3})===60);
    add("Bird unit price multiplies quantity",api.birdSaleAmount({price:20,quantity:3})===60);
    add("Zero Firebase reads",api.firebaseReads===0,`${api.firebaseReads}`);
    add("Zero Firebase writes",api.firebaseWrites===0,`${api.firebaseWrites}`);
    const html=api.panelHtml(rows);
    add("Rose Family Poultry branding",html.includes("Rose Family Poultry"));
    add("No LLC branding",!html.includes("LLC"));
    return {name:"Monthly Cash Flow",checks,passed:checks.every(x=>x.ok)};
  }
  window.StagingCashFlowRegressionV1={version:1,run};
  window.addEventListener("staging-run-full-test",()=>window.dispatchEvent(new CustomEvent("staging-regression-result",{detail:run()})));
})();