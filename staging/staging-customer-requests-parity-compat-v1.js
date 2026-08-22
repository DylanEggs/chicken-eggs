(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode || window.__StagingCustomerRequestsParityCompatBootV1) return;
  window.__StagingCustomerRequestsParityCompatBootV1=true;
  const ENTRIES="chickenEggEntriesV102",INVENTORY="chickenEggInventoryV2",APP2="chickenEggApp2V1";
  const MSGS={auto:"Automatic from farm data",available:"In stock now",next_week:"Likely available next week",coming_soon:"Coming soon",none_soon:"Nothing expected soon"};
  const BIRD_TYPES={chicks:"Chicks",pullets:"Pullets",roosters:"Roosters"};
  const n=v=>Number(v)||0,whole=v=>Math.max(0,Math.round(n(v)));
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}};

  function boot(){
    if(window.StagingCustomerRequestsV1)return;
    const p=window.StagingCustomerRequestsLiveParityV1,ui=window.FarmCustomerRequestsV1;
    if(!p||!ui||!String(ui.version||"").includes("staging-parity")){setTimeout(boot,100);return;}
    function physicalEggs(){const i=read(INVENTORY,{});return whole(i.dozens)*12+whole(i.packs18)*18+whole(i.loose);}
    function reservedEggs(){const a=read(APP2,{});return (Array.isArray(a.orders)?a.orders:[]).filter(o=>o?.status==="pending").reduce((s,o)=>s+whole(o.dozen)*12+whole(o.packs18)*18,0);}
    function autoAvailability(kind){
      if(kind==="birds"){
        const a=read(APP2,{}),rows=Array.isArray(a.birdListings)?a.birdListings:[];
        if(rows.some(x=>x?.public!==false&&whole(x.quantity)>0&&String(x.status||"Available")==="Available"))return"In stock now";
        if(rows.some(x=>x?.public!==false&&["Coming Soon","Reserved"].includes(String(x.status||""))))return"Coming soon";
        return"Nothing expected soon";
      }
      const available=Math.max(0,physicalEggs()-reservedEggs());
      if(available>=12)return"In stock now";if(available>0)return"Limited availability";
      const e=read(ENTRIES,[]).filter(x=>x?.type==="eggs"&&Number(x.eggs)>0).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,7);
      const avg=e.length?e.reduce((s,x)=>s+n(x.eggs),0)/e.length:0;return avg>=2?"Likely available next week":"Nothing expected soon";
    }
    function publicAvailability(kind){const s=p.readSettings(),v=s[kind]||"auto";return v==="auto"?autoAvailability(kind):MSGS[v];}
    function setAvailability(kind,value){if(!["eggs","birds"].includes(kind)||!MSGS[value])throw new Error("Invalid availability setting.");const s=p.readSettings();s[kind]=value;p.writeSettings(s);ui.render();return publicAvailability(kind);}
    function updateStatus(id,status){return p.updateRequest(id,{status,updatedAt:Date.now()});}
    function render(){return ui.render();}
    window.StagingCustomerRequestsV1={version:"live-parity",key:p.key,load:p.load,save:p.reset,createRequest:p.createRequest,updateStatus,setAvailability,publicAvailability,autoAvailability,render,statuses:p.statuses.slice(),birdTypes:{...BIRD_TYPES}};
    window.dispatchEvent(new CustomEvent("staging-final-suite-changed"));
    console.log("🪞 STAGING Customer Requests compatibility API now points to the live UI parity layer");
  }
  boot();
})();