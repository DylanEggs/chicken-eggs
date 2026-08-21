(() => {
  "use strict";
  if (window.FarmCustomerRequestsV1) return;

  const STATUS=["New","Contacted","Reserved","Fulfilled","Cancelled"];
  const MSGS={auto:"Automatic from farm data",available:"In stock now",next_week:"Likely available next week",coming_soon:"Coming soon",none_soon:"Nothing expected soon"};
  let fs=null,db=null,unsubscribe=null,rows=[],settings={enabled:false,eggs:"auto",birds:"auto"},busy=false,lastError="";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const whole=v=>Math.max(0,Math.round(Number(v)||0));
  const authStatus=()=>window.PublicCustomerOwnerAuth?.status?.()||{ready:false,connected:false};

  async function sdk(){
    if(fs)return fs;
    fs=await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    return fs;
  }
  async function ownerDb(){
    await window.PublicCustomerOwnerAuth?.init?.();
    if(!authStatus().connected)throw new Error("Connect Customer Page Sync first.");
    db=await window.PublicCustomerOwnerAuth.publisherDb();
    await sdk();
    return db;
  }
  function ensureCss(){
    if(document.getElementById("customerRequestsOwnerCss"))return;
    const s=document.createElement("style");s.id="customerRequestsOwnerCss";s.textContent=`
      #customerRequests .req-settings{display:grid;grid-template-columns:1fr 1fr;gap:12px}.req-card{padding:14px;border:1px solid rgba(31,122,58,.12);border-radius:18px;background:rgba(255,255,255,.9);margin:10px 0}.req-top{display:flex;justify-content:space-between;gap:12px}.req-contact{font-weight:850;margin-top:5px}.req-meta{color:var(--muted);margin-top:5px}.req-note{margin-top:8px}.req-actions{display:flex;gap:8px;align-items:center;margin-top:10px}.req-actions select{flex:1}.req-live-toggle{display:flex;align-items:center;gap:9px;margin:10px 0;font-weight:900}.req-live-toggle input{width:auto}.req-warning{padding:11px 12px;border-radius:14px;background:rgba(245,185,28,.14);font-weight:800;line-height:1.4}.req-good{padding:11px 12px;border-radius:14px;background:rgba(31,122,58,.12);color:#176b31;font-weight:800;line-height:1.4}@media(max-width:640px){#customerRequests .req-settings{grid-template-columns:1fr}.req-top{display:block}}`;
    document.head.appendChild(s);
  }
  function ensureScreen(){
    ensureCss();
    let screen=document.getElementById("customerRequests");
    if(!screen){
      screen=document.createElement("section");screen.id="customerRequests";screen.className="screen";
      screen.innerHTML=`<div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Customer Requests</h2></div><div id="customerRequestOwnerBody"></div><button class="secondary" onclick="showScreen('farm2Hub')">Back</button>`;
      const nav=document.querySelector(".bottomNav"),app=document.querySelector(".app");if(app)app.insertBefore(screen,nav||null);
    }
    let btn=document.getElementById("customerRequestsHubBtn");
    const grid=document.querySelector("#farm2Hub .farm2-hubGrid");
    if(grid&&!btn){
      btn=document.createElement("button");btn.id="customerRequestsHubBtn";btn.className="farm2-hubButton blue";btn.innerHTML='<span class="farm2-bigEmoji">📨</span>Customer Requests<small>Egg & bird requests / waitlist</small>';
      btn.addEventListener("click",()=>{window.showScreen?.("customerRequests");void openInbox();});grid.appendChild(btn);
    }
    return screen;
  }
  function options(current){return Object.entries(MSGS).map(([v,l])=>`<option value="${v}" ${v===current?"selected":""}>${esc(l)}</option>`).join("");}
  function birdLabel(r){return r.category==="birds"?(r.birdType==="pullets"?"🐔 Pullets":r.birdType==="roosters"?"🐓 Roosters":"🐣 Chicks"):"🥚 Eggs";}
  function render(){
    ensureScreen();const body=document.getElementById("customerRequestOwnerBody");if(!body)return;
    const s=authStatus(),newCount=rows.filter(r=>r.status==="New").length,open=rows.filter(r=>!["Fulfilled","Cancelled"].includes(r.status)).length;
    if(!s.connected){
      body.innerHTML=`<div class="farm2-card"><div class="farm2-kicker">🔐 Private inbox</div><h3>Connect Customer Page Sync</h3><div class="req-warning">Customer contact information is private. Connect your separate owner Firebase session in Farm Settings before this inbox can load.</div><button id="reqGoSettings">Open Farm Settings</button></div>`;
      document.getElementById("reqGoSettings")?.addEventListener("click",()=>window.showScreen?.("farm2Settings"));return;
    }
    body.innerHTML=`<div class="farm2-card"><div class="farm2-kicker">📣 Customer request page</div><h3>Availability & request form</h3><label class="req-live-toggle"><input id="reqPublicEnabled" type="checkbox" ${settings.enabled?"checked":""}> Show the request form on the customer page</label><div class="req-settings"><label>Eggs<select id="reqEggMsg">${options(settings.eggs)}</select></label><label>Birds<select id="reqBirdMsg">${options(settings.birds)}</select></label></div><button id="reqSaveSettings">Save Customer Request Settings</button><div class="farm2-subtle" style="margin-top:8px">The form stays hidden until enabled. Customer names, phone numbers, emails and notes are never published back to the customer page.</div>${lastError?`<div class="req-warning" style="margin-top:10px">${esc(lastError)}</div>`:`<div class="req-good" style="margin-top:10px">Private owner connection is active.</div>`}</div><div class="farm2-formRow"><div class="farm2-card"><div class="farm2-kicker">New</div><div class="farm2-moneyBig">${newCount}</div></div><div class="farm2-card"><div class="farm2-kicker">Open requests</div><div class="farm2-moneyBig">${open}</div></div></div><div class="farm2-card"><div class="farm2-kicker">📨 Request inbox</div><h3>${rows.length} total request${rows.length===1?"":"s"}</h3><div>${rows.length?rows.map(r=>`<article class="req-card"><div class="req-top"><div><strong>${esc(r.name)}</strong><div class="req-contact">${esc(r.phone||r.email)}${r.phone&&r.email?` • ${esc(r.email)}`:""}</div></div><b>${esc(r.status)}</b></div><div class="req-meta">${birdLabel(r)} • ${esc(r.item)} • Qty ${whole(r.quantity)}</div>${r.note?`<div class="req-note">${esc(r.note)}</div>`:""}<div class="req-actions"><select data-req-status="${esc(r.id)}">${STATUS.map(x=>`<option ${x===r.status?"selected":""}>${x}</option>`).join("")}</select><button data-req-save="${esc(r.id)}">Update</button></div></article>`).join(""):'<div class="farm2-subtle">No customer requests yet.</div>'}</div></div>`;
    document.getElementById("reqSaveSettings")?.addEventListener("click",saveSettings);
    body.querySelectorAll("[data-req-save]").forEach(btn=>btn.addEventListener("click",()=>void updateStatus(btn.dataset.reqSave,body.querySelector(`[data-req-status="${CSS.escape(btn.dataset.reqSave)}"]`)?.value||"New")));
  }
  function safeRow(docSnap){
    const x=docSnap.data()||{};return {id:docSnap.id,name:String(x.name||"").slice(0,80),phone:String(x.phone||"").slice(0,40),email:String(x.email||"").slice(0,120),category:x.category==="birds"?"birds":"eggs",birdType:["chicks","pullets","roosters"].includes(x.birdType)?x.birdType:"",item:String(x.item||"").slice(0,120),quantity:Math.min(999,whole(x.quantity)||1),note:String(x.note||"").slice(0,300),status:STATUS.includes(x.status)?x.status:"New",createdAt:whole(x.createdAt),updatedAt:whole(x.updatedAt)};
  }
  async function loadSettings(){
    const d=await ownerDb(),a=await sdk();const snap=await a.getDoc(a.doc(d,"public_customer","request_settings"));const x=snap.exists()?snap.data():{};settings={enabled:x.enabled===true,eggs:MSGS[x.eggs]?x.eggs:"auto",birds:MSGS[x.birds]?x.birds:"auto"};
  }
  async function subscribe(){
    if(unsubscribe)return;const d=await ownerDb(),a=await sdk();unsubscribe=a.onSnapshot(a.collection(d,"customer_requests"),snap=>{rows=snap.docs.map(safeRow).sort((x,y)=>y.createdAt-x.createdAt);lastError="";render();},err=>{lastError=String(err?.message||err);rows=[];render();});
  }
  async function openInbox(){
    ensureScreen();busy=true;render();try{await window.PublicCustomerOwnerAuth?.init?.();if(authStatus().connected){await loadSettings();await subscribe();lastError="";}}catch(e){lastError=String(e?.message||e);}finally{busy=false;render();}
  }
  function readSettingsForm(){
    return {
      enabled:!!document.getElementById("reqPublicEnabled")?.checked,
      eggs:document.getElementById("reqEggMsg")?.value||"auto",
      birds:document.getElementById("reqBirdMsg")?.value||"auto",
      updatedAt:Date.now()
    };
  }
  async function saveSettings(){
    if(busy)return;
    const next=readSettingsForm();
    if(!MSGS[next.eggs]||!MSGS[next.birds]){lastError="Invalid availability setting.";render();return;}
    busy=true;lastError="";
    const btn=document.getElementById("reqSaveSettings");
    if(btn){btn.disabled=true;btn.textContent="Saving Customer Request Settings…";}
    try{
      const d=await ownerDb(),a=await sdk();
      await a.setDoc(a.doc(d,"public_customer","request_settings"),next,{merge:false});
      settings=next;
    }catch(e){lastError=String(e?.message||e);}finally{busy=false;render();}
  }
  async function updateStatus(id,status){
    if(!STATUS.includes(status))return;try{const d=await ownerDb(),a=await sdk();await a.updateDoc(a.doc(d,"customer_requests",String(id)),{status,updatedAt:Date.now()});lastError="";}catch(e){lastError=String(e?.message||e);render();}
  }
  function install(){ensureScreen();[400,1200,2600].forEach(ms=>setTimeout(ensureScreen,ms));}
  window.addEventListener("public-customer-owner-auth-changed",()=>{if(!authStatus().connected&&unsubscribe){try{unsubscribe();}catch{}unsubscribe=null;rows=[];}if(document.getElementById("customerRequests")?.classList.contains("active"))void openInbox();else render();});
  window.FarmCustomerRequestsV1={version:2,openInbox,render,readSettingsForm,rows:()=>rows.slice(),settings:()=>({...settings})};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();