(() => {
  "use strict";
  if (window.__StagingFeedRunwayRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingFeedRunwayRegressionV1 = true;
  const check=(name,pass,detail="")=>({name,pass:!!pass,detail:String(detail||"")});
  function run(){
    const a=window.StagingFeedRunwayV1,out=[];
    out.push(check("Feed runway module loaded",!!a?.calculate));
    out.push(check("Feed runway makes zero Firebase reads",Number(a?.firebaseReads)===0,String(a?.firebaseReads)));
    out.push(check("Feed runway makes zero Firebase writes",Number(a?.firebaseWrites)===0,String(a?.firebaseWrites)));
    if(!a?.calculate)return out;
    const sample=a.calculate({feed:[
      {name:"Layer feed",category:"Feed",quantity:2,unit:"bags",costEach:18.5},
      {name:"Scratch",category:"Feed",quantity:25,unit:"lb",costEach:.4}
    ],defaultBagWeight:50,dailyFeedLbs:10,avgEggsPerDay:20});
    out.push(check("Feed pounds combine bag and pound inventory",Math.abs(sample.pounds-125)<.001,`pounds=${sample.pounds}`));
    out.push(check("Feed runway days calculate correctly",Math.abs(sample.days-12.5)<.001,`days=${sample.days}`));
    out.push(check("Feed inventory cost totals correctly",Math.abs(sample.inventoryCost-47)<.001,`cost=${sample.inventoryCost}`));
    out.push(check("Reorder warning stays off above seven days",sample.reorder===false));
    const low=a.calculate({feed:[{name:"Feed",category:"Feed",quantity:1,unit:"bag",costEach:20}],defaultBagWeight:50,dailyFeedLbs:8,avgEggsPerDay:12});
    out.push(check("Reorder warning turns on at seven days or less",low.reorder===true,`days=${low.days}`));
    out.push(check("Feed cost per dozen is calculated",low.feedCostPerDozen>0,`cost/dozen=${low.feedCostPerDozen}`));
    const html=a.panelHtml(low,{defaultBagWeight:50,dailyFeedLbs:8});
    out.push(check("Feed planner uses Rose Family Poultry branding",html.includes("Rose Family Poultry")));
    out.push(check("Feed planner does not use LLC branding",!html.includes("Rose Family Poultry, LLC")));
    out.push(check("Feed planner labels cost-per-dozen as feed-only",/feed cost only/i.test(html)));
    return out;
  }
  window.StagingFeedRunwayRegressionV1={version:1,run};
  if(window.StagingFullTestV4){const list=Array.isArray(window.StagingFullTestV4.extraSuites)?window.StagingFullTestV4.extraSuites:[];if(!list.includes(run))window.StagingFullTestV4.extraSuites=[...list,run];}
})();
