(() => {
  "use strict";
  if(window.__StagingBirdSalesInsightsRegressionV1||!window.__ChickenEggsStagingMode)return;
  window.__StagingBirdSalesInsightsRegressionV1=true;
  const check=(name,pass,detail="")=>({name,pass:!!pass,detail:String(detail||"")});
  function run(){
    const a=window.StagingBirdSalesInsightsV1, rows=[];
    rows.push(check("module loaded",!!a?.summarize));
    rows.push(check("zero Firebase reads",Number(a?.firebaseReads)===0,String(a?.firebaseReads)));
    rows.push(check("zero Firebase writes",Number(a?.firebaseWrites)===0,String(a?.firebaseWrites)));
    rows.push(check("branding omits LLC",a?.brand==="Rose Family Poultry",String(a?.brand||"")));
    if(a?.summarize){
      const s=a.summarize({birdListings:[{breed:"Silkie",quantity:4,price:20,public:true},{breed:"Draft",quantity:9,price:99,public:false},{breed:"Pullet",quantity:2,price:30,public:true}]},{growoutBatches:[{sold:3,revenue:75},{soldCount:2,earnings:60}]});
      rows.push(check("public inventory count",s.availableBirds===6,String(s.availableBirds)));
      rows.push(check("potential revenue",s.potentialRevenue===140,String(s.potentialRevenue)));
      rows.push(check("weighted asking price",Math.abs(s.weightedPrice-23.3333333333)<0.01,String(s.weightedPrice)));
      rows.push(check("sold bird count",s.sold===5,String(s.sold)));
      rows.push(check("realized bird revenue",s.realized===135,String(s.realized)));
      rows.push(check("average realized price",s.avgSoldPrice===27,String(s.avgSoldPrice)));
    }
    const total=rows.length,failed=rows.filter(x=>!x.pass).length;return {suite:"staging-bird-sales-insights-v1",checks:rows,total,passed:total-failed,failed};
  }
  function attach(){const base=window.StagingFullTest;if(!base?.run){setTimeout(attach,180);return;}if(base.__birdSalesInsightsV1)return;const oldRun=base.run.bind(base);window.StagingFullTest={...base,async run(){const first=await oldRun(),extra=run(),mapped=extra.checks.map(r=>({name:`Bird Sales Insights: ${r.name}`,pass:r.pass,detail:r.detail})),results=[...(first?.results||[]),...mapped],failed=results.filter(x=>!x.pass);return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results};},__birdSalesInsightsV1:true};}
  window.StagingBirdSalesInsightsRegressionV1={run};setTimeout(attach,1700);
})();