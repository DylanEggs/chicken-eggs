(() => {
  "use strict";
  if (window.__StagingActionCenterV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingActionCenterV1 = true;

  const FM="rfpFarmManagerV1";
  const APP2="chickenEggApp2V1";
  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x);}catch{return f;}};
  const n=v=>Math.max(0,Number(v)||0);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const addDays=(date,days)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return localDate(d);};
  const daysBetween=(a,b)=>Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000);

  function state(){
    const f=read(FM,{}),a=read(APP2,{});
    return {
      hatches:Array.isArray(f.hatches)?f.hatches:[],
      supplies:Array.isArray(f.supplies)?f.supplies:[],
      waitlist:Array.isArray(f.waitlist)?f.waitlist:[],
      health:Array.isArray(f.health)?f.health:[],
      calendar:Array.isArray(f.calendar)?f.calendar:[],
      flock:Array.isArray(a.flock)?a.flock:[]
    };
  }

  function dueLabel(days){
    if(days<0)return `${Math.abs(days)}d overdue`;
    if(days===0)return "Today";
    if(days===1)return "Tomorrow";
    return `In ${days}d`;
  }
  function priority(days){return days<0?0:days===0?1:days<=2?2:3;}
  function task(kind,title,date,detail="",source="auto"){
    const today=localDate(),days=daysBetween(today,date);
    return {kind,title,date,detail,days,priority:priority(days),source};
  }

  function buildTasks(){
    const s=state(),today=localDate(),out=[];
    for(const h of s.hatches){
      const name=String(h.name||h.cross||"Hatch");
      const set=String(h.setDate||"");
      const expected=String(h.expectedHatch||"");
      if(set){
        const candle1=String(h.candle1||addDays(set,7));
        const candle2=String(h.candle2||addDays(set,14));
        if(candle1)out.push(task("🕯️",`Candle ${name}`,candle1,"First candling check"));
        if(candle2)out.push(task("🕯️",`Candle ${name}`,candle2,"Second candling check"));
      }
      if(expected){
        out.push(task("🔒",`Lockdown ${name}`,addDays(expected,-3),"Stop turning and raise hatch humidity"));
        out.push(task("🐣",`Expected hatch: ${name}`,expected,`${n(h.hatched)}/${n(h.eggsSet)} recorded hatched`));
      }
    }
    for(const c of s.calendar){
      if(c?.done||!c?.date)continue;
      out.push(task("📅",String(c.title||"Farm reminder"),String(c.date),String(c.notes||c.kind||""),"calendar"));
    }
    for(const x of s.health){
      if(!x?.endDate)continue;
      out.push(task("🩺",`Treatment/withdrawal ends: ${String(x.bird||"Flock")}`,String(x.endDate),String(x.product||x.treatment||"")));
    }
    for(const x of s.supplies){
      if(n(x.quantity)<=n(x.lowAt))out.push({kind:"📦",title:`Low stock: ${String(x.name||"Supply")}`,date:today,detail:`${n(x.quantity)} ${String(x.unit||"units")} remaining`,days:0,priority:1,source:"inventory"});
    }
    for(const w of s.waitlist){
      if(String(w.status||"waiting").toLowerCase()!=="waiting")continue;
      out.push({kind:"🤝",title:`Waitlist: ${String(w.customer||"Customer")}`,date:String(w.date||today),detail:`${n(w.quantity)||1} × ${String(w.item||"item")}`,days:0,priority:2,source:"waitlist"});
    }
    const month=today.slice(5);
    for(const b of s.flock){
      const hd=String(b?.hatchDate||"");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(hd))continue;
      const candidate=`${today.slice(0,4)}-${hd.slice(5)}`;
      const date=candidate<today?`${Number(today.slice(0,4))+1}-${hd.slice(5)}`:candidate;
      const days=daysBetween(today,date);
      if(days<=14)out.push(task("🎂",`${String(b.name||"Chicken")}'s birthday`,date,String(b.breed||"")));
    }
    return out.filter(x=>x.days>=-30&&x.days<=30).sort((a,b)=>a.priority-b.priority||a.days-b.days||a.title.localeCompare(b.title));
  }

  function css(){
    if(document.getElementById("rfpActionCenterCss"))return;
    const s=document.createElement("style");s.id="rfpActionCenterCss";s.textContent=`
      #rfpActionCenter{margin:0 0 16px;padding:14px;border-radius:22px;background:linear-gradient(135deg,rgba(255,247,223,.96),rgba(238,248,238,.96));border:1px solid rgba(31,122,58,.14);box-shadow:0 12px 30px rgba(24,68,36,.10)}
      .farm2-dark #rfpActionCenter{background:linear-gradient(135deg,rgba(45,52,35,.94),rgba(28,50,36,.94));border-color:rgba(255,255,255,.10)}
      .rfp-ac-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.rfp-ac-head strong{font-size:17px}.rfp-ac-count{font-size:11px;font-weight:900;padding:5px 8px;border-radius:999px;background:rgba(31,122,58,.1)}
      .rfp-ac-list{display:grid;gap:7px}.rfp-ac-item{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:9px 10px;border-radius:14px;background:rgba(255,255,255,.64)}.farm2-dark .rfp-ac-item{background:rgba(255,255,255,.06)}
      .rfp-ac-item b{font-size:13px;display:block}.rfp-ac-item small{font-size:11px;opacity:.7;display:block;margin-top:2px}.rfp-ac-due{font-size:10px;font-weight:900;white-space:nowrap}.rfp-ac-overdue{color:#b91c1c}.rfp-ac-empty{font-size:12px;opacity:.7;padding:5px 2px}
    `;document.head.appendChild(s);
  }

  function host(){return document.getElementById("dashboard")||document.querySelector(".screen.active")||document.querySelector(".app");}
  function render(){
    css();
    const h=host();if(!h)return false;
    let box=document.getElementById("rfpActionCenter");
    if(!box){box=document.createElement("section");box.id="rfpActionCenter";const after=document.getElementById("dashboardTotals");if(after?.parentNode)after.parentNode.insertBefore(box,after.nextSibling);else h.prepend(box);}
    const tasks=buildTasks(),urgent=tasks.filter(x=>x.days<=2).length,shown=tasks.slice(0,7);
    box.innerHTML=`<div class="rfp-ac-head"><div><div class="eyebrow">Rose Family Poultry</div><strong>📋 Farm Today</strong></div><span class="rfp-ac-count">${urgent} due soon</span></div>${shown.length?`<div class="rfp-ac-list">${shown.map(x=>`<div class="rfp-ac-item"><span>${x.kind}</span><div><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div><span class="rfp-ac-due ${x.days<0?"rfp-ac-overdue":""}">${esc(dueLabel(x.days))}</span></div>`).join("")}</div>`:`<div class="rfp-ac-empty">Nothing urgent in the next 30 days. 🐔</div>`}`;
    return true;
  }

  let timer=0;
  function schedule(){clearTimeout(timer);timer=setTimeout(render,60);}
  ["rfp-staging-farm-manager-changed","farm-local-data-changed","core-data-synced"].forEach(e=>window.addEventListener(e,schedule));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)schedule();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(render,250),{once:true});else setTimeout(render,250);

  window.StagingActionCenterV1={version:1,networkCalls:0,firebaseWrites:0,buildTasks,render};
  console.log("🧪 STAGING Farm Today action center active — local/event-driven, zero Firebase calls");
})();
