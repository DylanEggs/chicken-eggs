(() => {
  "use strict";
  if (window.FarmChickenOfDayRotationV1) return;

  const HIDDEN=/^(sold|removed|rehomed|deceased|inactive)$/i;
  const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const daySerial=date=>{
    const [y,m,d]=String(date||localDate()).slice(0,10).split("-").map(Number);
    return Math.floor(Date.UTC(y,m-1,d)/86400000);
  };

  function eligible(flock){
    return (Array.isArray(flock)?flock:[]).filter(b=>b&&b.id&&!HIDDEN.test(String(b.status||"Active").trim()));
  }

  function hash(text){
    let h=2166136261>>>0;
    for(const ch of String(text||"")){
      h^=ch.charCodeAt(0);
      h=Math.imul(h,16777619)>>>0;
    }
    return h>>>0;
  }

  function shuffledBase(flock,cycle){
    const out=eligible(flock).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    let state=(hash(out.map(b=>String(b.id)).join("|")+"|"+String(cycle))||0x9e3779b9)>>>0;
    const rand=()=>{
      state^=state<<13;
      state^=state>>>17;
      state^=state<<5;
      state>>>=0;
      return state/4294967296;
    };
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(rand()*(i+1));
      [out[i],out[j]]=[out[j],out[i]];
    }
    return out;
  }

  function orderForCycle(flock,cycle){
    const out=shuffledBase(flock,cycle);
    if(cycle>0&&out.length>1){
      const prev=shuffledBase(flock,cycle-1);
      if(prev.length&&String(prev[prev.length-1]?.id)===String(out[0]?.id)){
        [out[0],out[1]]=[out[1],out[0]];
      }
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

  window.FarmChickenOfDayRotationV1={
    version:1,
    eligible,
    orderForCycle,
    pick,
    localDate,
    daySerial,
    firebaseReads:0,
    firebaseWrites:0,
    networkCalls:0
  };
})();
