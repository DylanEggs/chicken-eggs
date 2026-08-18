(() => {
  "use strict";
  if(window.__CustomerViewV2)return;window.__CustomerViewV2=true;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  function signed(v){const x=Number(v)||0;return `${x>0?"+":""}${x.toFixed(1)}%`;}
  function ensureTabs(){
    const app=document.getElementById("customerApp");if(!app||document.getElementById("customerTabs"))return;
    const tabs=document.createElement("nav");tabs.id="customerTabs";tabs.className="customer-tabs";tabs.setAttribute("aria-label","Customer farm pages");
    tabs.innerHTML='<a class="active" href="./">🏡 Farm View</a><a href="stats.html">📊 Egg Stats</a>';
    const header=app.querySelector(".site-header");header?.insertAdjacentElement("afterend",tabs);
  }
  function renderImpact(){
    const app=document.getElementById("customerApp");if(!app)return;
    const data=window.CustomerViewStaging?.getData?.()||window.StagingCustomerPublicData?.build?.();if(!data)return;
    let card=document.getElementById("customerWeatherImpact");
    if(!card){
      card=document.createElement("section");card.id="customerWeatherImpact";card.className="weather-impact-card";
      const weather=document.querySelector(".weather-card");weather?.insertAdjacentElement("afterend",card);
    }
    const insights=data.weatherInsights||{};const factors=Array.isArray(insights.factors)?insights.factors:[];
    if(factors.length){
      card.innerHTML=`<div class="section-kicker">🌦️ Weather + laying</div><h2>What the flock’s history is showing</h2><p>These are patterns from this farm’s own weather and egg logs, not a generic chicken estimate.</p><div class="weather-impact-list">${factors.slice(0,2).map(f=>`<div class="weather-impact-pill"><span>${esc(f.emoji)} ${esc(f.label)}</span><strong>${signed(f.effect)}</strong></div>`).join("")}</div><p class="weather-impact-note">Based on ${Number(insights.samples)||0} matched weather/laying days. <a href="stats.html">See all egg stats →</a></p>`;
    }else{
      card.innerHTML='<div class="section-kicker">🌦️ Weather + laying</div><h2>The flock is still teaching us</h2><p>We are collecting enough matching weather and laying days before calling anything a real pattern. The Stats page will fill in automatically as the history grows.</p><p class="weather-impact-note"><a href="stats.html">Open egg stats →</a></p>';
    }
  }
  function render(){ensureTabs();renderImpact();}
  const start=()=>{render();setTimeout(render,150);setInterval(render,15000);};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
