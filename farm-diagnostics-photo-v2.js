(() => {
  "use strict";
  if (window.__farmDiagnosticsPhotoV2) return;
  window.__farmDiagnosticsPhotoV2 = true;

  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

  function append(report){
    if(!report)return;
    const recovery=window.FarmBirdPhotoRecoveryV2?.stats?.() || null;
    report.photoRecovery=recovery;
    const raw=document.getElementById("farmDiagnosticsRaw");
    if(raw)raw.value=JSON.stringify(report,null,2);

    const out=document.getElementById("farmDiagnosticsOutput");
    if(!out||!recovery)return;
    out.querySelector("#farmDiagPhotoRecoveryV2")?.remove();
    const box=document.createElement("div");
    box.id="farmDiagPhotoRecoveryV2";
    box.className="farm2-card";
    const unresolved=recovery.unresolved || [];
    box.innerHTML=`<h3 style="margin-top:0">📷 Flock Photo Recovery</h3>
      <div class="farm2-subtle">Current flock: <b>${recovery.currentFlock}</b> • Photos visible now: <b>${recovery.visibleNow}</b> • Firebase active photo IDs: <b>${recovery.cloudActive}</b></div>
      <div class="farm2-subtle" style="margin-top:6px">Direct current-ID matches: <b>${recovery.currentMatched}</b> • Historical aliases still in use: <b>${recovery.aliasesInUse}</b> • Orphan cloud IDs: <b>${recovery.orphanActive}</b></div>
      <div class="farm2-subtle" style="margin-top:6px">Recovered this session: <b>${(recovery.recovered||[]).length}</b> • Unresolved: <b>${unresolved.length}</b></div>
      ${unresolved.length?`<details style="margin-top:10px"><summary>Show unresolved photo IDs</summary><div class="farm2-subtle" style="margin-top:8px">${unresolved.slice(0,40).map(x=>`${esc(x.name||x.birdId)} — ${esc(x.reason||"")}`).join("<br>")}</div></details>`:""}`;
    out.appendChild(box);
  }

  function install(){
    if(typeof window.farmDiagnosticsRun!=="function"){setTimeout(install,100);return;}
    if(window.farmDiagnosticsRun.__photoV2)return;
    const original=window.farmDiagnosticsRun;
    const wrapped=async function(){
      try{await window.FarmBirdPhotoRecoveryV2?.scan?.();}catch{}
      const report=await original();
      append(report);
      return report;
    };
    wrapped.__photoV2=true;
    window.farmDiagnosticsRun=wrapped;
    if(window.FarmDiagnostics)window.FarmDiagnostics.run=wrapped;

    const oldOpen=window.farmDiagnosticsOpen;
    if(typeof oldOpen==="function"){
      window.farmDiagnosticsOpen=function(){
        const result=oldOpen.apply(this,arguments);
        setTimeout(()=>void wrapped(),250);
        return result;
      };
    }

    window.addEventListener("bird-photos-changed",()=>{
      const report=window.FarmDiagnostics?.getLastReport?.();
      if(report)append(report);
    });
    console.log("✅ Farm Diagnostics photo recovery detail v2 active");
  }

  install();
})();
