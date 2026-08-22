(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode || window.__StagingCustomerPreviewGuardV1) return;
  window.__StagingCustomerPreviewGuardV1 = true;

  const CORE=["chickenEggApp2V1","chickenEggInventoryV2","chickenEggEntriesV102","chickenEggSettingsV102"];
  let opening=false;
  const hasSnapshot=()=>CORE.every(k=>{try{return !!localStorage.getItem(k);}catch{return false;}});

  function mirrorResult(){return window.StagingLocalSeedV1?.result||null;}
  function refreshMirror(){
    const r=window.StagingLocalSeedV1?.syncFromLiveBrowser?.();
    if(r&&window.StagingLocalSeedV1)window.StagingLocalSeedV1.result=r;
    renderMirrorBadge();
    return r||mirrorResult();
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
    const r=mirrorResult();
    if(r?.verified&&r?.hasLiveBrowserData){
      const removed=Number(r.removedStale)||0;
      el.textContent=`🪞 LIVE mirror verified • ${Number(r.copied)||0}/${Number(r.eligible)||0} keys${removed?` • ${removed} stale removed`:""} • 0 Firebase reads`;
      el.style.background="#173d28";
    }else{
      const skipped=Number(r?.skipped)||0,mismatch=Array.isArray(r?.mismatchedKeys)?r.mismatchedKeys.length:0,stale=Array.isArray(r?.remainingStale)?r.remainingStale.length:0;
      el.textContent=`⚠️ LIVE mirror not verified • skipped ${skipped} • mismatch ${mismatch} • stale ${stale} • testing locked`;
      el.style.background="#7f1d1d";
    }
  }

  async function prepareAndOpen(link){
    if(opening)return;opening=true;
    const old=link.textContent;
    link.textContent="⏳ Verifying LIVE mirror…";
    link.style.pointerEvents="none";
    try{
      const r=refreshMirror();
      if(!r?.verified||!r?.hasLiveBrowserData)throw new Error("The current LIVE app browser data could not be mirrored completely and verified for staging.");
      if(!hasSnapshot())throw new Error("The verified LIVE mirror did not contain all required staging core datasets.");
      const url=new URL(link.href,location.href);
      url.searchParams.set("stage",String(window.__ChickenEggsStagingBuild||Date.now()));
      url.searchParams.set("mirror",String(r.at||Date.now()));
      location.href=url.href;
    }catch(error){
      console.error("Could not prepare staging customer preview:",error);
      alert(`Customer Preview did not open because staging could not verify a complete LIVE mirror. Live data was not changed and no Firebase write was attempted.\n\n${String(error?.message||error)}`);
      opening=false;link.textContent=old;link.style.pointerEvents="";
    }
  }

  document.addEventListener("click",event=>{
    const link=event.target?.closest?.("#stagingSafetyBanner a.st-customer");
    if(!link)return;
    event.preventDefault();event.stopImmediatePropagation();
    void prepareAndOpen(link);
  },true);
  window.addEventListener("staging-live-browser-mirrored",event=>{if(window.StagingLocalSeedV1&&event?.detail)window.StagingLocalSeedV1.result=event.detail;renderMirrorBadge();});

  window.StagingCustomerPreviewGuardV1={version:5,hasSnapshot,mirrorResult,refreshMirror,renderMirrorBadge,prepareAndOpen};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderMirrorBadge,{once:true});else renderMirrorBadge();
})();