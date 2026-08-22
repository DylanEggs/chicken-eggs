(() => {
  "use strict";
  if(window.__StagingDelightRegressionV1||!window.__ChickenEggsStagingMode)return;
  window.__StagingDelightRegressionV1=true;
  function run(){
    const api=window.StagingDelightV1,checks=[];
    const add=(name,pass,detail="")=>checks.push({name,pass:!!pass,detail:String(detail||"")});
    add("Delight module loaded",!!api);
    add("Delight declares zero network calls",api?.networkCalls===0,api?.networkCalls);
    add("Delight cannot write Firebase",api?.writesFirebase===false,String(api?.writesFirebase));
    api?.render?.();
    const card=document.getElementById("rfpDelightCard");
    add("Home momentum card renders",!!card);
    add("Branding omits LLC",!String(card?.textContent||"").includes("LLC"));
    add("Today egg count is numeric",Number.isFinite(Number(api?.eggsOn?.())),api?.eggsOn?.());
    add("Laying streak is non-negative",Number(api?.streak?.())>=0,api?.streak?.());
    const d=Number(api?.nextDozen?.());add("Next dozen helper stays 1-12",d>=1&&d<=12,d);
    add("Carton progress renders 12 egg slots",card?.querySelectorAll?.(".rfp-carton i").length===12,card?.querySelectorAll?.(".rfp-carton i").length);
    const wi=api?.weatherInsight?.();add("Weather insight returns object or null",wi===null||typeof wi==="object",typeof wi);
    const result={suite:"staging-delight-v1",passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,total:checks.length,checks,at:Date.now()};
    window.__StagingDelightRegressionResult=result;window.dispatchEvent(new CustomEvent("staging-regression-result",{detail:result}));return result;
  }
  window.StagingDelightRegressionV1={run};setTimeout(run,1500);
})();
