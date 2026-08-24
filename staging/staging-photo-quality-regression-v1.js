(() => {
  "use strict";
  if (window.__StagingPhotoQualityRegressionV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingPhotoQualityRegressionV1 = true;

  const check=(name,pass,detail="")=>({name,pass:!!pass,detail:String(detail||"")});

  function makeFixtureBlob(){
    return new Promise(resolve=>{
      try{
        const c=document.createElement("canvas");
        c.width=1000;c.height=760;
        const x=c.getContext("2d");
        x.fillStyle="#d9efe0";x.fillRect(0,0,c.width,c.height);
        x.fillStyle="#72523b";x.fillRect(0,500,c.width,260);
        x.fillStyle="#f4f1d8";x.beginPath();x.arc(500,330,210,0,Math.PI*2);x.fill();
        x.fillStyle="#b1342f";x.beginPath();x.arc(500,155,62,0,Math.PI*2);x.fill();
        x.fillStyle="#222";x.beginPath();x.arc(440,300,12,0,Math.PI*2);x.arc(560,300,12,0,Math.PI*2);x.fill();
        x.strokeStyle="#6b4e35";x.lineWidth=8;
        for(let i=0;i<18;i++){x.beginPath();x.moveTo(320+i*20,405);x.lineTo(350+i*18,510);x.stroke();}
        c.toBlob(b=>resolve(b||null),"image/jpeg",.96);
      }catch{resolve(null);}
    });
  }

  function dimensions(src){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve({w:img.naturalWidth||img.width,h:img.naturalHeight||img.height});
      img.onerror=()=>resolve({w:0,h:0});
      img.src=src;
    });
  }

  async function run(){
    const api=window.FarmBirdPhotosV4;
    const p=api?.qualityProfile||{};
    const rows=[];
    rows.push(check("staging photo service loaded",!!api?.prepareFile));
    rows.push(check("target flock photo size is 480px",Number(p.targetSize)===480,String(p.targetSize||"")));
    rows.push(check("target JPEG quality is 82%",Math.abs(Number(p.targetQuality)-.82)<.001,String(p.targetQuality||"")));
    rows.push(check("storage-aware photo cap is active",Number(p.maxDataUrlChars)===90000,String(p.maxDataUrlChars||"")));
    rows.push(check("no direct Firebase/network writes",Number(api?.firebaseWrites)===0&&Number(api?.networkWrites)===0));

    const blob=await makeFixtureBlob();
    const src=blob ? await api?.prepareFile?.(blob) : "";
    rows.push(check("high-quality fixture converts to JPEG",String(src||"").startsWith("data:image/jpeg"),String(src||"").slice(0,24)));
    if(src){
      const d=await dimensions(src);
      rows.push(check("fixture remains 480x480 instead of old 168px",d.w===480&&d.h===480,`${d.w}x${d.h}`));
      rows.push(check("fixture stays inside storage budget",src.length<=Number(p.maxDataUrlChars||90000),String(src.length)));
    }else{
      rows.push(check("fixture remains 480x480 instead of old 168px",false,"conversion failed"));
      rows.push(check("fixture stays inside storage budget",false,"conversion failed"));
    }

    const failed=rows.filter(x=>!x.pass);
    return {suite:"staging-photo-quality-v1",checks:rows,total:rows.length,passed:rows.length-failed.length,failed:failed.length};
  }

  let tries=0;
  function attach(){
    const base=window.StagingFullTest;
    if(!base?.run){if(tries++<35)setTimeout(attach,180);return;}
    if(base.__photoQualityV1)return;
    const oldRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){
      const first=await oldRun();
      const extra=await run();
      const mapped=extra.checks.map(r=>({name:`Photo Quality: ${r.name}`,pass:r.pass,detail:r.detail}));
      const results=[...(first?.results||[]),...mapped];
      const failed=results.filter(x=>!x.pass);
      return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+photo-quality-v1`};
    },__photoQualityV1:true};
  }

  window.StagingPhotoQualityRegressionV1={version:1,run};
  setTimeout(attach,2800);
})();
