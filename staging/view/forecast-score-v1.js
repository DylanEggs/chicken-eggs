(() => {
  "use strict";
  if (window.__CustomerForecastScoreV1) return;
  window.__CustomerForecastScoreV1 = true;

  const PREFIX="__chicken_eggs_staging__::", PREVIEW_SESSION="chickenEggStagingCustomerPreviewV2";
  const ENTRY_KEY="chickenEggEntriesV102", WEATHER_KEY="chickenEggWeatherIntelligenceV2";
  const finite=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
  const n=v=>Number(v)||0;
  const median=values=>{const a=values.filter(finite).map(Number).sort((a,b)=>a-b);if(!a.length)return null;const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};

  function previewValues(){try{return JSON.parse(sessionStorage.getItem(PREVIEW_SESSION)||"null")?.values||{};}catch{return {};}}
  function read(key,fallback){try{const s=previewValues();if(Object.prototype.hasOwnProperty.call(s,key))return s[key];const raw=localStorage.getItem(PREFIX+key);return raw==null?fallback:JSON.parse(raw);}catch{return fallback;}}
  function eggMap(entries){const map={};for(const e of Array.isArray(entries)?entries:[]){if(e?.type!=="eggs"||!e.date)continue;const d=String(e.date).slice(0,10);map[d]=(map[d]||0)+Math.max(0,Math.round(n(e.eggs)));}return map;}
  function kind(w={}){if(n(w.rain??w.precip)>=.05||n(w.rainHours)>=2||n(w.precipProbability)>=60)return"rainy";if(finite(w.cloud)&&n(w.cloud)>=65)return"cloudy";return"sunny";}
  function localBaseline(date,map){const target=new Date(`${date}T12:00:00`).getTime();const near=Object.entries(map).filter(([d,v])=>d!==date&&finite(v)).map(([d,v])=>({v:Number(v),dist:Math.abs((new Date(`${d}T12:00:00`).getTime()-target)/86400000)})).filter(x=>x.dist<=14).sort((a,b)=>a.dist-b.dist).slice(0,12).map(x=>x.v);if(near.length>=5)return median(near);const prior=Object.entries(map).filter(([d,v])=>d<date&&finite(v)).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).map(([,v])=>Number(v));return prior.length>=4?median(prior):null;}

  function backtest(entries,weatherState){
    const map=eggMap(entries),history=weatherState?.history&&typeof weatherState.history==="object"?weatherState.history:{};
    const dates=Object.keys(map).filter(d=>history[d]&&finite(history[d]?.max)).sort((a,b)=>b.localeCompare(a)).slice(0,45);
    const rows=[];
    for(const date of dates){
      const w=history[date],base=localBaseline(date,map);if(!base||base<=0)continue;
      const temp=Number(w.max),k=kind(w),ratios=[];
      for(const [other,ow] of Object.entries(history)){
        if(other===date||!map[other]||!finite(ow?.max)||kind(ow)!==k||Math.abs(Number(ow.max)-temp)>12)continue;
        const ob=localBaseline(other,map);if(!ob||ob<=0)continue;
        ratios.push(Math.max(.5,Math.min(1.5,map[other]/ob)));
      }
      if(ratios.length<4)continue;
      const predicted=Math.max(0,Math.round(base*median(ratios))),actual=map[date],error=Math.abs(predicted-actual);
      rows.push({date,predicted,actual,error,kind:k,temp,samples:ratios.length});
      if(rows.length>=20)break;
    }
    return rows;
  }
  function summarize(rows){const list=Array.isArray(rows)?rows:[];if(!list.length)return {days:0,mae:null,within2:null};const mae=list.reduce((s,x)=>s+n(x.error),0)/list.length,within2=list.filter(x=>n(x.error)<=2).length/list.length*100;return {days:list.length,mae,within2};}
  function css(){if(document.getElementById("customerForecastScoreCss"))return;const s=document.createElement("style");s.id="customerForecastScoreCss";s.textContent=`.forecast-score{margin-top:12px;padding:11px 12px;border-radius:15px;background:rgba(255,255,255,.58);border:1px solid rgba(70,94,53,.12);font-size:11px;line-height:1.45}.forecast-score strong{display:block;font-size:12px;margin-bottom:2px}.forecast-score span{font-weight:850}.forecast-score small{display:block;opacity:.68;margin-top:3px}`;document.head.appendChild(s);}
  function render(){const card=document.getElementById("customerWeatherImpact");if(!card)return false;const rows=backtest(read(ENTRY_KEY,[]),read(WEATHER_KEY,{})),s=summarize(rows);let el=document.getElementById("customerForecastScore");if(!el){el=document.createElement("div");el.id="customerForecastScore";el.className="forecast-score";const note=card.querySelector(".weather-impact-note");if(note)note.insertAdjacentElement("beforebegin",el);else card.appendChild(el);}css();if(s.days<5||s.mae==null){el.innerHTML=`<strong>🧠 The flock forecast is still learning</strong>There are not enough comparable weather days yet to give the model a useful accuracy check.<small>This grows automatically as more weather + laying history is logged.</small>`;}else{el.innerHTML=`<strong>🎯 How has the weather-match forecast done?</strong>Across <span>${s.days} back-tested days</span>, the model was off by about <span>${s.mae.toFixed(1)} eggs on average</span>${s.within2==null?"":` • ${Math.round(s.within2)}% landed within 2 eggs`}.<small>A historical model check, not a promise for today.</small>`;}return true;}
  function start(){render();setTimeout(render,220);["staging-customer-data-ready","core-data-synced","farm-data-synced"].forEach(name=>window.addEventListener(name,render));}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.CustomerForecastScoreV1={version:1,backtest,summarize,eggMap,kind,localBaseline,networkCalls:0,firebaseReads:0,firebaseWrites:0};
})();