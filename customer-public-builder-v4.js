(() => {
  "use strict";
  if (window.FarmPublicCustomerBuilderV4) return;

  const n=v=>Number(v)||0;
  const finite=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
  const median=values=>{const a=values.filter(finite).map(Number).sort((a,b)=>a-b);if(!a.length)return null;const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
  const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const addDays=(date,days)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return localDate(d);};
  const pct=(now,prior)=>prior>0?((now-prior)/prior)*100:(now>0?100:0);

  function eggMap(entries){
    const map={};
    for(const e of Array.isArray(entries)?entries:[]){
      if(e?.type!=="eggs"||!e.date)continue;
      const date=String(e.date).slice(0,10);
      map[date]=(map[date]||0)+Math.max(0,Math.round(n(e.eggs)));
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
  function weatherHistory(input={}){return input?.weather&&typeof input.weather==="object"&&input.weather.history&&typeof input.weather.history==="object"?input.weather.history:{};}
  function historyKind(w={}){if(n(w.rain??w.precip)>=.05||n(w.rainHours)>=2||n(w.precipProbability)>=60)return"rainy";if(finite(w.cloud)&&n(w.cloud)>=65)return"cloudy";return"sunny";}
  function tempBand(temp){const t=Number(temp);if(t>=90)return"hot";if(t>=80)return"warm";if(t>=66)return"mild";if(t>=52)return"cool";return"cold";}
  function todayKind(summary={}){const w=summary.weather||{},text=String(w.condition||"").toLowerCase();if(/rain|storm|drizzle|shower|thunder/.test(text)||n(w.rainChance)>=60)return"rainy";if(/cloud|overcast|fog/.test(text))return"cloudy";return"sunny";}
  function todayTemp(summary={}){const w=summary.weather||{};return finite(w.high)?Number(w.high):finite(w.temperature)?Number(w.temperature):null;}
  function recentPace(map){const today=localDate();const values=Object.entries(map).filter(([date,v])=>date<today&&finite(v)).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).map(([,v])=>Number(v));return median(values)||0;}
  function normalizedRows(entries,input){
    const map=eggMap(entries),history=weatherHistory(input),rows=[];
    for(const [date,w] of Object.entries(history)){
      if(!finite(map[date])||!finite(w?.max))continue;
      const base=localBaseline(date,map);if(!base||base<=0)continue;
      rows.push({date,eggs:Number(map[date]),ratio:Math.max(.5,Math.min(1.5,Number(map[date])/base)),kind:historyKind(w),band:tempBand(w.max),temp:Number(w.max)});
    }
    return {map,history,rows};
  }
  function groupSummary(rows,key,value,pace){
    const list=rows.filter(r=>r[key]===value),ratios=list.map(r=>r.ratio).filter(finite),ratio=median(ratios);
    if(list.length<3||ratio==null||!pace)return null;
    return {key:value,samples:list.length,projected:Math.max(0,Math.round(pace*ratio)),effect:Math.round((ratio-1)*100)};
  }
  function weatherGroups(rows,pace){
    return {
      sky:["sunny","cloudy","rainy"].map(x=>groupSummary(rows,"kind",x,pace)).filter(Boolean),
      temp:["hot","warm","mild","cool","cold"].map(x=>groupSummary(rows,"band",x,pace)).filter(Boolean)
    };
  }
  function matchedPrediction(summary,rows,map){
    const temp=todayTemp(summary),band=temp==null?null:tempBand(temp),kind=todayKind(summary),base=recentPace(map)||Number(summary?.production?.dailyPace)||0;
    let matches=band?rows.filter(r=>r.band===band&&r.kind===kind):[];
    let matchLabel=band?`${band} + ${kind}`:kind,confidence="Strong match";
    if(matches.length<4&&band){matches=rows.filter(r=>r.band===band);matchLabel=`${band} days`;confidence="Broader weather match";}
    if(matches.length<4){matches=rows.filter(r=>r.kind===kind);matchLabel=`${kind} days`;confidence="Broader weather match";}
    if(matches.length<4||!base){const pace=Math.max(0,Number(summary?.production?.dailyPace)||base||0),low=Math.max(0,Math.round(pace*.85)),high=Math.max(low,Math.round(pace*1.15));return {low,high,samples:matches.length,kind,band,matchLabel:"recent flock pace",confidence:"Still learning similar weather",exact:false};}
    const projected=matches.map(r=>r.ratio*base).sort((a,b)=>a-b),q=p=>projected[Math.max(0,Math.min(projected.length-1,Math.floor((projected.length-1)*p)))];
    const low=Math.max(0,Math.round(q(.2))),high=Math.max(low,Math.round(q(.8)));
    return {low,high,samples:matches.length,kind,band,matchLabel,confidence,exact:true};
  }
  function weatherTwin(summary,history,map){
    const temp=todayTemp(summary),kind=todayKind(summary),today=localDate(),rows=[];
    for(const [date,w] of Object.entries(history)){
      if(date>=today||!finite(map[date])||!finite(w?.max))continue;
      const rowKind=historyKind(w),tempDiff=temp==null?0:Math.abs(Number(w.max)-temp),kindPenalty=rowKind===kind?0:12,ageDays=Math.max(0,(new Date(`${today}T12:00:00`)-new Date(`${date}T12:00:00`))/86400000);
      rows.push({date,kind:rowKind,temp:Math.round(Number(w.max)),eggs:Math.round(Number(map[date])),score:kindPenalty+tempDiff+Math.min(8,ageDays/90)});
    }
    if(!rows.length)return null;rows.sort((a,b)=>a.score-b.score||b.date.localeCompare(a.date));const best=rows[0];return {date:best.date,kind:best.kind,temp:best.temp,eggs:best.eggs,exactKind:best.kind===kind};
  }
  function confidence(summary,history,map){
    const kind=todayKind(summary),temp=todayTemp(summary),today=localDate();let count=0,closeCount=0;
    for(const [date,w] of Object.entries(history)){
      if(date>=today||!Object.prototype.hasOwnProperty.call(map,date)||!finite(w?.max)||historyKind(w)!==kind)continue;
      count++;if(temp==null||Math.abs(Number(w.max)-temp)<=8)closeCount++;
    }
    const effective=closeCount||count;
    if(effective>=8)return {level:"strong",label:`Based on ${effective} similar days`,samples:effective};
    if(effective>=4)return {level:"good",label:`Based on ${effective} similar days`,samples:effective};
    if(effective>=1)return {level:"early",label:`Early estimate • ${effective} similar day${effective===1?"":"s"}`,samples:effective};
    return {level:"learning",label:"Learning this weather pattern",samples:0};
  }
  function weeklyStory(summary={}){
    const daily=Array.isArray(summary?.stats?.daily30)?summary.stats.daily30.filter(x=>x?.date).slice(-14):[],current=daily.slice(-7),prior=daily.slice(-14,-7);
    const sum=list=>list.reduce((s,x)=>s+Math.max(0,n(x?.eggs)),0),currentTotal=sum(current),priorTotal=sum(prior),avg=current.length?currentTotal/current.length:0;
    return {days:current.length,currentTotal,priorTotal,currentAverage:Math.round(avg*10)/10,trend:Math.round(pct(currentTotal,priorTotal)*10)/10,dozens:Math.round(currentTotal/12*10)/10,priorEnough:prior.length>=4,enough:current.length>=4};
  }
  function dailyTrail(summary,history){
    return (Array.isArray(summary?.stats?.daily30)?summary.stats.daily30.slice(-14):[]).map(row=>{const w=history?.[row.date]||null;return {date:String(row.date||""),eggs:Math.max(0,Math.round(n(row.eggs))),weather:w&&finite(w.max)?{kind:historyKind(w),temp:Math.round(Number(w.max))}:null};});
  }
  function backtest(entries,input){
    const map=eggMap(entries),history=weatherHistory(input),dates=Object.keys(map).filter(d=>history[d]&&finite(history[d]?.max)).sort((a,b)=>b.localeCompare(a)).slice(0,45),rows=[];
    for(const date of dates){
      const w=history[date],base=localBaseline(date,map);if(!base||base<=0)continue;const temp=Number(w.max),kind=historyKind(w),ratios=[];
      for(const [other,ow] of Object.entries(history)){
        if(other===date||!map[other]||!finite(ow?.max)||historyKind(ow)!==kind||Math.abs(Number(ow.max)-temp)>12)continue;
        const ob=localBaseline(other,map);if(!ob||ob<=0)continue;ratios.push(Math.max(.5,Math.min(1.5,map[other]/ob)));
      }
      if(ratios.length<4)continue;const predicted=Math.max(0,Math.round(base*median(ratios))),actual=map[date],error=Math.abs(predicted-actual);rows.push({error});if(rows.length>=20)break;
    }
    if(!rows.length)return {days:0,mae:null,within2:null};const mae=rows.reduce((s,x)=>s+n(x.error),0)/rows.length,within2=rows.filter(x=>n(x.error)<=2).length/rows.length*100;return {days:rows.length,mae:Math.round(mae*10)/10,within2:Math.round(within2)};
  }
  function build(input={}){
    const base=window.FarmPublicCustomerBuilderV3||window.FarmPublicCustomerBuilderV2;
    if(!base?.build)throw new Error("Public customer builder v2+ is required before v4");
    const out=base.build(input),entries=Array.isArray(input.entries)?input.entries:[],norm=normalizedRows(entries,input),pace=recentPace(norm.map)||Number(out.summary?.production?.dailyPace)||0;
    out.summary.publicVersion=4;
    out.summary.customerStory={
      generatedAt:Date.now(),
      recentWeek:weeklyStory(out.summary),
      daily14:dailyTrail(out.summary,norm.history),
      weatherGroups:weatherGroups(norm.rows,pace),
      todayMatch:matchedPrediction(out.summary,norm.rows,norm.map),
      weatherTwin:weatherTwin(out.summary,norm.history,norm.map),
      confidence:confidence(out.summary,norm.history,norm.map),
      forecastScore:backtest(entries,input)
    };
    return out;
  }

  window.FarmPublicCustomerBuilderV4={version:4,build,eggMap,localBaseline,historyKind,tempBand,normalizedRows,weatherGroups,matchedPrediction,weatherTwin,confidence,weeklyStory,dailyTrail,backtest};
})();
