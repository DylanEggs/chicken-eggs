(() => {
  "use strict";
  if (window.FarmBirdSalesV1) return;

  const APP2_KEY = "chickenEggApp2V1";
  const PHOTO_PREFIX = "bird-sale-";
  let editingId = "";

  const n = v => Number(v) || 0;
  const whole = v => Math.max(0, Math.round(n(v)));
  const money = v => `$${Math.max(0, n(v)).toFixed(2)}`;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const dateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

  function readApp() {
    try {
      const app = JSON.parse(localStorage.getItem(APP2_KEY) || "{}");
      if (!app || typeof app !== "object") return { birdListings:[] };
      if (!Array.isArray(app.birdListings)) app.birdListings = [];
      return app;
    } catch { return { birdListings:[] }; }
  }
  function normalized(row = {}) {
    const quantity = whole(row.quantity);
    let status = String(row.status || (quantity > 0 ? "Available" : "Sold Out"));
    if (quantity === 0 && status === "Available") status = "Sold Out";
    return {
      id:String(row.id || ""),
      breed:String(row.breed || "").trim(),
      birdType:String(row.birdType || "Chicks (Straight Run)").trim(),
      hatchDate:dateOk(row.hatchDate) ? String(row.hatchDate) : "",
      quantity,
      status,
      price:row.price === "" || row.price == null ? null : Math.max(0, n(row.price)),
      notes:String(row.notes || "").trim().slice(0,240),
      public:row.public !== false,
      photoId:String(row.photoId || (row.id ? PHOTO_PREFIX + row.id : "")),
      createdAt:n(row.createdAt) || Date.now(),
      updatedAt:n(row.updatedAt) || Date.now()
    };
  }
  function list() {
    return readApp().birdListings.map(normalized).filter(x => x.id && x.breed);
  }
  function photoFor(row) {
    const svc = window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;
    return svc?.get?.(row.photoId) || "";
  }
  function saveApp(app, reason = "bird-listing") {
    app.updatedAt = Date.now();
    localStorage.setItem(APP2_KEY, JSON.stringify(app));
    try { window.__reloadFarm2Memory?.(); } catch {}
    window.dispatchEvent(new CustomEvent("farm-local-data-changed", { detail:{ key:APP2_KEY, reason } }));
    window.dispatchEvent(new CustomEvent("bird-sale-listings-changed", { detail:{ reason } }));
    render();
  }
  async function upsert(input = {}, options = {}) {
    const app = readApp();
    const rows = app.birdListings.map(normalized);
    const existing = input.id ? rows.find(x => x.id === String(input.id)) : null;
    const id = existing?.id || String(input.id || `sale-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
    const row = normalized({
      ...existing,
      ...input,
      id,
      photoId:existing?.photoId || input.photoId || PHOTO_PREFIX + id,
      createdAt:existing?.createdAt || Date.now(),
      updatedAt:Date.now()
    });
    if (!row.breed) throw new Error("Breed or mix is required");
    if (!Number.isInteger(Number(input.quantity ?? row.quantity)) || Number(input.quantity ?? row.quantity) < 0) throw new Error("Quantity must be a whole non-negative number");

    const index = rows.findIndex(x => x.id === id);
    if (index >= 0) rows[index] = row; else rows.unshift(row);
    app.birdListings = rows;
    saveApp(app, existing ? "bird-listing-edited" : "bird-listing-added");

    if (options.file) {
      const svc = window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;
      if (svc?.saveFile) await svc.saveFile(row.photoId, options.file);
    } else if (options.photoSrc) {
      const svc = window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;
      if (svc?.savePrepared) await svc.savePrepared(row.photoId, options.photoSrc);
    }
    render();
    return row;
  }
  async function remove(id, options = {}) {
    id = String(id || "");
    if (!id) return false;
    const app = readApp();
    const row = app.birdListings.map(normalized).find(x => x.id === id);
    app.birdListings = app.birdListings.filter(x => String(x?.id || "") !== id);
    saveApp(app, "bird-listing-deleted");
    if (row?.photoId && options.keepPhoto !== true) {
      const svc = window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;
      try { await svc?.remove?.(row.photoId); } catch {}
    }
    return true;
  }
  async function removePhoto(id) {
    const row = list().find(x => x.id === String(id || ""));
    if (!row) return false;
    const svc = window.FarmBirdPhotosV4 || window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;
    await svc?.remove?.(row.photoId);
    render();
    return true;
  }
  function ageText(date) {
    if (!dateOk(date)) return "Age not listed";
    const born = new Date(`${date}T12:00:00`);
    const days = Math.max(0, Math.floor((Date.now() - born.getTime()) / 86400000));
    if (days < 14) return `${days} day${days === 1 ? "" : "s"} old`;
    if (days < 112) return `${Math.floor(days/7)} weeks old`;
    const months = Math.floor(days/30.44);
    return months < 24 ? `${months} months old` : `${Math.floor(months/12)}y ${months%12}m old`;
  }

  function ensureUI() {
    const app = document.querySelector(".app"), nav = document.querySelector(".bottomNav"), hub = document.getElementById("farm2Hub");
    if (!app || !nav || !hub) return false;
    const grid = hub.querySelector(".farm2-hubGrid");
    if (grid && !document.getElementById("farm2BirdSalesHubBtn")) {
      const btn = document.createElement("button");
      btn.id = "farm2BirdSalesHubBtn";
      btn.className = "farm2-hubButton gold";
      btn.setAttribute("onclick", "showScreen('farm2BirdSales')");
      btn.innerHTML = '<span class="farm2-bigEmoji">🐣</span>Birds for Sale<small>Chicks, pullets & roosters</small>';
      grid.appendChild(btn);
    }
    if (!document.getElementById("farm2BirdSales")) {
      const screen = document.createElement("section");
      screen.id = "farm2BirdSales";
      screen.className = "screen";
      screen.innerHTML = `
        <div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>🐣 Birds for Sale</h2></div>
        <div class="farm2-card">
          <h3 id="birdSaleFormTitle">Add Bird Listing</h3>
          <div class="farm2-formRow">
            <div><label>Breed / Mix</label><input id="birdSaleBreed" placeholder="Example: Golden Comet mix" /></div>
            <div><label>Type</label><select id="birdSaleType"><option>Chicks (Straight Run)</option><option>Pullets</option><option>Cockerels</option><option>Roosters</option><option>Hens</option><option>Started Birds</option></select></div>
          </div>
          <div class="farm2-formRow">
            <div><label>Hatch Date</label><input id="birdSaleHatchDate" type="date" /></div>
            <div><label>Quantity Available</label><input id="birdSaleQuantity" type="number" min="0" step="1" value="1" /></div>
          </div>
          <div class="farm2-formRow">
            <div><label>Status</label><select id="birdSaleStatus"><option>Available</option><option>Coming Soon</option><option>Reserved</option><option>Sold Out</option></select></div>
            <div><label>Public Price Each (optional)</label><input id="birdSalePrice" type="number" min="0" step=".01" placeholder="Leave blank to hide price" /></div>
          </div>
          <label>Public Description</label><input id="birdSaleNotes" maxlength="240" placeholder="Color, parent stock, pickup notes, etc." />
          <label>Photo (optional)</label><input id="birdSalePhoto" type="file" accept="image/*" />
          <div class="farm2-toggleRow"><div><b>Show on customer page</b><div class="farm2-subtle">Turn this off to keep a draft/private listing.</div></div><input class="farm2-switch" id="birdSalePublic" type="checkbox" checked /></div>
          <button id="birdSaleSaveBtn" type="button">Save Listing</button>
          <button id="birdSaleCancelBtn" type="button" class="secondary" hidden>Cancel Edit</button>
        </div>
        <div id="birdSaleSummary"></div>
        <div id="birdSaleList" class="farm2-list"></div>`;
      app.insertBefore(screen, nav);
      document.getElementById("birdSaleSaveBtn")?.addEventListener("click", saveFromForm);
      document.getElementById("birdSaleCancelBtn")?.addEventListener("click", resetForm);
    }
    return true;
  }

  function formValue(id) { return document.getElementById(id)?.value ?? ""; }
  async function saveFromForm() {
    const quantityRaw = formValue("birdSaleQuantity");
    if (quantityRaw === "" || Number(quantityRaw) < 0 || !Number.isInteger(Number(quantityRaw))) { alert("Quantity must be a whole number of birds."); return; }
    const breed = String(formValue("birdSaleBreed")).trim();
    if (!breed) { alert("Enter the breed or mix first."); return; }
    const file = document.getElementById("birdSalePhoto")?.files?.[0] || null;
    try {
      await upsert({
        id:editingId || undefined,
        breed,
        birdType:formValue("birdSaleType"),
        hatchDate:formValue("birdSaleHatchDate"),
        quantity:Number(quantityRaw),
        status:formValue("birdSaleStatus"),
        price:formValue("birdSalePrice"),
        notes:formValue("birdSaleNotes"),
        public:!!document.getElementById("birdSalePublic")?.checked
      }, { file });
      resetForm();
    } catch (error) { alert(error?.message || "Could not save bird listing."); }
  }
  function edit(id) {
    const row = list().find(x => x.id === String(id));
    if (!row) return;
    editingId = row.id;
    document.getElementById("birdSaleBreed").value = row.breed;
    document.getElementById("birdSaleType").value = row.birdType;
    document.getElementById("birdSaleHatchDate").value = row.hatchDate;
    document.getElementById("birdSaleQuantity").value = row.quantity;
    document.getElementById("birdSaleStatus").value = row.status;
    document.getElementById("birdSalePrice").value = row.price == null ? "" : row.price;
    document.getElementById("birdSaleNotes").value = row.notes;
    document.getElementById("birdSalePublic").checked = row.public;
    document.getElementById("birdSaleFormTitle").textContent = "Edit Bird Listing";
    document.getElementById("birdSaleSaveBtn").textContent = "Save Changes";
    document.getElementById("birdSaleCancelBtn").hidden = false;
    window.showScreen?.("farm2BirdSales");
  }
  function resetForm() {
    editingId = "";
    const values = {birdSaleBreed:"",birdSaleType:"Chicks (Straight Run)",birdSaleHatchDate:"",birdSaleQuantity:"1",birdSaleStatus:"Available",birdSalePrice:"",birdSaleNotes:""};
    for (const [id,v] of Object.entries(values)) { const el=document.getElementById(id); if (el) el.value=v; }
    const pub=document.getElementById("birdSalePublic"); if(pub)pub.checked=true;
    const file=document.getElementById("birdSalePhoto"); if(file)file.value="";
    const title=document.getElementById("birdSaleFormTitle"); if(title)title.textContent="Add Bird Listing";
    const save=document.getElementById("birdSaleSaveBtn"); if(save)save.textContent="Save Listing";
    const cancel=document.getElementById("birdSaleCancelBtn"); if(cancel)cancel.hidden=true;
  }
  async function deleteFromUI(id) {
    const row=list().find(x=>x.id===String(id));
    if(!row)return;
    if(!confirm(`Delete the ${row.breed} listing?`))return;
    await remove(id);
  }
  function render() {
    if (!ensureUI()) return;
    const rows = list().sort((a,b)=>Number(b.updatedAt)-Number(a.updatedAt));
    const sum = document.getElementById("birdSaleSummary"), box = document.getElementById("birdSaleList");
    const publicRows = rows.filter(x=>x.public);
    const available = publicRows.filter(x=>x.status==="Available").reduce((s,x)=>s+x.quantity,0);
    if (sum) sum.innerHTML = `<div class="farm2-grid3"><div class="farm2-card"><div class="farm2-kicker">Listings</div><div class="farm2-moneyBig">${rows.length}</div></div><div class="farm2-card"><div class="farm2-kicker">Public</div><div class="farm2-moneyBig">${publicRows.length}</div></div><div class="farm2-card"><div class="farm2-kicker">Birds Available</div><div class="farm2-moneyBig">${available}</div></div></div>`;
    if (!box) return;
    box.innerHTML = rows.length ? rows.map(row => {
      const photo=photoFor(row), price=row.price==null?"Price not shown":`${money(row.price)} each`;
      return `<div class="farm2-listItem"><div class="farm2-listTop"><div style="display:flex;gap:12px;align-items:center"><div style="width:64px;height:64px;border-radius:16px;overflow:hidden;display:grid;place-items:center;background:rgba(245,185,28,.12);font-size:32px">${photo?`<img src="${esc(photo)}" alt="${esc(row.breed)}" style="width:100%;height:100%;object-fit:cover">`:"🐣"}</div><div><h4>${esc(row.breed)}</h4><div class="farm2-subtle">${esc(row.birdType)} • ${esc(ageText(row.hatchDate))}</div></div></div><span class="farm2-badge ${row.status==="Sold Out"?"red":row.status==="Available"?"":"gold"}">${esc(row.status)}</span></div><div class="farm2-subtle" style="margin-top:8px"><b>${row.quantity}</b> available • ${esc(price)} ${row.public?"• Public":"• Hidden from customers"}</div>${row.notes?`<div class="farm2-subtle">📝 ${esc(row.notes)}</div>`:""}<div class="farm2-actions"><button onclick="FarmBirdSalesV1.edit('${esc(row.id)}')">Edit</button>${photo?`<button class="secondary" onclick="FarmBirdSalesV1.removePhoto('${esc(row.id)}')">Remove Photo</button>`:""}<button class="farm2-delete" onclick="FarmBirdSalesV1.deleteFromUI('${esc(row.id)}')">Delete</button></div></div>`;
    }).join("") : `<div class="farm2-empty">No birds listed for sale yet. Add chicks, pullets, cockerels, roosters or hens above.</div>`;
  }

  window.FarmBirdSalesV1 = { version:1, list, upsert, remove, removePhoto, edit, deleteFromUI, render, ageText, photoFor };
  window.addEventListener("farm-data-synced", e => { if (!e.detail?.key || e.detail.key === APP2_KEY) render(); });
  window.addEventListener("bird-photos-changed", render);
  window.addEventListener("storage", e => { if (e.key === APP2_KEY) render(); });
  document.addEventListener("click", e => { const b=e.target?.closest?.("button"); if(b&&/showScreen\(['\"]farm2BirdSales['\"]\)/.test(b.getAttribute("onclick")||"")) setTimeout(render,0); }, true);

  const start=()=>{ if(ensureUI()){render();return;} setTimeout(start,120); };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();