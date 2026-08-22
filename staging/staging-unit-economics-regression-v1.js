(() => {
  "use strict";
  if(window.__StagingUnitEconomicsRegressionV1||!window.__ChickenEggsStagingMode)return;
  window.__StagingUnitEconomicsRegressionV1=true;
  const BIZ="rfpBusinessSuiteV1",ENTRIES="chickenEggEntriesV102";
  const check=(rows,name,pass,detail="")=>rows.push({name,pass:!!pass,detail:String(detail||"")});
  async function run(){
    const rows=[],oldBiz=localStorage.getItem(BIZ),oldEntries=localStorage.getItem(ENTRIES);
    try{
      const api=window.StagingUnitEconomicsV1;
      check(rows,"Unit-economics module loaded",!!api);
      check(rows,"Unit-economics is staging local-only",api?.environment==="staging-local-only");
      check(rows,"Unit-economics declares zero Firebase reads",api?.firebaseReads===0);
      check(rows,"Unit-economics declares zero Firebase writes",api?.firebaseWrites===0);
      const y=String(new Date().getFullYear());
      localStorage.setItem(ENTRIES,JSON.stringify([
        {type:"eggs",date:`${y}-01-02`,eggs:120},
        {type:"sale",date:`${y}-01-03`,dozenSold:5,dozenPrice:5},
        {type:"sale",date:`${y}-01-04`,packs18:1,pricePer18:8}
      ]));
      localStorage.setItem(BIZ,JSON.stringify({expenses:[
        {date:`${y}-01-05`,category:"Feed",amount:18},
        {date:`${y}-01-06`,category:"Egg Cartons",amount:6},
        {date:`${y}-01-07`,category:"Equipment",amount:100}
      ]}));
      const d=api.metrics();
      check(rows,"YTD egg production totals",d.produced===120,String(d.produced));
      check(rows,"YTD eggs sold totals",d.soldEggs===78,String(d.soldEggs));
      check(rows,"Only direct egg costs are included",d.directCost===24,String(d.directCost));
      check(rows,"Equipment stays out of direct egg cost",!Object.keys(d.byCategory).some(x=>/equipment/i.test(x)));
      check(rows,"Break-even dozen cost calculates",Math.abs(d.costPerDozen-2.4)<0.001,String(d.costPerDozen));
      check(rows,"Egg sales revenue calculates",Math.abs(d.revenue-33)<0.001,String(d.revenue));
      check(rows,"Branding does not introduce LLC",!document.documentElement.textContent.includes("Rose Family Poultry, LLC"));
    }catch(error){check(rows,"Unit-economics regression completed without exception",false,error?.message||error);}
    finally{
      if(oldBiz===null)localStorage.removeItem(BIZ);else localStorage.setItem(BIZ,oldBiz);
      if(oldEntries===null)localStorage.removeItem(ENTRIES);else localStorage.setItem(ENTRIES,oldEntries);
      window.dispatchEvent(new CustomEvent("rfp-staging-business-changed"));
    }
    const passed=rows.filter(x=>x.pass).length;
    return {suite:"Staging Unit Economics V1",passed,total:rows.length,ok:passed===rows.length,checks:rows};
  }
  window.StagingUnitEconomicsRegressionV1={version:1,run};
})();
