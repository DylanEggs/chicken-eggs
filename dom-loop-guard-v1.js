(() => {
  "use strict";
  const guarded = new Set([
    "bizChickenSummary",
    "bizChickenHistory",
    "farm2CustomerList",
    "farm2OrderList",
    "farm2ExpenseList",
    "farm2FlockList",
    "farm2ChoreList"
  ]);
  const proto = Element.prototype;
  if (proto.__farmIdenticalHtmlGuard) return;
  const desc = Object.getOwnPropertyDescriptor(proto, "innerHTML");
  if (!desc?.get || !desc?.set || !desc.configurable) return;
  Object.defineProperty(proto, "innerHTML", {
    configurable: desc.configurable,
    enumerable: desc.enumerable,
    get: desc.get,
    set(value) {
      const next = String(value ?? "");
      if (this?.id === "inventoryDashboardCard" && next.includes('class="farm2-badge gold"')) return;
      if (this?.id && guarded.has(this.id) && desc.get.call(this) === next) return;
      desc.set.call(this, value);
    }
  });
  Object.defineProperty(proto, "__farmIdenticalHtmlGuard", { value:true, configurable:true });
  console.log("✅ Duplicate redraw guard active; Physical Egg Inventory has one renderer");
})();

(() => {
  "use strict";
  const A="chickenEggApp2V1",D="chickenEggDeluxeV1",P="chickenEggLocalBirdPhotosV1";
  let pending="",target="",hooked=false,observer=null;
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
  const app=()=>read(A,{flock:[]}), deluxe=()=>read(D,{birdPhotoUrls:{},updatedAt:0}), pics=()=>read(P,{});
  function currentPhoto(id){const p=pics(),d=deluxe();return p[id]||d.birdPhotoUrls?.[id]||""}
  function syncLocal(){const d=deluxe(),p=pics();let changed=false;for(const[id,u]of Object.entries(d.birdPhotoUrls||{}))if(typeof u==="string"&&u&&p[id]!==u){p[id]=u;changed=true}if(changed)localStorage.setItem(P,JSON.stringify(p))}
  function savePhoto(id,u){if(!id||!u)return;const p=pics();p[id]=u;localStorage.setItem(P,JSON.stringify(p));const d=deluxe();d.birdPhotoUrls=d.birdPhotoUrls||{};d.birdPhotoUrls[id]=u;d.updatedAt=Date.now();localStorage.setItem(D,JSON.stringify(d));decorate()}
  function removePhoto(id){const p=pics();delete p[id];localStorage.setItem(P,JSON.stringify(p));const d=deluxe();if(d.birdPhotoUrls)delete d.birdPhotoUrls[id];d.updatedAt=Date.now();localStorage.setItem(D,JSON.stringify(d));decorate()}
  function compress(file,cb){if(!file)return cb("");const rd=new FileReader();rd.onload=e=>{const im=new Image();im.onload=()=>{const s=180,side=Math.min(im.width,im.height),sx=(im.width-side)/2,sy=(im.height-side)/2,c=document.createElement("canvas");c.width=s;c.height=s;c.getContext("2d").drawImage(im,sx,sy,side,side,0,0,s,s);cb(c.toDataURL("image/jpeg",.62))};im.onerror=()=>cb("");im.src=e.target.result};rd.onerror=()=>cb("");rd.readAsDataURL(file)}
  function clearPending(){pending="";const i=document.getElementById("farm2BirdPhotoInput"),p=document.getElementById("farm2BirdPhotoPreview"),x=document.getElementById("farm2BirdPhotoClear");if(i)i.value="";if(p)p.innerHTML="🐔";if(x)x.style.display="none"}
  function addPhotoUI(){const s=document.getElementById("farm2Flock");if(!s||document.getElementById("farm2BirdPhotoPicker"))return;const b=s.querySelector('button[onclick="farm2AddBird()"]');if(!b)return;const w=document.createElement("div");w.id="farm2BirdPhotoPicker";w.style.cssText="margin:12px 0 14px";w.innerHTML='<label>Photo <span class="farm2-subtle">(optional)</span></label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:7px"><div id="farm2BirdPhotoPreview" style="width:72px;height:72px;border-radius:16px;background:rgba(31,122,58,.08);display:grid;place-items:center;font-size:34px;overflow:hidden">🐔</div><div style="flex:1;min-width:180px"><input id="farm2BirdPhotoInput" type="file" accept="image/*" style="display:none"><button id="farm2BirdPhotoChoose" type="button" class="secondary" style="margin:0">📷 Choose Photo</button><button id="farm2BirdPhotoClear" type="button" class="secondary" style="margin:7px 0 0;display:none">Remove Selected Photo</button><div class="farm2-subtle" style="margin-top:6px">Choose a photo or take one on your phone.</div></div></div>';b.parentNode.insertBefore(w,b);const i=document.getElementById("farm2BirdPhotoInput");document.getElementById("farm2BirdPhotoChoose").onclick=()=>i.click();document.getElementById("farm2BirdPhotoClear").onclick=clearPending;i.onchange=()=>compress(i.files?.[0],u=>{pending=u;const p=document.getElementById("farm2BirdPhotoPreview"),x=document.getElementById("farm2BirdPhotoClear");if(p)p.innerHTML=u?`<img src="${u}" style="width:100%;height:100%;object-fit:cover">`:"🐔";if(x)x.style.display=u?"block":"none"})}
  function hiddenInput(){let i=document.getElementById("farm2DirectPhotoInput");if(i)return i;i=document.createElement("input");i.id="farm2DirectPhotoInput";i.type="file";i.accept="image/*";i.style.display="none";i.onchange=()=>{const id=target;compress(i.files?.[0],u=>{if(id&&u)savePhoto(id,u);i.value="";target=""})};document.body.appendChild(i);return i}
  window.farmPhotoChooseForBird=id=>{target=String(id||"");hiddenInput().click()};
  window.farmPhotoRemoveForBird=id=>{if(confirm("Remove this chicken's photo?"))removePhoto(String(id||""))};
  function decorate(){addPhotoUI();syncLocal();const flock=new Map((app().flock||[]).map(b=>[String(b.id),b]));document.querySelectorAll("#farm2FlockList .farm2-listItem").forEach(card=>{const del=card.querySelector('button[onclick*="farm2DeleteBird"]'),id=del?.getAttribute("onclick")?.match(/farm2DeleteBird\('([^']+)'\)/)?.[1];if(!id||!flock.has(String(id)))return;const u=currentPhoto(id);let im=card.querySelector(".farm-direct-photo");if(u){if(!im){im=document.createElement("img");im.className="farm-direct-photo";im.style.cssText="width:82px;height:82px;object-fit:cover;border-radius:17px;float:right;margin:0 0 9px 12px";card.prepend(im)}if(im.src!==u)im.src=u}else im?.remove();const actions=card.querySelector(".farm2-actions");if(!actions)return;let box=actions.querySelector(".farm-direct-photo-actions");if(!box){box=document.createElement("span");box.className="farm-direct-photo-actions";actions.prepend(box)}const html=`<button type="button" onclick="farmPhotoChooseForBird('${id}')">📷 ${u?"Change Photo":"Set Photo"}</button>${u?`<button type="button" class="secondary" onclick="farmPhotoRemoveForBird('${id}')">Remove Photo</button>`:""}`;if(box.innerHTML!==html)box.innerHTML=html})}
  function installHooks(){if(hooked)return;if(typeof window.farm2AddBird!=="function"){setTimeout(installHooks,120);return}hooked=true;const original=window.farm2AddBird;window.farm2AddBird=function(){const before=new Set((app().flock||[]).map(b=>String(b.id))),selected=pending,result=original.apply(this,arguments),added=(app().flock||[]).find(b=>!before.has(String(b.id)));if(added&&selected)savePhoto(String(added.id),selected);if(added)clearPending();setTimeout(decorate,0);return result};if(typeof window.showScreen==="function"&&!window.showScreen.__flockPhotos){const old=window.showScreen,wrapped=function(){const r=old.apply(this,arguments);setTimeout(decorate,0);return r};wrapped.__flockPhotos=true;window.showScreen=wrapped}}
  function watch(){const list=document.getElementById("farm2FlockList");if(!list){setTimeout(watch,250);return}let queued=false;observer?.disconnect();observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})});observer.observe(list,{childList:true,subtree:true})}
  function init(){syncLocal();addPhotoUI();hiddenInput();installHooks();watch();decorate();window.addEventListener("farm-data-synced",e=>{if([A,D].includes(e.detail?.key)){syncLocal();decorate()}});console.log("✅ Direct flock photo controls active")}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,500));else setTimeout(init,500);
})();