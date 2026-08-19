(() => {
  "use strict";
  if (window.StagingCustomerBirdSalesV1) return;
  const api = window.StagingCustomerPublicData;
  if (!api?.build) return;

  const PREFIX = "__chicken_eggs_staging__::";
  const APP2 = "chickenEggApp2V1";
  const PHOTOS = "chickenEggLocalBirdPhotosV1";
  const image = v => typeof v === "string" && (v.startsWith("data:image/") || /^https?:\/\//i.test(v)) ? v : "";
  const date = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "";
  const n = v => Number(v) || 0;
  const whole = v => Math.max(0, Math.round(n(v)));
  function read(key, fallback) {
    try { const raw=localStorage.getItem(PREFIX+key); return raw==null?fallback:JSON.parse(raw); }
    catch { return fallback; }
  }
  function ageText(value) {
    const d=date(value); if(!d)return "Age not listed";
    const born=new Date(`${d}T12:00:00`),days=Math.max(0,Math.floor((Date.now()-born.getTime())/86400000));
    if(days<14)return `${days} day${days===1?"":"s"} old`;
    if(days<112)return `${Math.floor(days/7)} weeks old`;
    const months=Math.floor(days/30.44);return months<24?`${months} months old`:`${Math.floor(months/12)}y ${months%12}m old`;
  }
  function listings() {
    const app=read(APP2,{}),photos=read(PHOTOS,{});
    return (Array.isArray(app?.birdListings)?app.birdListings:[])
      .filter(x=>x&&x.public!==false&&String(x.id||"")&&String(x.breed||"").trim())
      .map(x=>{
        const id=String(x.id),quantity=whole(x.quantity),photoId=String(x.photoId||`bird-sale-${id}`);
        let status=String(x.status|| (quantity?"Available":"Sold Out"));if(quantity===0&&status==="Available")status="Sold Out";
        return {
          id,
          breed:String(x.breed).trim().slice(0,100),
          birdType:String(x.birdType||"Chicks (Straight Run)").trim().slice(0,60),
          hatchDate:date(x.hatchDate),
          age:ageText(x.hatchDate),
          quantity,
          status:String(status).slice(0,30),
          price:x.price===null||x.price===""||x.price===undefined?null:Math.max(0,Math.round(n(x.price)*100)/100),
          notes:String(x.notes||"").trim().slice(0,240),
          photo:image(photos?.[photoId]),
          updatedAt:whole(x.updatedAt)
        };
      })
      .sort((a,b)=>b.updatedAt-a.updatedAt);
  }

  const baseBuild=api.build.bind(api);
  api.build=function(){const out=baseBuild();out.birdListings=listings();out.meta={...(out.meta||{}),birdListingCount:out.birdListings.length};return out;};
  window.StagingCustomerBirdSalesV1={version:1,listings};
})();