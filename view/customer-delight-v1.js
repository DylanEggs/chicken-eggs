(() => {
  "use strict";
  if (window.__CustomerViewDelightV1) return;
  window.__CustomerViewDelightV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const n = value => Number(value) || 0;
  const factIndexes = { fun: 0, flock: 0 };
  let factMode = "fun";
  let installedFactButton = false;
  let surpriseIndex = 0;

  function data() { return window.CustomerViewPublic?.getData?.() || null; }
  function story(d = data()) { return d?.customerStory && typeof d.customerStory === "object" ? d.customerStory : null; }
  function weatherEmoji(kind) { return kind === "rainy" ? "🌧️" : kind === "cloudy" ? "☁️" : "☀️"; }
  function signed(value) { const x = Number(value) || 0; return `${x > 0 ? "+" : ""}${Math.round(x)}%`; }
  function timeGreeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
  function prettyDate(value) { try { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"}); } catch { return value; } }

  function ensure(id, className, after) {
    let el = $(id);
    if (el) return el;
    el = document.createElement("section");
    el.id = id;
    el.className = className;
    after?.insertAdjacentElement?.("afterend", el);
    return el;
  }

  function renderGreeting(d) {
    const anchor = $("publicStatus") || $("customerTabs") || document.querySelector(".site-header");
    if (!anchor) return;
    const card = ensure("customerVisitGreeting", "visit-greeting-card", anchor);
    const daily = Array.isArray(d?.stats?.daily30) ? d.stats.daily30.slice(-7) : [];
    const total = daily.reduce((sum,row)=>sum+n(row?.eggs),0);
    const avg = daily.length ? total / daily.length : n(d?.production?.dailyPace);
    const flockCount = Array.isArray(d?.flock) ? d.flock.length : 0;
    card.innerHTML = `<h2>🐔 ${esc(timeGreeting())} from Rose Family Poultry</h2><p>The flock has averaged <strong>${avg.toFixed(1)} eggs a day</strong>${daily.length ? ` over its last ${daily.length} logged days` : " recently"}. ${flockCount ? `There are ${flockCount} flock profiles to meet below.` : ""} Explore the flock and see how today's weather lines up with the farm's real laying history.</p>`;
  }

  function renderWeatherMatch(d) {
    const s = story(d), match = s?.todayMatch;
    const card = $("customerWeatherImpact");
    if (!card || !match) return;
    const range = n(match.low) === n(match.high) ? String(n(match.high)) : `${n(match.low)}–${n(match.high)}`;
    const temp = d?.weather?.high ?? d?.weather?.temperature;
    const weatherText = [match.band, match.kind].filter(Boolean).join(" ");
    const samples = n(match.samples);
    const sampleText = match.exact
      ? `Built from ${samples} comparable ${esc(match.matchLabel || "weather days")} in this flock's own history.`
      : `${samples ? `Only ${samples} close weather match${samples === 1 ? "" : "es"} so far, so ` : ""}Today's range leans more on the flock's recent laying pace.`;
    const factors = Array.isArray(d?.weatherInsights?.factors) ? d.weatherInsights.factors.slice(0,2) : [];
    const confidence = s?.confidence?.label || match.confidence || "Learning this weather pattern";
    card.innerHTML = `<div class="section-kicker">🌦️ Today's weather-matched egg outlook</div><div class="weather-match-hero"><div><h2>On days like today, the flock usually lays around <span>${range}</span> eggs.</h2><p>${temp != null ? `${Math.round(Number(temp))}° ` : ""}${esc(weatherText)} conditions. ${sampleText} This is an estimate from this farm's own history, not a guarantee.</p></div><div class="weather-match-badge">${weatherEmoji(match.kind)}<strong>${esc(confidence)}</strong></div></div>${factors.length ? `<div class="weather-story"><strong>What the farm history is showing</strong><div class="weather-impact-list">${factors.map(f=>`<div class="weather-impact-pill"><span>${esc(f.emoji || "🌦️")} ${esc(f.label || "Weather")}</span><strong>${signed(f.effect)}</strong><small>compared with similar laying days</small></div>`).join("")}</div></div>` : ""}<p class="weather-impact-note">These are correlations from Rose Family Poultry's own weather + laying logs. <a href="stats.html">See all egg stats →</a></p>`;
    const outlook = $("todayForecast"); if (outlook) outlook.textContent = range;
    const chip = $("forecastConfidence"); if (chip) chip.textContent = s?.confidence?.label || match.confidence || chip.textContent;
  }

  function renderEggTrail(d) {
    const daily = Array.isArray(story(d)?.daily14) ? story(d).daily14 : [];
    if (!daily.length) return;
    const anchor = $("customerWeatherImpact") || document.querySelector(".weather-card");
    if (!anchor) return;
    const section = ensure("customerEggTrail", "egg-trail-card", anchor);
    const max = Math.max(1,...daily.map(x=>n(x?.eggs)));
    const records = d?.stats?.records || {};
    const bars = daily.map((row,index)=>{
      const eggs = Math.max(0,Math.round(n(row?.eggs)));
      const h = Math.max(5,Math.round(eggs/max*100));
      const day = (()=>{try{return new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined,{weekday:"narrow"});}catch{return "";}})();
      const w = row?.weather || null;
      return `<button type="button" class="egg-trail-day" data-trail-index="${index}" aria-label="${esc(row.date)}: ${eggs} eggs${w ? `, ${w.kind}, ${w.temp} degrees` : ""}"><em>${w ? weatherEmoji(w.kind) : "·"}</em><i style="height:${h}%"></i><b>${eggs}</b><span>${esc(day)}</span></button>`;
    }).join("");
    section.innerHTML = `<div class="section-heading"><div><div class="section-kicker">🥚 Two weeks in the nest boxes</div><h2>A little look at the laying rhythm</h2></div><a class="tiny-link" href="stats.html">More stats →</a></div><div class="egg-trail-chart" aria-label="Eggs collected during the last 14 days">${bars}</div><div class="egg-trail-detail" id="eggTrailDetail">Tap a day to see its eggs and weather.</div><div class="egg-trail-records"><div><span>🏆 Best day</span><strong>${n(records?.bestDay?.eggs)} eggs</strong></div><div><span>🔥 Current streak</span><strong>${n(records?.streak)} days</strong></div><div><span>🥚 Farm lifetime</span><strong>${n(records?.lifetimeEggs)}</strong></div></div>`;
    section.querySelectorAll("[data-trail-index]").forEach(button=>button.addEventListener("click",()=>{
      const row = daily[Number(button.dataset.trailIndex)] || {};
      const eggs = n(row.eggs);
      const w = row.weather;
      const detail = $("eggTrailDetail");
      if (detail) detail.textContent = `${prettyDate(row.date)} • ${eggs} egg${eggs === 1 ? "" : "s"}${w ? ` • ${weatherEmoji(w.kind)} ${w.kind} • about ${Math.round(n(w.temp))}°F` : " • weather history unavailable for that day"}`;
    }));
  }

  function renderWeeklyStory(d) {
    const w = story(d)?.recentWeek;
    const anchor = $("customerEggTrail");
    if (!anchor || !w?.enough) return;
    const card = ensure("customerWeeklyStory", "weekly-story-card", anchor);
    const trend = w.priorEnough ? `${n(w.trend) >= 0 ? "up" : "down"} ${Math.abs(n(w.trend)).toFixed(1)}% from the prior week` : "the flock is still building a prior-week comparison";
    card.innerHTML = `<div class="section-kicker">🌿 This week at Rose Family Poultry</div><h2>${n(w.currentTotal)} eggs across the latest ${n(w.days)} logged days</h2><p>That's an average of ${n(w.currentAverage).toFixed(1)} eggs a day, and ${trend}.</p><div class="story-stats"><div><span>Latest logged week</span><strong>${n(w.currentTotal)} eggs</strong></div><div><span>Daily average</span><strong>${n(w.currentAverage).toFixed(1)}</strong></div><div><span>Dozen equivalent</span><strong>${n(w.dozens).toFixed(1)}</strong></div></div>`;
  }

  function renderWeatherTwin(d) {
    const twin = story(d)?.weatherTwin;
    const anchor = $("customerWeeklyStory") || $("customerEggTrail");
    if (!anchor || !twin) return;
    const card = ensure("customerWeatherTwin", "weather-twin-card", anchor);
    card.innerHTML = `<div class="section-kicker">🪞 Today's weather twin</div><h2>The closest past day like today was ${esc(prettyDate(twin.date))}</h2><p>It was about <strong>${Math.round(n(twin.temp))}°F</strong> and ${esc(twin.kind)}, and the flock laid <strong>${n(twin.eggs)} eggs</strong>. ${twin.exactKind ? "The sky condition matched today too." : "The temperature was the closest match, though the sky condition was different."}</p>`;
  }

  function renderWeatherExplorer(d) {
    const s = story(d), groups = s?.weatherGroups;
    const anchor = $("customerWeatherTwin") || $("customerWeeklyStory") || $("customerEggTrail");
    if (!anchor || !groups) return;
    let box = $("customerWeatherExplorer");
    if (!box) { box = document.createElement("details"); box.id="customerWeatherExplorer"; box.className="weather-explorer-card"; anchor.insertAdjacentElement("afterend",box); }
    const all = [...(Array.isArray(groups.sky)?groups.sky:[]),...(Array.isArray(groups.temp)?groups.temp:[])];
    const rows = all.map(g=>`<div class="weather-group"><span>${esc(String(g.key||"").replace(/^./,x=>x.toUpperCase()))} • ${n(g.samples)} days</span><strong>~${n(g.projected)} eggs</strong><small>${signed(g.effect)} vs the flock's nearby laying baseline</small></div>`).join("");
    const score = s?.forecastScore || {};
    const scoreText = n(score.days) > 0 ? `Back-test: ${n(score.days)} past days • average miss ${n(score.mae).toFixed(1)} eggs • ${n(score.within2)}% landed within 2 eggs.` : "The forecast scorecard will appear after enough comparable weather days are logged.";
    box.innerHTML = `<summary>🌦️ Explore how different weather has lined up with laying</summary><div class="weather-explorer-body"><div class="weather-group-grid">${rows || "<p>The flock is still building enough weather history for categories.</p>"}</div><div class="forecast-score">${esc(scoreText)} These are observed relationships, not proof that weather caused the change.</div></div>`;
  }

  function renderMilestone(d) {
    const lifetime = Math.max(0,Math.round(n(d?.stats?.records?.lifetimeEggs)));
    if (!lifetime) return;
    const anchor = $("customerWeatherExplorer") || $("customerWeatherTwin") || $("customerWeeklyStory");
    if (!anchor) return;
    const next = Math.max(1000,Math.ceil((lifetime + 1)/1000)*1000);
    const start = Math.max(0,next-1000);
    const progress = Math.max(0,Math.min(100,((lifetime-start)/(next-start))*100));
    const remaining = Math.max(0,next-lifetime);
    const card = ensure("customerMilestone", "milestone-card", anchor);
    card.innerHTML = `<div class="section-kicker">🎉 Egg milestone watch</div><h2>${lifetime.toLocaleString()} eggs logged and counting</h2><p>${remaining ? `${remaining.toLocaleString()} more eggs until the ${next.toLocaleString()}-egg milestone.` : `The flock just reached ${next.toLocaleString()} eggs!`}</p><div class="milestone-track" aria-label="${Math.round(progress)} percent toward the next egg milestone"><i style="width:${progress}%"></i></div>`;
  }

  function clean(value) { return String(value ?? "").trim(); }
  function flockFacts(d) {
    const flock = Array.isArray(d?.flock) ? d.flock.filter(Boolean) : [];
    if (!flock.length) return [];
    const hens = flock.filter(b=>["Hen","Pullet"].includes(clean(b?.sex))).length;
    const roosters = flock.filter(b=>["Rooster","Cockerel"].includes(clean(b?.sex))).length;
    const breeds = new Map(); flock.forEach(b=>{const breed=clean(b?.breed)||"Unknown breed";breeds.set(breed,(breeds.get(breed)||0)+1);});
    const facts = [`🐔 The public flock currently has ${flock.length} profile${flock.length===1?"":"s"} to explore.`];
    if (hens || roosters) facts.push(`🥚 Among the public profiles, there are ${hens} hens/pullets and ${roosters} roosters/cockerels.`);
    if (breeds.size) facts.push(`🪶 The public flock represents ${breeds.size} different breed${breeds.size===1?"":"s"} or crosses.`);
    const top=[...breeds.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]; if(top&&top[1]>1)facts.push(`⭐ ${top[0]} is the most represented breed/cross in the public flock right now, with ${top[1]} birds.`);
    const dated=flock.map(b=>({b,date:/^\d{4}-\d{2}-\d{2}$/.test(clean(b?.hatchDate))?new Date(`${b.hatchDate}T12:00:00`):null})).filter(x=>x.date&&!Number.isNaN(x.date.getTime())).sort((a,b)=>a.date-b.date); if(dated.length)facts.push(`🎂 ${clean(dated[0].b?.name)||"One flock member"} has the earliest listed hatch date in the public flock: ${dated[0].date.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}.`);
    return facts;
  }
  function funFacts() { const deck=window.CustomerChickenFactsV1?.facts?.(); return Array.isArray(deck)?deck.filter(Boolean).map(String):[]; }
  function factDeck(d,mode=factMode) { const flock=flockFacts(d),fun=funFacts(); return mode==="flock"?(flock.length?flock:fun):(fun.length?fun:flock); }
  function updateFactSwitch() { document.querySelectorAll("[data-fact-mode]").forEach(b=>{const active=b.dataset.factMode===factMode;b.classList.toggle("active",active);b.setAttribute("aria-pressed",active?"true":"false");}); }
  function renderFact(next=false) {
    const d=data(), deck=factDeck(d); if(!deck.length)return;
    if(next)factIndexes[factMode]=(factIndexes[factMode]+1)%deck.length;
    const index=Math.abs(n(factIndexes[factMode]))%deck.length;
    const text=$("factText"),title=$("factTitle"),button=$("nextFact"),emoji=document.querySelector(".fact-card .fact-emoji");
    if(text)text.textContent=deck[index]; if(title)title.textContent=factMode==="flock"?"A fact about this flock":"Chicken fact of the visit"; if(button)button.textContent=factMode==="flock"?"Another flock fact 🐔":"Another fun fact ✨"; if(emoji)emoji.textContent=factMode==="flock"?"🐔🥚":"💡🐓"; updateFactSwitch();
  }
  function installFacts() {
    const copy=document.querySelector(".fact-card .fact-copy"),button=$("nextFact"); if(!copy||!button)return;
    if(!$("customerFactModeSwitch")){const sw=document.createElement("div");sw.id="customerFactModeSwitch";sw.className="fact-mode-switch";sw.setAttribute("role","group");sw.setAttribute("aria-label","Choose fact type");sw.innerHTML='<button type="button" data-fact-mode="fun" aria-pressed="true">💡 Fun facts</button><button type="button" data-fact-mode="flock" aria-pressed="false">🐔 Flock facts</button>';copy.appendChild(sw);sw.querySelectorAll("[data-fact-mode]").forEach(b=>b.addEventListener("click",()=>{factMode=b.dataset.factMode;renderFact(false);}));}
    if(!installedFactButton){installedFactButton=true;button.addEventListener("click",event=>{event.stopImmediatePropagation();renderFact(true);},true);} renderFact(false);
  }

  function installSurprise(d) {
    const copy=document.querySelector(".celebrity-copy"); if(!copy||$("surpriseFlockMember"))return;
    const button=document.createElement("button");button.type="button";button.id="surpriseFlockMember";button.className="surprise-flock";button.textContent="🐔 Meet another flock member";button.addEventListener("click",()=>{const flock=Array.isArray(data()?.flock)?data().flock:[];if(!flock.length)return;surpriseIndex=(surpriseIndex+1)%flock.length;const bird=flock[surpriseIndex];window.CustomerViewPublic?.openProfile?.(bird.id);});copy.appendChild(button);
  }

  function renderAll() {
    const d=data(); if(!d)return false;
    renderGreeting(d);renderWeatherMatch(d);renderEggTrail(d);renderWeeklyStory(d);renderWeatherTwin(d);renderWeatherExplorer(d);renderMilestone(d);installFacts();installSurprise(d);return true;
  }
  function start(){if(!renderAll())setTimeout(renderAll,250);window.addEventListener("customer-view-rendered",()=>setTimeout(renderAll,0));}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();

  window.CustomerViewDelightV1={version:1,render:renderAll,flockFacts,funFacts,firebaseReads:0,firebaseWrites:0,networkCalls:0};
})();
