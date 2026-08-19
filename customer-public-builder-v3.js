(() => {
  "use strict";
  if (window.FarmPublicCustomerBuilderV3) return;

  const n=v=>Number(v)||0;
  const whole=v=>Math.max(0,Math.round(n(v)));
  const image=v=>typeof v==="string"&&(v.startsWith("data:image/")||/^https?:\/\//i.test(v))?v:"";
  const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?String(v):"";
  const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch{return v;}};
  function ageText(value){
    const d=date(value);if(!d)return "Age not listed";
    const born=new Date(`${d}T12:00:00`),days=Math.max(0,Math.floor((Date.now()-born.getTime())/86400000));
    if(days<14)return `${days} day${days===1?"":"s"} old`;
    if(days<112)return `${Math.floor(days/7)} weeks old`;
    const months=Math.floor(days/30.44);return months<24?`${months} months old`:`${Math.floor(months/12)}y ${months%12}m old`;
  }
  function listings(app2,photoResolver){
    return (Array.isArray(app2?.birdListings)?app2.birdListings:[])
      .filter(x=>x&&x.public!==false&&String(x.id||"")&&String(x.breed||"").trim())
      .map(x=>{
        const id=String(x.id),quantity=whole(x.quantity),photoId=String(x.photoId||`bird-sale-${id}`);
        let status=String(x.status|| (quantity?"Available":"Sold Out")).trim().slice(0,30);
        if(quantity===0&&status==="Available")status="Sold Out";
        return {
          id,
          kind:"birdListing",
          breed:String(x.breed).trim().slice(0,100),
          birdType:String(x.birdType||"Chicks (Straight Run)").trim().slice(0,60),
          hatchDate:date(x.hatchDate),
          age:ageText(x.hatchDate),
          quantity,
          status,
          price:x.price===null||x.price===""||x.price===undefined?null:Math.max(0,Math.round(n(x.price)*100)/100),
          notes:String(x.notes||"").trim().slice(0,240),
          photo:image(photoResolver?.(photoId)||""),
          updatedAt:whole(x.updatedAt)
        };
      })
      .sort((a,b)=>b.updatedAt-a.updatedAt);
  }
  function build(input={}){
    const base=window.FarmPublicCustomerBuilderV2;
    if(!base?.build)throw new Error("Public customer builder v2 is required before v3");
    const out=base.build(input);
    const rows=listings(input.app2||{},input.photoResolver);
    out.summary.publicVersion=3;
    out.summary.listingIds=rows.map(x=>x.id);
    out.summary.listingCount=rows.length;
    out.listings=clone(rows);
    return out;
  }
  window.FarmPublicCustomerBuilderV3={version:3,build,listings};
})();