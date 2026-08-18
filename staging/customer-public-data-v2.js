(() => {
  "use strict";
  if (window.__StagingCustomerPublicDataV2) return;
  window.__StagingCustomerPublicDataV2 = true;

  const legacy=window.StagingCustomerPublicData;
  if(!legacy?.build||!window.FarmPublicCustomerBuilderV2?.build)return;
  const PREFIX="__chicken_eggs_staging__::";
  const KEYS={app2:"chickenEggApp2V1",inventory:"chickenEggInventoryV2",entries:"chickenEggEntriesV102",settings:"chickenEggSettingsV102",weather:"chickenEggWeatherIntelligenceV2",deluxe:"chickenEggDeluxeV1",photos:"chickenEggLocalBirdPhotosV1",seed:"chickenEggStagingSeedV1"};

  function read(key,fallback){try{const raw=localStorage.getItem(PREFIX+key);return raw==null?fallback:JSON.parse(raw);}catch{return fallback;}}
  function factDeck(old){const full=window.CustomerChickenFactsV1?.facts?.();return Array.isArray(full)&&full.length?full:(Array.isArray(old?.facts)?old.facts:legacy.facts?.()||[]);}
  function build(){
    const old=legacy.build();
    const photos=read(KEYS.photos,{});
    const out=window.FarmPublicCustomerBuilderV2.build({
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

  window.StagingCustomerPublicData={version:2,prefix:PREFIX,build,facts:()=>factDeck(legacy.build?.()||{})};
  console.log("🧪 Customer preview v2 active — shared sanitized stats, weather insights, and full fact deck");
})();
