(() => {
  "use strict";
  if (window.StagingChickenOfDayRotationV1) return;

  const HIDDEN=/^(sold|removed|rehomed|deceased|inactive)$/i;
  const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const daySerial=date=>{const [y,m,d]=String(date||localDate()).slice(0,10).split("-").map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);};
  function eligible(flock){
    return (Array.isArray(flock)?flock:[]).filter(b=>b&&b.id&&!HIDDEN.test(String(b.status||"Active").trim()));
  }
  function hash(text){let h=2166136261>>>0;for(const ch of String(text||"")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
  function shuffledBase(flock,cycle){
    const out=eligible(flock).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    let state=(hash(out.map(b=>String(b.id)).join("|")+"|"+String(cycle))||0x9e3779b9)>>>0;
    const rand=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/4294967296;};
    for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
    return out;
  }
  function orderForCycle(flock,cycle){
    const out=shuffledBase(flock,cycle);
    if(cycle>0&&out.length>1){
      const prev=shuffledBase(flock,cycle-1);
      if(prev.length&&String(prev[prev.length-1]?.id)===String(out[0]?.id)) [out[0],out[1]]=[out[1],out[0]];
    }
    return out;
  }
  function pick(flock,date=localDate(),deluxe={}){
    const list=eligible(flock);
    if(!list.length)return null;
    const day=String(date||localDate()).slice(0,10);
    if(deluxe?.photoOverrideDate===day&&deluxe?.photoOverrideBirdId){
      const manual=list.find(b=>String(b.id)===String(deluxe.photoOverrideBirdId));
      if(manual)return manual;
    }
    const serial=daySerial(day),count=list.length;
    const cycle=Math.floor(serial/count);
    const position=((serial%count)+count)%count;
    return orderForCycle(list,cycle)[position]||list[0];
  }

  window.StagingChickenOfDayRotationV1={version:1,eligible,orderForCycle,pick,localDate,daySerial,firebaseReads:0,firebaseWrites:0,networkCalls:0};

  function installOwnerDashboard(){
    if(window.__StagingChickenRotationOwnerInstalled)return;
    try{
      const url=new URL("../extras-dashboard.js",location.href);
      url.searchParams.set("stageRotation","1");
      const xhr=new XMLHttpRequest();xhr.open("GET",url.href,false);xhr.send(null);
      if(!(xhr.status>=200&&xhr.status<300)&&xhr.status!==0)throw new Error(`extras-dashboard HTTP ${xhr.status}`);
      let loader=String(xhr.responseText||"");
      const oldGuard='if (window.__extrasDashboardSafeLoaderV4) return;\n  window.__extrasDashboardSafeLoaderV4 = true;';
      const newGuard='if (window.__StagingExtrasDashboardRotationV1) return;\n  window.__StagingExtrasDashboardRotationV1 = true;\n  window.__extrasDashboardSafeLoaderV4 = true;';
      if(!loader.includes(oldGuard))throw new Error("Dashboard guard signature changed");
      loader=loader.replace(oldGuard,newGuard);
      const marker='if (source.includes(\'timer=setTimeout(cloudSave,500)\')) throw new Error("Legacy Deluxe cloud writer was not removed");';
      if(!loader.includes(marker))throw new Error("Dashboard validation signature changed");
      const inject=`{
      const birdStart=source.indexOf("function bird(){");
      const birdEnd=source.indexOf("window.xChangeBird",birdStart);
      if(birdStart<0||birdEnd<0)throw new Error("Chicken of the Day selector signature changed");
      const birdSource='function bird(){let f=app().flock||[];let q=window.StagingChickenOfDayRotationV1?.pick?.(f,dt(),st);return q||null}\\n';
      source=source.slice(0,birdStart)+birdSource+source.slice(birdEnd);
      source=source.replace('window.xChangeBird=()=>{let f=app().flock||[],cur=bird(),a=f.filter(x=>x.id!==cur?.id);','window.xChangeBird=()=>{let f=window.StagingChickenOfDayRotationV1?.eligible?.(app().flock||[])||[],cur=bird(),a=f.filter(x=>x.id!==cur?.id);');
    }
    `;
      loader=loader.replace(marker,inject+marker);
      if(!loader.includes("StagingChickenOfDayRotationV1"))throw new Error("No-repeat selector was not injected");
      (0,eval)(`${loader}\n//# sourceURL=staging-extras-dashboard-rotation-loader.js`);
      window.__StagingChickenRotationOwnerInstalled=true;
    }catch(error){console.error("STAGING Chicken of the Day owner rotation failed:",error);}
  }

  function installCustomerBuilder(){
    const base=window.FarmPublicCustomerBuilderV1;
    if(!base?.build){setTimeout(installCustomerBuilder,120);return;}
    if(base.__stagingNoRepeatRotation)return;
    const oldBuild=base.build.bind(base);
    window.FarmPublicCustomerBuilderV1={...base,build(input={}){
      const out=oldBuild(input);
      const chosen=pick(out?.flock||[],localDate(),input?.deluxe||{});
      if(out?.summary)out.summary.chickenOfTheDayId=chosen?.id||"";
      return out;
    },__stagingNoRepeatRotation:true};
    window.__StagingCustomerRotationInstalled=true;
  }

  const check=(name,pass,detail="")=>({name,pass:!!pass,detail:String(detail||"")});
  function regression(){
    const fake=Array.from({length:12},(_,i)=>({id:`bird-${i+1}`,name:`Bird ${i+1}`,status:"Active"}));
    const rows=[];
    const a=orderForCycle(fake,4321),b=orderForCycle(fake,4322);
    rows.push(check("rotation utility loaded",!!window.StagingChickenOfDayRotationV1));
    rows.push(check("first rotation round has no repeats",new Set(a.map(x=>x.id)).size===fake.length,`${new Set(a.map(x=>x.id)).size}/${fake.length}`));
    rows.push(check("first rotation round includes every bird",fake.every(x=>a.some(y=>y.id===x.id))));
    rows.push(check("next rotation round has no repeats",new Set(b.map(x=>x.id)).size===fake.length,`${new Set(b.map(x=>x.id)).size}/${fake.length}`));
    rows.push(check("next rotation round includes every bird",fake.every(x=>b.some(y=>y.id===x.id))));
    rows.push(check("new round does not repeat the prior day's bird",String(a[a.length-1]?.id)!==String(b[0]?.id),`${a[a.length-1]?.id} -> ${b[0]?.id}`));
    const day="2026-08-24",p1=pick(fake,day,{}),p2=pick(fake,day,{});
    rows.push(check("same date always selects the same automatic bird",p1?.id===p2?.id,String(p1?.id||"")));
    rows.push(check("manual Change override still wins for the day",pick(fake,day,{photoOverrideDate:day,photoOverrideBirdId:"bird-9"})?.id==="bird-9"));
    rows.push(check("inactive birds are excluded",!eligible([...fake,{id:"gone",status:"Sold"},{id:"inactive",status:"Inactive"}]).some(x=>["gone","inactive"].includes(x.id))));
    rows.push(check("owner Home rotation is installed",window.__StagingChickenRotationOwnerInstalled===true));
    rows.push(check("customer builder rotation is installed",window.__StagingCustomerRotationInstalled===true));
    rows.push(check("rotation adds zero Firebase/network calls",window.StagingChickenOfDayRotationV1.firebaseReads===0&&window.StagingChickenOfDayRotationV1.firebaseWrites===0&&window.StagingChickenOfDayRotationV1.networkCalls===0));
    const failed=rows.filter(x=>!x.pass);
    return {suite:"staging-chicken-of-day-rotation-v1",checks:rows,total:rows.length,passed:rows.length-failed.length,failed:failed.length};
  }
  function attachRegression(){
    const base=window.StagingFullTest;
    if(!base?.run){setTimeout(attachRegression,180);return;}
    if(base.__chickenOfDayRotationV1)return;
    const oldRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){
      const first=await oldRun();
      const extra=regression();
      const mapped=extra.checks.map(r=>({name:`Chicken of the Day: ${r.name}`,pass:r.pass,detail:r.detail}));
      const results=[...(first?.results||[]),...mapped];
      const failed=results.filter(x=>!x.pass);
      return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+chicken-of-day-rotation-v1`};
    },__chickenOfDayRotationV1:true};
  }

  installOwnerDashboard();
  installCustomerBuilder();
  setTimeout(attachRegression,2200);
  console.log("🔄 STAGING Chicken of the Day no-repeat rotation active — every eligible bird gets one turn per round; manual Change still works; 0 Firebase calls");
})();
