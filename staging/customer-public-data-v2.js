(() => {
  "use strict";
  if (window.__StagingCustomerPublicDataV2) return;
  window.__StagingCustomerPublicDataV2 = true;

  const legacy=window.StagingCustomerPublicData;
  if(!legacy?.build)return;
  if(!window.FarmPublicCustomerBuilderV4?.build){
    try{
      const url=new URL("../customer-public-builder-v4.js",document.currentScript?.src||location.href);
      const xhr=new XMLHttpRequest();xhr.open("GET",url.href,false);xhr.send(null);
      if((xhr.status>=200&&xhr.status<300)||xhr.status===0)(0,eval)(`${String(xhr.responseText||"")}\n//# sourceURL=staging-customer-public-builder-v4-runtime.js`);
    }catch(error){console.warn("STAGING customer builder v4 unavailable; using v2 fallback",error);}
  }
  if(!(window.FarmPublicCustomerBuilderV4?.build||window.FarmPublicCustomerBuilderV2?.build))return;

  const PREFIX="__chicken_eggs_staging__::";
  const PREVIEW_SESSION="chickenEggStagingCustomerPreviewV2";
  const KEYS={app2:"chickenEggApp2V1",inventory:"chickenEggInventoryV2",entries:"chickenEggEntriesV102",settings:"chickenEggSettingsV102",weather:"chickenEggWeatherIntelligenceV2",deluxe:"chickenEggDeluxeV1",photos:"chickenEggLocalBirdPhotosV1",seed:"chickenEggStagingSeedV1"};

  let sessionValues=null;
  function previewValues(){
    if(sessionValues)return sessionValues;
    try{
      const payload=JSON.parse(sessionStorage.getItem(PREVIEW_SESSION)||"null");
      sessionValues=payload?.values&&typeof payload.values==="object"?payload.values:{};
    }catch{sessionValues={};}
    return sessionValues;
  }
  function read(key,fallback){
    try{
      const staged=previewValues();
      if(Object.prototype.hasOwnProperty.call(staged,key))return staged[key];
      const raw=localStorage.getItem(PREFIX+key);
      return raw==null?fallback:JSON.parse(raw);
    }catch{return fallback;}
  }
  function factDeck(old){const full=window.CustomerChickenFactsV1?.facts?.();return Array.isArray(full)&&full.length?full:(Array.isArray(old?.facts)?old.facts:legacy.facts?.()||[]);}
  function build(){
    const old=legacy.build();
    const photos=read(KEYS.photos,{});
    const builder=window.FarmPublicCustomerBuilderV4||window.FarmPublicCustomerBuilderV2;
    const out=builder.build({
      app2:read(KEYS.app2,{}),
      inventory:read(KEYS.inventory,{}),
      entries:read(KEYS.entries,[]),
      settings:read(KEYS.settings,{}),
      weather:read(KEYS.weather,{}),
      deluxe:read(KEYS.deluxe,{}),
      photoResolver:id=>typeof photos?.[String(id||"")]==="string"?photos[String(id||"")]:""
    });
    const byId=new Map(out.flock.map(b=>[String(b.id),b]));
    const seed=read(KEYS.seed,{});
    const facts=factDeck(old);
    return {
      schema:out.summary.schema,
      publicVersion:Number(out.summary.publicVersion)||2,
      environment:"staging-preview",
      farm:out.summary.farm,
      availability:out.summary.availability,
      production:out.summary.production,
      weather:out.summary.weather,
      stats:out.summary.stats,
      weatherInsights:out.summary.weatherInsights,
      customerStory:out.summary.customerStory||null,
      chickenOfTheDay:byId.get(String(out.summary.chickenOfTheDayId||""))||out.flock[0]||null,
      flock:out.flock,
      facts,
      factIndex:facts.length?(Number(old.factIndex)||0)%facts.length:0,
      meta:{
        generatedAt:Date.now(),
        sourceSnapshotAt:Number(seed?.importedAt)||Number(old.meta?.sourceSnapshotAt)||0,
        flockCount:out.flock.length,
        photoCount:out.flock.filter(b=>!!b.photo).length
      }
    };
  }

  window.StagingCustomerPublicData={version:4,prefix:PREFIX,previewSessionKey:PREVIEW_SESSION,build,facts:()=>factDeck(legacy.build?.()||{})};
  console.log("🧪 Customer preview v4 active — sanitized customer story + shared stats + one-time public photo hydration");
})();