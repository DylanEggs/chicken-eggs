(() => {
  "use strict";
  if (window.__StagingCustomerWeatherTwinV1) return;
  window.__StagingCustomerWeatherTwinV1 = true;

  const PREFIX = "__chicken_eggs_staging__::";
  const PREVIEW_SESSION = "chickenEggStagingCustomerPreviewV2";
  const ENTRY_KEY = "chickenEggEntriesV102";
  const WEATHER_KEY = "chickenEggWeatherIntelligenceV2";
  const n = v => Number(v) || 0;
  const finite = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  function previewValues(){
    try{return JSON.parse(sessionStorage.getItem(PREVIEW_SESSION)||"null")?.values||{};}catch{return {};}
  }
  function read(key,fallback){
    try{
      const s=previewValues();
      if(Object.prototype.hasOwnProperty.call(s,key)) return s[key];
      const raw=localStorage.getItem(PREFIX+key);
      return raw==null?fallback:JSON.parse(raw);
    }catch{return fallback;}
  }
  function getData(){
    return window.CustomerViewStaging?.getData?.() || window.StagingCustomerPublicData?.build?.() || null;
  }
  function eggMap(entries){
    const map={};
    for(const e of Array.isArray(entries)?entries:[]){
      if(e?.type!=="eggs"||!e.date) continue;
      const date=String(e.date).slice(0,10);
      map[date]=(map[date]||0)+Math.max(0,Math.round(n(e.eggs)));
    }
    return map;
  }
  function kindFromHistory(w={}){
    if(n(w.rain??w.precip)>=.05||n(w.rainHours)>=2||n(w.precipProbability)>=60) return "rainy";
    if(finite(w.cloud)&&n(w.cloud)>=65) return "cloudy";
    return "sunny";
  }
  function kindToday(data={}){
    const w=data.weather||{}, text=String(w.condition||"").toLowerCase();
    if(/rain|storm|drizzle|shower|thunder/.test(text)||n(w.rainChance)>=60) return "rainy";
    if(/cloud|overcast|fog/.test(text)) return "cloudy";
    return "sunny";
  }
  function todayTemp(data={}){
    const w=data.weather||{};
    return finite(w.high)?Number(w.high):finite(w.temperature)?Number(w.temperature):null;
  }
  function labelKind(kind){return kind==="rainy"?"rainy":kind==="cloudy"?"cloudy":"sunny";}
  function emoji(kind){return kind==="rainy"?"🌧️":kind==="cloudy"?"☁️":"☀️";}
  function formatDate(date){
    const d=new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime())?date:d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
  }

  function nearestTwin(data=getData()){
    if(!data) return null;
    const entries=read(ENTRY_KEY,[]), weather=read(WEATHER_KEY,{}), eggs=eggMap(entries);
    const history=weather?.history&&typeof weather.history==="object"?weather.history:{};
    const temp=todayTemp(data), kind=kindToday(data), today=todayKey();
    const rows=[];
    for(const [date,w] of Object.entries(history)){
      if(date>=today||!finite(eggs[date])||!finite(w?.max)) continue;
      const rowKind=kindFromHistory(w);
      const tempDiff=temp==null?0:Math.abs(Number(w.max)-temp);
      const kindPenalty=rowKind===kind?0:12;
      const ageDays=Math.max(0,(new Date(`${today}T12:00:00`)-new Date(`${date}T12:00:00`))/86400000);
      rows.push({date,kind:rowKind,temp:Number(w.max),eggs:Number(eggs[date]),score:kindPenalty+tempDiff+Math.min(8,ageDays/90)});
    }
    if(!rows.length) return null;
    rows.sort((a,b)=>a.score-b.score||b.date.localeCompare(a.date));
    const best=rows[0];
    return {...best,todayKind:kind,todayTemp:temp,exactKind:best.kind===kind};
  }

  function css(){
    if(document.getElementById("customerWeatherTwinCss")) return;
    const style=document.createElement("style");
    style.id="customerWeatherTwinCss";
    style.textContent=`
      .weather-twin{margin-top:12px;padding:11px 12px;border-radius:15px;background:rgba(255,255,255,.72);border:1px solid rgba(31,122,58,.10);display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}
      .weather-twin-emoji{font-size:24px}.weather-twin-copy{min-width:0}.weather-twin-copy strong{display:block;font-size:12px;color:#17351f}.weather-twin-copy small{display:block;margin-top:2px;font-size:10px;line-height:1.4;color:#6f7e73}.weather-twin-eggs{text-align:right}.weather-twin-eggs b{display:block;font-size:20px;line-height:1;color:#17351f}.weather-twin-eggs span{font-size:9px;font-weight:850;color:#78877c}
      @media(max-width:430px){.weather-twin{grid-template-columns:auto 1fr}.weather-twin-eggs{grid-column:2;text-align:left}.weather-twin-eggs b{display:inline;font-size:15px}.weather-twin-eggs span{margin-left:4px}}
    `;
    document.head.appendChild(style);
  }

  function render(){
    css();
    const impact=document.getElementById("customerWeatherImpact");
    if(!impact) return false;
    const twin=nearestTwin();
    let row=document.getElementById("customerWeatherTwin");
    if(!twin){if(row)row.remove();return false;}
    if(!row){row=document.createElement("div");row.id="customerWeatherTwin";row.className="weather-twin";impact.appendChild(row);}
    const same=twin.exactKind?`${labelKind(twin.kind)} and ${Math.round(twin.temp)}°`:`about ${Math.round(twin.temp)}°`;
    row.innerHTML=`<div class="weather-twin-emoji" aria-hidden="true">${emoji(twin.kind)}</div><div class="weather-twin-copy"><strong>Weather twin: ${esc(formatDate(twin.date))}</strong><small>The closest past weather day was ${esc(same)}. That day the flock laid:</small></div><div class="weather-twin-eggs"><b>${Math.round(twin.eggs)}</b><span>eggs</span></div>`;
    return true;
  }

  function start(){
    render();
    setTimeout(render,260);
    ["staging-customer-data-ready","core-data-synced","farm-data-synced"].forEach(name=>window.addEventListener(name,render));
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();

  window.StagingCustomerWeatherTwinV1={version:1,nearestTwin,kindFromHistory,kindToday,eggMap,render,networkCalls:0,firebaseReads:0,firebaseWrites:0};
})();
