(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode) return;
  if (window.__StagingCustomerRequestsLiveParityV1) return;
  window.__StagingCustomerRequestsLiveParityV1 = true;

  const KEY="chickenEggCustomerRequestsV1",PHYSICAL_KEY="__chicken_eggs_staging__::"+KEY;
  const STATUS=["New","Contacted","Reserved","Fulfilled","Cancelled"];
  const MSGS={auto:"Automatic from farm data",available:"In stock now",next_week:"Likely available next week",coming_soon:"Coming soon",none_soon:"Nothing expected soon"};
  const BIRD_TYPES={chicks:"Chicks",pullets:"Pullets",roosters:"Roosters"};
  const whole=v=>Math.max(0,Math.round(Number(v)||0)),nowId=()=>`req-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  let requestListeners=new Set(),suppressEmit=false;

  function blank(){return{version:1,settings:{enabled:false,eggs:"auto",birds:"auto"},requests:[],updatedAt:0};}
  function sanitizeRequest(raw,existing=false){
    const r=raw&&typeof raw==="object"?raw:{},category=r.category==="birds"?"birds":"eggs";
    const birdType=category==="birds"&&BIRD_TYPES[String(r.birdType||"")]?String(r.birdType):"";
    const row={id:String(r.id||nowId()).slice(0,140),name:String(r.name||"").trim().slice(0,80),phone:String(r.phone||"").trim().slice(0,40),email:String(r.email||"").trim().slice(0,120),category,birdType,item:String(r.item||(category==="birds"?(BIRD_TYPES[birdType]||"Birds"):"Eggs")).trim().slice(0,120),quantity:Math.min(999,Math.max(1,whole(r.quantity)||1)),note:String(r.note||"").trim().slice(0,300),status:STATUS.includes(r.status)?r.status:"New",createdAt:whole(r.createdAt||Date.now()),updatedAt:whole(r.updatedAt||Date.now())};
    if(!existing){if(!row.name)throw new Error("Name is required.");if(!row.phone&&!row.email)throw new Error("Enter a phone number or email.");if(row.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))throw new Error("Enter a valid email address.");if(category==="birds"&&!birdType)throw new Error("Choose Chicks, Pullets or Roosters.");}
    return row;
  }
  function sanitizeState(raw){const x=raw&&typeof raw==="object"?raw:{};return{version:1,settings:{enabled:x.settings?.enabled===true,eggs:MSGS[x.settings?.eggs]?x.settings.eggs:"auto",birds:MSGS[x.settings?.birds]?x.settings.birds:"auto"},requests:(Array.isArray(x.requests)?x.requests:[]).map(r=>sanitizeRequest(r,true)).slice(0,500),updatedAt:whole(x.updatedAt)};}
  function load(){try{return sanitizeState(JSON.parse(localStorage.getItem(KEY)||"null"));}catch{return blank();}}
  function write(state,notify=true){const next=sanitizeState(state);next.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(next));if(notify&&!suppressEmit)emitRequests();return next;}
  function reset(state=blank()){return write(state);}
  function createRequest(input){const s=load(),row=sanitizeRequest(input,false);s.requests.unshift(row);write(s);return row;}
  function readSettings(){return{...load().settings};}
  function writeSettings(next){const s=load();s.settings={enabled:next?.enabled===true,eggs:MSGS[next?.eggs]?next.eggs:"auto",birds:MSGS[next?.birds]?next.birds:"auto"};write(s,false);return{...s.settings};}
  function updateRequest(id,patch){const s=load(),row=s.requests.find(r=>r.id===String(id));if(!row)throw new Error("Request not found.");if(patch&&Object.prototype.hasOwnProperty.call(patch,"status")){if(!STATUS.includes(patch.status))throw new Error("Invalid request status.");row.status=patch.status;}row.updatedAt=whole(patch?.updatedAt||Date.now());write(s,false);if(!suppressEmit)emitRequests();return{...row};}
  function snapshots(){return load().requests.map(row=>({id:row.id,data:()=>({...row})}));}
  function emitRequests(){const snap={docs:snapshots()};requestListeners.forEach(fn=>{try{fn(snap);}catch(e){console.error(e);}});}

  const fakeDb={__stagingCustomerRequests:true};
  const fakeFs={
    doc(_db,...parts){return{kind:"doc",parts};},collection(_db,...parts){return{kind:"collection",parts};},
    async getDoc(ref){const ok=ref?.parts?.[0]==="public_customer"&&ref?.parts?.[1]==="request_settings",data=ok?readSettings():null;return{exists:()=>!!data,data:()=>data?{...data}:undefined};},
    onSnapshot(ref,next,error){if(ref?.parts?.[0]!=="customer_requests"){queueMicrotask(()=>error?.(new Error("Unsupported staging listener.")));return()=>{};}requestListeners.add(next);queueMicrotask(()=>{try{next({docs:snapshots()});}catch(e){error?.(e);}});return()=>requestListeners.delete(next);},
    async setDoc(ref,data){if(ref?.parts?.[0]!=="public_customer"||ref?.parts?.[1]!=="request_settings")throw new Error("Staging write blocked: unsupported document.");writeSettings(data);},
    async updateDoc(ref,patch){if(ref?.parts?.[0]!=="customer_requests")throw new Error("Staging write blocked: unsupported collection.");return updateRequest(ref.parts[1],patch||{});}
  };

  window.PublicCustomerOwnerAuth={version:"staging-parity",init:async()=>({ready:true,connected:true,uid:"staging-owner",email:"staging@example.test"}),status:()=>({ready:true,connected:true,uid:"staging-owner",email:"staging@example.test"}),publisherDb:async()=>fakeDb,currentOwner:async()=>({uid:"staging-owner",email:"staging@example.test",isAnonymous:false}),signIn:async()=>({uid:"staging-owner",email:"staging@example.test",isAnonymous:false}),disconnect:async()=>({ready:true,connected:true,uid:"staging-owner",email:"staging@example.test"})};

  window.StagingCustomerRequestsLiveParityV1={version:3,key:KEY,statuses:STATUS.slice(),birdTypes:{...BIRD_TYPES},load,reset,createRequest,readSettings,writeSettings,updateRequest,firestoreApi:fakeFs,db:fakeDb,emitRequests,setSuppressEmit:value=>{suppressEmit=!!value;}};
  window.addEventListener("storage",event=>{if(event.key===PHYSICAL_KEY&&!suppressEmit)emitRequests();});

  try{
    const build=String(window.__ChickenEggsBuild||Date.now()),stageBuild=String(window.__ChickenEggsStagingBuild||Date.now());
    const url=new URL("../customer-requests-owner-v1.js",document.currentScript?.src||location.href);url.searchParams.set("app",build);url.searchParams.set("stage",stageBuild);url.searchParams.set("parity","1");
    const xhr=new XMLHttpRequest();xhr.open("GET",url.href,false);xhr.send(null);if(!((xhr.status>=200&&xhr.status<300)||xhr.status===0))throw new Error(`Customer Requests live source HTTP ${xhr.status}`);
    let source=String(xhr.responseText||"");
    const sdkOld=`  async function sdk(){\n    if(fs)return fs;\n    fs=await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");\n    return fs;\n  }\n  async function ownerDb(){\n    await window.PublicCustomerOwnerAuth?.init?.();\n    if(!authStatus().connected)throw new Error("Connect Customer Page Sync first.");\n    db=await window.PublicCustomerOwnerAuth.publisherDb();\n    await sdk();\n    return db;\n  }`;
    const sdkNew=`  async function sdk(){\n    if(fs)return fs;\n    fs=window.StagingCustomerRequestsLiveParityV1.firestoreApi;\n    return fs;\n  }\n  async function ownerDb(){\n    db=window.StagingCustomerRequestsLiveParityV1.db;\n    await sdk();\n    return db;\n  }`;
    if(!source.includes(sdkOld))throw new Error("Live Customer Requests data-layer signature changed; staging refused to run a non-parity copy.");
    source=source.replace(sdkOld,sdkNew);

    // Candidate closed-inbox behavior under test. The live owner UI still renders
    // every stored request first; this staging-only wrapper then keeps Fulfilled
    // and Cancelled cards out of the default inbox while preserving an explicit
    // Show closed archive. This lets the sandbox prove the behavior without
    // deleting request history or changing the live app.
    const stateOld='  let fs=null,db=null,unsubscribe=null,rows=[],settings={enabled:false,eggs:"auto",birds:"auto"},busy=false,lastError="";';
    const stateCandidate='  let fs=null,db=null,unsubscribe=null,rows=[],settings={enabled:false,eggs:"auto",birds:"auto"},busy=false,lastError="",showClosed=false;';
    if(!source.includes(stateOld))throw new Error("Live Customer Requests state signature changed; staging refused to test the closed-inbox candidate.");
    source=source.replace(stateOld,stateCandidate);
    if(!source.includes('  function render(){'))throw new Error("Live Customer Requests render signature changed; staging refused to test the closed-inbox candidate.");
    source=source.replace('  function render(){','  function renderLive(){');
    const safeRowMarker='  function safeRow(docSnap){';
    const archiveCandidate=`  function render(){
    renderLive();
    const body=document.getElementById("customerRequestOwnerBody");
    if(!body||!authStatus().connected)return;
    const closedStatuses=["Fulfilled","Cancelled"];
    const closedCount=rows.filter(row=>closedStatuses.includes(row.status)).length;
    const openCount=rows.length-closedCount;
    const inbox=[...body.querySelectorAll(".farm2-card")].find(card=>card.querySelector(".farm2-kicker")?.textContent?.includes("Request inbox"));
    if(!inbox)return;
    const kicker=inbox.querySelector(".farm2-kicker"),heading=inbox.querySelector("h3");
    const list=[...inbox.children].find(child=>child.tagName==="DIV"&&!child.classList.contains("farm2-kicker"));
    if(kicker)kicker.textContent=showClosed?"📨 All requests":"📨 Open request inbox";
    if(heading){
      const count=showClosed?rows.length:openCount;
      heading.textContent=count+(showClosed?" total request":" open request")+(count===1?"":"s");
    }
    body.querySelectorAll(".req-card").forEach(card=>{
      const id=card.querySelector("[data-req-save]")?.dataset.reqSave||"";
      const row=rows.find(item=>item.id===id);
      card.hidden=!showClosed&&!!row&&closedStatuses.includes(row.status);
    });
    if(!showClosed&&openCount===0&&rows.length>0&&list){
      const empty=document.createElement("div");
      empty.id="reqOpenInboxEmpty";empty.className="farm2-subtle";empty.textContent="No open customer requests.";
      list.appendChild(empty);
    }
    if(closedCount>0&&heading){
      const toggle=document.createElement("button");
      toggle.id="reqToggleClosed";toggle.className="secondary";toggle.type="button";
      toggle.style.margin="0 0 10px";
      toggle.textContent=showClosed?"Hide closed ("+closedCount+")":"Show closed ("+closedCount+")";
      toggle.addEventListener("click",()=>{showClosed=!showClosed;render();});
      heading.insertAdjacentElement("afterend",toggle);
    }
  }`;
    if(!source.includes(safeRowMarker))throw new Error("Live Customer Requests row signature changed; staging refused to test the closed-inbox candidate.");
    source=source.replace(safeRowMarker,archiveCandidate+"\n"+safeRowMarker);

    // Candidate fix under test. This is the ONLY behavior patch beyond swapping
    // Firebase for the sandbox adapter. If staging proves it, this exact function
    // can replace the live function without being rewritten a second time.
    const updateOld=`  async function updateStatus(id,status){\n    if(!STATUS.includes(status))return;try{const d=await ownerDb(),a=await sdk();await a.updateDoc(a.doc(d,"customer_requests",String(id)),{status,updatedAt:Date.now()});lastError="";}catch(e){lastError=String(e?.message||e);render();}\n  }`;
    const updateCandidate=`  async function updateStatus(id,status){\n    if(busy||!STATUS.includes(status))return;\n    const row=rows.find(r=>r.id===String(id));\n    const previous=row?.status||"";\n    const updatedAt=Date.now();\n    busy=true;lastError="";\n    const btn=document.querySelector(\`[data-req-save="\${CSS.escape(String(id))}"]\`);\n    if(btn){btn.disabled=true;btn.textContent="Updating…";}\n    try{\n      const d=await ownerDb(),a=await sdk();\n      await a.updateDoc(a.doc(d,"customer_requests",String(id)),{status,updatedAt});\n      if(row){row.status=status;row.updatedAt=updatedAt;}\n      lastError="";\n    }catch(e){\n      if(row&&previous)row.status=previous;\n      lastError=String(e?.message||e);\n    }finally{\n      busy=false;render();\n    }\n  }`;
    if(!source.includes(updateOld))throw new Error("Live Customer Requests status-update signature changed; staging refused to test the wrong candidate.");
    source=source.replace(updateOld,updateCandidate).replace('window.FarmCustomerRequestsV1={version:2,','window.FarmCustomerRequestsV1={version:"2-staging-parity-candidate-closed-inbox-v1",');
    (0,eval)(`${source}\n//# sourceURL=staging-customer-requests-live-parity-runtime.js`);
    if(!window.FarmCustomerRequestsV1)throw new Error("Live Customer Requests UI did not initialize in staging.");
    console.log("🪞 STAGING Customer Requests candidate active — live UI source + sandbox adapter + immediate status update + closed-inbox archive");
  }catch(error){console.error("STAGING Customer Requests live parity failed:",error);}
})();
