(() => {
  "use strict";
  if (window.StagingCustomerRequestUITestV1) return;
  const PREFIX="__chicken_eggs_staging__::";
  const KEY=PREFIX+"chickenEggCustomerRequestsV1";
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const rawGet=()=>localStorage.getItem(KEY);
  const rawSet=v=>{if(v==null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,v);};
  async function run(){
    const results=[],check=(name,pass,detail="")=>results.push({name,pass:!!pass,detail:String(detail||"")});
    const api=window.StagingCustomerRequestPreviewV1;
    const original=rawGet();
    try{
      check("Customer request preview v2 is active",api?.version===2,`version=${api?.version}`);
      const cat=document.getElementById("reqPubCategory"),birdWrap=document.getElementById("reqPubBirdTypeWrap"),birdType=document.getElementById("reqPubBirdType"),item=document.getElementById("reqPubItem"),form=document.getElementById("customerRequestForm");
      check("Customer request form controls exist",!!cat&&!!birdWrap&&!!birdType&&!!item&&!!form);
      cat.value="eggs";cat.dispatchEvent(new Event("change",{bubbles:true}));
      check("Bird-type selector stays hidden for egg requests",birdWrap.hidden===true);
      cat.value="birds";cat.dispatchEvent(new Event("change",{bubbles:true}));
      check("Bird-type selector appears for bird requests",birdWrap.hidden===false);
      for(const type of ["chicks","pullets","roosters"]){
        birdType.value=type;birdType.dispatchEvent(new Event("change",{bubbles:true}));
        const expected=api.birdChoices(type);
        const labels=[...item.options].map(o=>o.textContent||"");
        check(`${type[0].toUpperCase()+type.slice(1)} dropdown shows only matching listings plus Any`,item.options.length===expected.length+1&&expected.every(x=>labels.some(l=>l.includes(x.label))),`options=${item.options.length}, expected=${expected.length+1}`);
      }
      check("Cockerels are grouped under Roosters",api.normalizeBirdType("Cockerels")==="roosters");
      birdType.value="roosters";birdType.dispatchEvent(new Event("change",{bubbles:true}));
      document.getElementById("reqPubName").value="UI Test Buyer";
      document.getElementById("reqPubPhone").value="336-555-0199";
      document.getElementById("reqPubEmail").value="";
      document.getElementById("reqPubQty").value="2";
      document.getElementById("reqPubNote").value="Temporary staging UI test";
      const beforeCount=(api.state()?.requests||[]).length;
      form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
      await wait(40);
      const after=api.state()?.requests||[],made=after.find(r=>r.name==="UI Test Buyer");
      check("Submitting bird form creates exactly one staging request",after.length===beforeCount+1&&!!made,`before=${beforeCount}, after=${after.length}`);
      check("Submitted bird request stores Roosters category",made?.category==="birds"&&made?.birdType==="roosters",JSON.stringify(made||{}));
      const pop=document.getElementById("customerRequestSuccessPopup"),title=document.getElementById("reqSuccessTitle")?.textContent||"",msg=document.getElementById("reqSuccessMessage")?.textContent||"";
      check("Success popup opens after request submission",!!pop&&pop.hidden===false);
      check("Success popup clearly says request sent successfully",/sent successfully/i.test(title),title);
      check("Success popup includes a fun farm message",msg.length>20&&/(flock|feathered|chickie|request)/i.test(msg),msg);
      api.hideSuccess?.();
      const eggCopy=api.successCopy?.("eggs","")||[];
      check("Egg requests have a playful success message",/sent successfully/i.test(String(eggCopy[1]||""))&&/(egg|hen|nest|flock)/i.test(String(eggCopy[2]||"")),eggCopy.join(" | "));
    }catch(error){check("Customer request UI test completed without exception",false,String(error?.stack||error));}
    finally{
      rawSet(original);
      try{api?.hideSuccess?.();api?.render?.();}catch{}
    }
    const failed=results.filter(x=>!x.pass),passed=results.length-failed.length;
    const lines=[`${failed.length?"❌":"✅"} Customer request UI test ${failed.length?"finished":"passed"} ${passed}/${results.length} checks.`];
    if(failed.length){lines.push("","FAILED:",...failed.map((x,i)=>`${i+1}. ${x.name}${x.detail?`\n${x.detail}`:""}`));}else lines.push("","Dropdown filtering, private staging submission, and success popup all worked. Staging request data was restored.");
    alert(lines.join("\n"));
    return {total:results.length,passed,failed:failed.length,results};
  }
  function install(){
    const bar=document.querySelector(".preview-bar");if(!bar||document.getElementById("customerRequestUITestBtn")){setTimeout(install,150);return;}
    const btn=document.createElement("button");btn.type="button";btn.id="customerRequestUITestBtn";btn.textContent="🧪 Test Request Form";btn.style.cssText="border:0;border-radius:999px;padding:8px 11px;font-weight:900;background:#fff;color:#7f1d1d";btn.addEventListener("click",run);bar.appendChild(btn);
  }
  window.StagingCustomerRequestUITestV1={run};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(install,300),{once:true});else setTimeout(install,300);
})();