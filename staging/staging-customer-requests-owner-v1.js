(() => {
  "use strict";
  if (window.StagingCustomerRequestsV1) return;
  if (!window.__ChickenEggsStagingMode) return;

  const KEY="chickenEggCustomerRequestsV1";
  const ENTRIES="chickenEggEntriesV102";
  const INVENTORY="chickenEggInventoryV2";
  const APP2="chickenEggApp2V1";
  const STATUS=["New","Contacted","Reserved","Fulfilled","Cancelled"];
  const MSGS={
    auto:"Automatic from farm data",
    available:"In stock now",
    next_week:"Likely available next week",
    coming_soon:"Coming soon",
    none_soon:"Nothing expected soon"
  };
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const n=v=>Number(v)||0;
  const whole=v=>Math.max(0,Math.round(n(v)));
  const readJSON=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}};
  const nowId=()=>`req-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  function blank(){return {version:1,settings:{eggs:"auto",birds:"auto"},requests:[],updatedAt:0};}
  function sanitizeState(raw){
    const d=blank(),x=raw&&typeof raw==="object"?raw:{};
    const requests=(Array.isArray(x.requests)?x.requests:[]).map(r=>sanitizeRequest(r,true)).filter(Boolean).slice(0,500);
    return {version:1,settings:{eggs:MSGS[x.settings?.eggs]?x.settings.eggs:"auto",birds:MSGS[x.settings?.birds]?x.settings.birds:"auto"},requests,updatedAt:whole(x.updatedAt)};
  }
  function sanitizeRequest(raw,existing=false){
    const r=raw&&typeof raw==="object"?raw:{};
    const name=String(r.name||"").trim().slice(0,80);
    const phone=String(r.phone||"").trim().slice(0,40);
    const email=String(r.email||"").trim().slice(0,120);
    const category=r.category==="birds"?"birds":"eggs";
    const item=String(r.item|| (category==="birds"?"Birds":"Eggs")).trim().slice(0,120);
    const quantity=Math.min(999,whole(r.quantity));
    const note=String(r.note||"").trim().slice(0,300);
    const status=STATUS.includes(r.status)?r.status:"New";
    if(!existing){
      if(!name)throw new Error("Name is required.");
      if(!phone&&!email)throw new Error("Enter a phone number or email.");
      if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Enter a valid email address.");
      if(quantity<1)throw new Error("Quantity must be at least 1.");
    }
    if(existing&&!String(r.id||""))return null;
    return {id:String(r.id||nowId()).slice(0,140),name,phone,email,category,item:item|| (category==="birds"?"Birds":"Eggs"),quantity:Math.max(1,quantity||1),note,status,createdAt:whole(r.createdAt||Date.now()),updatedAt:whole(r.updatedAt||Date.now())};
  }
  function load(){return sanitizeState(readJSON(KEY,blank()));}
  function save(state){const next=sanitizeState(state);next.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(next));render();return next;}
  function createRequest(input){const s=load(),row=sanitizeRequest(input,false);s.requests.unshift(row);save(s);return row;}
  function updateStatus(id,status){if(!STATUS.includes(status))throw new Error("Invalid request status.");const s=load(),row=s.requests.find(r=>r.id===String(id));if(!row)throw new Error("Request not found.");row.status=status;row.updatedAt=Date.now();save(s);return row;}
  function setAvailability(kind,value){if(!["eggs","birds"].includes(kind)||!MSGS[value])throw new Error("Invalid availability setting.");const s=load();s.settings[kind]=value;save(s);return publicAvailability(kind);}
  function physicalEggs(){const inv=readJSON(INVENTORY,{});return whole(inv.dozens)*12+whole(inv.packs18)*18+whole(inv.loose);}
  function reservedEggs(){const app=readJSON(APP2,{});return (Array.isArray(app.orders)?app.orders:[]).filter(o=>o?.status==="pending").reduce((sum,o)=>sum+whole(o.dozen)*12+whole(o.packs18)*18,0);}
  function autoAvailability(kind){
    if(kind==="birds"){
      const app=readJSON(APP2,{}),rows=Array.isArray(app.birdListings)?app.birdListings:[];
      if(rows.some(x=>x?.public!==false&&whole(x.quantity)>0&&String(x.status||"Available")==="Available"))return "In stock now";
      if(rows.some(x=>x?.public!==false&&["Coming Soon","Reserved"].includes(String(x.status||""))))return "Coming soon";
      return "Nothing expected soon";
    }
    const available=Math.max(0,physicalEggs()-reservedEggs());
    if(available>=12)return "In stock now";
    if(available>0)return "Limited availability";
    const entries=readJSON(ENTRIES,[]).filter(e=>e?.type==="eggs"&&Number(e.eggs)>0).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,7);
    const avg=entries.length?entries.reduce((s,e)=>s+n(e.eggs),0)/entries.length:0;
    return avg>=2?"Likely available next week":"Nothing expected soon";
  }
  function publicAvailability(kind){const s=load(),choice=s.settings[kind]||"auto";return choice==="auto"?autoAvailability(kind):MSGS[choice];}

  function ensureScreen(){
    let screen=document.getElementById("customerRequests");
    if(!screen){
      screen=document.createElement("section");screen.id="customerRequests";screen.className="screen";
      screen.innerHTML=`<div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Customer Requests</h2></div><div id="customerRequestOwnerBody"></div><button class="secondary" onclick="showScreen('farm2Hub')">Back</button>`;
      const nav=document.querySelector(".bottomNav"),app=document.querySelector(".app");if(app)app.insertBefore(screen,nav||null);
    }
    let btn=document.getElementById("customerRequestsHubBtn");
    const grid=document.querySelector("#farm2Hub .farm2-hubGrid");
    if(grid&&!btn){btn=document.createElement("button");btn.id="customerRequestsHubBtn";btn.className="farm2-hubButton blue";btn.setAttribute("onclick","showScreen('customerRequests');StagingCustomerRequestsV1.render() ");btn.innerHTML='<span class="farm2-bigEmoji">📨</span>Customer Requests<small>Egg & bird requests / waitlist</small>';grid.appendChild(btn);}
    if(!document.getElementById("customerRequestsCss")){
      const st=document.createElement("style");st.id="customerRequestsCss";st.textContent=`#customerRequests .req-settings{display:grid;grid-template-columns:1fr 1fr;gap:12px}.req-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.req-card{padding:14px;border:1px solid rgba(31,122,58,.12);border-radius:18px;background:rgba(255,255,255,.9);margin:10px 0}.req-top{display:flex;justify-content:space-between;gap:12px}.req-contact{font-weight:800;margin-top:5px}.req-meta{color:var(--muted);margin-top:5px}.req-note{margin-top:8px}.req-actions{display:flex;gap:8px;align-items:center;margin-top:10px}.req-actions select{flex:1}@media(max-width:640px){#customerRequests .req-settings{grid-template-columns:1fr}.req-top{display:block}}`;document.head.appendChild(st);
    }
    return screen;
  }
  function render(){
    ensureScreen();const body=document.getElementById("customerRequestOwnerBody");if(!body)return;
    const s=load(),newCount=s.requests.filter(r=>r.status==="New").length,open=s.requests.filter(r=>!["Fulfilled","Cancelled"].includes(r.status)).length;
    const opts=current=>Object.entries(MSGS).map(([v,l])=>`<option value="${v}" ${v===current?"selected":""}>${esc(l)}</option>`).join("");
    body.innerHTML=`<div class="farm2-card"><div class="farm2-kicker">📣 Customer availability message</div><h3>What customers see before requesting</h3><div class="req-settings"><label>Eggs<select id="reqEggMsg">${opts(s.settings.eggs)}</select></label><label>Birds<select id="reqBirdMsg">${opts(s.settings.birds)}</select></label></div><button id="reqSaveMessages">Save Availability Messages</button><div class="farm2-subtle">Current public message: 🥚 ${esc(publicAvailability("eggs"))} • 🐣 ${esc(publicAvailability("birds"))}</div></div><div class="farm2-formRow"><div class="farm2-card"><div class="farm2-kicker">New</div><div class="farm2-moneyBig">${newCount}</div></div><div class="farm2-card"><div class="farm2-kicker">Open requests</div><div class="farm2-moneyBig">${open}</div></div></div><div class="farm2-card"><div class="farm2-kicker">📨 Request inbox</div><h3>${s.requests.length} total request${s.requests.length===1?"":"s"}</h3><div id="reqOwnerList">${s.requests.length?s.requests.map(r=>`<article class="req-card"><div class="req-top"><div><strong>${esc(r.name)}</strong><div class="req-contact">${esc(r.phone||r.email)}${r.phone&&r.email?` • ${esc(r.email)}`:""}</div></div><b>${esc(r.status)}</b></div><div class="req-meta">${r.category==="birds"?"🐣":"🥚"} ${esc(r.item)} • Qty ${r.quantity}</div>${r.note?`<div class="req-note">${esc(r.note)}</div>`:""}<div class="req-actions"><select data-req-status="${esc(r.id)}">${STATUS.map(x=>`<option ${x===r.status?"selected":""}>${x}</option>`).join("")}</select><button data-req-save="${esc(r.id)}">Update</button></div></article>`).join(""):'<div class="farm2-subtle">No customer requests yet.</div>'}</div></div>`;
    document.getElementById("reqSaveMessages")?.addEventListener("click",()=>{const next=load();next.settings.eggs=document.getElementById("reqEggMsg")?.value||"auto";next.settings.birds=document.getElementById("reqBirdMsg")?.value||"auto";save(next);});
    body.querySelectorAll("[data-req-save]").forEach(btn=>btn.addEventListener("click",()=>{const id=btn.dataset.reqSave,sel=body.querySelector(`[data-req-status="${CSS.escape(id)}"]`);updateStatus(id,sel?.value||"New");}));
  }
  function start(){ensureScreen();render();setTimeout(()=>{ensureScreen();render();},700);setTimeout(()=>{ensureScreen();render();},1800);}
  window.StagingCustomerRequestsV1={version:1,key:KEY,load,save,createRequest,updateStatus,setAvailability,publicAvailability,autoAvailability,sanitizeRequest,render,statuses:STATUS.slice()};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();