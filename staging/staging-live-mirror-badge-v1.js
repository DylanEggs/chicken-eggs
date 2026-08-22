(() => {
  "use strict";
  if (window.__StagingLiveMirrorBadgeV1) return;
  window.__StagingLiveMirrorBadgeV1 = true;

  function text(){
    const r=window.StagingLocalSeedV1?.result;
    if(r?.verified&&r?.hasLiveBrowserData)return `🪞 LIVE mirror verified • ${Number(r.copied)||0} keys • 0 Firebase reads`;
    if(r?.hasLiveBrowserData)return `⚠️ LIVE mirror incomplete • ${Number(r.copied)||0} copied • testing locked`;
    return "⚠️ No LIVE browser mirror found • testing locked";
  }
  function render(){
    const bar=document.querySelector("#stagingSafetyBanner .st-row");
    if(!bar){setTimeout(render,120);return;}
    let el=document.getElementById("stagingLiveMirrorState");
    if(!el){
      el=document.createElement("span");el.id="stagingLiveMirrorState";
      el.style.cssText="display:inline-flex;align-items:center;padding:7px 9px;border-radius:10px;background:#173d28;color:#d9ffe6;border:1px solid rgba(255,255,255,.35);font-size:11px;font-weight:900;line-height:1.1";
      bar.appendChild(el);
    }
    el.textContent=text();
    el.dataset.verified=window.StagingLocalSeedV1?.result?.verified?"true":"false";
  }
  window.addEventListener("staging-live-browser-mirrored",event=>{
    if(window.StagingLocalSeedV1&&event?.detail)window.StagingLocalSeedV1.result=event.detail;
    render();
  });
  window.StagingLiveMirrorBadgeV1={version:1,render,text};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});else render();
})();
