(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode || window.__StagingCustomerPreviewGuardV1) return;
  window.__StagingCustomerPreviewGuardV1 = true;

  const SEED="chickenEggStagingSeedV1";
  const CORE=["chickenEggApp2V1","chickenEggInventoryV2","chickenEggEntriesV102","chickenEggSettingsV102"];
  let opening=false;
  const hasSnapshot=()=>CORE.some(k=>{try{return !!localStorage.getItem(k);}catch{return false;}});

  async function prepareAndOpen(link){
    if(opening)return;opening=true;
    const old=link.textContent;
    link.textContent="⏳ Preparing Customer Preview…";
    link.style.pointerEvents="none";
    try{
      if(!hasSnapshot()){
        const ok=await window.FarmSyncSafety?.ready?.();
        if(ok===false&&!hasSnapshot())throw new Error("The staging farm does not have a usable snapshot yet.");
      }
      if(!hasSnapshot())throw new Error("The staging farm does not have a usable snapshot yet.");
      let seed=null;try{seed=JSON.parse(localStorage.getItem(SEED)||"null");}catch{}
      if(!seed?.completed){
        localStorage.setItem(SEED,JSON.stringify({completed:true,importedAt:Date.now(),source:"prepared from current isolated staging state",previewPrepared:true}));
      }
      const url=new URL(link.href,location.href);
      url.searchParams.set("stage",String(window.__ChickenEggsStagingBuild||Date.now()));
      location.href=url.href;
    }catch(error){
      console.error("Could not prepare staging customer preview:",error);
      alert(`Customer Preview could not open because the staging snapshot is not ready. Live data was not changed.\n\n${String(error?.message||error)}`);
      opening=false;link.textContent=old;link.style.pointerEvents="";
    }
  }

  document.addEventListener("click",event=>{
    const link=event.target?.closest?.("#stagingSafetyBanner a.st-customer");
    if(!link)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void prepareAndOpen(link);
  },true);

  window.StagingCustomerPreviewGuardV1={version:1,hasSnapshot,prepareAndOpen};
})();
