(() => {
  "use strict";
  if (window.StagingCustomerRequestPublicParityV1) return;

  const PREFIX="__chicken_eggs_staging__::";
  const KEY=PREFIX+"chickenEggCustomerRequestsV1";
  const STATUS=["New","Contacted","Reserved","Fulfilled","Cancelled"];
  const MSGS={auto:"Automatic from farm data",available:"In stock now",next_week:"Likely available next week",coming_soon:"Coming soon",none_soon:"Nothing expected soon"};
  const BIRD_TYPES={chicks:"Chicks",pullets:"Pullets",roosters:"Roosters"};
  const whole=v=>Math.max(0,Math.round(Number(v)||0));
  const listeners=new Set();

  function blank(){return {version:1,settings:{enabled:false,eggs:"auto",birds:"auto"},requests:[],updatedAt:0};}
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||"null");return x&&typeof x==="object"?{...blank(),...x,settings:{...blank().settings,...(x.settings||{})},requests:Array.isArray(x.requests)?x.requests:[]}:blank();}catch{return blank();}}
  function save(state){const next={...blank(),...(state||{}),settings:{...blank().settings,...(state?.settings||{})},requests:Array.isArray(state?.requests)?state.requests:[],updatedAt:Date.now()};localStorage.setItem(KEY,JSON.stringify(next));emit();return next;}
  function emit(){const snap={docs:load().requests.map(r=>({id:String(r.id||""),data:()=>({...r})}))};listeners.forEach(fn=>{try{fn(snap);}catch{}});}
  function createRequest(data){const s=load(),t=Date.now(),row={id:`req-${t}-${Math.random().toString(36).slice(2,8)}`,name:String(data?.name||"").slice(0,80),phone:String(data?.phone||"").slice(0,40),email:String(data?.email||"").slice(0,120),category:data?.category==="birds"?"birds":"eggs",birdType:BIRD_TYPES[data?.birdType]?data.birdType:"",item:String(data?.item||"").slice(0,120),quantity:Math.min(999,Math.max(1,whole(data?.quantity)||1)),note:String(data?.note||"").slice(0,300),status:"New",createdAt:t,updatedAt:t,source:"staging-live-parity"};s.requests.unshift(row);save(s);return row;}
  function settings(){const s=load().settings||{};return {enabled:s.enabled===true,eggs:MSGS[s.eggs]?s.eggs:"auto",birds:MSGS[s.birds]?s.birds:"auto"};}

  const fakeDb={__stagingPublicRequests:true};
  const fs={
    doc(_db,...parts){return {kind:"doc",parts};},
    collection(_db,...parts){return {kind:"collection",parts};},
    onSnapshot(ref,next,error){
      if(ref?.parts?.[0]==="public_customer"&&ref?.parts?.[1]==="request_settings"){
        const fn=()=>{const x=settings();next({exists:()=>true,data:()=>({...x})});};
        listeners.add(fn);queueMicrotask(fn);return()=>listeners.delete(fn);
      }
      queueMicrotask(()=>error?.(new Error("Unsupported staging listener.")));return()=>{};
    },
    async addDoc(ref,data){if(ref?.parts?.[0]!=="customer_requests")throw new Error("Staging write blocked.");return {id:createRequest(data).id};}
  };

  window.CustomerViewPublic=window.CustomerViewPublic||window.CustomerViewStaging;
  window.StagingCustomerRequestPublicParityV1={version:1,key:KEY,load,save,createRequest,settings,firestoreApi:fs,db:fakeDb};

  try{
    const url=new URL("../../view/customer-requests-v1.js",document.currentScript?.src||location.href);url.searchParams.set("stage",String(Date.now()));
    const xhr=new XMLHttpRequest();xhr.open("GET",url.href,false);xhr.send(null);
    if(!((xhr.status>=200&&xhr.status<300)||xhr.status===0))throw new Error(`Live customer request source HTTP ${xhr.status}`);
    let source=String(xhr.responseText||"");
    source=source.replace(/^import .*?;\n/gm,"");
    source=source.replace(/const app=getApps\(\)\.length\?getApp\(\):initializeApp\(firebaseConfig\),db=getFirestore\(app\);/, 'const app={name:"staging-public-request-parity"},db=window.StagingCustomerRequestPublicParityV1.db;');
    source=`const {doc,onSnapshot,collection,addDoc}=window.StagingCustomerRequestPublicParityV1.firestoreApi;\n${source}`;
    (0,eval)(`${source}\n//# sourceURL=staging-view-customer-request-live-parity-runtime.js`);
    if(!window.CustomerRequestViewV1)throw new Error("Live public Customer Requests UI did not initialize in staging preview.");
    console.log("🪞 STAGING customer preview request parity active — live UI with sandbox-only writes");
  }catch(error){console.error("STAGING public Customer Requests parity failed:",error);}
})();
