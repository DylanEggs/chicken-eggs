(() => {
  "use strict";
  if (window.__StagingSimpleBusinessRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingSimpleBusinessRegressionV1 = true;

  const taxScript = document.createElement("script");
  const taxUrl = new URL("staging-tax-expense-report-v1.js", document.currentScript?.src || location.href);
  taxUrl.searchParams.set("stage", String(window.__ChickenEggsStagingBuild || Date.now()));
  taxUrl.searchParams.set("app", String(window.__ChickenEggsBuild || Date.now()));
  taxScript.src = taxUrl.href;
  taxScript.async = false;
  document.head.appendChild(taxScript);

  const check=(name,pass,detail="")=>({name,pass:!!pass,detail:String(detail||"")});
  const DATA_KEYS=["chickenEggEntriesV102","chickenEggSettingsV102","chickenEggApp2V1","chickenEggInventoryV2","chickenEggBusinessV1"];
  const snapshot=()=>Object.fromEntries(DATA_KEYS.map(k=>[k,localStorage.getItem(k)]));
  const unchanged=(a,b)=>DATA_KEYS.every(k=>a[k]===b[k]);

  function run(){
    const api=window.StagingSimpleBusinessV1;
    const tax=window.StagingTaxExpenseReportV1;
    const rows=[];
    rows.push(check("simple business module loaded",!!api?.calculate));
    rows.push(check("expenses use same App2 source as Home",api?.sources?.expenses==="chickenEggApp2V1",String(api?.sources?.expenses||"")));
    rows.push(check("chicken sales use live business source",api?.sources?.chickenSales==="chickenEggBusinessV1",String(api?.sources?.chickenSales||"")));

    const month=new Date().toISOString().slice(0,7);
    const fixture={
      entries:[{type:"sale",date:`${month}-10`,dozenSold:10,dozenPrice:5,packSold:0,packPrice:0}],
      app2:{expenses:[{date:`${month}-05`,category:"Feed",amount:80},{date:`${month}-11`,category:"Equipment",amount:40}]},
      business:{chickenSales:[{date:`${month}-12`,total:20}]}
    };
    const calc=api?.calculate?.(fixture,month)||{};
    rows.push(check("fixture egg sales total correctly",Number(calc.eggSales)===50,String(calc.eggSales)));
    rows.push(check("fixture chicken sales total correctly",Number(calc.chickenSales)===20,String(calc.chickenSales)));
    rows.push(check("fixture tracked expenses are included",Number(calc.expenses)===120,String(calc.expenses)));
    rows.push(check("loss is shown when expenses exceed sales",Number(calc.net)===-50,String(calc.net)));

    const launcher=document.getElementById("rfpSimpleBusinessLauncher");
    const modal=document.getElementById("rfpSimpleBusinessModal");
    rows.push(check("simple Receipts & Expenses launcher exists",!!launcher));
    rows.push(check("old Business Tools launcher is retired from visible UI",!!document.getElementById("rfpBusinessLauncher")?.hidden));
    rows.push(check("simple Business has only two visible work areas",modal?.querySelectorAll?.("[data-simple-tab]")?.length===2,String(modal?.querySelectorAll?.("[data-simple-tab]")?.length||0)));
    rows.push(check("no calculator button in simplified Business",!Array.from(modal?.querySelectorAll?.("button")||[]).some(b=>/calculator|worth selling|cash flow|goals|forecast|pricing/i.test(b.textContent||""))));
    rows.push(check("zero Firebase/network calls",Number(api?.firebaseReads)===0&&Number(api?.firebaseWrites)===0&&Number(api?.networkCalls)===0));

    rows.push(check("tax expense report module loaded",!!tax?.buildReport));
    const before=snapshot();
    const taxFixture=[
      {date:"2026-01-01",vendor:"Feed Store",category:"Feed",amount:25.50,notes:"Starter feed"},
      {date:"2026-02-15",vendor:"Farm Supply",category:"Equipment",amount:74.50,notes:"Feeder"},
      {date:"2026-03-01",vendor:"Outside Range",category:"Other",amount:9}
    ];
    const report=tax?.buildReport?.("2026-01-01","2026-02-15",taxFixture)||{};
    rows.push(check("tax report filters inclusive date range",Number(report.count)===2,String(report.count)));
    rows.push(check("tax report totals selected expenses",Number(report.total)===100,String(report.total)));
    const csv=tax?.reportCsv?.(report)||"";
    rows.push(check("tax report creates accountant-friendly CSV",csv.includes("Vendor / Store")&&csv.includes("Feed Store")&&csv.includes("100.00")));
    rows.push(check("tax report does not change farm data",unchanged(before,snapshot())));
    rows.push(check("tax report adds zero Firebase/network calls",Number(tax?.firebaseReads)===0&&Number(tax?.firebaseWrites)===0&&Number(tax?.networkCalls)===0));

    const failed=rows.filter(x=>!x.pass);
    return {suite:"staging-business-simple-v1",checks:rows,total:rows.length,passed:rows.length-failed.length,failed:failed.length};
  }

  let tries=0;
  function attach(){
    const base=window.StagingFullTest;
    if(!base?.run||!window.StagingTaxExpenseReportV1){if(tries++<40)setTimeout(attach,180);return;}
    if(base.__simpleBusinessV1)return;
    const oldRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){
      const first=await oldRun();
      const extra=run();
      const mapped=extra.checks.map(r=>({name:`Simple Business: ${r.name}`,pass:r.pass,detail:r.detail}));
      const results=[...(first?.results||[]),...mapped];
      const failed=results.filter(x=>!x.pass);
      return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+simple-business-v1`};
    },__simpleBusinessV1:true};
  }

  window.StagingSimpleBusinessRegressionV1={version:2,run};
  setTimeout(attach,2200);
})();