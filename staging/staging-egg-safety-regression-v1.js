(() => {
  "use strict";
  if (window.__StagingEggSafetyRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingEggSafetyRegressionV1 = true;

  const api=()=>window.StagingEggSafetyV1;
  const check=(name,pass,detail="")=>({name,pass:!!pass,detail:String(detail||"")});
  function run(){
    const a=api(),out=[];
    out.push(check("Egg safety module loaded",!!a?.summarize));
    out.push(check("Egg safety makes zero Firebase reads",Number(a?.firebaseReads)===0,String(a?.firebaseReads)));
    out.push(check("Egg safety makes zero Firebase writes",Number(a?.firebaseWrites)===0,String(a?.firebaseWrites)));
    if(!a?.summarize)return out;

    const state={health:[
      {id:"h1",bird:"Hen A",date:"2026-08-20",endDate:"2026-08-25",symptom:"test",treatment:"test",product:"test"},
      {id:"h2",bird:"Hen B",date:"2026-08-21",endDate:"",symptom:"test",treatment:"test",product:"test"},
      {id:"h3",bird:"Hen C",date:"2026-08-10",endDate:"2026-08-20",symptom:"test",treatment:"test",product:"test"},
      {id:"h4",bird:"Hen D",date:"2026-07-01",endDate:"2026-07-03",symptom:"old",treatment:"old",product:"old"}
    ]};
    const s=a.summarize(state,"2026-08-22");
    out.push(check("Active withdrawal records are flagged",s.active.length===1,`active=${s.active.length}`));
    out.push(check("Missing withdrawal/end dates are flagged",s.missing.length===1,`missing=${s.missing.length}`));
    out.push(check("Recently ended records are retained for review",s.recentlyEnded.length===1,`recent=${s.recentlyEnded.length}`));
    out.push(check("Old ended records drop from the review window",!s.recentlyEnded.some(x=>x.id==="h4")));
    out.push(check("Days remaining calculation is correct",s.active[0]?.daysRemaining===3,`remaining=${s.active[0]?.daysRemaining}`));
    out.push(check("Safety review count combines active + missing",s.needsReview===2,`needsReview=${s.needsReview}`));
    const html=a.panelHtml(s);
    out.push(check("Safety panel uses Rose Family Poultry branding",html.includes("Rose Family Poultry")));
    out.push(check("Safety panel does not claim LLC branding",!html.includes("Rose Family Poultry, LLC")));
    out.push(check("Safety panel warns it does not calculate drug withdrawal times",/does not calculate medication withdrawal times/i.test(html)));
    return out;
  }
  window.StagingEggSafetyRegressionV1={version:1,run};

  // Attach to the full staging test chain without replacing prior suites.
  const previous=window.StagingFullTestV4?.extraSuites;
  if(window.StagingFullTestV4){
    const list=Array.isArray(previous)?previous:[];
    if(!list.includes(run))window.StagingFullTestV4.extraSuites=[...list,run];
  }
})();
