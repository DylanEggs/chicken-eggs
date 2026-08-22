(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode || window.__StagingCustomerPreviewGuardV1) return;
  window.__StagingCustomerPreviewGuardV1 = true;

  const CORE=["chickenEggApp2V1","chickenEggInventoryV2","chickenEggEntriesV102","chickenEggSettingsV102"];
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
      el.textContent=why?`⚠️ LIVE data not verified • ${why.slice(0,70)}`:"⚠️ LIVE data not verified • testing locked";
      el.style.background="#7f1d1d";
    }
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
      const url=new URL(link.href,location.href);
      url.searchParams.set("stage",String(window.__ChickenEggsStagingBuild||Date.now()));
      url.searchParams.set("live",String(r.at||Date.now()));
      location.href=url.href;
    }catch(error){
      console.error("Could not prepare staging customer preview:",error);
      alert(`Customer Preview did not open because TEST/STAGING could not verify fresh LIVE data. Live data was not changed.\n\n${String(error?.message||error)}`);
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

  window.StagingCustomerPreviewGuardV1={version:6,hasSnapshot,sourceResult,refreshSource,renderMirrorBadge,prepareAndOpen};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderMirrorBadge,{once:true});else renderMirrorBadge();
})();