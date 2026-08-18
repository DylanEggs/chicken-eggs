(() => {
  "use strict";
  if (window.FarmPublicCustomerBuilderV1) return;

  const n=v=>Number(v)||0;
  const whole=v=>Math.max(0,Math.round(n(v)));
  const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch{return v;}};
  function localDate(d=new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function addDays(date,amount){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+amount);return localDate(d);}
  const avg=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  function ageText(date){
    if(!date)return "Age unknown";
    const born=new Date(String(date)+"T12:00:00");
    if(Number.isNaN(born.getTime()))return "Age unknown";
    const days=Math.max(0,Math.floor((Date.now()-born.getTime())/86400000));
    if(days<14)return `${days} days old`;
    if(days<112)return `${Math.floor(days/7)} weeks old`;
    const months=Math.floor(days/30.44);
    if(months<24)return `${months} months old`;
    return `${Math.floor(months/12)}y ${months%12}m old`;
  }
  function imageValue(value){return typeof value==="string"&&(value.startsWith("data:image/")||/^https?:\/\//i.test(value))?value:"";}
  function weatherCode(code){
    const c=Number(code);
    if(c===0)return {emoji:"☀️",text:"Clear"};
    if(c===1)return {emoji:"🌤️",text:"Mainly clear"};
    if(c===2)return {emoji:"⛅",text:"Partly cloudy"};
    if(c===3)return {emoji:"☁️",text:"Overcast"};
    if([45,48].includes(c))return {emoji:"🌫️",text:"Foggy"};
    if([51,53,55,56,57].includes(c))return {emoji:"🌦️",text:"Drizzle"};
    if([61,63,65,66,67].includes(c))return {emoji:"🌧️",text:"Rain"};
    if([71,73,75,77].includes(c))return {emoji:"🌨️",text:"Snow"};
    if([80,81,82].includes(c))return {emoji:"🌦️",text:"Rain showers"};
    if([85,86].includes(c))return {emoji:"🌨️",text:"Snow showers"};
    if([95,96,99].includes(c))return {emoji:"⛈️",text:"Thunderstorms"};
    return {emoji:"🌤️",text:"Weather"};
  }
  function eggMap(entries){
    const map={};
    for(const e of Array.isArray(entries)?entries:[]){
      if(e?.type!=="eggs"||!e.date)continue;
      const date=String(e.date).slice(0,10);
      map[date]=(map[date]||0)+whole(e.eggs);
    }
    return map;
  }
  function production(entries,settings){
    const map=eggMap(entries),today=localDate();
    const allDates=Object.keys(map).filter(d=>d<=today).sort();
    const recentCutoff=addDays(today,-21);
    let recentDates=allDates.filter(d=>d>=recentCutoff).slice(-7);
    if(recentDates.length<3)recentDates=allDates.slice(-7);
    const recentValues=recentDates.map(d=>whole(map[d]));
    const last3Values=recentValues.slice(-3);
    const recentAvg=avg(recentValues),last3Avg=avg(last3Values),lifetimeAvg=allDates.length?avg(allDates.map(d=>whole(map[d]))):0;
    let daily=recentAvg||lifetimeAvg||0;
    if(recentValues.length>=3){
      const accelerating=recentAvg>0&&last3Avg>recentAvg*1.15;
      daily=accelerating?last3Avg*.70+recentAvg*.30:last3Avg*.55+recentAvg*.45;
    }
    const now=new Date();now.setHours(12,0,0,0);
    const weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());
    const weekStartKey=localDate(weekStart);
    const weekCollected=allDates.filter(d=>d>=weekStartKey&&d<=today).reduce((s,d)=>s+whole(map[d]),0);
    const elapsedWeekDays=now.getDay()+1,remainingWeekDays=Math.max(0,7-elapsedWeekDays);
    const observedWeekPace=weekCollected>0?weekCollected/elapsedWeekDays:0;
    if(observedWeekPace>daily){const weight=Math.min(.65,.25+elapsedWeekDays*.07);daily=daily*(1-weight)+observedWeekPace*weight;}
    const hens=Math.max(0,n(settings?.hens)),recentMax=recentValues.length?Math.max(...recentValues):0;
    if(hens>0&&recentMax<=hens*1.20)daily=Math.min(daily,hens);
    daily=Math.max(0,daily);
    const predictedWeek=Math.max(weekCollected,Math.round(weekCollected+daily*remainingWeekDays));
    const monthPrefix=today.slice(0,7);
    const monthCollected=allDates.filter(d=>d.startsWith(monthPrefix)).reduce((s,d)=>s+whole(map[d]),0);
    const yearNumber=Number(today.slice(0,4)),monthIndex=Number(today.slice(5,7))-1,dayOfMonth=Number(today.slice(8,10));
    const daysInMonth=new Date(yearNumber,monthIndex+1,0).getDate(),remainingMonthDays=Math.max(0,daysInMonth-dayOfMonth);
    const predictedMonth=Math.max(monthCollected,Math.round(monthCollected+daily*remainingMonthDays));
    const yearPrefix=String(yearNumber),yearCollected=allDates.filter(d=>d.startsWith(yearPrefix)).reduce((s,d)=>s+whole(map[d]),0);
    const current=new Date(`${today}T12:00:00`),end=new Date(yearNumber,11,31,12,0,0,0);
    const remainingYearDays=Math.max(0,Math.round((end-current)/86400000));
    const predictedYear=Math.max(yearCollected,Math.round(yearCollected+daily*remainingYearDays));
    const todayCollected=whole(map[today]);
    const todayLow=daily?Math.max(todayCollected,Math.round(daily*.85)):todayCollected;
    const todayHigh=daily?Math.max(todayLow,todayCollected,Math.round(daily*1.15)):todayCollected;
    return {todayCollected,todayLow,todayHigh,dailyPace:Math.round(daily*10)/10,weekCollected,predictedWeek,monthCollected,predictedMonth,year:yearNumber,yearCollected,predictedYear,confidence:recentDates.length>=7?"Strong recent data":recentDates.length>=4?"Building recent data":"Learning the flock"};
  }
  function safeWeather(state){
    state=state&&typeof state==="object"?state:{};
    const today=localDate(),f=state.forecast?.[today]||{},c=state.current||{},cond=weatherCode(c.code??f.code);
    return {location:String(state.label||state.location||"High Point, NC").trim()||"High Point, NC",emoji:cond.emoji,condition:cond.text,temperature:Number.isFinite(Number(c.temperature))?Math.round(Number(c.temperature)):null,feelsLike:Number.isFinite(Number(c.apparent))?Math.round(Number(c.apparent)):null,high:Number.isFinite(Number(f.max))?Math.round(Number(f.max)):null,low:Number.isFinite(Number(f.min))?Math.round(Number(f.min)):null,rainChance:Number.isFinite(Number(f.precipProbability))?Math.round(Number(f.precipProbability)):null,humidity:Number.isFinite(Number(c.humidity))?Math.round(Number(c.humidity)):null,updatedAt:whole(state.lastRefreshAt||state.updatedAt)};
  }
  function publicFlock(app2,photoResolver){
    const hidden=/^(sold|removed|rehomed|deceased|inactive)$/i;
    return (Array.isArray(app2?.flock)?app2.flock:[]).filter(b=>b&&!hidden.test(String(b.status||"Active").trim())).map(b=>{
      const id=String(b.id||"");
      return {id,name:String(b.name||"Chicken").trim()||"Chicken",breed:String(b.breed||"Breed not listed").trim()||"Breed not listed",sex:String(b.sex||"Unknown").trim()||"Unknown",hatchDate:/^\d{4}-\d{2}-\d{2}$/.test(String(b.hatchDate||""))?String(b.hatchDate):"",age:ageText(b.hatchDate),photo:imageValue(photoResolver?.(id)||"")};
    });
  }
  function availability(inventory,app2){
    const physical=whole(inventory?.dozens)*12+whole(inventory?.packs18)*18+whole(inventory?.loose);
    const reserved=(Array.isArray(app2?.orders)?app2.orders:[]).filter(o=>o?.status==="pending").reduce((s,o)=>s+whole(o.dozen)*12+whole(o.packs18)*18,0);
    const eggs=Math.max(0,physical-reserved);
    let label="Plenty available",tone="good";
    if(eggs===0){label="Currently spoken for";tone="none";}else if(eggs<12){label="A few available";tone="low";}else if(eggs<36){label="Limited availability";tone="medium";}
    return {eggs,dozenEquivalent:Math.floor(eggs/12),remainder:eggs%12,label,tone,updatedAt:whole(inventory?.updatedAt)};
  }
  function dailyBird(flock,deluxe){
    if(!flock.length)return null;
    const today=localDate();
    if(deluxe?.photoOverrideDate===today&&deluxe?.photoOverrideBirdId){const selected=flock.find(b=>b.id===String(deluxe.photoOverrideBirdId));if(selected)return selected;}
    const seed=today.replace(/-/g,"").split("").reduce((a,b)=>a+n(b),0);
    return flock[seed%flock.length];
  }
  function build(input={}){
    const app2=input.app2&&typeof input.app2==="object"?input.app2:{};
    const inventory=input.inventory&&typeof input.inventory==="object"?input.inventory:{};
    const entries=Array.isArray(input.entries)?input.entries:[];
    const settings=input.settings&&typeof input.settings==="object"?input.settings:{};
    const weather=safeWeather(input.weather);
    const flock=publicFlock(app2,input.photoResolver);
    const featured=dailyBird(flock,input.deluxe||{});
    const summary={schema:"customer-public-v1",farm:{name:String(settings.farmName||"Rose Family Poultry").trim()||"Rose Family Poultry",location:weather.location},availability:availability(inventory,app2),production:production(entries,settings),weather,chickenOfTheDayId:featured?.id||"",flockIds:flock.map(b=>b.id),flockCount:flock.length};
    return {summary:clone(summary),flock:clone(flock)};
  }
  window.FarmPublicCustomerBuilderV1={version:1,build};
})();
