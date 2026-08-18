(() => {
  "use strict";
  if (window.__ChickenEggsStagingDiagnostics) return;
  window.__ChickenEggsStagingDiagnostics = true;

  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}};
  function report(){
    const entries=read("chickenEggEntriesV102",[]);
    const app=read("chickenEggApp2V1",{});
    const inv=read("chickenEggInventoryV2",{});
    const biz=read("chickenEggBusinessV1",{});
    const photos=read("chickenEggLocalBirdPhotosV1",{});
    const storage=window.StagingStorageSandbox?.diagnostics?.()||{};
    return {
      environment:"STAGING",
      liveFirestoreExposed:!!window.FirestoreDB,
      liveFirebaseUserExposed:!!window.FirebaseUser,
      firebaseMode:window.__STAGING_FIREBASE_READONLY__?"READ ONLY":"UNKNOWN",
      entries:Array.isArray(entries)?entries.length:0,
      flock:Array.isArray(app.flock)?app.flock.length:0,
      inventory:{dozens:Number(inv.dozens)||0,packs18:Number(inv.packs18)||0,loose:Number(inv.loose)||0},
      chickenSales:Array.isArray(biz.chickenSales)?biz.chickenSales.length:0,
      stagedPhotos:Object.keys(photos||{}).length,
      seed:window.StagingSandbox?.seedInfo?.()||null,
      storage
    };
  }
  window.StagingDiagnostics={report};

  function inject(){
    const farm=document.getElementById("farm")||document.getElementById("farm2Hub");
    if(!farm||document.getElementById("stagingDiagnosticsCard"))return;
    const card=document.createElement("div");
    card.id="stagingDiagnosticsCard";
    card.className="farm2-card";
    card.style.marginTop="14px";
    card.innerHTML=`<div class="farm2-kicker">🧪 Staging Safety</div><div style="font-weight:900;margin-top:4px">Sandbox diagnostics</div><div class="farm2-subtle" style="margin-top:5px">Live Firestore is intentionally not exposed to the app code.</div><button type="button" id="stagingDiagBtn" style="margin-top:10px">Run Staging Check</button><pre id="stagingDiagOut" style="white-space:pre-wrap;font-size:11px;max-height:280px;overflow:auto"></pre>`;
    farm.appendChild(card);
    document.getElementById("stagingDiagBtn")?.addEventListener("click",()=>{
      const r=report();
      document.getElementById("stagingDiagOut").textContent=JSON.stringify(r,null,2);
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(inject,500),{once:true});
  else setTimeout(inject,500);
})();
