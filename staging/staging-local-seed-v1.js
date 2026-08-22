(() => {
  "use strict";
  if (window.__ChickenEggsStagingLocalSeedV1) return;
  window.__ChickenEggsStagingLocalSeedV1 = true;

  const PREFIX = "__chicken_eggs_staging__::";
  const local = window.localStorage;
  const proto = Storage.prototype;
  const native = {getItem:proto.getItem,setItem:proto.setItem,removeItem:proto.removeItem,key:proto.key};
  const stageKey = key => PREFIX + String(key);
  const PRIVATE_OR_HEAVY = [
    /^chickenEggCustomerRequestsV1$/i,
    /^chickenEggLocalBirdPhotosV1$/i,
    /^chickenEggBirdPhotoMetaV4$/i,
    /^chickenEggApp2SnapshotsV1$/i,
    /ManualStagingBaseline/i,
    /Staging.*Test/i,
    /password|credential|authToken|accessToken|refreshToken/i
  ];
  const relevantLiveKey = key => /^(chickenEgg|farm|bird|core|inventory)/i.test(String(key || ""));
  const excluded = key => PRIVATE_OR_HEAVY.some(rx => rx.test(String(key || "")));

  function physicalKeys(){const out=[];let len=0;try{len=local.length;}catch{}for(let i=0;i<len;i++){try{const key=native.key.call(local,i);if(key!=null)out.push(String(key));}catch{}}return out;}
  function liveKeys(){return physicalKeys().filter(key=>!key.startsWith(PREFIX)&&relevantLiveKey(key)&&!excluded(key));}

  function compactValue(key,value){
    const text=String(value??"");if(!text)return text;
    if(/chickenEggDeluxeV1/i.test(key)&&text.includes("birdPhotoUrls")){
      try{const obj=JSON.parse(text);if(obj&&typeof obj==="object"&&obj.birdPhotoUrls&&typeof obj.birdPhotoUrls==="object")return JSON.stringify({...obj,birdPhotoUrls:{}});}catch{}
    }
    return text;
  }
  function hash(text){let h=2166136261>>>0;const s=String(text??"");for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,"0");}
  function hasLiveBrowserData(){return liveKeys().some(key=>/chickenEgg(App2V1|InventoryV2|EntriesV102|SettingsV102)/i.test(key));}
  function hasStagingCore(){for(const key of ["chickenEggApp2V1","chickenEggInventoryV2","chickenEggEntriesV102","chickenEggSettingsV102"]){try{if(native.getItem.call(local,stageKey(key)))return true;}catch{}}return false;}

  function syncFromLiveBrowser(){
    const keys=liveKeys();let copied=0,skipped=0,bytes=0;const copiedKeys=[],mismatchedKeys=[];const fingerprints={};
    for(const key of keys){
      try{
        const raw=native.getItem.call(local,key);if(raw==null)continue;
        const value=compactValue(key,raw);
        if(value.length>900000){skipped+=1;continue;}
        native.setItem.call(local,stageKey(key),value);
        const staged=native.getItem.call(local,stageKey(key));
        const sourceHash=hash(value),stageHash=hash(staged);
        fingerprints[key]={sourceHash,stageHash,chars:value.length};
        if(sourceHash!==stageHash)mismatchedKeys.push(key);
        copied+=1;bytes+=value.length;copiedKeys.push(key);
      }catch(error){skipped+=1;console.warn("STAGING live-browser mirror skipped",key,error);}
    }
    const at=Date.now();
    try{
      native.setItem.call(local,stageKey("chickenEggStagingSeedV1"),JSON.stringify({
        completed:(copied>0||hasStagingCore())&&mismatchedKeys.length===0,
        importedAt:at,
        coreEntries:(()=>{try{const raw=native.getItem.call(local,stageKey("chickenEggEntriesV102"));const rows=raw?JSON.parse(raw):[];return Array.isArray(rows)?rows.length:0;}catch{return 0;}})(),
        photos:0,fullCoreRefresh:false,
        source:"current LIVE app browser mirror; zero Firebase reads",
        localMirror:true,copiedKeys:copied,skippedKeys:skipped,mirroredBytes:bytes,mismatchedKeys:mismatchedKeys.length
      }));
    }catch{}
    const result={copied,skipped,bytes,copiedKeys,mismatchedKeys,fingerprints,verified:mismatchedKeys.length===0&&copied>0,at,hasLiveBrowserData:keys.length>0};
    if(window.StagingLocalSeedV1)window.StagingLocalSeedV1.result=result;
    window.dispatchEvent(new CustomEvent("staging-live-browser-mirrored",{detail:result}));
    return result;
  }

  const result=syncFromLiveBrowser();
  window.StagingLocalSeedV1={version:4,prefix:PREFIX,hasLiveBrowserData,hasStagingCore,liveKeys,syncFromLiveBrowser,result};
  console.log(`🪞 STAGING mirrored ${result.copied} current LIVE browser keys (${result.bytes} chars); verified=${result.verified}; 0 Firebase reads`);
})();
