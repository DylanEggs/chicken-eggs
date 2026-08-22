(() => {
  "use strict";
  if (window.__StagingBreedingPerformanceRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingBreedingPerformanceRegressionV1 = true;
  const tests=[];
  const add=(name,fn)=>tests.push({name,fn});
  const ok=(cond,msg)=>{if(!cond)throw new Error(msg||"Assertion failed");};
  const api=()=>window.StagingBreedingPerformanceV1;

  add("Breeding performance API loads",()=>ok(!!api(),"Breeding performance API missing"));
  add("Breeding performance is local-only",()=>{ok(api()?.networkCalls===0,"Unexpected network calls");ok(api()?.firebaseWrites===0,"Unexpected Firebase writes");});
  add("Breeding performance branding omits LLC",()=>ok(!document.documentElement.innerHTML.includes("Rose Family Poultry, LLC"),"LLC branding found"));
  add("Breeding summary calculates group productivity",()=>{
    const state={breeding:[{id:"g1",name:"Silkie Pen",rooster:"Roo",hens:"Hens",cross:"Silkie"},{id:"g2",name:"Comet Pen"}],hatches:[{id:"h1",eggsSet:10,fertile:8,hatched:7},{id:"h2",eggsSet:12,fertile:10,hatched:9},{id:"h3",eggsSet:8,fertile:8,hatched:8}]};
    const r=api().summarize(state,{h1:"g1",h2:"g1",h3:"g2"});
    const g1=r.groups.find(g=>g.id==="g1"),g2=r.groups.find(g=>g.id==="g2");
    ok(g1.hatches===2,"Expected two linked hatches for group 1");
    ok(g1.hatched===16,"Expected 16 chicks for group 1");
    ok(g1.hatchRate===88.9,`Unexpected hatch rate ${g1.hatchRate}`);
    ok(g2.hatchRate===100,"Expected 100% hatch rate for group 2");
    ok(r.productive?.id==="g1","Most productive group should be group 1");
    ok(r.bestRate?.id==="g2","Best hatch-rate group should be group 2");
  });
  add("Unlinked hatches do not affect breeding totals",()=>{
    const r=api().summarize({breeding:[{id:"g1",name:"A"}],hatches:[{id:"h1",eggsSet:20,fertile:20,hatched:20}]},{});
    ok(r.groups[0].hatches===0,"Unlinked hatch was counted");
    ok(r.groups[0].hatched===0,"Unlinked chicks were counted");
  });

  async function run(){const results=[];for(const t of tests){try{await t.fn();results.push({name:t.name,ok:true});}catch(error){results.push({name:t.name,ok:false,error:String(error?.message||error)});}}const failed=results.filter(x=>!x.ok);const out={suite:"staging-breeding-performance-v1",total:results.length,passed:results.length-failed.length,failed:failed.length,results};window.__StagingBreedingPerformanceRegressionResult=out;window.dispatchEvent(new CustomEvent("staging-regression-result",{detail:out}));return out;}
  window.StagingBreedingPerformanceRegressionV1={run,tests:()=>tests.map(x=>x.name)};
  window.addEventListener("staging-run-full-tests",()=>void run());
})();
