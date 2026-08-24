(() => {
  "use strict";
  if (window.__StagingSimpleBusinessRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingSimpleBusinessRegressionV1 = true;

  const check=(name,pass,detail="")=>({name,pass:!!pass,detail:String(detail||"")});

  function run(){
    const api=window.StagingSimpleBusinessV1;
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

    const failed=rows.filter(x=>!x.pass);
    return {suite:"staging-business-simple-v1",checks:rows,total:rows.length,passed:rows.length-failed.length,failed:failed.length};
  }

  let tries=0;
  function attach(){
    const base=window.StagingFullTest;
    if(!base?.run){if(tries++<30)setTimeout(attach,180);return;}
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

  window.StagingSimpleBusinessRegressionV1={version:1,run};
  setTimeout(attach,2200);
})();
