(() => {
  "use strict";
  if (window.__flockPhotoProfileV4) return;
  window.__flockPhotoProfileV4 = true;

  const APP="chickenEggApp2V1", DELUXE="chickenEggDeluxeV1", LOCAL="chickenEggLocalBirdPhotosV1";
  let pendingPhoto="", photoTarget="", listObserver=null;

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  function app(){const a=read(APP,{});a.flock=Array.isArray(a.flock)?a.flock:[];return a}
  const sortedBirds=()=>[...app().flock].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));

  function installStyle(){
    if(document.getElementById("flockPhotoProfileV4Style"))return;
    const s=document.createElement("style");s.id="flockPhotoProfileV4Style";
    s.textContent=`#farm2BirdPhotoPicker,#farm2BirdPhotoPickerV2,#farm2BirdPhotoPickerV3,.farm-direct-photo,.farm-direct-photo-v2,.farm-direct-photo-actions,.farm-direct-photo-actions-v2,.farm-profile-photo-v3,.farm-profile-actions-v3{display:none!important}.farm-profile-actions-v4{display:flex;gap:8px;flex-wrap:wrap;margin-right:8px}.farm-profile-photo-v4{width:88px;height:88px;object-fit:cover;border-radius:18px;float:right;margin:0 0 10px 12px}#farmFlockEditOverlayV4{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:18px}#farmFlockEditCardV4{width:min(620px,100%);max-height:88vh;overflow:auto;background:var(--card,#fff);color:inherit;border-radius:24px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}#farmFlockEditCardV4 label{display:block;margin-top:12px;font-weight:700}#farmFlockEditCardV4 input,#farmFlockEditCardV4 select,#farmFlockEditCardV4 textarea{width:100%;margin-top:6px}#farmFlockEditCardV4 textarea{min-height:90px;resize:vertical}.farm-edit-actions-v4{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}`;
    document.head.appendChild(s);
  }

  function photoFor(id){const l=read(LOCAL,{}),d=read(DELUXE,{});return l[id]||d?.birdPhotoUrls?.[id]||""}
  function savePhoto(id,url){
    if(!id||!url)return;
    const l=read(LOCAL,{});l[id]=url;localStorage.setItem(LOCAL,JSON.stringify(l));
    const d=read(DELUXE,{});d.birdPhotoUrls=d.birdPhotoUrls||{};d.birdPhotoUrls[id]=url;d.updatedAt=Date.now();localStorage.setItem(DELUXE,JSON.stringify(d));
    window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{key:DELUXE}}));render();
  }
  function removePhoto(id,ask=true){
    if(!id)return;if(ask&&!confirm("Remove this chicken's photo?"))return;
    const l=read(LOCAL,{});delete l[id];localStorage.setItem(LOCAL,JSON.stringify(l));
    const d=read(DELUXE,{});d.birdPhotoUrls=d.birdPhotoUrls||{};delete d.birdPhotoUrls[id];d.updatedAt=Date.now();localStorage.setItem(DELUXE,JSON.stringify(d));
    window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{key:DELUXE}}));render();
  }
  function compress(file,done){
    if(!file)return done("");const r=new FileReader();r.onload=e=>{const im=new Image();im.onload=()=>{const size=120,side=Math.min(im.width,im.height),sx=(im.width-side)/2,sy=(im.height-side)/2,c=document.createElement("canvas");c.width=size;c.height=size;c.getContext("2d").drawImage(im,sx,sy,side,side,0,0,size,size);done(c.toDataURL("image/jpeg",.48))};im.onerror=()=>done("");im.src=e.target.result};r.onerror=()=>done("");r.readAsDataURL(file)
  }

  function directInput(){
    let i=document.getElementById("farmFlockPhotoInputV4");if(i)return i;
    i=document.createElement("input");i.id="farmFlockPhotoInputV4";i.type="file";i.accept="image/*";i.style.display="none";
    i.onchange=()=>{const id=photoTarget;compress(i.files?.[0],url=>{if(id&&url)savePhoto(id,url);photoTarget="";i.value=""})};document.body.appendChild(i);return i;
  }
  window.farmFlockSetPhotoV4=id=>{photoTarget=String(id||"");directInput().click()};
  window.farmFlockRemovePhotoV4=id=>removePhoto(String(id||""),true);

  function ensureAddPicker(){
    const screen=document.getElementById("farm2Flock"),add=screen?.querySelector('button[onclick="farm2AddBird()"]');if(!screen||!add)return;
    if(document.getElementById("farm2BirdPhotoPickerV4"))return;
    const w=document.createElement("div");w.id="farm2BirdPhotoPickerV4";w.style.cssText="margin:12px 0 14px";
    w.innerHTML=`<label>Photo <span class="farm2-subtle">(optional)</span></label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:7px"><div id="farm2BirdPhotoPreviewV4" style="width:72px;height:72px;border-radius:16px;background:rgba(31,122,58,.08);display:grid;place-items:center;font-size:34px;overflow:hidden">🐔</div><div style="flex:1;min-width:180px"><input id="farm2BirdPhotoInputV4" type="file" accept="image/*" style="display:none"><button id="farm2BirdPhotoChooseV4" type="button" class="secondary" style="margin:0">📷 Choose Photo</button><button id="farm2BirdPhotoClearV4" type="button" class="secondary" style="margin:7px 0 0;display:none">Remove Selected Photo</button><div class="farm2-subtle" style="margin-top:6px">Optional when adding a new chicken.</div></div></div>`;
    add.parentNode.insertBefore(w,add);
    const i=document.getElementById("farm2BirdPhotoInputV4"),p=document.getElementById("farm2BirdPhotoPreviewV4"),c=document.getElementById("farm2BirdPhotoClearV4");
    document.getElementById("farm2BirdPhotoChooseV4").onclick=()=>i.click();
    c.onclick=()=>{pendingPhoto="";i.value="";p.innerHTML="🐔";c.style.display="none"};
    i.onchange=()=>compress(i.files?.[0],url=>{pendingPhoto=url;p.innerHTML=url?`<img src="${url}" style="width:100%;height:100%;object-fit:cover">`:"🐔";c.style.display=url?"block":"none"});
  }
  function resetPicker(){pendingPhoto="";const i=document.getElementById("farm2BirdPhotoInputV4"),p=document.getElementById("farm2BirdPhotoPreviewV4"),c=document.getElementById("farm2BirdPhotoClearV4");if(i)i.value="";if(p)p.innerHTML="🐔";if(c)c.style.display="none"}

  function ensureFunctionHooks(){
    if(typeof window.farm2AddBird==="function"&&!window.farm2AddBird.__flockV4){
      const original=window.farm2AddBird;
      const wrapped=function(){const before=new Set(app().flock.map(b=>String(b.id))),selected=pendingPhoto,result=original.apply(this,arguments),added=app().flock.find(b=>!before.has(String(b.id)));if(added&&selected)savePhoto(String(added.id),selected);if(added)resetPicker();setTimeout(render,0);return result};
      wrapped.__flockV4=true;window.farm2AddBird=wrapped;
    }
    if(typeof window.farm2DeleteBird==="function"&&!window.farm2DeleteBird.__flockV4){
      const original=window.farm2DeleteBird;
      const wrapped=function(id){const birdId=String(id||""),before=app().flock.some(b=>String(b.id)===birdId),result=original.apply(this,arguments),after=app().flock.some(b=>String(b.id)===birdId);if(before&&!after)removePhoto(birdId,false);return result};
      wrapped.__flockV4=true;window.farm2DeleteBird=wrapped;
    }
  }

  window.farmFlockEditBirdV4=id=>{
    const b=app().flock.find(x=>String(x.id)===String(id));if(!b)return;document.getElementById("farmFlockEditOverlayV4")?.remove();
    const o=document.createElement("div");o.id="farmFlockEditOverlayV4";o.innerHTML=`<div id="farmFlockEditCardV4"><h3 style="margin:0 0 4px">✏️ Edit ${esc(b.name||"Chicken")}</h3><div class="farm2-subtle">Update this flock profile and save.</div><label>Name<input id="farmFlockEditNameV4"></label><label>Breed<input id="farmFlockEditBreedV4"></label><label>Hatch / Birth Date<input id="farmFlockEditDateV4" type="date"></label><label>Sex<select id="farmFlockEditSexV4"><option>Hen</option><option>Rooster</option><option>Pullet</option><option>Cockerel</option><option>Unknown</option></select></label><label>Notes<textarea id="farmFlockEditNotesV4"></textarea></label><div class="farm-edit-actions-v4"><button type="button" onclick="farmFlockSaveEditV4('${esc(b.id)}')">Save Changes</button><button type="button" class="secondary" onclick="farmFlockCloseEditV4()">Cancel</button></div></div>`;
    document.body.appendChild(o);document.getElementById("farmFlockEditNameV4").value=b.name||"";document.getElementById("farmFlockEditBreedV4").value=b.breed||"";document.getElementById("farmFlockEditDateV4").value=b.hatchDate||"";document.getElementById("farmFlockEditSexV4").value=b.sex||"Unknown";document.getElementById("farmFlockEditNotesV4").value=b.notes||"";o.onclick=e=>{if(e.target===o)o.remove()};
  };
  window.farmFlockCloseEditV4=()=>document.getElementById("farmFlockEditOverlayV4")?.remove();
  window.farmFlockSaveEditV4=id=>{
    const a=app(),b=a.flock.find(x=>String(x.id)===String(id));if(!b)return;const name=document.getElementById("farmFlockEditNameV4")?.value.trim();if(!name){alert("Enter the chicken's name.");return}
    b.name=name;b.breed=document.getElementById("farmFlockEditBreedV4")?.value.trim()||"";b.hatchDate=document.getElementById("farmFlockEditDateV4")?.value||"";b.sex=document.getElementById("farmFlockEditSexV4")?.value||"Unknown";b.notes=document.getElementById("farmFlockEditNotesV4")?.value.trim()||"";b.updatedAt=Date.now();a.updatedAt=Date.now();localStorage.setItem(APP,JSON.stringify(a));document.getElementById("farmFlockEditOverlayV4")?.remove();window.dispatchEvent(new CustomEvent("farm-data-synced",{detail:{key:APP}}));if(typeof window.syncFarmNow==="function")window.syncFarmNow();setTimeout(render,0);
  };

  function renderCards(){
    const birds=sortedBirds(),cards=[...document.querySelectorAll("#farm2FlockList .farm2-listItem")];
    cards.forEach((card,index)=>{const b=birds[index];if(!b)return;const id=String(b.id||""),url=photoFor(id);card.dataset.farmBirdIdV4=id;
      let im=card.querySelector(".farm-profile-photo-v4");if(url){if(!im){im=document.createElement("img");im.className="farm-profile-photo-v4";card.prepend(im)}if(im.getAttribute("src")!==url)im.setAttribute("src",url)}else im?.remove();
      const actions=card.querySelector(".farm2-actions");if(!actions)return;let controls=actions.querySelector(".farm-profile-actions-v4");if(!controls){controls=document.createElement("span");controls.className="farm-profile-actions-v4";actions.prepend(controls)}
      const html=`<button type="button" onclick="farmFlockEditBirdV4('${esc(id)}')">✏️ Edit Profile</button><button type="button" onclick="farmFlockSetPhotoV4('${esc(id)}')">📷 ${url?"Change Photo":"Set Photo"}</button>${url?`<button type="button" class="secondary" onclick="farmFlockRemovePhotoV4('${esc(id)}')">Remove Photo</button>`:""}`;if(controls.innerHTML!==html)controls.innerHTML=html;
    });
  }
  function render(){installStyle();ensureAddPicker();ensureFunctionHooks();renderCards()}
  function attach(){render();const list=document.getElementById("farm2FlockList");if(!list){setTimeout(attach,250);return}listObserver?.disconnect();let q=false;listObserver=new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;render()})});listObserver.observe(list,{childList:true,subtree:true});render();setTimeout(render,1100)}

  window.addEventListener("farm-data-synced",render);window.addEventListener("core-data-synced",render);window.addEventListener("storage",e=>{if([APP,DELUXE].includes(e.key))render()});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(attach,350));else setTimeout(attach,350);
})();