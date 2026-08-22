(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode) return;
  if (window.__StagingCustomerRequestLiveParityBootV1) return;
  window.__StagingCustomerRequestLiveParityBootV1 = true;

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let parityReady=false;

  async function runParityChecks(){
    const results=[],check=(name,pass,detail="")=>results.push({name,pass:!!pass,detail:String(detail||"")});
    const data=window.StagingCustomerRequestsLiveParityV1,ui=window.FarmCustomerRequestsV1;
    const KEY=data?.key||"chickenEggCustomerRequestsV1",original=localStorage.getItem(KEY);
    try{
      check("Staging uses the live Customer Requests UI source plus candidate fix",!!ui&&String(ui.version).includes("staging-parity-candidate"),String(ui?.version||"missing"));
      check("Live-parity staging data adapter is active",!!data?.firestoreApi&&!!data?.createRequest&&typeof data?.setSuppressEmit==="function");
      data.reset({version:1,settings:{enabled:false,eggs:"auto",birds:"auto"},requests:[]});
      await ui.openInbox();await sleep(40);

      check("Staging owner screen has the same enable checkbox as live",!!document.getElementById("reqPublicEnabled"));
      check("Staging owner screen has the same Save Customer Request Settings button as live",document.getElementById("reqSaveSettings")?.textContent?.includes("Save Customer Request Settings"));
      check("Staging owner screen shows the same private owner connection state",document.getElementById("customerRequestOwnerBody")?.textContent?.includes("Private owner connection is active"));

      const enabled=document.getElementById("reqPublicEnabled");if(enabled)enabled.checked=true;
      document.getElementById("reqSaveSettings")?.click();await sleep(90);
      check("Real live-parity Save click keeps request form enabled",data.readSettings().enabled===true,JSON.stringify(data.readSettings()));
      check("Enable checkbox stays checked after live-parity rerender",document.getElementById("reqPublicEnabled")?.checked===true);

      const row=data.createRequest({name:"Live Parity Cancel Test",category:"birds",birdType:"pullets",item:"Any pullets",quantity:1,phone:"336-555-0199"});
      await sleep(50);
      let select=document.querySelector(`#customerRequests [data-req-status="${CSS.escape(row.id)}"]`);
      let button=document.querySelector(`#customerRequests [data-req-save="${CSS.escape(row.id)}"]`);
      check("Live-parity inbox renders the real status dropdown and Update button",!!select&&!!button);
      if(select&&button){
        const originalUpdate=data.firestoreApi.updateDoc;
        data.firestoreApi.updateDoc=async(...args)=>{await sleep(90);return originalUpdate(...args);};
        data.setSuppressEmit(true);
        select.value="Cancelled";
        button.click();
        await sleep(10);
        check("Real Update click immediately shows Updating state",button.disabled===true&&/Updating/i.test(button.textContent||""),button.textContent||"");
        // Force the same kind of unrelated rerender that previously caused form
        // state to disappear while the async operation was still pending.
        ui.render();
        await sleep(160);
        const saved=data.load().requests.find(r=>r.id===row.id);
        check("Exact live Update click persists Cancelled even with snapshot listener suppressed",saved?.status==="Cancelled",saved?.status||"missing");
        check("Owner UI visibly shows Cancelled without waiting for snapshot listener",document.getElementById("customerRequestOwnerBody")?.textContent?.includes("Cancelled"),document.getElementById("customerRequestOwnerBody")?.textContent?.slice(-180)||"");
        data.setSuppressEmit(false);data.emitRequests();
        data.firestoreApi.updateDoc=originalUpdate;
        await sleep(30);
        check("Delayed listener catch-up keeps Cancelled status",data.load().requests.find(r=>r.id===row.id)?.status==="Cancelled");
      }
    }catch(error){check("Live-parity Customer Requests regression completed without exception",false,String(error?.stack||error));}
    finally{
      try{data?.setSuppressEmit?.(false);}catch{}
      if(original==null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,original);
      try{data?.emitRequests?.();await window.FarmCustomerRequestsV1?.openInbox?.();}catch{}
    }
    return results;
  }

  function attachSuite(){
    const base=window.StagingFullTest;
    if(!parityReady||!base?.run||!base.__customerRequestsV1||base.__customerRequestsLiveParityV1){setTimeout(attachSuite,160);return;}
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){const first=await baseRun();const extra=await runParityChecks();const results=[...(first?.results||[]),...extra];const failed=results.filter(x=>!x.pass);return{...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+customer-requests-live-parity-v3`};},__customerRequestsLiveParityV1:true};
    window.dispatchEvent(new CustomEvent("staging-final-suite-changed"));
    console.log("🪞 STAGING Customer Requests live-parity regression attached — delayed/suppressed snapshot Update path included");
  }

  function waitForParity(){const data=window.StagingCustomerRequestsLiveParityV1,ui=window.FarmCustomerRequestsV1;parityReady=!!data&&!!ui&&String(ui.version||"").includes("staging-parity-candidate");if(!parityReady){setTimeout(waitForParity,120);return;}attachSuite();window.dispatchEvent(new CustomEvent("staging-final-suite-changed"));}
  window.StagingCustomerRequestStatusTestV1={version:6,parityReady:()=>parityReady,runRegression:runParityChecks};
  setTimeout(waitForParity,300);
})();