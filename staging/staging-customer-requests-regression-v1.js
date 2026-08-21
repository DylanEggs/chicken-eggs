(() => {
  "use strict";
  if (window.__StagingCustomerRequestsRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingCustomerRequestsRegressionV1=true;
  const KEY="chickenEggCustomerRequestsV1";
  const FARM_KEYS=["chickenEggEntriesV102","chickenEggSettingsV102","chickenEggApp2V1","chickenEggInventoryV2","chickenEggBusinessV1"];
  const snapFarm=()=>Object.fromEntries(FARM_KEYS.map(k=>[k,localStorage.getItem(k)]));
  const sameFarm=(a,b)=>FARM_KEYS.every(k=>a[k]===b[k]);
  async function runChecks(){
    const results=[],check=(name,pass,detail="")=>results.push({name,pass:!!pass,detail:String(detail||"")});
    const api=window.StagingCustomerRequestsV1;
    const original=localStorage.getItem(KEY),before=snapFarm();
    try{
      check("Customer Requests staging owner module is active",!!api?.createRequest);
      api.save({version:1,settings:{eggs:"auto",birds:"auto"},requests:[]});
      check("Customer request test starts with isolated empty inbox",api.load().requests.length===0);
      check("Automatic egg availability returns a customer-safe message",typeof api.autoAvailability("eggs")==="string"&&api.autoAvailability("eggs").length>0,api.autoAvailability("eggs"));
      check("Automatic bird availability returns a customer-safe message",typeof api.autoAvailability("birds")==="string"&&api.autoAvailability("birds").length>0,api.autoAvailability("birds"));
      api.setAvailability("eggs","next_week");
      api.setAvailability("birds","none_soon");
      check("Owner can set eggs to Likely available next week",api.publicAvailability("eggs")==="Likely available next week",api.publicAvailability("eggs"));
      check("Owner can set birds to Nothing expected soon",api.publicAvailability("birds")==="Nothing expected soon",api.publicAvailability("birds"));
      let rejected=false;try{api.createRequest({category:"eggs",item:"12-pack eggs",quantity:1,phone:"5551234567"});}catch{rejected=true;}check("Request without customer name is rejected",rejected);
      rejected=false;try{api.createRequest({name:"Test",category:"eggs",item:"12-pack eggs",quantity:1});}catch{rejected=true;}check("Request without phone or email is rejected",rejected);
      rejected=false;try{api.createRequest({name:"Test",category:"eggs",item:"12-pack eggs",quantity:1,email:"not-an-email"});}catch{rejected=true;}check("Invalid customer email is rejected",rejected);
      rejected=false;try{api.createRequest({name:"Test",category:"eggs",item:"12-pack eggs",quantity:0,phone:"5551234567"});}catch{rejected=true;}check("Zero-quantity request is rejected",rejected);
      const egg=api.createRequest({name:"Egg Buyer",category:"eggs",item:"12-pack eggs",quantity:2,phone:"336-555-0101",note:"Next week is fine"});
      const bird=api.createRequest({name:"Bird Buyer",category:"birds",item:"Silkie pullets",quantity:3,email:"birdbuyer@example.test",note:"Prefer females"});
      check("Valid egg request enters private inbox",api.load().requests.some(r=>r.id===egg.id&&r.category==="eggs"&&r.quantity===2));
      check("Valid bird request enters private inbox",api.load().requests.some(r=>r.id===bird.id&&r.category==="birds"&&r.quantity===3));
      check("Multiple customer requests receive unique IDs",egg.id!==bird.id);
      check("New requests default to New status",egg.status==="New"&&bird.status==="New");
      api.updateStatus(egg.id,"Contacted");api.updateStatus(bird.id,"Reserved");
      const afterStatus=api.load();
      check("Owner can mark egg request Contacted",afterStatus.requests.find(r=>r.id===egg.id)?.status==="Contacted");
      check("Owner can mark bird request Reserved",afterStatus.requests.find(r=>r.id===bird.id)?.status==="Reserved");
      rejected=false;try{api.updateStatus(egg.id,"Hacked");}catch{rejected=true;}check("Unknown request status is rejected",rejected);
      const hostile=api.createRequest({name:'<img src=x onerror="window.__requestXss=1">',category:"eggs",item:"12-pack eggs",quantity:1,email:"safe@example.test",note:'<script>window.__requestXss=1<\/script>'});
      api.render();
      const owner=document.getElementById("customerRequests");
      check("Customer Requests owner screen exists",!!owner&&!!document.getElementById("customerRequestsHubBtn"));
      check("Customer text is escaped instead of rendered as HTML",!owner?.querySelector('img[src="x"]')&&!window.__requestXss,owner?.textContent?.includes("<img")?"escaped text visible":"no injected element");
      let publicSafe=true,detail="";
      try{const app2=JSON.parse(localStorage.getItem("chickenEggApp2V1")||"{}");const out=window.FarmPublicCustomerBuilderV3?.build?.({entries:[],settings:{},inventory:{},app2,weather:{},deluxe:{},photoResolver:()=>""});const text=JSON.stringify(out||{});publicSafe=!text.includes("336-555-0101")&&!text.includes("birdbuyer@example.test")&&!text.includes("safe@example.test");detail=`public bytes=${text.length}`;}catch(e){publicSafe=false;detail=String(e?.message||e);}check("Customer phone/email never enters public customer snapshot",publicSafe,detail);
      check("Customer request workflow does not alter eggs, inventory, flock, business or settings",sameFarm(before,snapFarm()));
      api.updateStatus(hostile.id,"Cancelled");
      check("Requests can be closed without deletion",api.load().requests.find(r=>r.id===hostile.id)?.status==="Cancelled");
    }catch(error){check("Customer Requests regression completed without exception",false,String(error?.stack||error));}
    finally{if(original==null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,original);try{window.StagingCustomerRequestsV1?.render?.();}catch{}}
    return results;
  }
  function install(){
    const base=window.StagingFullTest;
    const ready=base?.run&&base.__twelvePackFullSuiteV1&&base.__historyBackV1&&base.__saleEditBackV1&&window.StagingCustomerRequestsV1?.createRequest;
    if(!ready||base.__customerRequestsV1){setTimeout(install,140);return;}
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){const first=await baseRun();const extra=await runChecks();const results=[...(first?.results||[]),...extra];const failed=results.filter(x=>!x.pass);return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+customer-requests-v1`};},__customerRequestsV1:true};
    console.log("📨 STAGING customer request regression active — privacy, validation and owner workflow checks added");
  }
  setTimeout(install,2600);
})();