(() => {
  "use strict";
  const api=window.StagingCustomerPublicData;
  if(!api?.build){document.getElementById("statsMissing")?.removeAttribute("hidden");return;}
  const BRAND="Rose Family Poultry";
  let dailyChart=null,weeklyChart=null,monthlyChart=null;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const shortDate=v=>v?new Date(`${v}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"}):"—";
  const monthLabel=v=>v?new Date(`${v}-01T12:00:00`).toLocaleDateString(undefined,{month:"short",year:"2-digit"}):"—";
  const signed=v=>{const x=Number(v)||0;return `${x>0?"+":""}${x.toFixed(1)}%`;};
  function setText(id,value){const el=$(id);if(el)el.textContent=value;}
  function chart(existing,id,labels,values,label){
    existing?.destroy?.();const canvas=$(id);if(!canvas||typeof Chart!=="function")return null;
    return new Chart(canvas,{type:"bar",data:{labels,datasets:[{label,data:values,borderWidth:1,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false}}}}});
  }
  function renderRecords(data){
    const r=data.stats?.records||{};const grid=$("recordGrid");if(!grid)return;
    grid.innerHTML=[
      ["🥚 Lifetime eggs",r.lifetimeEggs||0,"all logged collections"],
      ["🔥 Current streak",`${r.streak||0} days`,"consecutive logging days"],
      ["🏆 Best day",r.bestDay?.eggs||0,shortDate(r.bestDay?.date)],
      ["📅 Best week",r.bestWeek?.eggs||0,`week of ${shortDate(r.bestWeek?.start)}`],
      ["🗓️ Best month",r.bestMonth?.eggs||0,monthLabel(r.bestMonth?.month)],
      ["📈 Logged-day avg",Number(r.averageLoggedDay||0).toFixed(1),"eggs per laying day logged"]
    ].map(([title,value,note])=>`<article class="public-stat"><span>${esc(title)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join("");
  }
  function renderWeather(data){
    const w=data.weatherInsights||{};setText("weatherSamples",`${Number(w.samples)||0} matched days`);
    const factors=Array.isArray(w.factors)?w.factors:[];const grid=$("weatherFactorGrid");
    if(grid)grid.innerHTML=factors.length?factors.map(f=>`<article class="weather-factor"><div class="factor-top"><span>${esc(f.emoji)} ${esc(f.label)}</span><strong>${signed(f.effect)}</strong></div><p>Compared with ${Number(f.comparisonDays)||0} other days • ${Number(f.withDays)||0} matching days.</p></article>`).join(""):'<article class="weather-factor"><div class="factor-top"><span>🌱 Still learning</span><strong>—</strong></div><p>Not enough matched weather and laying days yet to call a pattern.</p></article>';
    const t=w.productionTrend;const trend=$("productionTrend");
    if(trend)trend.innerHTML=t?`<strong>${signed(t.change)} production trend</strong><p>Recent 30-day average: ${Number(t.recentAverage).toFixed(1)} eggs/day • prior 30-day average: ${Number(t.priorAverage).toFixed(1)} eggs/day.</p>`:'<strong>Production trend is still building</strong><p>Once there are enough logged days, this compares the most recent 30 days with the 30 days before them.</p>';
  }
  function render(){
    const data=api.build();const ready=Number(data.meta?.sourceSnapshotAt)>0||data.flock?.length||data.availability?.updatedAt>0;
    const missing=$("statsMissing");if(missing)missing.hidden=!!ready;if(!ready)return;
    setText("statsFarmName",BRAND);setText("statsFarmLocation",data.farm.location);setText("statsFooterFarm",BRAND);document.title=`${BRAND} — Egg Stats`;
    renderRecords(data);renderWeather(data);
    const s=data.stats||{};
    dailyChart=chart(dailyChart,"dailyPublicChart",(s.daily30||[]).map(x=>shortDate(x.date)),(s.daily30||[]).map(x=>Number(x.eggs)||0),"Daily eggs");
    weeklyChart=chart(weeklyChart,"weeklyPublicChart",(s.weekly8||[]).map(x=>shortDate(x.start)),(s.weekly8||[]).map(x=>Number(x.eggs)||0),"Weekly eggs");
    monthlyChart=chart(monthlyChart,"monthlyPublicChart",(s.monthly12||[]).map(x=>monthLabel(x.month)),(s.monthly12||[]).map(x=>Number(x.eggs)||0),"Monthly eggs");
  }
  window.CustomerStatsStaging={version:3,refresh:render,getData:()=>api.build()};
  render();setInterval(render,15000);
})();
