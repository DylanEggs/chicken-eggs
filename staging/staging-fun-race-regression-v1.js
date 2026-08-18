(() => {
  "use strict";
  if (window.__StagingFunRaceRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingFunRaceRegressionV1 = true;

  const ENTRIES="chickenEggEntriesV102";
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};

  function snapshotStorage(){const out={};for(const key of window.StagingStorageSandbox?.listKeys?.()||[]){const v=localStorage.getItem(key);if(v!==null)out[key]=v;}return out;}
  function restoreStorage(snap){const old=window.__farmApplyingRemote;window.__farmApplyingRemote=true;try{localStorage.clear();for(const [k,v] of Object.entries(snap||{}))localStorage.setItem(k,v);}finally{window.__farmApplyingRemote=old;}try{window.loadLocal?.();}catch{}try{window.loadFarmSettings?.();}catch{}try{window.__reloadFarm2Memory?.();}catch{}try{window.updateApp?.();}catch{}window.dispatchEvent(new CustomEvent("core-data-synced",{detail:{staging:true,funRaceRestore:true}}));window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,funRaceRestore:true,key:"restore"}}));}

  async function runRaceRegression(){
    const results=[];
    const check=(name,pass,detail="")=>results.push({name,pass:!!pass,detail:String(detail||"")});
    const snap=snapshotStorage();
    const oldRandom=Math.random;
    const captured=[];
    const onError=e=>captured.push(String(e?.error?.stack||e?.message||e?.error||"window error"));
    window.addEventListener("error",onError);
    try{
      check("Guarded staging fun runtime is active",window.__stagingExtrasFunSafeLoaderV1===true);
      await window.InventorySystemV6?.commitExact?.(1,0,0);
      await sleep(80);
      const before=read(ENTRIES,[]).length;
      const date=document.getElementById("eggDate"),count=document.getElementById("eggCount");
      if(date)date.value=today();if(count)count.value="1";

      // 0.65 deliberately selects the surprise chicken-race branch in the
      // legacy fun animation. Keep it in place until eggAnim has chosen its roll.
      Math.random=()=>0.65;
      window.saveEggs?.();
      await sleep(180);
      Math.random=oldRandom;
      check("Forced race setup still saves the one-egg collection",read(ENTRIES,[]).length===before+1,`${before} -> ${read(ENTRIES,[]).length}`);

      // eggAnim schedules race after 450 ms; race itself schedules racer movement
      // 100 ms later. Replace the overlay after race has drawn but before that
      // delayed movement fires. An unguarded getElementById(...).style throws here.
      await sleep(390);
      const overlay=document.getElementById("xFunOverlay");
      if(overlay)overlay.innerHTML='<div class="xf">Staging deliberately rebuilt this animation.</div>';
      await sleep(1750);

      const staleDomErrors=captured.filter(x=>/null|style|xrr|xr\d/i.test(x));
      check("Delayed chicken race survives a UI rebuild without a page error",staleDomErrors.length===0,staleDomErrors.join(" | "));
    }catch(error){check("Chicken race regression completed without exception",false,String(error?.stack||error));}
    finally{
      Math.random=oldRandom;
      window.removeEventListener("error",onError);
      document.getElementById("xFunOverlay")?.classList.remove("show");
      restoreStorage(snap);
      await sleep(100);
    }
    return results;
  }

  function install(){
    const base=window.StagingFullTest;
    if(!base?.run||base.__funRaceRegressionV1){setTimeout(install,90);return;}
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){const first=await baseRun();const extra=await runRaceRegression();const results=[...(first?.results||[]),...extra];const failed=results.filter(x=>!x.pass);return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+fun-race-v1`};},__funRaceRegressionV1:true};
    console.log("🧪 STAGING chicken race regression active — stale animation callbacks must not throw");
  }
  setTimeout(install,1250);
})();
