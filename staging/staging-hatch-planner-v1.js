(() => {
  "use strict";
  if (window.__StagingHatchPlannerV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingHatchPlannerV1 = true;

  const STORE="rfpFarmManagerV1";
  const BRAND="Rose Family Poultry";
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");return x&&typeof x==="object"?x:{};}catch{return {};}};
  const write=s=>{try{localStorage.setItem(STORE,JSON.stringify(s));window.dispatchEvent(new CustomEvent("rfp-staging-farm-manager-changed"));return true;}catch{return false;}};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const today=()=>new Date().toISOString().slice(0,10);
  const addDays=(date,days)=>{const d=new Date(`${date}T12:00:00`);if(Number.isNaN(d.getTime()))return"";d.setDate(d.getDate()+Number(days||0));return d.toISOString().slice(0,10);};
  const whole=(v,fallback=0)=>Number.isFinite(Number(v))?Math.max(0,Math.round(Number(v))):fallback;

  function calculate(x={}){
    const setDate=String(x.setDate||today());
    const incubationDays=whole(x.incubationDays,21)||21;
    const candle1Day=Math.min(incubationDays,whole(x.candle1Day,7)||7);
    const candle2Day=Math.min(incubationDays,whole(x.candle2Day,14)||14);
    const lockdownBefore=Math.min(incubationDays,whole(x.lockdownBefore,3)||3);
    return {
      setDate,
      incubationDays,
      candle1Day,
      candle2Day,
      lockdownBefore,
      candle1:addDays(setDate,candle1Day),
      candle2:addDays(setDate,candle2Day),
      lockdown:addDays(setDate,Math.max(0,incubationDays-lockdownBefore)),
      expectedHatch:addDays(setDate,incubationDays)
    };
  }

  function applyToState(state,input={}){
    const out=state&&typeof state==="object"?JSON.parse(JSON.stringify(state)):{};
    out.hatches=Array.isArray(out.hatches)?out.hatches:[];
    out.calendar=Array.isArray(out.calendar)?out.calendar:[];
    const plan=calculate(input);
    const planId=String(input.planId||`plan-${Date.now()}-${Math.random().toString(36).slice(2,6)}`);
    const name=String(input.name||input.cross||"Planned hatch").trim()||"Planned hatch";
    const cross=String(input.cross||"").trim();
    const eggsSet=whole(input.eggsSet,0);
    const existing=out.hatches.find(h=>String(h.sourcePlanId||"")===planId);
    if(!existing){
      out.hatches.push({
        id:`hatch-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        sourcePlanId:planId,name,cross,setDate:plan.setDate,expectedHatch:plan.expectedHatch,
        candle1:plan.candle1,candle2:plan.candle2,eggsSet,fertile:0,hatched:0,
        notes:`Planned schedule • ${plan.incubationDays}-day incubation`
      });
    }
    const events=[
      {kind:"Candling",date:plan.candle1,title:`Candle: ${name}`,key:"candle1"},
      {kind:"Candling",date:plan.candle2,title:`Candle again: ${name}`,key:"candle2"},
      {kind:"Incubator",date:plan.lockdown,title:`Lockdown: ${name}`,key:"lockdown"},
      {kind:"Hatch",date:plan.expectedHatch,title:`Expected hatch: ${name}`,key:"hatch"}
    ];
    for(const e of events){
      if(!e.date||out.calendar.some(c=>String(c.sourcePlanId||"")===planId&&c.sourcePlanEvent===e.key))continue;
      out.calendar.push({id:`cal-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,sourcePlanId:planId,sourcePlanEvent:e.key,date:e.date,title:e.title,kind:e.kind,notes:`Auto-created by Hatch Planner • ${BRAND}`,done:false});
    }
    return {state:out,plan,planId};
  }

  function savePlan(input={}){const result=applyToState(read(),input);if(!write(result.state))return {ok:false,...result};return {ok:true,...result};}

  function css(){
    if(document.getElementById("rfpHatchPlannerCss"))return;
    const s=document.createElement("style");s.id="rfpHatchPlannerCss";s.textContent=`
      .rfp-hp-banner{padding:10px 12px;border-radius:14px;background:rgba(31,122,58,.08);font-size:12px;margin-bottom:12px}.rfp-hp-form{display:grid;gap:8px}.rfp-hp-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.rfp-hp-form input{width:100%;box-sizing:border-box}.rfp-hp-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.rfp-hp-date{padding:11px;border-radius:14px;background:rgba(31,122,58,.07)}.rfp-hp-date span{display:block;font-size:11px;opacity:.7}.rfp-hp-date b{display:block;margin-top:3px}.rfp-hp-note{font-size:11px;opacity:.7}@media(max-width:560px){.rfp-hp-row,.rfp-hp-preview{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function preview(form){
    const box=document.getElementById("rfpHatchPlannerPreview");if(!box||!form)return;
    const f=Object.fromEntries(new FormData(form));const p=calculate(f);
    box.innerHTML=`<div class="rfp-hp-date"><span>First candling</span><b>${esc(p.candle1)}</b></div><div class="rfp-hp-date"><span>Second candling</span><b>${esc(p.candle2)}</b></div><div class="rfp-hp-date"><span>Lockdown</span><b>${esc(p.lockdown)}</b></div><div class="rfp-hp-date"><span>Expected hatch</span><b>${esc(p.expectedHatch)}</b></div>`;
  }

  function render(){
    const body=document.getElementById("rfpBizBody");if(!body)return;
    body.innerHTML=`<div class="rfp-hp-banner"><strong>🐣 Hatch Schedule Planner</strong><br>Chicken defaults are Day 7 + Day 14 candling, Day 18 lockdown, Day 21 hatch. Saving adds the batch to Hatch Tracker and creates Farm Calendar reminders. STAGING local-only.</div><form id="rfpHatchPlannerForm" class="rfp-hp-form"><div class="rfp-hp-row"><input name="name" placeholder="Hatch / batch name" required><input name="cross" placeholder="Breed / cross"></div><div class="rfp-hp-row"><label>Set date<input name="setDate" type="date" value="${today()}" required></label><input name="eggsSet" type="number" min="0" placeholder="Eggs set"></div><div class="rfp-hp-row"><label>Incubation days<input name="incubationDays" type="number" min="1" value="21"></label><label>Lockdown days before hatch<input name="lockdownBefore" type="number" min="0" value="3"></label></div><div class="rfp-hp-row"><label>First candle day<input name="candle1Day" type="number" min="1" value="7"></label><label>Second candle day<input name="candle2Day" type="number" min="1" value="14"></label></div><div id="rfpHatchPlannerPreview" class="rfp-hp-preview"></div><button type="submit">Add to Hatch Tracker + Calendar</button><div id="rfpHatchPlannerStatus" class="rfp-hp-note"></div></form>`;
    const form=document.getElementById("rfpHatchPlannerForm");preview(form);
    form?.addEventListener("input",()=>preview(form));
    form?.addEventListener("submit",e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));const result=savePlan(data);const status=document.getElementById("rfpHatchPlannerStatus");if(status)status.textContent=result.ok?`Saved. Expected hatch ${result.plan.expectedHatch}; 4 calendar reminders created.`:"Could not save this hatch plan.";if(result.ok)window.dispatchEvent(new CustomEvent("rfp-staging-hatch-plan-saved",{detail:{planId:result.planId,plan:result.plan}}));});
  }

  function installTab(){
    const tabs=document.querySelector("#rfpBusinessModal .rfp-biz-tabs");if(!tabs||tabs.querySelector("[data-hatch-planner]"))return false;
    const b=document.createElement("button");b.type="button";b.dataset.hatchPlanner="1";b.textContent="🐣 Hatch Planner";
    b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));render();});tabs.appendChild(b);return true;
  }
  function start(){css();installTab();document.addEventListener("click",e=>{if(e.target?.closest?.("#rfpBusinessLauncher"))setTimeout(installTab,0);});}

  window.StagingHatchPlannerV1={version:1,networkCalls:0,firebaseWrites:0,calculate,applyToState,savePlan,installTab,render};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
