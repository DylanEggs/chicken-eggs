(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode || window.__StagingCustomerPreviewGuardV1) return;
  window.__StagingCustomerPreviewGuardV1 = true;

  const CORE=["chickenEggApp2V1","chickenEggInventoryV2","chickenEggEntriesV102","chickenEggSettingsV102"];
  const PREVIEW_KEYS=[...CORE,"chickenEggWeatherIntelligenceV2","chickenEggDeluxeV1"];
  const PREVIEW_SESSION="chickenEggStagingCustomerPreviewV2";
  let opening=false;
  const hasSnapshot=()=>CORE.every(k=>{try{return localStorage.getItem(k)!==null;}catch{return false;}});

  function sourceResult(){return window.StagingSandbox?.liveSourceResult?.()||window.__StagingLiveSourceResult||window.StagingLocalSeedV1?.result||null;}
  async function refreshSource(){
    let r=sourceResult();
    if(r?.verified&&hasSnapshot())return r;
    try{await window.StagingSandbox?.resetFromLive?.();}catch{}
    r=sourceResult();
    renderMirrorBadge();
    return r;
  }
  function renderMirrorBadge(){
    const row=document.querySelector("#stagingSafetyBanner .st-row");
    if(!row){setTimeout(renderMirrorBadge,120);return;}
    let el=document.getElementById("stagingLiveMirrorState");
    if(!el){
      el=document.createElement("span");el.id="stagingLiveMirrorState";
      el.style.cssText="display:inline-flex;align-items:center;padding:7px 9px;border-radius:10px;background:#173d28;color:#d9ffe6;border:1px solid rgba(255,255,255,.35);font-size:11px;font-weight:900;line-height:1.1";
      row.appendChild(el);
    }
    const r=sourceResult();
    if(r?.verified&&hasSnapshot()){
      const cloud=String(r.source||"").includes("firebase");
      el.textContent=cloud?`☁️ LIVE Firebase verified • ${Number(r.copied)||0}/${Number(r.eligible)||0} datasets`:`🪞 LIVE copy verified • ${Number(r.copied)||0}/${Number(r.eligible)||0} datasets`;
      el.style.background="#173d28";
    }else{
      const why=String(r?.error||"").trim();
      el.textContent=why?`⚠️ LIVE refresh failed • ${why.slice(0,70)}`:"☁️ LIVE data not loaded yet • Refresh or Run Test";
      el.style.background=why?"#7f1d1d":"#6b4f00";
    }
  }

  function previewValue(key){
    try{
      const raw=localStorage.getItem(key);
      if(raw==null)return null;
      const value=JSON.parse(raw);
      if(key==="chickenEggDeluxeV1"&&value&&typeof value==="object"){
        const compact={...value};
        if(compact.birdPhotoUrls&&typeof compact.birdPhotoUrls==="object")compact.birdPhotoUrls={};
        return compact;
      }
      return value;
    }catch{return null;}
  }

  function preparePreviewSnapshot(r){
    const values={};
    for(const key of PREVIEW_KEYS){
      const value=previewValue(key);
      if(value!==null)values[key]=value;
    }
    values.chickenEggStagingSeedV1={
      importedAt:Number(r?.at)||Date.now(),
      source:String(r?.source||"verified-live-read-only"),
      verified:!!r?.verified,
      copied:Number(r?.copied)||0,
      eligible:Number(r?.eligible)||0
    };
    const payload={version:2,createdAt:Date.now(),values};
    sessionStorage.setItem(PREVIEW_SESSION,JSON.stringify(payload));
    const parsed=JSON.parse(sessionStorage.getItem(PREVIEW_SESSION)||"{}");
    const saved=parsed?.values||{};
    if(!CORE.every(k=>saved[k]!=null))throw new Error("Could not prepare the isolated Customer Preview snapshot.");
    return {ok:true,keys:Object.keys(saved).length,at:payload.createdAt};
  }

  async function prepareAndOpen(link){
    if(opening)return;opening=true;
    const old=link.textContent;
    link.textContent="⏳ Verifying LIVE data…";
    link.style.pointerEvents="none";
    try{
      const r=await refreshSource();
      if(!r?.verified)throw new Error(r?.error||"Fresh LIVE data could not be verified for staging.");
      if(!hasSnapshot())throw new Error("The verified LIVE snapshot did not contain all required staging core datasets.");
      preparePreviewSnapshot(r);
      const url=new URL(link.href,location.href);
      url.searchParams.set("stage",String(window.__ChickenEggsStagingBuild||Date.now()));
      url.searchParams.set("live",String(r.at||Date.now()));
      location.href=url.href;
    }catch(error){
      console.error("Could not prepare staging customer preview:",error);
      alert(`Customer Preview did not open because TEST/STAGING could not prepare fresh verified data. Live data was not changed.\n\n${String(error?.message||error)}`);
      opening=false;link.textContent=old;link.style.pointerEvents="";
    }
  }

  document.addEventListener("click",event=>{
    const link=event.target?.closest?.("#stagingSafetyBanner a.st-customer");
    if(!link)return;
    event.preventDefault();event.stopImmediatePropagation();
    void prepareAndOpen(link);
  },true);
  for(const name of ["staging-live-source-verified","staging-live-browser-mirrored","farm-sync-ready"])window.addEventListener(name,renderMirrorBadge);

  window.StagingCustomerPreviewGuardV1={version:8,hasSnapshot,sourceResult,refreshSource,renderMirrorBadge,preparePreviewSnapshot,prepareAndOpen,previewSessionKey:PREVIEW_SESSION};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderMirrorBadge,{once:true});else renderMirrorBadge();
})();