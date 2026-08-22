(() => {
  "use strict";
  if (window.__StagingHatchPlannerRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingHatchPlannerRegressionV1 = true;

  const tests=[];
  const add=(name,fn)=>tests.push({name,fn});
  const ok=(cond,msg)=>{if(!cond)throw new Error(msg||"Assertion failed");};
  const api=()=>window.StagingHatchPlannerV1;

  add("Hatch planner API loads",()=>ok(!!api(),"Hatch planner API missing"));
  add("Hatch planner is local-only",()=>{ok(api()?.networkCalls===0,"Unexpected network calls");ok(api()?.firebaseWrites===0,"Unexpected Firebase writes");});
  add("Branding does not use LLC",()=>ok(!document.documentElement.innerHTML.includes("Rose Family Poultry, LLC"),"LLC branding found in staging DOM"));
  add("Chicken schedule math uses 21-day default",()=>{
    const p=api().calculate({setDate:"2026-08-22"});
    ok(p.candle1==="2026-08-29",`First candle wrong: ${p.candle1}`);
    ok(p.candle2==="2026-09-05",`Second candle wrong: ${p.candle2}`);
    ok(p.lockdown==="2026-09-09",`Lockdown wrong: ${p.lockdown}`);
    ok(p.expectedHatch==="2026-09-12",`Hatch date wrong: ${p.expectedHatch}`);
  });
  add("Planner creates one hatch and four calendar reminders",()=>{
    const r=api().applyToState({hatches:[],calendar:[]},{planId:"regression-plan",name:"Regression Hatch",cross:"Silkie",setDate:"2026-08-22",eggsSet:12});
    ok(r.state.hatches.length===1,"Expected one hatch record");
    ok(r.state.calendar.length===4,`Expected four calendar reminders, got ${r.state.calendar.length}`);
    ok(r.state.hatches[0].eggsSet===12,"Egg count not preserved");
    ok(r.state.calendar.some(x=>x.sourcePlanEvent==="lockdown"&&x.date==="2026-09-09"),"Lockdown reminder missing");
  });
  add("Planner does not duplicate same plan",()=>{
    const first=api().applyToState({hatches:[],calendar:[]},{planId:"same-plan",name:"A",setDate:"2026-08-22"});
    const second=api().applyToState(first.state,{planId:"same-plan",name:"A",setDate:"2026-08-22"});
    ok(second.state.hatches.length===1,"Duplicate hatch created");
    ok(second.state.calendar.length===4,"Duplicate calendar reminders created");
  });

  async function run(){
    const results=[];
    for(const t of tests){try{await t.fn();results.push({name:t.name,ok:true});}catch(error){results.push({name:t.name,ok:false,error:String(error?.message||error)});}}
    const failed=results.filter(x=>!x.ok);
    const out={suite:"staging-hatch-planner-v1",total:results.length,passed:results.length-failed.length,failed:failed.length,results};
    window.__StagingHatchPlannerRegressionResult=out;
    window.dispatchEvent(new CustomEvent("staging-regression-result",{detail:out}));
    return out;
  }

  window.StagingHatchPlannerRegressionV1={run,tests:()=>tests.map(x=>x.name)};
  window.addEventListener("staging-run-full-tests",()=>void run());
})();
