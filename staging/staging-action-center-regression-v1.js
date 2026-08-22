(() => {
  "use strict";
  if(window.__StagingActionCenterRegressionV1||!window.__ChickenEggsStagingMode)return;
  window.__StagingActionCenterRegressionV1=true;
  const FM="rfpFarmManagerV1",APP2="chickenEggApp2V1";
  const get=k=>localStorage.getItem(k),set=(k,v)=>v==null?localStorage.removeItem(k):localStorage.setItem(k,v);
  const date=(days=0)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  function run(){
    const api=window.StagingActionCenterV1,oldFm=get(FM),oldApp=get(APP2),checks=[];
    const check=(name,pass,detail="")=>checks.push({name,pass:!!pass,detail});
    try{
      check("action center module loaded",!!api?.buildTasks);
      check("declares zero network calls",api?.networkCalls===0);
      check("declares zero Firebase writes",api?.firebaseWrites===0);
      localStorage.setItem(FM,JSON.stringify({
        hatches:[{id:"h1",name:"Silkie Test",setDate:date(-7),expectedHatch:date(14),eggsSet:8,fertile:6,hatched:0}],
        supplies:[{id:"s1",name:"Feed",quantity:1,lowAt:1,unit:"bag"}],
        waitlist:[{id:"w1",customer:"Test Customer",item:"Silkie pullets",quantity:2,status:"waiting",date:date(0)}],
        health:[{id:"x1",bird:"Test Hen",endDate:date(2),product:"Test product"}],
        calendar:[{id:"c1",date:date(1),title:"Clean incubator",notes:"Test",done:false}],
        breeding:[],batches:[],settings:{businessName:"Rose Family Poultry"}
      }));
      localStorage.setItem(APP2,JSON.stringify({flock:[{id:"b1",name:"Birthday Bird",breed:"Silkie",hatchDate:`2025-${date(3).slice(5)}` }]}));
      const tasks=api.buildTasks();
      check("low-stock warning generated",tasks.some(x=>/Low stock: Feed/.test(x.title)));
      check("waitlist action generated",tasks.some(x=>/Waitlist: Test Customer/.test(x.title)));
      check("health end-date reminder generated",tasks.some(x=>/Treatment\/withdrawal ends: Test Hen/.test(x.title)));
      check("calendar reminder generated",tasks.some(x=>x.title==="Clean incubator"));
      check("birthday reminder generated",tasks.some(x=>/Birthday Bird's birthday/.test(x.title)));
      check("hatch workflow reminder generated",tasks.some(x=>/Silkie Test/.test(x.title)&&(/Candle|Lockdown|Expected hatch/.test(x.title))));
      api.render();
      const box=document.getElementById("rfpActionCenter");
      check("Farm Today card renders",!!box&&/Farm Today/.test(box.textContent||""));
      check("branding omits LLC",!!box&&!/\bLLC\b/i.test(box.textContent||""));
    }catch(error){check("regression execution",false,String(error?.message||error));}
    finally{set(FM,oldFm);set(APP2,oldApp);try{api?.render?.();}catch{}}
    return {suite:"staging-action-center-v1",total:checks.length,passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,checks};
  }
  window.StagingActionCenterRegressionV1={version:1,run};
})();
