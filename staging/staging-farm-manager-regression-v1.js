(() => {
  "use strict";
  if (window.__StagingFarmManagerRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingFarmManagerRegressionV1=true;
  const STORE="rfpFarmManagerV1";
  const api=()=>window.StagingFarmManagerV1;
  const check=(rows,name,ok,detail="")=>rows.push({name,ok:!!ok,detail:String(detail||"")});
  async function run(){
    const rows=[];
    const old=localStorage.getItem(STORE);
    try{
      const a=api();
      check(rows,"Farm manager module loaded",!!a);
      check(rows,"Farm manager is staging local-only",a?.environment==="staging-local-only");
      check(rows,"Farm manager declares zero Firebase reads",a?.firebaseReads===0);
      check(rows,"Farm manager declares zero Firebase writes",a?.firebaseWrites===0);
      check(rows,"Brand omits LLC",a?.brand==="Rose Family Poultry"&&!/LLC/i.test(a?.brand||""));
      localStorage.setItem(STORE,JSON.stringify({}));
      const h=a.addHatch({name:"QA Hatch",cross:"Silkie",setDate:"2026-08-01",expectedHatch:"2026-08-22",eggsSet:10,fertile:8,hatched:6});
      check(rows,"Hatch tracker saves hatch",a.read().hatches.length===1);
      check(rows,"Hatch percentage calculates",a.hatchRate(h)===75,String(a.hatchRate(h)));
      const b=a.moveHatchToBatch(h.id);
      check(rows,"Move hatch creates grow-out batch",!!b&&b.startingQty===6&&b.remainingQty===6);
      a.sellFromBatch(b.id,2,30);
      const sold=a.read().batches.find(x=>x.id===b.id);
      check(rows,"Grow-out sale decrements quantity",sold?.remainingQty===4&&sold?.sold===2&&sold?.earned===30,JSON.stringify(sold||{}));
      const supply=a.addSupply({name:"Feed",quantity:2,unit:"bags",lowAt:1,costEach:18});a.adjustSupply(supply.id,-1);
      const sp=a.read().supplies.find(x=>x.id===supply.id);
      check(rows,"Supply inventory adjusts safely",sp?.quantity===1);
      a.addWait({customer:"QA Customer",item:"Silkie pullets",quantity:4});
      check(rows,"Waitlist saves customer need",a.read().waitlist[0]?.quantity===4);
      a.addBreeding({name:"QA Group",rooster:"Arie",hens:"Hen group",cross:"Test Cross"});
      check(rows,"Breeding groups save",a.read().breeding.length===1);
      a.addHealth({bird:"QA Bird",symptom:"Test",treatment:"Observe"});
      check(rows,"Private health log saves",a.read().health.length===1);
      a.addCalendar({date:"2026-08-25",title:"QA Candling",kind:"Candling"});
      check(rows,"Farm calendar saves reminder",a.read().calendar.length===1);
      const st=a.updateSettings({businessName:"Rose Family Poultry, LLC",invoicePrefix:"TEST"});
      check(rows,"Business settings strip premature LLC wording",st.businessName==="Rose Family Poultry"&&!/LLC/i.test(st.businessName));
      check(rows,"No public customer collections referenced",!Object.keys(a).some(k=>/firebase|public_customer|public_flock/i.test(k)&&typeof a[k]==="function"));
    }catch(error){check(rows,"Regression completed without exception",false,error?.message||error);}
    finally{if(old===null)localStorage.removeItem(STORE);else localStorage.setItem(STORE,old);window.dispatchEvent(new CustomEvent("rfp-staging-farm-manager-changed"));}
    const passed=rows.filter(x=>x.ok).length;
    return {suite:"Staging Farm Manager V1",passed,total:rows.length,ok:passed===rows.length,rows};
  }
  window.StagingFarmManagerRegressionV1={version:1,run};
})();
