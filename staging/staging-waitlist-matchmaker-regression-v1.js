(() => {
  "use strict";
  if (window.__StagingWaitlistMatchmakerRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingWaitlistMatchmakerRegressionV1 = true;

  function run(){
    const api=window.StagingWaitlistMatchmakerV1,checks=[];
    const check=(name,pass,detail="")=>checks.push({name,pass:!!pass,detail});
    check("Waitlist matchmaker loads",!!api);
    if(!api)return checks;
    check("Waitlist matchmaker uses zero Firebase reads",api.firebaseReads===0,String(api.firebaseReads));
    check("Waitlist matchmaker uses zero Firebase writes",api.firebaseWrites===0,String(api.firebaseWrites));
    check("Egg requests are recognized",api.itemKind("2 dozen eggs")==="eggs",api.itemKind("2 dozen eggs"));
    const eggReady=api.evaluate({id:"e",customer:"A",item:"Eggs",quantity:12,status:"waiting"},{eggs:24,batchRows:[]});
    check("Egg waitlist entry becomes ready when inventory covers it",eggReady.match==="ready",JSON.stringify(eggReady));
    const eggWait=api.evaluate({id:"e2",customer:"B",item:"Eggs",quantity:18,status:"waiting"},{eggs:10,batchRows:[]});
    check("Egg waitlist entry stays waiting when inventory is short",eggWait.match==="waiting",JSON.stringify(eggWait));
    const birdReady=api.evaluate({id:"b",customer:"C",item:"Silkie pullets",quantity:3,status:"waiting"},{eggs:0,batchRows:[{id:"silk",name:"Silkie Grow-Out",breed:"Silkie",remainingQty:5}]});
    check("Breed-matched bird batch becomes ready",birdReady.match==="ready"&&birdReady.batchId==="silk",JSON.stringify(birdReady));
    const generic=api.evaluate({id:"g",customer:"D",item:"Pullets",quantity:2,status:"waiting"},{eggs:0,batchRows:[{id:"x",name:"Mixed Grow-Out",breed:"Mixed",remainingQty:6}]});
    check("Generic pullet request is marked verify-first instead of guessed ready",generic.match==="possible",JSON.stringify(generic));
    const done=api.evaluate({id:"d",item:"Eggs",quantity:12,status:"fulfilled"},{eggs:99,batchRows:[]});
    check("Fulfilled waitlist entries stay done",done.match==="done",JSON.stringify(done));
    const summary=api.summary([eggReady,eggWait,generic]);
    check("Waitlist summary counts match states",summary.ready===1&&summary.waiting===1&&summary.possible===1,JSON.stringify(summary));
    const contact=api.contactText({customer:"Sarah",quantity:4,item:"Silkie pullets",contact:"555-0100"});
    check("Contact helper uses Rose Family Poultry branding",contact.startsWith("Rose Family Poultry:"),contact);
    check("Waitlist helper does not use LLC branding",!/\bLLC\b/i.test(contact+api.panelHtml([])),contact);
    return checks;
  }

  window.StagingWaitlistMatchmakerRegressionV1={version:1,run};
  window.addEventListener("staging-run-full-tests",e=>{
    const checks=run();
    window.dispatchEvent(new CustomEvent("staging-regression-results",{detail:{suite:"Waitlist Matchmaker",checks,requestId:e.detail?.requestId||""}}));
  });
})();
