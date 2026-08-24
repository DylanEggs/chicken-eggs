(() => {
  "use strict";
  if (window.__CustomerWeatherMatchRegressionV1) return;
  window.__CustomerWeatherMatchRegressionV1 = true;

  const results=[];
  const check=(name,pass,detail="")=>results.push({name,pass:!!pass,detail});
  const run=()=>{
    const api=window.CustomerViewWeatherMatchV1;
    check("Weather match module loaded",!!api);
    if(!api){window.CustomerWeatherMatchRegressionV1={results,passed:false};return results;}
    const exact=api.weatherSimilarity?.({temp:88,kind:"sunny"},90,"sunny");
    const far=api.weatherSimilarity?.({temp:72,kind:"rainy"},90,"sunny");
    check("Same-condition close temperature scores strongly",Number(exact?.score)>=80,String(exact?.score));
    check("Different-condition distant day scores weakly",Number(far?.score)<=10,String(far?.score));
    check("Temperature delta is preserved",Number(exact?.delta)===2,String(exact?.delta));
    check("Customer weather feature declares zero Firebase reads",api.firebaseReads===0,String(api.firebaseReads));
    check("Customer weather feature declares zero Firebase writes",api.firebaseWrites===0,String(api.firebaseWrites));
    check("Customer weather feature declares zero network calls",api.networkCalls===0,String(api.networkCalls));
    window.CustomerWeatherMatchRegressionV1={results,passed:results.every(x=>x.pass),run};
    if(!results.every(x=>x.pass))console.warn("Customer weather-match regression failed",results.filter(x=>!x.pass));
    return results;
  };
  setTimeout(run,0);
})();