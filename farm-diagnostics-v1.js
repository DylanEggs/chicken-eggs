(() => {
  "use strict";
  if (window.__farmDiagnosticsV1) return;
  window.__farmDiagnosticsV1 = true;

  const KEYS = {
    entries: "chickenEggEntriesV102",
    settings: "chickenEggSettingsV102",
    app2: "chickenEggApp2V1",
    inventory: "chickenEggInventoryV2",
    business: "chickenEggBusinessV1",
    deluxe: "chickenEggDeluxeV1",
    photos: "chickenEggLocalBirdPhotosV1",
    photoMeta: "chickenEggBirdPhotoMetaV4",
    snapshots: "chickenEggApp2SnapshotsV1"
  };

  const DATASETS = [
    { id:"farm_app_2_v1", field:"farmApp2", key:KEYS.app2, label:"Farm App 2" },
    { id:"farm_inventory_v2", field:"inventory", key:KEYS.inventory, label:"Inventory" },
    { id:"farm_business_v1", field:"business", key:KEYS.business, label:"Business" },
    { id:"farm_deluxe_v1", field:"deluxe", key:KEYS.deluxe, label:"Deluxe" }
  ];

  let lastReport = null;
  let running = false;

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };
  const n = v => Number(v) || 0;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const clone = v => { try { return v == null ? v : JSON.parse(JSON.stringify(v)); } catch { return v; } };
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const addDays = (key, amount) => { const d=new Date(`${key}T12:00:00`); d.setDate(d.getDate()+amount); return dateKey(d); };
  const same = (a,b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; } };
  const itemId = x => String(x?.id || x?.birdId || "");
  const list = x => Array.isArray(x) ? x : [];

  function physicalInventory(x) {
    x = x && typeof x === "object" ? x : {};
    return Math.round(n(x.dozens)*12 + n(x.packs18)*18 + n(x.loose));
  }

  function normalizeCore(rows) {
    return list(rows).filter(x => x && (x.type === "eggs" || x.type === "sale")).map(x => ({
      id:String(x.id || ""),
      type:x.type,
      date:String(x.date || "").slice(0,10),
      eggs:x.type === "eggs" ? n(x.eggs) : 0,
      dozenSold:x.type === "sale" ? n(x.dozenSold) : 0,
      packSold:x.type === "sale" ? n(x.packSold ?? x.packs18Sold) : 0,
      dozenPrice:x.type === "sale" ? n(x.dozenPrice) : 0,
      packPrice:x.type === "sale" ? n(x.packPrice ?? x.packs18Price) : 0,
      updatedAt:n(x.updatedAt),
      createdAt:n(x.createdAt)
    }));
  }

  function coreSummary(rows) {
    const r = normalizeCore(rows);
    return {
      entries:r.length,
      eggEntries:r.filter(x=>x.type==="eggs").length,
      saleEntries:r.filter(x=>x.type==="sale").length,
      lifetimeEggs:r.filter(x=>x.type==="eggs").reduce((s,x)=>s+x.eggs,0),
      eggsSold:r.filter(x=>x.type==="sale").reduce((s,x)=>s+x.dozenSold*12+x.packSold*18,0)
    };
  }

  function app2Counts(x) {
    x = x && typeof x === "object" ? x : {};
    return {
      flock:list(x.flock).length,
      expenses:list(x.expenses).length,
      customers:list(x.customers).length,
      orders:list(x.orders).length,
      chores:list(x.chores).length,
      activity:list(x.activity).length,
      saleMeta:x.saleMeta && typeof x.saleMeta === "object" ? Object.keys(x.saleMeta).length : 0
    };
  }

  function recentEggs(localRows, cloudRows) {
    const local = normalizeCore(localRows).filter(x=>x.type==="eggs");
    const cloud = normalizeCore(cloudRows).filter(x=>x.type==="eggs");
    const today = dateKey();
    const days = [];
    for (let i=0;i<7;i++) {
      const date = addDays(today,-i);
      const l = local.filter(x=>x.date===date);
      const c = cloud.filter(x=>x.date===date);
      const lm = new Map(l.map(x=>[x.id,x]));
      const cm = new Map(c.map(x=>[x.id,x]));
      const onlyLocal = [...lm.keys()].filter(id=>!cm.has(id));
      const onlyCloud = [...cm.keys()].filter(id=>!lm.has(id));
      const changed = [...lm.keys()].filter(id=>cm.has(id) && !same(lm.get(id),cm.get(id)));
      days.push({
        date,
        phoneEggs:l.reduce((s,x)=>s+x.eggs,0),
        firebaseEggs:c.reduce((s,x)=>s+x.eggs,0),
        phoneEntries:l.map(x=>({id:x.id,eggs:x.eggs,updatedAt:x.updatedAt})),
        firebaseEntries:c.map(x=>({id:x.id,eggs:x.eggs,updatedAt:x.updatedAt})),
        onlyOnPhone:onlyLocal,
        onlyInFirebase:onlyCloud,
        different:changed,
        matches:onlyLocal.length===0 && onlyCloud.length===0 && changed.length===0 && l.reduce((s,x)=>s+x.eggs,0)===c.reduce((s,x)=>s+x.eggs,0)
      });
    }
    return days;
  }

  function compareCore(localRows, cloudRows) {
    const l = new Map(normalizeCore(localRows).map(x=>[x.id,x]));
    const c = new Map(normalizeCore(cloudRows).map(x=>[x.id,x]));
    return {
      onlyOnPhone:[...l.keys()].filter(id=>!c.has(id)),
      onlyInFirebase:[...c.keys()].filter(id=>!l.has(id)),
      different:[...l.keys()].filter(id=>c.has(id) && !same(l.get(id),c.get(id)))
    };
  }

  function resourceVersion(fragment) {
    const perf = performance.getEntriesByType?.("resource") || [];
    const hit = perf.map(x=>x.name).find(name=>name.includes(fragment));
    if (!hit) return "not-seen";
    try { const u=new URL(hit); return u.searchParams.get("v") || u.searchParams.get("build") || hit.split("?")[1] || "loaded"; }
    catch { return hit; }
  }

  async function waitForFirebase(ms=18000) {
    const start=Date.now();
    while (Date.now()-start < ms) {
      if (window.FirestoreDB && window.FirebaseUser && window.ChickenEggsDB) return true;
      await new Promise(r=>setTimeout(r,100));
    }
    return false;
  }

  async function cloudRead() {
    if (!(await waitForFirebase())) throw new Error("Firebase authenticated session was not ready within 18 seconds.");
    const { doc, getDoc, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    const db = window.FirestoreDB;

    const allSnapPromise = getDocs(collection(db,"entries"));
    const settingsPromise = window.ChickenEggsDB.loadFarmSettings();
    const datasetPromises = DATASETS.map(async ds => {
      const snap = await getDoc(doc(db,"entries",ds.id));
      return [ds.id, snap.exists() ? (snap.data()?.[ds.field] ?? null) : null];
    });
    const [allSnap, settings, datasets] = await Promise.all([allSnapPromise, settingsPromise, Promise.all(datasetPromises)]);
    const allDocs = allSnap.docs.map(d=>({id:d.id,...d.data()}));
    const map = Object.fromEntries(datasets);
    return {
      allDocs,
      core:allDocs.filter(x=>x.type==="eggs" || x.type==="sale"),
      settings:settings || null,
      app2:map.farm_app_2_v1 || null,
      inventory:map.farm_inventory_v2 || null,
      business:map.farm_business_v1 || null,
      deluxe:map.farm_deluxe_v1 || null,
      photos:allDocs.filter(x=>x.type==="birdPhotoV4"),
    };
  }

  function localRead() {
    return {
      core:read(KEYS.entries,[]),
      settings:read(KEYS.settings,{}),
      app2:read(KEYS.app2,{}),
      inventory:read(KEYS.inventory,{}),
      business:read(KEYS.business,{}),
      deluxe:read(KEYS.deluxe,{}),
      photos:read(KEYS.photos,{}),
      photoMeta:read(KEYS.photoMeta,{}),
      snapshots:read(KEYS.snapshots,[])
    };
  }

  function makeReport(local, cloud) {
    const coreCompare = compareCore(local.core,cloud.core);
    const recent = recentEggs(local.core,cloud.core);
    const lc = coreSummary(local.core), cc=coreSummary(cloud.core);
    const la=app2Counts(local.app2), ca=app2Counts(cloud.app2);
    const lb=list(local.business?.chickenSales).length, cb=list(cloud.business?.chickenSales).length;
    const localPhotoCount=Object.values(local.photos||{}).filter(v=>typeof v==="string" && v.length>10).length;
    const cloudActivePhotos=cloud.photos.filter(x=>!x.deleted && typeof x.dataUrl==="string" && x.dataUrl.length>10).length;
    const dirty = window.FarmSyncSafety?.getDirtyKeys?.() || [];
    const inventoryLocal=physicalInventory(local.inventory), inventoryCloud=physicalInventory(cloud.inventory);
    const app2Match = Object.keys(la).every(k=>la[k]===ca[k]);
    const coreMatch = !coreCompare.onlyOnPhone.length && !coreCompare.onlyInFirebase.length && !coreCompare.different.length;
    const inventoryMatch = inventoryLocal===inventoryCloud;
    const businessMatch = lb===cb;
    const recentMismatch = recent.some(x=>!x.matches);

    const warnings=[];
    if (!coreMatch) warnings.push("Core egg/sale history differs between this phone and Firebase.");
    if (recentMismatch) warnings.push("At least one of the last 7 days has an egg-entry mismatch.");
    if (!inventoryMatch) warnings.push("Physical egg inventory differs between this phone and Firebase.");
    if (!app2Match) warnings.push("Farm App 2 counts differ between this phone and Firebase.");
    if (!businessMatch) warnings.push("Chicken Sales count differs between this phone and Firebase.");
    if (dirty.length) warnings.push(`Unsynced local farm datasets are pending: ${dirty.join(", ")}.`);
    if (!window.FarmSyncSafety?.isReady?.()) warnings.push("Protected Firebase bootstrap is not reporting ready.");

    return {
      diagnosticVersion:"1.0",
      generatedAt:new Date().toISOString(),
      localTime:new Date().toString(),
      online:navigator.onLine,
      syncStatus:document.getElementById("syncStatus")?.textContent?.trim() || "",
      firebaseReady:!!window.FarmSyncSafety?.isReady?.(),
      firebaseSyncVersion:String(window.FarmSyncSafety?.version || "unknown"),
      firebaseUser:window.FirebaseUser?.uid ? `anonymous:${String(window.FirebaseUser.uid).slice(-8)}` : "not-ready",
      appResources:{
        app2:resourceVersion("app2.js"),
        firebase:resourceVersion("firebase-safe-v9.js"),
        diagnostics:resourceVersion("farm-diagnostics-v1.js")
      },
      result:warnings.length ? "CHECK NEEDED" : "MATCHED",
      warnings,
      core:{phone:lc,firebase:cc,comparison:coreCompare},
      recentEggCollections:recent,
      inventory:{
        phone:{total:inventoryLocal,dozens:n(local.inventory?.dozens),packs18:n(local.inventory?.packs18),loose:n(local.inventory?.loose),updatedAt:n(local.inventory?.updatedAt)},
        firebase:{total:inventoryCloud,dozens:n(cloud.inventory?.dozens),packs18:n(cloud.inventory?.packs18),loose:n(cloud.inventory?.loose),updatedAt:n(cloud.inventory?.updatedAt)},
        matches:inventoryMatch,
        recentPhoneAdjustments:list(local.inventory?.adjustments).slice(0,10),
        recentFirebaseAdjustments:list(cloud.inventory?.adjustments).slice(0,10)
      },
      farmApp2:{phone:la,firebase:ca,matches:app2Match,phoneUpdatedAt:n(local.app2?.updatedAt),firebaseUpdatedAt:n(cloud.app2?.updatedAt)},
      business:{phoneChickenSales:lb,firebaseChickenSales:cb,matches:businessMatch,phoneUpdatedAt:n(local.business?.updatedAt),firebaseUpdatedAt:n(cloud.business?.updatedAt)},
      photos:{phoneCached:localPhotoCount,firebaseActive:cloudActivePhotos,firebasePhotoDocs:cloud.photos.length},
      safety:{dirtyKeys:dirty,localSafetySnapshots:list(local.snapshots).length},
      firebaseDocumentCounts:{allEntriesCollectionDocs:cloud.allDocs.length,coreEggSaleDocs:cloud.core.length,birdPhotoDocs:cloud.photos.length}
    };
  }

  function summaryCard(label, phone, cloud, ok) {
    return `<div class="diag-stat ${ok?"ok":"warn"}"><span>${esc(label)}</span><b>${esc(phone)}</b><small>Phone</small><b>${esc(cloud)}</b><small>Firebase</small></div>`;
  }

  function renderReport(report) {
    const out=document.getElementById("farmDiagnosticsOutput");
    if(!out)return;
    const recent=report.recentEggCollections;
    out.innerHTML=`
      <div class="diag-result ${report.result==="MATCHED"?"ok":"warn"}"><b>${report.result==="MATCHED"?"✅ Phone and Firebase match":"⚠️ Difference found"}</b><span>${esc(report.syncStatus||"")}</span></div>
      ${report.warnings.length?`<div class="diag-warnings">${report.warnings.map(x=>`<div>• ${esc(x)}</div>`).join("")}</div>`:'<div class="diag-warnings ok">No data mismatches detected by this read-only check.</div>'}
      <h3>🥚 Recent Egg Collections</h3>
      <div class="diag-days">${recent.map(d=>`<div class="diag-day ${d.matches?"ok":"warn"}"><b>${esc(d.date)}</b><span>Phone: <strong>${d.phoneEggs}</strong></span><span>Firebase: <strong>${d.firebaseEggs}</strong></span>${d.matches?'':'<small>Entry mismatch — include the copied report so I can inspect the IDs.</small>'}</div>`).join("")}</div>
      <h3>Farm Data Comparison</h3>
      <div class="diag-grid">
        ${summaryCard("Lifetime eggs",report.core.phone.lifetimeEggs,report.core.firebase.lifetimeEggs,report.core.phone.lifetimeEggs===report.core.firebase.lifetimeEggs)}
        ${summaryCard("Physical inventory",report.inventory.phone.total,report.inventory.firebase.total,report.inventory.matches)}
        ${summaryCard("Flock profiles",report.farmApp2.phone.flock,report.farmApp2.firebase.flock,report.farmApp2.phone.flock===report.farmApp2.firebase.flock)}
        ${summaryCard("Expenses",report.farmApp2.phone.expenses,report.farmApp2.firebase.expenses,report.farmApp2.phone.expenses===report.farmApp2.firebase.expenses)}
        ${summaryCard("Customers",report.farmApp2.phone.customers,report.farmApp2.firebase.customers,report.farmApp2.phone.customers===report.farmApp2.firebase.customers)}
        ${summaryCard("Chicken sales",report.business.phoneChickenSales,report.business.firebaseChickenSales,report.business.matches)}
      </div>
      <div class="farm2-card"><b>Sync engine</b><div class="farm2-subtle">Firebase v${esc(report.firebaseSyncVersion)} • ${report.firebaseReady?"Ready":"Not ready"} • Pending datasets: ${report.safety.dirtyKeys.length?esc(report.safety.dirtyKeys.join(", ")):"none"}</div></div>
      <div class="farm2-subtle" style="margin-top:10px">Generated ${esc(report.localTime)}</div>`;
  }

  function css(){
    if(document.getElementById("farmDiagnosticsCss"))return;
    const s=document.createElement("style");s.id="farmDiagnosticsCss";s.textContent=`
      #farmDiagnostics .diag-note{padding:12px 14px;border-radius:16px;background:rgba(31,122,58,.08);font-weight:750;line-height:1.4;margin-bottom:12px}
      #farmDiagnostics .diag-actions{display:flex;gap:9px;flex-wrap:wrap;margin:10px 0 15px}
      #farmDiagnostics .diag-actions button{width:auto;margin:0}
      .diag-result{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px;border-radius:18px;margin:10px 0}.diag-result.ok,.diag-warnings.ok{background:rgba(31,122,58,.09)}.diag-result.warn,.diag-warnings:not(.ok){background:rgba(217,59,59,.09)}
      .diag-result span{font-size:12px;font-weight:800;color:var(--muted)}.diag-warnings{padding:12px 14px;border-radius:16px;line-height:1.5;margin-bottom:16px}
      .diag-days{display:grid;gap:8px;margin-bottom:18px}.diag-day{display:grid;grid-template-columns:minmax(110px,1.4fr) 1fr 1fr;gap:8px;align-items:center;padding:11px 12px;border-radius:15px;background:rgba(127,127,127,.06);border:1px solid rgba(127,127,127,.12)}.diag-day.warn{border-color:rgba(217,59,59,.35);background:rgba(217,59,59,.06)}.diag-day small{grid-column:1/-1;color:#b33131;font-weight:800}
      .diag-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:14px}.diag-stat{padding:12px;border-radius:16px;border:1px solid rgba(127,127,127,.15);display:grid;grid-template-columns:1fr auto;gap:3px 10px}.diag-stat>span{grid-column:1/-1;font-size:12px;font-weight:900;color:var(--muted)}.diag-stat b{font-size:20px}.diag-stat small{text-align:right;color:var(--muted);font-weight:800}.diag-stat.warn{border-color:rgba(217,59,59,.32);background:rgba(217,59,59,.05)}.diag-stat.ok{background:rgba(31,122,58,.04)}
      #farmDiagnosticsRaw{width:100%;min-height:180px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;display:none}
      @media(max-width:520px){.diag-day{grid-template-columns:1fr 1fr}.diag-day>b{grid-column:1/-1}.diag-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function ensureUi(){
    css();
    const root=document.querySelector(".app"),nav=document.querySelector(".bottomNav");
    if(root&&nav&&!document.getElementById("farmDiagnostics")){
      const w=document.createElement("div");
      w.innerHTML=`<section id="farmDiagnostics" class="screen"><div class="screenTitle"><button class="backMini" onclick="showScreen('farm2Hub')">←</button><h2>Farm Diagnostics</h2></div><div class="diag-note">Read-only check. This screen compares this phone with live Firebase and does not change farm data.</div><div class="diag-actions"><button type="button" onclick="farmDiagnosticsRun()">🩺 Run Diagnostics</button><button type="button" class="secondary" onclick="farmDiagnosticsCopy()">📋 Copy Report</button><button type="button" class="secondary" onclick="farmDiagnosticsShare()">⬆️ Share Report</button></div><div id="farmDiagnosticsOutput"><div class="farm2-empty">Tap Run Diagnostics.</div></div><textarea id="farmDiagnosticsRaw" readonly></textarea></section>`;
      root.insertBefore(w.firstElementChild,nav);
    }
    const grid=document.querySelector("#farm2Hub .farm2-hubGrid");
    if(grid&&!document.getElementById("farmDiagnosticsHubBtn")){
      const b=document.createElement("button");b.id="farmDiagnosticsHubBtn";b.className="farm2-hubButton green";b.onclick=()=>window.farmDiagnosticsOpen();b.innerHTML='<span class="farm2-bigEmoji">🩺</span>Farm Diagnostics<small>Compare this phone with Firebase</small>';grid.appendChild(b);
    }
  }

  async function run(){
    if(running)return lastReport;
    ensureUi();running=true;
    const out=document.getElementById("farmDiagnosticsOutput");
    if(out)out.innerHTML='<div class="farm2-card"><b>Checking Firebase…</b><div class="farm2-subtle">Reading only. Nothing is being changed.</div></div>';
    try{
      const local=localRead();
      const cloud=await cloudRead();
      lastReport=makeReport(local,cloud);
      renderReport(lastReport);
      const raw=document.getElementById("farmDiagnosticsRaw");if(raw)raw.value=JSON.stringify(lastReport,null,2);
      return lastReport;
    }catch(error){
      console.error("Farm diagnostics failed:",error);
      lastReport={diagnosticVersion:"1.0",generatedAt:new Date().toISOString(),result:"ERROR",error:String(error?.message||error),syncStatus:document.getElementById("syncStatus")?.textContent||""};
      if(out)out.innerHTML=`<div class="diag-result warn"><b>⚠️ Diagnostic could not finish</b><span>${esc(lastReport.error)}</span></div>`;
      const raw=document.getElementById("farmDiagnosticsRaw");if(raw)raw.value=JSON.stringify(lastReport,null,2);
      return lastReport;
    }finally{running=false;}
  }

  async function copy(){
    if(!lastReport)await run();
    const text=JSON.stringify(lastReport,null,2);
    try{await navigator.clipboard.writeText(text);alert("Diagnostic report copied. Paste it into our ChatGPT conversation.");}
    catch{const raw=document.getElementById("farmDiagnosticsRaw");if(raw){raw.style.display="block";raw.value=text;raw.focus();raw.select();}alert("Clipboard was blocked. The report is selected below—copy it and paste it into ChatGPT.");}
  }

  async function share(){
    if(!lastReport)await run();
    const text=JSON.stringify(lastReport,null,2);
    if(navigator.share){try{await navigator.share({title:"Chicken Eggs Farm Diagnostic",text});return;}catch(e){if(e?.name==="AbortError")return;}}
    await copy();
  }

  window.farmDiagnosticsRun=run;
  window.farmDiagnosticsCopy=copy;
  window.farmDiagnosticsShare=share;
  window.farmDiagnosticsOpen=()=>{ensureUi();if(typeof window.showScreen==="function")window.showScreen("farmDiagnostics");void run();};
  window.FarmDiagnostics={run,getLastReport:()=>clone(lastReport)};

  function init(){ensureUi();window.addEventListener("farm-sync-ready",ensureUi);window.addEventListener("farm-data-synced",ensureUi);console.log("✅ Read-only Farm Diagnostics v1 active");}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,500));else setTimeout(init,500);
})();
