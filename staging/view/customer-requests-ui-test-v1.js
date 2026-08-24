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
    const ui=window.CustomerRequestViewV1,store=window.StagingCustomerRequestPublicParityV1;
    const original=rawGet();
    try{
      check("Customer preview uses the live request UI module",!!ui&&ui.version===1,`version=${ui?.version}`);
      check("Customer preview sandbox adapter is active",!!store?.createRequest&&!!store?.save);

      const seeded=store.load();seeded.settings={...(seeded.settings||{}),enabled:true,eggs:"auto",birds:"auto"};seeded.requests=[];store.save(seeded);await wait(30);ui.render();
      const section=document.getElementById("customerRequestSection"),cat=document.getElementById("reqPubCategory"),birdWrap=document.getElementById("reqPubBirdTypeWrap"),birdType=document.getElementById("reqPubBirdType"),item=document.getElementById("reqPubItem"),form=document.getElementById("customerRequestForm");
      check("Live request section is visible when staging setting is enabled",!!section&&section.hidden===false);
      check("Live request form controls exist",!!cat&&!!birdWrap&&!!birdType&&!!item&&!!form);

      cat.value="eggs";cat.dispatchEvent(new Event("change",{bubbles:true}));
      check("Bird-type selector stays hidden for egg requests",birdWrap.hidden===true);
      cat.value="birds";cat.dispatchEvent(new Event("change",{bubbles:true}));
      check("Bird-type selector appears for bird requests",birdWrap.hidden===false);
      for(const type of ["chicks","pullets","roosters"]){
        birdType.value=type;birdType.dispatchEvent(new Event("change",{bubbles:true}));
        const expected=ui.birdChoices(type),labels=[...item.options].map(o=>o.textContent||"");
        check(`${type[0].toUpperCase()+type.slice(1)} dropdown uses live filtering`,item.options.length===expected.length+1&&expected.every(x=>labels.some(l=>l.includes(x.label))),`options=${item.options.length}, expected=${expected.length+1}`);
      }
      check("Cockerels are grouped under Roosters",ui.normalizeBirdType("Cockerels")==="roosters");

      birdType.value="roosters";birdType.dispatchEvent(new Event("change",{bubbles:true}));
      document.getElementById("reqPubName").value="UI Test Buyer";
      document.getElementById("reqPubPhone").value="336-555-0199";
      document.getElementById("reqPubEmail").value="";
      document.getElementById("reqPubQty").value="2";
      document.getElementById("reqPubNote").value="Temporary staging UI test";
      sessionStorage.removeItem("roseCustomerRequestLastSend");
      const beforeCount=store.load().requests.length;
      form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
      await wait(70);
      const after=store.load().requests,made=after.find(r=>r.name==="UI Test Buyer");
      check("Submitting the live form creates exactly one sandbox request",after.length===beforeCount+1&&!!made,`before=${beforeCount}, after=${after.length}`);
      check("Submitted live-form request stores Roosters category",made?.category==="birds"&&made?.birdType==="roosters",JSON.stringify(made||{}));
      const pop=document.getElementById("customerRequestSuccessPopup"),title=document.getElementById("reqSuccessTitle")?.textContent||"",msg=document.getElementById("reqSuccessMessage")?.textContent||"";
      check("Live success popup opens after staging submission",!!pop&&pop.hidden===false);
      check("Live success popup confirms request sent",/sent successfully/i.test(title),title);
      check("Live success popup includes the fun farm message",msg.length>20&&/(flock|feathered|chickie|request|egg|hen|nest)/i.test(msg),msg);
      document.getElementById("reqSuccessClose")?.click();

      const disabled=store.load();disabled.settings={...(disabled.settings||{}),enabled:false};store.save(disabled);await wait(30);ui.render();
      check("Staging preview keeps the request section forced on for sandbox testing",store.settings().enabled===true&&document.getElementById("customerRequestSection")?.hidden===false);
    }catch(error){check("Customer request live-parity UI test completed without exception",false,String(error?.stack||error));}
    finally{rawSet(original);try{sessionStorage.removeItem("roseCustomerRequestLastSend");window.CustomerRequestViewV1?.render?.();}catch{}}
    const failed=results.filter(x=>!x.pass),passed=results.length-failed.length;
    const lines=[`${failed.length?"❌":"✅"} Customer request LIVE-PARITY UI test ${failed.length?"finished":"passed"} ${passed}/${results.length} checks.`];
    if(failed.length){lines.push("","FAILED:",...failed.map((x,i)=>`${i+1}. ${x.name}${x.detail?`\n${x.detail}`:""}`));}else lines.push("","The actual live customer request UI ran against sandbox-only data. No live Firebase request was created.");
    alert(lines.join("\n"));
    return {total:results.length,passed,failed:failed.length,results};
  }

  function install(){const bar=document.querySelector(".preview-bar");if(!bar||document.getElementById("customerRequestUITestBtn")){setTimeout(install,150);return;}const btn=document.createElement("button");btn.type="button";btn.id="customerRequestUITestBtn";btn.textContent="🧪 Test Live Request UI";btn.style.cssText="border:0;border-radius:999px;padding:8px 11px;font-weight:900;background:#fff;color:#7f1d1d";btn.addEventListener("click",run);bar.appendChild(btn);}
  window.StagingCustomerRequestUITestV1={version:4,run};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(install,300),{once:true});else setTimeout(install,300);
})();