(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode || window.__StagingCustomerPreviewGuardV1) return;
  window.__StagingCustomerPreviewGuardV1 = true;

  const SEED="chickenEggStagingSeedV1";
  const CORE=["chickenEggApp2V1","chickenEggInventoryV2","chickenEggEntriesV102","chickenEggSettingsV102"];
  const LOCAL_COPY=[...CORE,"chickenEggWeatherIntelligenceV2","chickenEggDeluxeV1","chickenEggBusinessV1"];
  let opening=false;
  const hasSnapshot=()=>CORE.some(k=>{try{return !!localStorage.getItem(k);}catch{return false;}});

  function copyFromLiveBrowserStorage(){
    const values={};
    const old=window.__ChickenEggsStagingMode;
    try{
      window.__ChickenEggsStagingMode=false;
      for(const key of LOCAL_COPY){
        try{const value=localStorage.getItem(key);if(value!=null)values[key]=value;}catch{}
      }
    }finally{window.__ChickenEggsStagingMode=old;}
    for(const [key,value] of Object.entries(values)){
      try{localStorage.setItem(key,value);}catch{}
    }
    return Object.keys(values).length;
  }

  async function prepareAndOpen(link){
    if(opening)return;opening=true;
    const old=link.textContent;
    link.textContent="⏳ Preparing Customer Preview…";
    link.style.pointerEvents="none";
    try{
      // First repair from the current LIVE browser copy. This is local-only and
      // uses ZERO Firestore reads, so opening Customer Preview never creates a bill.
      if(!hasSnapshot())copyFromLiveBrowserStorage();
      if(!hasSnapshot())throw new Error("No local staging snapshot is available. Use Refresh Test Data From Live once, then open Customer Preview again.");
      let seed=null;try{seed=JSON.parse(localStorage.getItem(SEED)||"null");}catch{}
      if(!seed?.completed){
        localStorage.setItem(SEED,JSON.stringify({completed:true,importedAt:Date.now(),source:"prepared from local browser farm copy; zero Firebase reads",previewPrepared:true}));
      }
      const url=new URL(link.href,location.href);
      url.searchParams.set("stage",String(window.__ChickenEggsStagingBuild||Date.now()));
      location.href=url.href;
    }catch(error){
      console.error("Could not prepare staging customer preview:",error);
      alert(`Customer Preview could not open because the staging snapshot is not ready. Live data was not changed and no Firebase write was attempted.\n\n${String(error?.message||error)}`);
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

  window.StagingCustomerPreviewGuardV1={version:3,hasSnapshot,copyFromLiveBrowserStorage,prepareAndOpen};
})();