(() => {
  "use strict";
  if (window.__ChickenEggsStagingLocalSeedV1) return;
  window.__ChickenEggsStagingLocalSeedV1 = true;

  const PREFIX = "__chicken_eggs_staging__::";
  const local = window.localStorage;
  const proto = Storage.prototype;
  const native = {getItem:proto.getItem,setItem:proto.setItem,removeItem:proto.removeItem,key:proto.key};
  const stageKey = key => PREFIX + String(key);

  // These are the authoritative datasets the live app actually uses for farm
  // state and the staging tests. Large photo caches, old snapshots and test
  // artifacts are intentionally NOT duplicated into the same-origin sandbox.
  const REQUIRED_CORE = [
    "chickenEggApp2V1",
    "chickenEggInventoryV2",
    "chickenEggEntriesV102",
    "chickenEggSettingsV102"
  ];
  const AUTHORITATIVE = [
    ...REQUIRED_CORE,
    "chickenEggBusinessV1",
    "chickenEggWeatherIntelligenceV2",
    "chickenEggDeluxeV1",
    "chickenEggFunV1"
  ];
  const AUTHORITATIVE_SET = new Set(AUTHORITATIVE);
  const PROTECTED_STAGING = [
    /^chickenEggCustomerRequestsV1$/i,
    /^chickenEggLocalBirdPhotosV1$/i,
    /^chickenEggBirdPhotoMetaV4$/i,
    /^chickenEggApp2SnapshotsV1$/i,
    /^chickenEggStagingSeedV1$/i,
    /ManualStagingBaseline/i,
    /Staging.*Test/i,
    /password|credential|authToken|accessToken|refreshToken/i
  ];

  function physicalKeys(){
    const out=[];let len=0;
    try{len=local.length;}catch{}
    for(let i=0;i<len;i++){
      try{const key=native.key.call(local,i);if(key!=null)out.push(String(key));}catch{}
    }
    return out;
  }
  function raw(key){try{return native.getItem.call(local,key);}catch{return null;}}
  function protectedKey(key){return PROTECTED_STAGING.some(rx=>rx.test(String(key||"")));}
  function liveKeys(){return AUTHORITATIVE.filter(key=>raw(key)!=null);}
  function stagedMirrorKeys(){
    return physicalKeys()
      .filter(key=>key.startsWith(PREFIX))
      .map(key=>key.slice(PREFIX.length))
      .filter(key=>AUTHORITATIVE_SET.has(key));
  }

  function compactValue(key,value){
    const text=String(value??"");
    if(!text)return text;
    if(key==="chickenEggDeluxeV1"&&text.includes("birdPhotoUrls")){
      try{
        const obj=JSON.parse(text);
        if(obj&&typeof obj==="object"&&obj.birdPhotoUrls&&typeof obj.birdPhotoUrls==="object"){
          return JSON.stringify({...obj,birdPhotoUrls:{}});
        }
      }catch{}
    }
    return text;
  }
  function hash(text){
    let h=2166136261>>>0;const s=String(text??"");
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    return h.toString(16).padStart(8,"0");
  }
  function liveCorePresent(){return REQUIRED_CORE.every(key=>raw(key)!=null);}
  function hasLiveBrowserData(){return liveCorePresent();}
  function hasStagingCore(){return REQUIRED_CORE.every(key=>raw(stageKey(key))!=null);}

  function reclaimOldMirrorSpace(){
    let removed=0;
    for(const physicalKey of physicalKeys()){
      if(!physicalKey.startsWith(PREFIX))continue;
      const virtualKey=physicalKey.slice(PREFIX.length);
      if(AUTHORITATIVE_SET.has(virtualKey)||protectedKey(virtualKey))continue;
      if(!/^(chickenEgg|farm|bird|core|inventory)/i.test(virtualKey))continue;
      try{native.removeItem.call(local,physicalKey);removed++;}catch{}
    }
    return removed;
  }

  function syncFromLiveBrowser(){
    const reclaimed=reclaimOldMirrorSpace();
    const keys=liveKeys(),liveSet=new Set(keys);
    let copied=0,skipped=0,bytes=0,removedStale=0;
    const copiedKeys=[],skippedKeys=[],mismatchedKeys=[],removedStaleKeys=[];
    const fingerprints={};

    // Remove authoritative staging values that no longer exist in LIVE.
    for(const key of stagedMirrorKeys()){
      if(liveSet.has(key))continue;
      try{
        native.removeItem.call(local,stageKey(key));
        removedStale++;
        removedStaleKeys.push(key);
      }catch(error){
        skipped++;
        skippedKeys.push(key);
        console.warn("STAGING could not remove stale authoritative key",key,error);
      }
    }

    // Copy core first so the app can never report a verified mirror without the
    // exact egg/sale history, settings, inventory and App2 farm data.
    const ordered=[...REQUIRED_CORE,...keys.filter(key=>!REQUIRED_CORE.includes(key))];
    for(const key of ordered){
      if(!liveSet.has(key))continue;
      try{
        const source=raw(key);
        if(source==null){skipped++;skippedKeys.push(key);continue;}
        const value=compactValue(key,source);
        native.setItem.call(local,stageKey(key),value);
        const staged=raw(stageKey(key));
        const sourceHash=hash(value),stageHash=hash(staged);
        fingerprints[key]={sourceHash,stageHash,chars:value.length};
        if(sourceHash!==stageHash)mismatchedKeys.push(key);
        copied++;
        bytes+=value.length;
        copiedKeys.push(key);
      }catch(error){
        skipped++;
        skippedKeys.push(key);
        console.warn("STAGING authoritative LIVE mirror could not copy",key,error);
      }
    }

    const at=Date.now();
    const coreVerified=REQUIRED_CORE.every(key=>{
      try{
        const live=raw(key),stage=raw(stageKey(key));
        return live!=null&&stage!=null&&hash(compactValue(key,live))===hash(stage);
      }catch{return false;}
    });
    const authoritativeVerified=keys.every(key=>{
      try{
        const live=raw(key),stage=raw(stageKey(key));
        return live!=null&&stage!=null&&hash(compactValue(key,live))===hash(stage);
      }catch{return false;}
    });
    const remainingStale=stagedMirrorKeys().filter(key=>!liveSet.has(key));
    const verified=liveCorePresent()&&coreVerified&&authoritativeVerified&&keys.length>=REQUIRED_CORE.length&&skipped===0&&mismatchedKeys.length===0&&remainingStale.length===0;

    try{
      native.setItem.call(local,stageKey("chickenEggStagingSeedV1"),JSON.stringify({
        completed:verified,
        importedAt:at,
        coreEntries:(()=>{try{const rows=JSON.parse(raw(stageKey("chickenEggEntriesV102"))||"[]");return Array.isArray(rows)?rows.length:0;}catch{return 0;}})(),
        photos:0,
        fullCoreRefresh:false,
        source:"verified authoritative current LIVE app browser mirror; zero Firebase reads",
        localMirror:true,
        copiedKeys:copied,
        eligibleKeys:keys.length,
        skippedKeys:skipped,
        mirroredBytes:bytes,
        mismatchedKeys:mismatchedKeys.length,
        removedStaleKeys:removedStale,
        remainingStaleKeys:remainingStale.length,
        reclaimedLegacyKeys:reclaimed,
        coreVerified,
        authoritativeVerified
      }));
    }catch{}

    const result={
      copied,eligible:keys.length,skipped,bytes,copiedKeys,skippedKeys,mismatchedKeys,
      fingerprints,removedStale,removedStaleKeys,remainingStale,reclaimed,
      coreVerified,authoritativeVerified,verified,at,hasLiveBrowserData:liveCorePresent()
    };
    if(window.StagingLocalSeedV1)window.StagingLocalSeedV1.result=result;
    window.dispatchEvent(new CustomEvent("staging-live-browser-mirrored",{detail:result}));
    return result;
  }

  const result=syncFromLiveBrowser();
  window.StagingLocalSeedV1={
    version:7,
    prefix:PREFIX,
    requiredCore:REQUIRED_CORE.slice(),
    authoritativeKeys:AUTHORITATIVE.slice(),
    hasLiveBrowserData,
    hasStagingCore,
    liveKeys,
    stagedMirrorKeys,
    syncFromLiveBrowser,
    result
  };
  console.log(`🪞 STAGING authoritative mirror ${result.copied}/${result.eligible} datasets (${result.bytes} chars); skipped=${result.skipped}; coreVerified=${result.coreVerified}; verified=${result.verified}; reclaimed=${result.reclaimed}; 0 Firebase reads`);
})();
