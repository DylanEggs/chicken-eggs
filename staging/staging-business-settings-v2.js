(() => {
  "use strict";
  if (window.__StagingBusinessSettingsV2 || !window.__ChickenEggsStagingMode) return;
  window.__StagingBusinessSettingsV2 = true;

  const STORE = "rfpBusinessIdentityV2";
  const BRAND = "Rose Family Poultry";
  const read = () => {
    try {
      const x = JSON.parse(localStorage.getItem(STORE) || "{}");
      return {
        businessName: cleanName(x.businessName || BRAND),
        phone: String(x.phone || ""),
        email: String(x.email || ""),
        invoicePrefix: String(x.invoicePrefix || "RFP").replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "RFP",
        nextInvoice: Math.max(1, Math.floor(Number(x.nextInvoice) || 1)),
        businessStartDate: String(x.businessStartDate || ""),
        taxId: String(x.taxId || ""),
        receiptFooter: String(x.receiptFooter || "Thank you for supporting Rose Family Poultry!"),
        logo: typeof x.logo === "string" && x.logo.startsWith("data:image/") ? x.logo : ""
      };
    } catch { return {businessName:BRAND,phone:"",email:"",invoicePrefix:"RFP",nextInvoice:1,businessStartDate:"",taxId:"",receiptFooter:"Thank you for supporting Rose Family Poultry!",logo:""}; }
  };
  const write = value => {
    const v = {...value, businessName: cleanName(value.businessName || BRAND)};
    try { localStorage.setItem(STORE, JSON.stringify(v)); window.dispatchEvent(new CustomEvent("rfp-staging-business-identity-changed", {detail:v})); return true; }
    catch { return false; }
  };
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  function cleanName(v){ return String(v || BRAND).replace(/,?\s*LLC\b/ig, "").replace(/\s{2,}/g," ").trim() || BRAND; }

  function compress(file){
    if(!file) return Promise.resolve("");
    return new Promise(resolve=>{
      const img=new Image(),url=URL.createObjectURL(file);
      img.onload=()=>{try{const max=420,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext("2d").drawImage(img,0,0,c.width,c.height);let out=c.toDataURL("image/jpeg",.62);if(out.length>180000)out=c.toDataURL("image/jpeg",.42);URL.revokeObjectURL(url);resolve(out);}catch{URL.revokeObjectURL(url);resolve("");}};
      img.onerror=()=>{URL.revokeObjectURL(url);resolve("");};img.src=url;
    });
  }

  function ensureCss(){
    if(document.getElementById("rfpBusinessIdentityCss")) return;
    const s=document.createElement("style");s.id="rfpBusinessIdentityCss";s.textContent=`
      .rfp-id-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.rfp-id-form{display:grid;gap:9px}.rfp-id-form input,.rfp-id-form textarea{width:100%;box-sizing:border-box}.rfp-id-form textarea{min-height:72px}.rfp-id-preview{margin-top:14px;padding:16px;border:1px dashed rgba(31,122,58,.35);border-radius:16px;background:#fff;color:#17351f}.farm2-dark .rfp-id-preview{background:#fff;color:#17351f}.rfp-id-logo{width:72px;height:72px;border-radius:14px;object-fit:cover;display:block;margin-bottom:8px}.rfp-id-private{font-size:11px;font-weight:800;color:#7f1d1d}.rfp-id-number{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}@media(max-width:560px){.rfp-id-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function ensureTab(){
    const modal=document.getElementById("rfpBusinessModal");
    if(!modal) return false;
    const tabs=modal.querySelector(".rfp-biz-tabs");
    if(!tabs) return false;
    if(!tabs.querySelector('[data-identity-tab="1"]')){
      const b=document.createElement("button");b.type="button";b.dataset.identityTab="1";b.textContent="🏷️ Business Settings";
      b.addEventListener("click",()=>render());tabs.appendChild(b);
    }
    return true;
  }

  function receiptNumber(s){ return `${s.invoicePrefix}-${String(s.nextInvoice).padStart(4,"0")}`; }
  function render(){
    ensureCss();ensureTab();
    const s=read(),body=document.getElementById("rfpBizBody");if(!body)return;
    document.querySelectorAll("#rfpBusinessModal .rfp-biz-tabs button").forEach(x=>x.classList.toggle("active",x.dataset.identityTab==="1"));
    body.innerHTML=`<section class="rfp-biz-panel active"><h3>🏷️ Business Settings</h3><div class="rfp-muted">STAGING • LOCAL ONLY • No Firebase reads or writes</div><p class="rfp-id-private">Private fields on this screen are never included on the customer page.</p><form id="rfpIdentityForm" class="rfp-id-form"><div class="rfp-id-grid"><label>Business display name<input name="businessName" value="${esc(s.businessName)}" required></label><label>Business start date<input name="businessStartDate" type="date" value="${esc(s.businessStartDate)}"></label></div><div class="rfp-id-grid"><label>Phone<input name="phone" value="${esc(s.phone)}" inputmode="tel"></label><label>Email<input name="email" type="email" value="${esc(s.email)}"></label></div><div class="rfp-id-grid"><label>Invoice prefix<input name="invoicePrefix" value="${esc(s.invoicePrefix)}" maxlength="12"></label><label>Next invoice number<input name="nextInvoice" type="number" min="1" value="${s.nextInvoice}"></label></div><label>Private tax / EIN field<input name="taxId" value="${esc(s.taxId)}" autocomplete="off"></label><label>Receipt footer<textarea name="receiptFooter">${esc(s.receiptFooter)}</textarea></label><label>Business logo (optional, stored only in STAGING browser storage)<input id="rfpIdentityLogo" name="logo" type="file" accept="image/*" capture="environment"></label>${s.logo?`<img class="rfp-id-logo" src="${esc(s.logo)}" alt="Business logo preview">`:""}<div class="rfp-biz-actions"><button type="submit">Save Business Settings</button>${s.logo?'<button id="rfpRemoveLogo" type="button">Remove Logo</button>':''}</div></form><div class="rfp-id-preview">${s.logo?`<img class="rfp-id-logo" src="${esc(s.logo)}" alt="Business logo">`:""}<strong>${esc(s.businessName)}</strong><div class="rfp-muted">${esc([s.phone,s.email].filter(Boolean).join(" • ")||"Contact details not set")}</div><hr><div><strong>Receipt preview</strong></div><div class="rfp-id-number">${esc(receiptNumber(s))}</div><div>${esc(s.receiptFooter)}</div></div></section>`;
    document.getElementById("rfpIdentityForm")?.addEventListener("submit",saveForm);
    document.getElementById("rfpRemoveLogo")?.addEventListener("click",()=>{const x=read();x.logo="";write(x);render();});
  }

  async function saveForm(e){
    e.preventDefault();const f=new FormData(e.currentTarget),old=read(),file=f.get("logo");let logo=old.logo;
    if(file && typeof file==="object" && file.size) logo=await compress(file);
    const next={businessName:cleanName(f.get("businessName")),phone:String(f.get("phone")||""),email:String(f.get("email")||""),invoicePrefix:String(f.get("invoicePrefix")||"RFP"),nextInvoice:Math.max(1,Math.floor(Number(f.get("nextInvoice"))||1)),businessStartDate:String(f.get("businessStartDate")||""),taxId:String(f.get("taxId")||""),receiptFooter:String(f.get("receiptFooter")||""),logo};
    write(next);render();
  }

  document.addEventListener("click",e=>{
    const t=e.target.closest?.("#rfpBusinessLauncher,#rfpBusinessModal [data-tab],#rfpBusinessModal [data-farmtab]");
    if(t) setTimeout(ensureTab,0);
  },true);
  window.addEventListener("rfp-staging-business-changed",()=>setTimeout(ensureTab,0));

  // Help the receipt vault use the rear camera on phones when available.
  document.addEventListener("click",()=>setTimeout(()=>{
    document.querySelectorAll('#rfpBusinessModal input[type="file"][accept*="image"]').forEach(x=>x.setAttribute("capture","environment"));
  },0),true);

  window.StagingBusinessIdentityV2={version:2,read,write,cleanName,receiptNumber,render,zeroFirebase:true};
})();
