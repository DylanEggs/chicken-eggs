(() => {
  "use strict";
  if (window.StagingCustomerRequestPreviewV1) return;
  const PREFIX="__chicken_eggs_staging__::";
  const KEY=PREFIX+"chickenEggCustomerRequestsV1";
  const APP2=PREFIX+"chickenEggApp2V1";
  const INVENTORY=PREFIX+"chickenEggInventoryV2";
  const ENTRIES=PREFIX+"chickenEggEntriesV102";
  const MSGS={auto:"Automatic from farm data",available:"In stock now",next_week:"Likely available next week",coming_soon:"Coming soon",none_soon:"Nothing expected soon"};
  const BIRD_TYPES={chicks:"Chicks",pullets:"Pullets",roosters:"Roosters"};
  const n=v=>Number(v)||0, whole=v=>Math.max(0,Math.round(n(v)));
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch{return f;}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  function state(){const x=read(KEY,{});return {version:1,settings:{eggs:MSGS[x.settings?.eggs]?x.settings.eggs:"auto",birds:MSGS[x.settings?.birds]?x.settings.birds:"auto"},requests:Array.isArray(x.requests)?x.requests:[],updatedAt:whole(x.updatedAt)};}
  function physical(){const i=read(INVENTORY,{});return whole(i.dozens)*12+whole(i.packs18)*18+whole(i.loose);}
  function reserved(){const a=read(APP2,{});return (Array.isArray(a.orders)?a.orders:[]).filter(o=>o?.status==="pending").reduce((s,o)=>s+whole(o.dozen)*12+whole(o.packs18)*18,0);}
  function auto(kind){if(kind==="birds"){const a=read(APP2,{}),rows=Array.isArray(a.birdListings)?a.birdListings:[];if(rows.some(x=>x?.public!==false&&whole(x.quantity)>0&&String(x.status||"Available")==="Available"))return "In stock now";if(rows.some(x=>x?.public!==false&&["Coming Soon","Reserved"].includes(String(x.status||""))))return "Coming soon";return "Nothing expected soon";}const av=Math.max(0,physical()-reserved());if(av>=12)return "In stock now";if(av>0)return "Limited availability";const e=read(ENTRIES,[]).filter(x=>x?.type==="eggs"&&Number(x.eggs)>0).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,7);const avg=e.length?e.reduce((s,x)=>s+n(x.eggs),0)/e.length:0;return avg>=2?"Likely available next week":"Nothing expected soon";}
  function availability(kind){const s=state(),v=s.settings[kind]||"auto";return v==="auto"?auto(kind):MSGS[v];}
  function normalizeBirdType(value){const v=String(value||"").toLowerCase();if(v.includes("pullet"))return "pullets";if(v.includes("rooster")||v.includes("cockerel"))return "roosters";if(v.includes("chick"))return "chicks";return "";}
  function birdChoices(kind=""){
    try{
      return (window.StagingCustomerBirdSalesV1?.listings?.()||[])
        .filter(x=>x&&x.breed&&(!kind||normalizeBirdType(x.birdType)===kind))
        .map(x=>({value:`${x.breed} — ${x.birdType||"Birds"}`,label:`${x.breed} — ${x.birdType||"Birds"}`,birdType:normalizeBirdType(x.birdType),status:String(x.status||""),quantity:whole(x.quantity)}));
    }catch{return [];}
  }
  function ensure(){
    if(document.getElementById("customerRequestSection"))return document.getElementById("customerRequestSection");
    const section=document.createElement("section");section.id="customerRequestSection";section.className="section-block";
    section.innerHTML=`<div class="section-heading"><div><div class="section-kicker">📨 Request eggs or birds</div><h2>Join the request list</h2><p>Tell Rose Family Poultry what you are looking for and how to reach you.</p></div><span class="mini-chip">TEST / STAGING</span></div><div class="request-availability"><div><span>🥚 Eggs</span><strong id="reqPubEggMsg"></strong></div><div><span>🐣 Birds</span><strong id="reqPubBirdMsg"></strong></div></div><form id="customerRequestForm"><div class="request-grid"><label>Request type<select id="reqPubCategory"><option value="eggs">🥚 Eggs</option><option value="birds">🐣 Birds</option></select></label><label id="reqPubBirdTypeWrap" hidden>Bird type<select id="reqPubBirdType"><option value="chicks">🐣 Chicks</option><option value="pullets">🐔 Pullets</option><option value="roosters">🐓 Roosters</option></select></label><label>What do you want?<select id="reqPubItem"></select></label><label>Quantity<input id="reqPubQty" type="number" min="1" max="999" value="1" required></label><label>Your name<input id="reqPubName" maxlength="80" required></label><label>Phone<input id="reqPubPhone" inputmode="tel" maxlength="40" placeholder="Phone or email required"></label><label>Email<input id="reqPubEmail" type="email" maxlength="120" placeholder="Phone or email required"></label></div><label>Notes<textarea id="reqPubNote" maxlength="300" rows="3" placeholder="Color, age, pickup timing, etc."></textarea></label><button type="submit" class="fact-next">Send Request 📨</button><p class="request-privacy">Your contact information is sent privately to Rose Family Poultry and is never shown on the customer page.</p><div id="reqPubResult" class="request-result" hidden></div></form>`;
    const before=document.querySelector(".flock-section")||document.querySelector("footer");before?.parentNode?.insertBefore(section,before);
    if(!document.getElementById("customerRequestSuccessPopup")){
      const pop=document.createElement("div");pop.id="customerRequestSuccessPopup";pop.className="request-success-overlay";pop.hidden=true;pop.innerHTML=`<div class="request-success-card" role="dialog" aria-modal="true" aria-labelledby="reqSuccessTitle"><div class="request-success-emoji" id="reqSuccessEmoji">🐣</div><h2 id="reqSuccessTitle">Request sent successfully!</h2><p id="reqSuccessMessage">The flock office has your request.</p><button type="button" id="reqSuccessClose" class="fact-next">Got it 👍</button></div>`;document.body.appendChild(pop);
      pop.addEventListener("click",ev=>{if(ev.target===pop)hideSuccess();});
      pop.querySelector("#reqSuccessClose")?.addEventListener("click",hideSuccess);
    }
    if(!document.getElementById("customerRequestPreviewCss")){
      const st=document.createElement("style");st.id="customerRequestPreviewCss";st.textContent=`.request-availability{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}.request-availability>div{padding:14px;border-radius:18px;background:rgba(255,255,255,.9);border:1px solid rgba(31,122,58,.12)}.request-availability span,.request-availability strong{display:block}.request-availability strong{margin-top:5px;color:#1f7a3a}.request-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.request-grid label,#customerRequestForm>label{font-weight:800}.request-grid input,.request-grid select,#customerRequestForm textarea{width:100%;box-sizing:border-box;margin-top:6px;padding:12px;border:1px solid rgba(31,122,58,.18);border-radius:14px;font:inherit}.request-privacy{font-size:12px;color:#667267;line-height:1.45}.request-result{margin-top:12px;padding:12px;border-radius:14px;background:#e9f7ed;color:#17652e;font-weight:800}.request-success-overlay{position:fixed;inset:0;z-index:99999;background:rgba(10,32,17,.58);display:grid;place-items:center;padding:22px}.request-success-overlay[hidden]{display:none}.request-success-card{width:min(420px,100%);box-sizing:border-box;background:#fff;border-radius:26px;padding:26px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.28)}.request-success-emoji{font-size:58px}.request-success-card h2{margin:8px 0}.request-success-card p{font-size:17px;line-height:1.45;color:#526255}.request-success-card button{margin-top:8px}@media(max-width:650px){.request-grid,.request-availability{grid-template-columns:1fr}}`;document.head.appendChild(st);
    }
    return section;
  }
  function refreshItems(){
    const cat=document.getElementById("reqPubCategory")?.value||"eggs",sel=document.getElementById("reqPubItem"),birdWrap=document.getElementById("reqPubBirdTypeWrap"),birdType=document.getElementById("reqPubBirdType")?.value||"chicks";
    if(!sel)return;
    if(cat==="eggs"){
      if(birdWrap)birdWrap.hidden=true;
      sel.innerHTML='<option>12-pack eggs</option><option>18-pack eggs</option><option>Any fresh eggs</option>';
      return;
    }
    if(birdWrap)birdWrap.hidden=false;
    const birds=birdChoices(birdType),label=BIRD_TYPES[birdType]||"Birds";
    const any={value:`Any ${label.toLowerCase()}`,label:`Any ${label.toLowerCase()}`};
    sel.innerHTML=[...birds,any].map(x=>`<option value="${esc(x.value)}">${esc(x.label)}${x.status&&x.status!=="Available"?` — ${esc(x.status)}`:""}</option>`).join("");
  }
  function render(){ensure();const e=document.getElementById("reqPubEggMsg"),b=document.getElementById("reqPubBirdMsg");if(e)e.textContent=availability("eggs");if(b)b.textContent=availability("birds");refreshItems();}
  function successCopy(category,birdType){
    if(category==="eggs"){
      const rows=[
        ["🥚","Request sent successfully!","Your eggs have been summoned! The hens have been notified. Probably."],
        ["🧺","Request sent successfully!","Egg request received — the nest-box department is on the case."],
        ["🐔","Request sent successfully!","The flock office has your egg request. Expect zero paperwork from the chickens."]
      ];return rows[Math.floor(Math.random()*rows.length)];
    }
    const label=BIRD_TYPES[birdType]||"Bird";
    const rows=[
      [birdType==="roosters"?"🐓":"🐣","Request sent successfully!",`${label} request sent — chickie headquarters has it!`],
      ["🐔","Request sent successfully!",`Your ${label.toLowerCase()} request just flew into the farm inbox.`],
      ["📨","Request sent successfully!",`The feathered sales department has received your ${label.toLowerCase()} request.`]
    ];return rows[Math.floor(Math.random()*rows.length)];
  }
  function showSuccess(category,birdType){const pop=document.getElementById("customerRequestSuccessPopup"),copy=successCopy(category,birdType);if(!pop)return;const emoji=document.getElementById("reqSuccessEmoji"),title=document.getElementById("reqSuccessTitle"),msg=document.getElementById("reqSuccessMessage");if(emoji)emoji.textContent=copy[0];if(title)title.textContent=copy[1];if(msg)msg.textContent=copy[2];pop.hidden=false;}
  function hideSuccess(){const pop=document.getElementById("customerRequestSuccessPopup");if(pop)pop.hidden=true;}
  function submit(ev){
    ev.preventDefault();
    const name=String(document.getElementById("reqPubName")?.value||"").trim().slice(0,80),phone=String(document.getElementById("reqPubPhone")?.value||"").trim().slice(0,40),email=String(document.getElementById("reqPubEmail")?.value||"").trim().slice(0,120),category=document.getElementById("reqPubCategory")?.value==="birds"?"birds":"eggs",birdType=category==="birds"&&BIRD_TYPES[document.getElementById("reqPubBirdType")?.value]?document.getElementById("reqPubBirdType").value:"",item=String(document.getElementById("reqPubItem")?.value||"").trim().slice(0,120),quantity=Math.min(999,whole(document.getElementById("reqPubQty")?.value)),note=String(document.getElementById("reqPubNote")?.value||"").trim().slice(0,300),result=document.getElementById("reqPubResult");
    const fail=msg=>{if(result){result.hidden=false;result.textContent=msg;result.style.background="#fdecec";result.style.color="#9e2727";}};
    if(!name)return fail("Please enter your name.");if(!phone&&!email)return fail("Please enter a phone number or email so the farm can contact you.");if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail("Please enter a valid email address.");if(quantity<1)return fail("Quantity must be at least 1.");
    const s=state(),row={id:`req-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,phone,email,category,birdType,item:item||(category==="birds"?(BIRD_TYPES[birdType]||"Birds"):"Eggs"),quantity,note,status:"New",createdAt:Date.now(),updatedAt:Date.now()};
    s.requests.unshift(row);s.requests=s.requests.slice(0,500);s.updatedAt=Date.now();write(KEY,s);
    if(result){result.hidden=false;result.style.background="#e9f7ed";result.style.color="#17652e";result.textContent="Request sent successfully.";}
    showSuccess(category,birdType);
    ev.target.reset();document.getElementById("reqPubQty").value="1";refreshItems();
  }
  function start(){ensure();render();document.getElementById("reqPubCategory")?.addEventListener("change",refreshItems);document.getElementById("reqPubBirdType")?.addEventListener("change",refreshItems);document.getElementById("customerRequestForm")?.addEventListener("submit",submit);setTimeout(render,500);}
  window.StagingCustomerRequestPreviewV1={version:2,state,availability,render,birdChoices,normalizeBirdType,refreshItems,successCopy,showSuccess,hideSuccess};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();