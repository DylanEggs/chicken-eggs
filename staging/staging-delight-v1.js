(() => {
  "use strict";
  if (window.__StagingDelightV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingDelightV1 = true;

  const ENTRIES="chickenEggEntriesV102";
  const WEATHER="chickenEggWeatherIntelligenceV2";
  const STATE="rfpStagingDelightV1";
  const read=(k,f)=>{try{const raw=localStorage.getItem(k);return raw==null?f:JSON.parse(raw);}catch{return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
  const n=v=>Math.max(0,Number(v)||0);
  const pad=v=>String(v).padStart(2,"0");
  const dateKey=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const entries=()=>{const x=read(ENTRIES,[]);return Array.isArray(x)?x:[];};
  const weather=()=>{const x=read(WEATHER,{});return x&&typeof x==="object"?x:{};};

  function eggsOn(date=dateKey()){
    return entries().filter(e=>e?.type==="eggs"&&String(e.date||"").slice(0,10)===date).reduce((s,e)=>s+n(e.eggs),0);
  }
  function saleCount(){return entries().filter(e=>e?.type==="sale").length;}
  function streak(){
    const map=new Set(entries().filter(e=>e?.type==="eggs"&&n(e.eggs)>0&&e.date).map(e=>String(e.date).slice(0,10)));
    if(!map.size)return 0;
    const d=new Date();d.setHours(12,0,0,0);
    if(!map.has(dateKey(d))){d.setDate(d.getDate()-1);if(!map.has(dateKey(d)))return 0;}
    let count=0;
    while(map.has(dateKey(d))){count++;d.setDate(d.getDate()-1);}
    return count;
  }
  function nextDozen(){const today=eggsOn();const rem=today%12;return rem===0?(today?12:12):12-rem;}
  function greeting(){const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening";}
  function weatherInsight(){
    try{
      const api=window.FarmPublicCustomerBuilderV2;
      if(!api?.weatherInsights)return null;
      const result=api.weatherInsights(entries(),weather());
      const factor=result?.factors?.[0]||null;
      const trend=result?.productionTrend||null;
      return {samples:n(result?.samples),factor,trend};
    }catch{return null;}
  }

  function css(){
    if(document.getElementById("rfpDelightCss"))return;
    const s=document.createElement("style");s.id="rfpDelightCss";s.textContent=`
      .rfp-delight{margin:14px 0;padding:16px;border-radius:22px;background:linear-gradient(135deg,rgba(255,247,223,.96),rgba(238,248,238,.96));border:1px solid rgba(31,122,58,.14);box-shadow:0 12px 30px rgba(24,68,36,.08)}.farm2-dark .rfp-delight{background:linear-gradient(135deg,rgba(54,48,30,.9),rgba(25,49,34,.9))}.rfp-delight h3{margin:0 0 3px}.rfp-delight-sub{font-size:11px;font-weight:800;opacity:.7}.rfp-delight-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.rfp-delight-stat{padding:10px;border-radius:15px;background:rgba(255,255,255,.68);text-align:center}.farm2-dark .rfp-delight-stat{background:rgba(255,255,255,.06)}.rfp-delight-stat b{display:block;font-size:21px}.rfp-delight-stat span{display:block;font-size:10px;font-weight:850;opacity:.7}.rfp-carton{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:12px 0 7px}.rfp-carton i{aspect-ratio:1;border-radius:50% 50% 46% 46%;display:block;background:rgba(31,122,58,.09);border:1px solid rgba(31,122,58,.12)}.rfp-carton i.filled{background:linear-gradient(180deg,#fff5cf,#f1c96b);box-shadow:0 3px 8px rgba(80,60,10,.14)}.rfp-weather-line{margin-top:10px;padding:10px 11px;border-radius:14px;background:rgba(31,122,58,.07);font-size:11px;font-weight:800;line-height:1.4}.rfp-toast{position:fixed;left:50%;bottom:110px;transform:translate(-50%,20px);z-index:11000;background:#17351f;color:white;padding:12px 16px;border-radius:999px;font-weight:900;box-shadow:0 16px 38px rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:.25s ease;max-width:min(88vw,460px);text-align:center}.rfp-toast.show{opacity:1;transform:translate(-50%,0)}.rfp-pop{animation:rfpPop .55s ease}@keyframes rfpPop{0%{transform:scale(.96)}55%{transform:scale(1.025)}100%{transform:scale(1)}}@media(max-width:560px){.rfp-delight-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    `;document.head.appendChild(s);
  }
  function weatherText(){
    const w=weatherInsight();
    if(!w||(!w.factor&&!w.trend))return "🌦️ Weather + laying: still collecting enough matched farm data to call a pattern.";
    const parts=[];
    if(w.factor){const x=Number(w.factor.effect)||0;parts.push(`${w.factor.emoji||"🌤️"} ${w.factor.label}: ${x>0?"+":""}${x.toFixed(1)}% vs comparison days`);}
    if(w.trend){const x=Number(w.trend.change)||0;parts.push(`📈 30-day production trend: ${x>0?"+":""}${x.toFixed(1)}%`);}
    return `${parts.join(" • ")}${w.samples?` • ${w.samples} matched days`:""}`;
  }
  function render(){
    const dash=document.getElementById("dashboard");if(!dash)return false;
    let card=document.getElementById("rfpDelightCard");
    if(!card){card=document.createElement("section");card.id="rfpDelightCard";card.className="rfp-delight";const smart=document.getElementById("rfpSmartInsightsCard");if(smart)smart.insertAdjacentElement("beforebegin",card);else dash.appendChild(card);}
    const today=eggsOn(),filled=today%12,displayFilled=filled===0&&today>0?12:filled;
    card.innerHTML=`<h3>🌞 ${greeting()}, Rose Family Poultry</h3><div class="rfp-delight-sub">STAGING • today at a glance</div><div class="rfp-delight-grid"><div class="rfp-delight-stat"><b>${today}</b><span>eggs today</span></div><div class="rfp-delight-stat"><b>${streak()}</b><span>day laying streak</span></div><div class="rfp-delight-stat"><b>${nextDozen()}</b><span>to next dozen</span></div></div><div class="rfp-carton" aria-label="Carton progress">${Array.from({length:12},(_,i)=>`<i class="${i<displayFilled?"filled":""}"></i>`).join("")}</div><div class="rfp-delight-sub">🥚 Carton progress: ${displayFilled}/12 toward the next full dozen</div><div class="rfp-weather-line">${weatherText()}</div>`;
    return true;
  }
  function toast(text){let el=document.getElementById("rfpDelightToast");if(!el){el=document.createElement("div");el.id="rfpDelightToast";el.className="rfp-toast";document.body.appendChild(el);}el.textContent=text;el.classList.remove("show");requestAnimationFrame(()=>{el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400);});const card=document.getElementById("rfpDelightCard");card?.classList.remove("rfp-pop");requestAnimationFrame(()=>card?.classList.add("rfp-pop"));}
  function detectCelebrate(){
    const prev=read(STATE,{eggs:eggsOn(),sales:saleCount()});const nowEggs=eggsOn(),nowSales=saleCount();
    if(nowEggs>n(prev.eggs))toast(`🥚 Nice! ${nowEggs} eggs collected today.`);
    else if(nowSales>n(prev.sales))toast("💰 Sale recorded — another farm win!");
    write(STATE,{eggs:nowEggs,sales:nowSales,updatedAt:Date.now()});
    render();
  }
  function start(){css();render();const initial={eggs:eggsOn(),sales:saleCount(),updatedAt:Date.now()};write(STATE,initial);["farm-local-data-changed","core-data-synced","farm-data-synced","rfp-staging-smart-insights-changed"].forEach(name=>window.addEventListener(name,detectCelebrate));window.addEventListener("storage",e=>{if([ENTRIES,WEATHER].includes(e.key))detectCelebrate();});}

  window.StagingDelightV1={version:1,networkCalls:0,writesFirebase:false,render,eggsOn,streak,nextDozen,weatherInsight,greeting};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(start,350),{once:true});else setTimeout(start,350);
})();
