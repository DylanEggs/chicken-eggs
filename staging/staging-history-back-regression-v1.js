(() => {
  "use strict";
  if (window.__StagingHistoryBackRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingHistoryBackRegressionV1 = true;

  const DATA_KEYS=["chickenEggEntriesV102","chickenEggSettingsV102","chickenEggApp2V1","chickenEggInventoryV2","chickenEggBusinessV1"];
  const snapshot=()=>Object.fromEntries(DATA_KEYS.map(k=>[k,localStorage.getItem(k)]));
  const unchanged=(a,b)=>DATA_KEYS.every(k=>a[k]===b[k]);
  const active=()=>document.querySelector(".screen.active")?.id||"";

  function patch(){
    const history=document.getElementById("history");
    if(!history)return false;
    const top=history.querySelector(".screenTitle .backMini");
    const bottom=[...history.querySelectorAll("button.secondary")].find(b=>b.textContent.trim()==="Back");
    for(const button of [top,bottom]){
      if(!button)continue;
      button.setAttribute("onclick","showScreen('farm2Hub')");
      button.dataset.historyBackTarget="farm2Hub";
    }
    return !!top&&!!bottom;
  }

  function clickAndCheck(button){
    window.showScreen?.("history");
    button?.click();
    return active()==="farm2Hub";
  }

  async function runChecks(){
    const results=[];
    const check=(name,pass,detail="")=>results.push({name,pass:!!pass,detail:String(detail||"")});
    const before=snapshot();
    const start=active()||"dashboard";
    try{
      check("History back buttons are present and patched",patch());
      const history=document.getElementById("history");
      const top=history?.querySelector(".screenTitle .backMini");
      const bottom=[...(history?.querySelectorAll("button.secondary")||[])].find(b=>b.textContent.trim()==="Back");
      check("History top arrow returns to Farm hub",clickAndCheck(top),`active=${active()}`);
      check("History bottom Back returns to Farm hub",clickAndCheck(bottom),`active=${active()}`);
      check("History back navigation does not change farm data",unchanged(before,snapshot()));
    }catch(error){
      check("History back regression completed without exception",false,String(error?.stack||error));
    }finally{
      try{window.showScreen?.(start);}catch{}
    }
    return results;
  }

  function install(){
    patch();
    const base=window.StagingFullTest;
    if(!base?.run||base.__historyBackV1){setTimeout(install,100);return;}
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){const first=await baseRun();patch();const extra=await runChecks();const results=[...(first?.results||[]),...extra];const failed=results.filter(x=>!x.pass);return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+history-back-v1`};},__historyBackV1:true};
    console.log("🧪 STAGING history back regression active — both History back buttons must return to Farm hub");
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(install,1700),{once:true});else setTimeout(install,1700);
})();