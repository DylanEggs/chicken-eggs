(() => {
  "use strict";
  if(window.__StagingBusinessRegressionV1||!window.__ChickenEggsStagingMode)return;
  window.__StagingBusinessRegressionV1=true;
  const STORE="rfpBusinessSuiteV1";
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  function check(results,name,pass,detail=""){results.push({name,pass:!!pass,detail:String(detail||"")});if(!pass)console.warn("STAGING BUSINESS FAIL:",name,detail);}
  async function tests(){
    const results=[],before=localStorage.getItem(STORE);
    try{
      const api=window.StagingBusinessSuiteV1;
      check(results,"Business suite loads in staging",!!api?.open&&!!api?.ytd);
      check(results,"Business suite declares zero Firebase writes",Number(api?.firebaseWrites)===0,String(api?.firebaseWrites));
      check(results,"Business suite declares zero network calls",Number(api?.networkCalls)===0,String(api?.networkCalls));
      check(results,"Business branding omits LLC until formation",String(window.StagingMidnightPolishV1?.brand||"")==="Rose Family Poultry",String(window.StagingMidnightPolishV1?.brand||""));
      const source=document.documentElement.innerText||"";
      check(results,"Visible staging business UI contains no LLC branding",!source.includes("Rose Family Poultry, LLC"));
      const y=api?.ytd?.()||{};
      check(results,"YTD dashboard returns numeric income/expense/net fields",[y.eggSales,y.chickenSales,y.income,y.expenses,y.net,y.miles].every(Number.isFinite),JSON.stringify(y));
      api?.open?.();await sleep(40);
      check(results,"Business Tools modal opens",document.getElementById("rfpBusinessModal")?.hidden===false);
      api?.show?.("expenses");await sleep(20);
      check(results,"Receipt & Expense Vault renders",/Receipt & Expense Vault/.test(document.getElementById("rfpBizBody")?.textContent||""));
      api?.show?.("mileage");await sleep(20);
      check(results,"Mileage Tracker renders",/Business Mileage Tracker/.test(document.getElementById("rfpBizBody")?.textContent||""));
      api?.show?.("report");await sleep(20);
      check(results,"Tax Accountant report renders",/Business Summary/.test(document.getElementById("rfpBizBody")?.textContent||""));
      api?.show?.("receipts");await sleep(20);
      check(results,"Receipt generator renders without LLC wording",/Invoice \/ Receipt Generator/.test(document.getElementById("rfpBizBody")?.textContent||"")&&!/LLC/.test(document.getElementById("rfpBizBody")?.textContent||""));
      api?.show?.("calculator");await sleep(20);
      check(results,"Worth Selling calculator renders",/Is This Worth Selling/.test(document.getElementById("rfpBizBody")?.textContent||""));
      api?.close?.();
    }catch(error){check(results,"Business regression completed without exception",false,String(error?.stack||error));}
    finally{try{if(before===null)localStorage.removeItem(STORE);else localStorage.setItem(STORE,before);}catch{}try{window.StagingBusinessSuiteV1?.close?.();}catch{}}
    return results;
  }
  function install(){
    const base=window.StagingFullTest;
    if(!base?.run||base.__businessV1){setTimeout(install,120);return;}
    const run=base.run.bind(base);
    window.StagingFullTest={...base,async run(){const first=await run();const extra=await tests();const results=[...(first?.results||[]),...extra],failed=results.filter(x=>!x.pass);const report={...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+business-v1`};try{localStorage.setItem("chickenEggStagingBusinessRegressionV1",JSON.stringify(report));}catch{}return report;},last:()=>read("chickenEggStagingBusinessRegressionV1",null)||base.last?.()||null,__businessV1:true};
    console.log("🧪 STAGING business regression v1 active");
  }
  setTimeout(install,1450);
})();