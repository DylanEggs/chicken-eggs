(() => {
  "use strict";
  if (window.__StagingBirdSalesRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingBirdSalesRegressionV1 = true;

  const APP2="chickenEggApp2V1",INV="chickenEggInventoryV2",ENTRIES="chickenEggEntriesV102",PHOTOS="chickenEggLocalBirdPhotosV1",META="chickenEggBirdPhotoMetaV4";
  const tinyPhoto="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const readRaw=k=>localStorage.getItem(k);
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}};
  const restore=(snapshot)=>{const old=window.__farmApplyingRemote;window.__farmApplyingRemote=true;try{for(const [k,v] of Object.entries(snapshot)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}}finally{window.__farmApplyingRemote=old;}try{window.__reloadFarm2Memory?.();}catch{}try{window.loadLocal?.();}catch{}try{window.updateApp?.();}catch{}window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{staging:true,birdSalesRestore:true,key:APP2}}));};
  const todayMinus=days=>{const d=new Date();d.setDate(d.getDate()-days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  const check=(results,name,pass,detail="")=>results.push({name,pass:!!pass,detail:String(detail||"")});

  async function runChecks(){
    const results=[];
    const snap=Object.fromEntries([APP2,INV,ENTRIES,PHOTOS,META].map(k=>[k,readRaw(k)]));
    const beforeInv=readRaw(INV),beforeEntries=readRaw(ENTRIES);
    try{
      const api=window.FarmBirdSalesV1;
      const builder=window.FarmPublicCustomerBuilderV3;
      check(results,"Birds-for-sale manager is loaded in staging",!!api?.upsert&&!!api?.remove);
      check(results,"Public customer v3 sanitizer is loaded in staging",!!builder?.build);
      if(!api?.upsert||!builder?.build)return results;

      const app=read(APP2,{});
      app.customers=[...(Array.isArray(app.customers)?app.customers:[]),{id:"private-test",name:"SECRET BIRD BUYER",contact:"555-PRIVATE"}];
      app.expenses=[...(Array.isArray(app.expenses)?app.expenses:[]),{id:"private-expense",description:"SECRET FEED COST",amount:9999}];
      localStorage.setItem(APP2,JSON.stringify(app));
      try{window.__reloadFarm2Memory?.();}catch{}

      const row=await api.upsert({breed:"TEST Golden Comet Mix",birdType:"Pullets",hatchDate:todayMinus(42),quantity:6,status:"Available",price:12.5,notes:"Healthy started birds - staging test",public:true},{photoSrc:tinyPhoto});
      const afterAdd=read(APP2,{}),saved=(afterAdd.birdListings||[]).find(x=>x.id===row.id);
      check(results,"Adding a bird listing stores breed, type and quantity",!!saved&&saved.breed==="TEST Golden Comet Mix"&&saved.birdType==="Pullets"&&Number(saved.quantity)===6,JSON.stringify(saved||{}));
      check(results,"Adding a bird listing does not change egg inventory",readRaw(INV)===beforeInv);
      check(results,"Adding a bird listing does not change egg/sale history",readRaw(ENTRIES)===beforeEntries);
      check(results,"Optional listing photo stays in the photo service",window.FarmBirdPhotosV4?.get?.(row.photoId)===tinyPhoto);

      const out=builder.build({app2:afterAdd,inventory:read(INV,{}),entries:read(ENTRIES,[]),settings:{farmName:"Rose Family Poultry"},weather:{},deluxe:{},photoResolver:id=>window.FarmBirdPhotosV4?.get?.(id)||""});
      const pub=(out.listings||[]).find(x=>x.id===row.id),text=JSON.stringify(out);
      check(results,"Customer sanitizer publishes the available bird listing",!!pub&&pub.breed==="TEST Golden Comet Mix"&&pub.quantity===6&&pub.status==="Available",JSON.stringify(pub||{}));
      check(results,"Customer listing includes optional public price and photo",!!pub&&pub.price===12.5&&pub.photo===tinyPhoto);
      check(results,"Customer listing computes age from hatch date",!!pub&&/week|month|day|old/i.test(pub.age||""),pub?.age||"");
      check(results,"Private customer and expense data never enter public bird payload",!text.includes("SECRET BIRD BUYER")&&!text.includes("555-PRIVATE")&&!text.includes("SECRET FEED COST")&&!text.includes("9999"));

      await api.upsert({...saved,id:row.id,quantity:4,status:"Reserved",public:true});
      const editedApp=read(APP2,{}),editedOut=builder.build({app2:editedApp,inventory:{},entries:[],settings:{},weather:{},deluxe:{},photoResolver:id=>window.FarmBirdPhotosV4?.get?.(id)||""});
      const edited=(editedOut.listings||[]).find(x=>x.id===row.id);
      check(results,"Editing quantity/status updates the customer-safe listing",!!edited&&edited.quantity===4&&edited.status==="Reserved",JSON.stringify(edited||{}));

      await api.upsert({...editedApp.birdListings.find(x=>x.id===row.id),id:row.id,public:false});
      const hiddenApp=read(APP2,{}),hiddenOut=builder.build({app2:hiddenApp,inventory:{},entries:[],settings:{},weather:{},deluxe:{},photoResolver:id=>window.FarmBirdPhotosV4?.get?.(id)||""});
      check(results,"Private/draft bird listing is excluded from customer output",!(hiddenOut.listings||[]).some(x=>x.id===row.id));

      await api.remove(row.id);
      const removedApp=read(APP2,{});
      check(results,"Deleting a bird listing removes it from Farm App 2 data",!(removedApp.birdListings||[]).some(x=>x.id===row.id));
      check(results,"Deleting a bird listing removes its sale photo",!window.FarmBirdPhotosV4?.get?.(row.photoId));
      check(results,"Bird listing add/edit/delete never changes egg inventory/history",readRaw(INV)===beforeInv&&readRaw(ENTRIES)===beforeEntries);
    }catch(error){check(results,"Bird listings staging regression completed without exception",false,String(error?.stack||error));}
    finally{restore(snap);}
    return results;
  }

  function install(){
    const base=window.StagingFullTest;
    if(!base?.run||base.__birdSalesV1){setTimeout(install,100);return;}
    const baseRun=base.run.bind(base);
    window.StagingFullTest={...base,async run(){const first=await baseRun();const extra=await runChecks();const results=[...(first?.results||[]),...extra];const failed=results.filter(x=>!x.pass);return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+bird-sales-v1`};},__birdSalesV1:true};
    console.log("🐣 STAGING bird-sale regression added to full sandbox test");
  }
  setTimeout(install,1500);
})();