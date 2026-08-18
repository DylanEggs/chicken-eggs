(() => {
  "use strict";
  if (window.FarmPublicCustomerBuilderV2) return;

  const n=v=>Number(v)||0;
  const whole=v=>Math.max(0,Math.round(n(v)));
  const finite=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const mean=values=>{const a=values.filter(finite).map(Number);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;};
  const median=values=>{const a=values.filter(finite).map(Number).sort((a,b)=>a-b);if(!a.length)return null;const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
  const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  function addDays(date,days){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return localDate(d);}
  function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
  function weekStart(date){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()-d.getDay());return localDate(d);}

  function eggMap(entries){
    const map={};
    for(const e of Array.isArray(entries)?entries:[]){
      if(e?.type!=="eggs"||!e.date)continue;
      const date=String(e.date).slice(0,10);
      map[date]=(map[date]||0)+whole(e.eggs);
    }
    return map;
  }

  function currentStreak(map){
    const dates=new Set(Object.keys(map).filter(d=>whole(map[d])>0));
    if(!dates.size)return 0;
    let cursor=localDate();
    if(!dates.has(cursor)){
      const y=addDays(cursor,-1);
      if(!dates.has(y))return 0;
      cursor=y;
    }
    let count=0;
    while(dates.has(cursor)){count++;cursor=addDays(cursor,-1);}
    return count;
  }

  function stats(entries){
    const map=eggMap(entries),today=localDate();
    const daily30=[];
    for(let i=29;i>=0;i--){const date=addDays(today,-i);daily30.push({date,eggs:whole(map[date])});}

    const weekly8=[];
    const thisWeek=weekStart(today);
    for(let i=7;i>=0;i--){
      const start=addDays(thisWeek,-7*i);let eggs=0;
      for(let d=0;d<7;d++)eggs+=whole(map[addDays(start,d)]);
      weekly8.push({start,eggs});
    }

    const monthly12=[];
    const now=new Date(`${today}T12:00:00`);
    for(let i=11;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1,12,0,0,0);const month=monthKey(d);
      const eggs=Object.entries(map).filter(([date])=>date.startsWith(month)).reduce((s,[,v])=>s+whole(v),0);
      monthly12.push({month,eggs});
    }

    const dailyRows=Object.entries(map).map(([date,eggs])=>({date,eggs:whole(eggs)})).sort((a,b)=>a.date.localeCompare(b.date));
    const weekTotals={};const monthTotals={};
    for(const row of dailyRows){
      const wk=weekStart(row.date);weekTotals[wk]=(weekTotals[wk]||0)+row.eggs;
      const mo=row.date.slice(0,7);monthTotals[mo]=(monthTotals[mo]||0)+row.eggs;
    }
    const best=(rows,key)=>rows.reduce((a,b)=>!a||b.eggs>a.eggs?b:a,null);
    const bestDay=best(dailyRows);
    const bestWeek=best(Object.entries(weekTotals).map(([start,eggs])=>({start,eggs})));
    const bestMonth=best(Object.entries(monthTotals).map(([month,eggs])=>({month,eggs})));
    const lifetimeEggs=dailyRows.reduce((s,r)=>s+r.eggs,0);
    const averageLoggedDay=dailyRows.length?Math.round((lifetimeEggs/dailyRows.length)*10)/10:0;

    return {
      daily30,weekly8,monthly12,
      records:{
        lifetimeEggs,
        averageLoggedDay,
        streak:currentStreak(map),
        bestDay:bestDay||{date:"",eggs:0},
        bestWeek:bestWeek||{start:"",eggs:0},
        bestMonth:bestMonth||{month:"",eggs:0}
      }
    };
  }

  function isRainy(w){return n(w?.rain??w?.precip)>=0.05||n(w?.rainHours)>=2||n(w?.precipProbability)>=60;}
  function localBaseline(date,map){
    const target=new Date(`${date}T12:00:00`).getTime();
    const near=Object.entries(map).filter(([d,v])=>d!==date&&finite(v)).map(([d,v])=>({v:Number(v),dist:Math.abs((new Date(`${d}T12:00:00`).getTime()-target)/86400000)})).filter(x=>x.dist<=14).sort((a,b)=>a.dist-b.dist).slice(0,12).map(x=>x.v);
    if(near.length>=5)return median(near);
    const prior=Object.entries(map).filter(([d,v])=>d<date&&finite(v)).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).map(([,v])=>Number(v));
    return prior.length>=4?median(prior):null;
  }
  function normalizedWeatherRows(entries,weather){
    const map=eggMap(entries),history=weather&&typeof weather==="object"&&weather.history&&typeof weather.history==="object"?weather.history:{};
    const dates=Object.keys(map).sort();const recentCut=dates.length>130?dates[dates.length-130]:"";const rows=[];
    for(const date of dates){
      if(recentCut&&date<recentCut)continue;
      const w=history[date];if(!w||!finite(w.max))continue;
      const baseline=localBaseline(date,map);if(!baseline||baseline<=0)continue;
      rows.push({date,eggs:whole(map[date]),ratio:clamp(whole(map[date])/baseline,.45,1.65),max:finite(w.max)?Number(w.max):null,humidity:finite(w.humidity)?Number(w.humidity):null,cloud:finite(w.cloud)?Number(w.cloud):null,rain:finite(w.rain)?Number(w.rain):null,precip:finite(w.precip)?Number(w.precip):null,rainHours:finite(w.rainHours)?Number(w.rainHours):null,precipProbability:finite(w.precipProbability)?Number(w.precipProbability):null});
    }
    return rows;
  }
  function factor(rows,label,emoji,predicate,counterpart=r=>!predicate(r)){
    const yes=rows.filter(predicate),no=rows.filter(counterpart);if(yes.length<5||no.length<7)return null;
    const ya=mean(yes.map(r=>r.ratio)),na=mean(no.map(r=>r.ratio));if(!ya||!na)return null;
    return {label,emoji,effect:Math.round((ya/na-1)*1000)/10,withDays:yes.length,comparisonDays:no.length};
  }
  function weatherInsights(entries,weather){
    const rows=normalizedWeatherRows(entries,weather);
    const factors=[
      factor(rows,"Rainy days","🌧️",r=>isRainy(r),r=>!isRainy(r)),
      factor(rows,"90°F+ days","🥵",r=>n(r.max)>=90,r=>n(r.max)<88),
      factor(rows,"Humid days","💧",r=>finite(r.humidity)&&n(r.humidity)>=75,r=>finite(r.humidity)&&n(r.humidity)<70),
      factor(rows,"Cloudy days","☁️",r=>finite(r.cloud)&&n(r.cloud)>=70,r=>finite(r.cloud)&&n(r.cloud)<45)
    ].filter(Boolean).sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect));

    const map=eggMap(entries),today=new Date(`${localDate()}T12:00:00`),recentStart=new Date(today),priorStart=new Date(today);recentStart.setDate(recentStart.getDate()-30);priorStart.setDate(priorStart.getDate()-60);
    const recent=[],prior=[];
    for(const [date,value] of Object.entries(map)){
      const d=new Date(`${date}T12:00:00`);
      if(d>=recentStart&&d<today)recent.push(Number(value));else if(d>=priorStart&&d<recentStart)prior.push(Number(value));
    }
    const ra=mean(recent),pa=mean(prior);const productionTrend=ra!==null&&pa!==null&&pa>0&&recent.length>=10&&prior.length>=10?{recentAverage:Math.round(ra*10)/10,priorAverage:Math.round(pa*10)/10,change:Math.round((ra/pa-1)*1000)/10,recentDays:recent.length,priorDays:prior.length}:null;
    return {samples:rows.length,factors:factors.slice(0,4),productionTrend};
  }

  function build(input={}){
    const base=window.FarmPublicCustomerBuilderV1;
    if(!base?.build)throw new Error("Public customer builder v1 is required before v2");
    const out=base.build(input);
    out.summary.publicVersion=2;
    out.summary.stats=stats(input.entries||[]);
    out.summary.weatherInsights=weatherInsights(input.entries||[],input.weather||{});
    return out;
  }

  window.FarmPublicCustomerBuilderV2={version:2,build,stats,weatherInsights};
})();
