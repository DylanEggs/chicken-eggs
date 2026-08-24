(() => {
  "use strict";
  if(window.__CustomerForecastScoreRegressionV1)return;window.__CustomerForecastScoreRegressionV1=true;
  function run(){
    const api=window.CustomerForecastScoreV1,checks=[];
    const ok=(name,pass)=>checks.push({name,pass:!!pass});
    ok("forecast score module loaded",!!api);
    if(!api)return checks;
    const summary=api.summarize([{error:1},{error:2},{error:5},{error:0}]);
    ok("forecast score mean absolute error",Math.abs(summary.mae-2)<.0001);
    ok("forecast score within-two rate",Math.abs(summary.within2-75)<.0001);
    ok("forecast score egg map combines same-day collections",api.eggMap([{type:"eggs",date:"2026-08-01",eggs:4},{type:"eggs",date:"2026-08-01",eggs:3}])["2026-08-01"]===7);
    ok("forecast score identifies rainy weather",api.kind({precip:.1})==="rainy");
    ok("forecast score identifies cloudy weather",api.kind({cloud:80})==="cloudy");
    ok("forecast score identifies sunny weather",api.kind({cloud:10})==="sunny");
    ok("forecast score makes zero network calls",api.networkCalls===0);
    ok("forecast score makes zero Firebase reads",api.firebaseReads===0);
    ok("forecast score makes zero Firebase writes",api.firebaseWrites===0);
    window.__customerForecastScoreRegressionResults=checks;
    return checks;
  }
  window.CustomerForecastScoreRegressionV1={run};
  setTimeout(run,350);
})();