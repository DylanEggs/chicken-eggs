(() => {
  "use strict";
  if(window.__CustomerViewV2)return;window.__CustomerViewV2=true;

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const BRAND="Rose Family Poultry";
  const PREFIX="__chicken_eggs_staging__::";
  const PREVIEW_SESSION="chickenEggStagingCustomerPreviewV2";
  const ENTRY_KEY="chickenEggEntriesV102";
  const WEATHER_KEY="chickenEggWeatherIntelligenceV2";
  const n=v=>Number(v)||0;
  const finite=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
  const median=values=>{const a=values.filter(finite).map(Number).sort((a,b)=>a-b);if(!a.length)return null;const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  const signed=v=>{const x=Number(v)||0;return `${x>0?"+":""}${x.toFixed(1)}%`;};

  function previewValues(){try{return JSON.parse(sessionStorage.getItem(PREVIEW_SESSION)||"null")?.values||{};}catch{return {};}}
  function read(key,fallback){
    try{
      const s=previewValues();
      if(Object.prototype.hasOwnProperty.call(s,key))return s[key];
      const raw=localStorage.getItem(PREFIX+key);
      return raw==null?fallback:JSON.parse(raw);
    }catch{return fallback;}
  }
  function eggMap(entries){
    const map={};
    for(const e of Array.isArray(entries)?entries:[]){
      if(e?.type!=="eggs"||!e.date)continue;
      const d=String(e.date).slice(0,10);map[d]=(map[d]||0)+Math.max(0,Math.round(n(e.eggs)));
    }
    return map;
  }
  function localBaseline(date,map){
    const target=new Date(`${date}T12:00:00`).getTime();
    const near=Object.entries(map).filter(([d,v])=>d!==date&&finite(v)).map(([d,v])=>({v:Number(v),dist:Math.abs((new Date(`${d}T12:00:00`).getTime()-target)/86400000)})).filter(x=>x.dist<=14).sort((a,b)=>a.dist-b.dist).slice(0,12).map(x=>x.v);
    if(near.length>=5)return median(near);
    const prior=Object.entries(map).filter(([d,v])=>d<date&&finite(v)).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).map(([,v])=>Number(v));
    return prior.length>=4?median(prior):null;
  }
  function tempBand(temp){const t=Number(temp);if(t>=90)return"hot";if(t>=80)return"warm";if(t>=66)return"mild";if(t>=52)return"cool";return"cold";}
  function historicalKind(w={}){
    if(n(w.rain??w.precip)>=.05||n(w.rainHours)>=2||n(w.precipProbability)>=60)return"rainy";
    if(finite(w.cloud)&&n(w.cloud)>=65)return"cloudy";
    return"sunny";
  }
  function todayKind(data={}){
    const w=data.weather||{},text=String(w.condition||"").toLowerCase();
    if(/rain|storm|drizzle|shower|thunder/.test(text)||n(w.rainChance)>=60)return"rainy";
    if(/cloud|overcast|fog/.test(text))return"cloudy";
    return"sunny";
  }
  function todayTemp(data={}){const w=data.weather||{};return finite(w.high)?Number(w.high):finite(w.temperature)?Number(w.temperature):null;}
  function recentBaseline(map){
    const today=todayKey();const values=Object.entries(map).filter(([d,v])=>d<today&&finite(v)).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).map(([,v])=>Number(v));
    return values.length?median(values):null;
  }
  function matchedPrediction(data={}){
    const entries=read(ENTRY_KEY,[]),weather=read(WEATHER_KEY,{}),map=eggMap(entries),history=weather?.history&&typeof weather.history==="object"?weather.history:{};
    const temp=todayTemp(data),band=temp==null?null:tempBand(temp),kind=todayKind(data),base=recentBaseline(map)||Number(data?.production?.dailyPace)||0;
    const rows=[];
    for(const [date,w] of Object.entries(history)){
      if(!map[date]||!finite(w?.max))continue;
      const local=localBaseline(date,map);if(!local||local<=0)continue;
      rows.push({date,band:tempBand(w.max),kind:historicalKind(w),ratio:Math.max(.5,Math.min(1.5,map[date]/local))});
    }
    let matches=band?rows.filter(r=>r.band===band&&r.kind===kind):[];
    let matchLabel=band?`${band} + ${kind}`:kind;
    let confidence="Strong match";
    if(matches.length<4&&band){matches=rows.filter(r=>r.band===band);matchLabel=`${band} days`;confidence="Broader weather match";}
    if(matches.length<4){matches=rows.filter(r=>r.kind===kind);matchLabel=`${kind} days`;confidence="Broader weather match";}
    if(matches.length<4||!base){
      const pace=Math.max(0,Number(data?.production?.dailyPace)||base||0),low=Math.max(0,Math.round(pace*.85)),high=Math.max(low,Math.round(pace*1.15));
      return {low,high,samples:matches.length,kind,band,matchLabel:"recent flock pace",confidence:"Still learning similar weather",exact:false};
    }
    const projected=matches.map(r=>r.ratio*base).sort((a,b)=>a-b);
    const q=p=>projected[Math.max(0,Math.min(projected.length-1,Math.floor((projected.length-1)*p)))];
    const low=Math.max(0,Math.round(q(.2))),high=Math.max(low,Math.round(q(.8)));
    return {low,high,samples:matches.length,kind,band,matchLabel,confidence,exact:true};
  }

  function ensureTabs(){
    const app=document.getElementById("customerApp");if(!app||document.getElementById("customerTabs"))return;
    const tabs=document.createElement("nav");tabs.id="customerTabs";tabs.className="customer-tabs";tabs.setAttribute("aria-label","Customer farm pages");
    tabs.innerHTML='<a class="active" href="./">🏡 Farm View</a><a href="stats.html">📊 Egg Stats</a>';
    const header=app.querySelector(".site-header");header?.insertAdjacentElement("afterend",tabs);
  }
  function renderBranding(){
    document.title=`${BRAND} — Customer Preview`;
    const farm=document.getElementById("farmName");if(farm)farm.textContent=BRAND;
    const footer=document.getElementById("footerFarmName");if(footer)footer.textContent=BRAND;
    const loc=document.getElementById("farmLocation");if(loc&&!String(loc.textContent||"").trim())loc.textContent="High Point, NC";
  }
  function weatherPhrase(p,data){
    const bits=[];if(p.band)bits.push(p.band);bits.push(p.kind);const temp=todayTemp(data);return `${temp==null?"Today's":`${Math.round(temp)}°`} ${bits.join(" ")} conditions`;
  }
  function renderImpact(){
    const app=document.getElementById("customerApp");if(!app)return;
    const data=window.CustomerViewStaging?.getData?.()||window.StagingCustomerPublicData?.build?.();if(!data)return;
    const prediction=matchedPrediction(data);
    const outlook=document.getElementById("todayForecast");if(outlook)outlook.textContent=prediction.low===prediction.high?String(prediction.high):`${prediction.low}–${prediction.high}`;
    let card=document.getElementById("customerWeatherImpact");
    if(!card){card=document.createElement("section");card.id="customerWeatherImpact";card.className="weather-impact-card";document.querySelector(".weather-card")?.insertAdjacentElement("afterend",card);}
    const insights=data.weatherInsights||{},factors=Array.isArray(insights.factors)?insights.factors:[];
    const sampleText=prediction.exact?`Built from ${prediction.samples} comparable ${esc(prediction.matchLabel)} in this flock's own history.`:`Only ${prediction.samples} close weather matches so far, so today's range leans more on the recent flock pace.`;
    card.innerHTML=`<div class="section-kicker">🌦️ Today's weather-matched egg outlook</div><div class="weather-match-hero"><div><h2>On days like today, the flock usually lands around <span>${prediction.low===prediction.high?prediction.high:`${prediction.low}–${prediction.high}`}</span> eggs.</h2><p>${esc(weatherPhrase(prediction,data))}. ${esc(sampleText)} This is a friendly estimate, not a guarantee.</p></div><div class="weather-match-badge">${prediction.kind==="rainy"?"🌧️":prediction.kind==="cloudy"?"☁️":"☀️"}<strong>${esc(prediction.confidence)}</strong></div></div>${factors.length?`<div class="weather-story"><strong>What the farm history is showing</strong><div class="weather-impact-list">${factors.slice(0,2).map(f=>`<div class="weather-impact-pill"><span>${esc(f.emoji)} ${esc(f.label)}</span><strong>${signed(f.effect)}</strong><small>vs comparable non-${esc(String(f.label||"").toLowerCase())}</small></div>`).join("")}</div></div>`:""}<p class="weather-impact-note">Patterns are correlations from this farm's own weather + laying logs. <a href="stats.html">See all egg stats →</a></p>`;
  }
  function renderEggTrail(){
    const data=window.CustomerViewStaging?.getData?.()||window.StagingCustomerPublicData?.build?.();if(!data?.stats)return;
    let section=document.getElementById("customerEggTrail");
    if(!section){section=document.createElement("section");section.id="customerEggTrail";section.className="egg-trail-card";document.getElementById("customerWeatherImpact")?.insertAdjacentElement("afterend",section);}
    const daily=(data.stats.daily30||[]).slice(-14),max=Math.max(1,...daily.map(x=>Number(x.eggs)||0)),r=data.stats.records||{};
    const bars=daily.map((x,i)=>{const h=Math.max(5,Math.round((Number(x.eggs)||0)/max*100));const label=new Date(`${x.date}T12:00:00`).toLocaleDateString(undefined,{weekday:"narrow"});return `<div class="egg-trail-day" title="${esc(x.date)}: ${Number(x.eggs)||0} eggs"><i style="height:${h}%"></i><b>${Number(x.eggs)||0}</b><span>${esc(label)}</span></div>`;}).join("");
    section.innerHTML=`<div class="section-heading"><div><div class="section-kicker">🥚 Two weeks in the nest boxes</div><h2>A little look at the laying rhythm</h2></div><a class="tiny-link" href="stats.html">More stats →</a></div><div class="egg-trail-chart" aria-label="Eggs collected during the last 14 days">${bars}</div><div class="egg-trail-records"><div><span>🏆 Best day</span><strong>${Number(r.bestDay?.eggs)||0} eggs</strong></div><div><span>🔥 Current streak</span><strong>${Number(r.streak)||0} days</strong></div><div><span>🥚 Farm lifetime</span><strong>${Number(r.lifetimeEggs)||0}</strong></div></div>`;
  }
  function render(){ensureTabs();renderBranding();renderImpact();renderEggTrail();}
  const start=()=>{render();setTimeout(render,180);["staging-customer-data-ready","core-data-synced","farm-data-synced"].forEach(name=>window.addEventListener(name,render));};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.CustomerViewWeatherMatchV1={matchedPrediction,tempBand,historicalKind,todayKind,eggMap,networkCalls:0,firebaseReads:0,firebaseWrites:0};
})();