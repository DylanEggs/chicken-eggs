(() => {
  "use strict";
  if (window.__StagingFarmChoresRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingFarmChoresRegressionV1 = true;

  const STORE="rfpRecurringChoresV1";
  const tests=[];
  const add=(name,fn)=>tests.push({name,fn});
  const ok=(cond,msg)=>{if(!cond)throw new Error(msg||"Assertion failed");};
  const api=()=>window.StagingFarmChoresV1;

  add("Recurring chore API loads",()=>ok(!!api(),"Chore API missing"));
  add("Recurring chores are local-only",()=>{ok(api()?.networkCalls===0,"Unexpected network calls");ok(api()?.firebaseWrites===0,"Unexpected Firebase writes");});
  add("Branding does not use LLC",()=>ok(!document.documentElement.innerHTML.includes("Rose Family Poultry, LLC"),"LLC branding found in staging DOM"));
  add("Cadence interval math is correct",()=>{ok(api().intervalDays("daily")===1,"Daily cadence wrong");ok(api().intervalDays("weekly")===7,"Weekly cadence wrong");ok(api().intervalDays("monthly")===30,"Monthly cadence wrong");});
  add("Completing a chore advances due date",()=>{
    const before=localStorage.getItem(STORE);
    try{
      localStorage.setItem(STORE,"[]");
      const x=api().addChore({title:"Regression chore",cadence:"weekly",nextDue:"2026-08-22"});
      const y=api().complete(x.id);
      ok(y?.nextDue==="2026-08-29",`Expected 2026-08-29, got ${y?.nextDue}`);
      ok(Number(y?.completedCount)===1,"Completion count did not increment");
    } finally {
      if(before==null)localStorage.removeItem(STORE);else localStorage.setItem(STORE,before);
    }
  });
  add("Chore summary counts due states",()=>{
    const before=localStorage.getItem(STORE);
    try{
      localStorage.setItem(STORE,JSON.stringify([
        {id:"a",title:"A",cadence:"weekly",nextDue:"2000-01-01"},
        {id:"b",title:"B",cadence:"weekly",nextDue:new Date().toISOString().slice(0,10)},
        {id:"c",title:"C",cadence:"weekly",nextDue:"2999-01-01"}
      ]));
      const s=api().summary();
      ok(s.overdue===1,"Overdue count wrong");ok(s.today===1,"Today count wrong");ok(s.upcoming===1,"Upcoming count wrong");
    } finally {
      if(before==null)localStorage.removeItem(STORE);else localStorage.setItem(STORE,before);
    }
  });

  async function run(){
    const results=[];
    for(const t of tests){try{await t.fn();results.push({name:t.name,ok:true});}catch(error){results.push({name:t.name,ok:false,error:String(error?.message||error)});}}
    const failed=results.filter(x=>!x.ok);
    const out={suite:"staging-farm-chores-v1",total:results.length,passed:results.length-failed.length,failed:failed.length,results};
    window.__StagingFarmChoresRegressionResult=out;
    window.dispatchEvent(new CustomEvent("staging-regression-result",{detail:out}));
    return out;
  }

  window.StagingFarmChoresRegressionV1={run,tests:()=>tests.map(x=>x.name)};
  window.addEventListener("staging-run-full-tests",()=>void run());
})();
