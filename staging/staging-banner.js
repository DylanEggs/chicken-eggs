(() => {
  "use strict";
  if (window.__ChickenEggsStagingBanner) return;
  window.__ChickenEggsStagingBanner = true;

  function inject() {
    if (!document.body || document.getElementById("stagingSafetyBanner")) return;
    const style=document.createElement("style");
    style.textContent=`
      #stagingSafetyBanner{position:sticky;top:0;z-index:100000;background:#7f1d1d;color:#fff;padding:9px 12px;box-shadow:0 3px 14px rgba(0,0,0,.25);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #stagingSafetyBanner .st-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;font-weight:900;text-align:center}
      #stagingSafetyBanner button,#stagingSafetyBanner a{width:auto!important;margin:0!important;padding:7px 10px!important;border-radius:10px!important;border:1px solid rgba(255,255,255,.4)!important;background:#fff!important;color:#7f1d1d!important;font-size:12px!important;font-weight:900!important;text-decoration:none!important}
      #stagingSafetyBanner small{display:block;text-align:center;margin-top:4px;opacity:.9;font-weight:700}
    `;
    document.head.appendChild(style);
    const bar=document.createElement("div");
    bar.id="stagingSafetyBanner";
    bar.innerHTML=`<div class="st-row">🧪 TEST / STAGING — LIVE FARM DATA IS READ-ONLY <button id="stagingResetLive">Reset Test Copy From Live</button><a href="./">Open LIVE App</a></div><small>Anything you add, edit, delete, pay, restore, or photograph here stays in the sandbox.</small>`;
    document.body.prepend(bar);

    document.getElementById("stagingResetLive")?.addEventListener("click", async()=>{
      if(!confirm("Replace the TEST copy with a fresh read-only snapshot of the LIVE farm? Your live data will not be changed.")) return;
      const btn=document.getElementById("stagingResetLive");
      if(btn){btn.disabled=true;btn.textContent="Copying…";}
      try {
        await window.StagingSandbox?.resetFromLive?.();
        location.reload();
      } catch(error) {
        console.error(error);
        alert("Could not refresh the staging snapshot. Live data was not changed.");
        if(btn){btn.disabled=false;btn.textContent="Reset Test Copy From Live";}
      }
    });
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",inject,{once:true});
  else inject();
})();
