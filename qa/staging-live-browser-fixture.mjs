export async function installStagingLiveBrowserFixture(context){
  await context.addInitScript(()=>{
    if(location.hostname!=='dylaneggs.github.io'||!location.pathname.startsWith('/chicken-eggs/staging/'))return;
    const t=Date.now();
    const fixture={
      chickenEggEntriesV102:JSON.stringify([
        {id:'qa-live-eggs-1',type:'eggs',date:'2026-08-21',eggs:8,at:t},
        {id:'qa-live-eggs-2',type:'eggs',date:'2026-08-20',eggs:7,at:t-86400000}
      ]),
      chickenEggSettingsV102:JSON.stringify({hens:1,roosters:0,dozenPrice:4,packPrice:6,farmName:'QA Live Mirror Farm'}),
      chickenEggApp2V1:JSON.stringify({version:1,customers:[],orders:[],expenses:[],chores:[],saleMeta:{},birdListings:[],flock:[{id:'qa-live-hen',name:'Mirror Hen',breed:'QA Breed',sex:'Hen',status:'Active',hatchDate:'2026-01-01'}]}),
      chickenEggInventoryV2:JSON.stringify({version:6,authorityVersion:6,dozens:2,packs18:0,loose:3,adjustments:[],recoveryMarkers:{},updatedAt:t}),
      chickenEggBusinessV1:JSON.stringify({version:1,expenses:[],updatedAt:t}),
      chickenEggDeluxeV1:JSON.stringify({version:1,birdPhotoUrls:{qa:'data:image/png;base64,SHOULD_BE_STRIPPED'}})
    };
    for(const [key,value] of Object.entries(fixture)){
      if(localStorage.getItem(key)==null)localStorage.setItem(key,value);
    }
  });
}

export function visibleDataEntryCountScript(){
  return `(() => [...document.querySelectorAll('input,textarea,select')].filter(el => { const sec=el.closest('#customerRequestSection'); return !sec || sec.hidden===false; }).length)()`;
}
