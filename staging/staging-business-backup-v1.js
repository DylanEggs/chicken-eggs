(() => {
  "use strict";
  if (window.__StagingBusinessBackupV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingBusinessBackupV1 = true;

  const BRAND = "Rose Family Poultry";
  const VERSION = 1;
  const STORES = [
    ["rfpBusinessSuiteV1","Expenses, mileage, receipts and business totals"],
    ["rfpFarmManagerV1","Hatches, grow-out batches, supplies, waitlist, breeding, health and calendar"],
    ["rfpRecurringChoresV1","Recurring farm chores"],
    ["rfpBusinessIdentityV2","Business settings and receipt identity"],
    ["rfpFeedRunwayV1","Feed runway settings"]
  ];
  const readRaw = key => localStorage.getItem(key);
  const safeParse = (raw, fallback=null) => { try { return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; } };
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const stamp = () => new Date().toISOString().replace(/[:.]/g,"-");

  function buildPayload() {
    const data = {};
    let present = 0;
    for (const [key] of STORES) {
      const raw = readRaw(key);
      if (raw == null) continue;
      const parsed = safeParse(raw, undefined);
      if (parsed === undefined) continue;
      data[key] = parsed;
      present++;
    }
    return {
      schema:"rose-family-poultry-staging-business-backup-v1",
      version:VERSION,
      environment:"staging",
      brand:BRAND,
      exportedAt:new Date().toISOString(),
      storeCount:present,
      data
    };
  }

  function validatePayload(value) {
    if (!value || typeof value !== "object") return {ok:false,error:"Backup file is not valid JSON data."};
    if (value.schema !== "rose-family-poultry-staging-business-backup-v1") return {ok:false,error:"This is not a Rose Family Poultry STAGING business backup."};
    if (Number(value.version) !== VERSION) return {ok:false,error:"This backup version is not supported yet."};
    if (!value.data || typeof value.data !== "object" || Array.isArray(value.data)) return {ok:false,error:"Backup does not contain a valid data section."};
    const allowed = new Set(STORES.map(([key])=>key));
    const keys = Object.keys(value.data).filter(key=>allowed.has(key));
    if (!keys.length) return {ok:false,error:"Backup contains no recognized business/farm-management data."};
    return {ok:true,keys};
  }

  function payloadBytes(payload=buildPayload()) {
    try { return new Blob([JSON.stringify(payload)],{type:"application/json"}).size; }
    catch { return JSON.stringify(payload).length; }
  }

  function download() {
    const payload = buildPayload();
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rose-Family-Poultry-STAGING-Business-Backup-${stamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    window.dispatchEvent(new CustomEvent("rfp-staging-business-backup-downloaded",{detail:{stores:payload.storeCount,bytes:blob.size}}));
    render();
    return payload;
  }

  function restorePayload(payload, mode="replace") {
    const check = validatePayload(payload);
    if (!check.ok) return check;
    const allowed = new Set(check.keys);
    let restored = 0;
    for (const [key] of STORES) {
      if (!allowed.has(key)) continue;
      const incoming = payload.data[key];
      if (mode === "merge") {
        const existing = safeParse(readRaw(key), null);
        let next = incoming;
        if (existing && incoming && typeof existing === "object" && typeof incoming === "object" && !Array.isArray(existing) && !Array.isArray(incoming)) next = {...existing,...incoming};
        localStorage.setItem(key,JSON.stringify(next));
      } else {
        localStorage.setItem(key,JSON.stringify(incoming));
      }
      restored++;
    }
    window.dispatchEvent(new CustomEvent("rfp-staging-business-changed",{detail:{source:"backup-restore"}}));
    window.dispatchEvent(new CustomEvent("rfp-staging-farm-manager-changed",{detail:{source:"backup-restore"}}));
    window.dispatchEvent(new CustomEvent("rfp-staging-chores-changed",{detail:{source:"backup-restore"}}));
    window.dispatchEvent(new CustomEvent("rfp-staging-feed-runway-changed",{detail:{source:"backup-restore"}}));
    return {ok:true,restored,mode};
  }

  async function importFile(file) {
    if (!file) return {ok:false,error:"No file selected."};
    let payload;
    try { payload = JSON.parse(await file.text()); }
    catch { return {ok:false,error:"Could not read that JSON backup file."}; }
    const check = validatePayload(payload);
    if (!check.ok) return check;
    const confirmText = `Restore ${check.keys.length} Rose Family Poultry STAGING business data section${check.keys.length===1?"":"s"}?\n\nThis replaces only the matching STAGING business/farm-management data. LIVE and Firebase are not touched.`;
    if (!window.confirm(confirmText)) return {ok:false,cancelled:true};
    return restorePayload(payload,"replace");
  }

  function humanBytes(bytes) {
    bytes = Number(bytes)||0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024/1024).toFixed(2)} MB`;
  }

  function render() {
    const body = document.getElementById("rfpBizBody");
    if (!body) return;
    const payload = buildPayload();
    const present = new Set(Object.keys(payload.data));
    body.innerHTML = `<section class="rfp-biz-panel active"><h3>💾 Business Data Backup</h3><div class="rfp-biz-card"><strong>${BRAND}</strong><p class="rfp-muted">Backs up the new STAGING-only business and farm-management tools. No Firebase connection is used and LIVE is never changed.</p><div class="rfp-cat"><span>Data sections included</span><strong>${payload.storeCount}</strong><span>Estimated backup size</span><strong>${humanBytes(payloadBytes(payload))}</strong></div></div><h4>Included sections</h4><div class="rfp-biz-list">${STORES.map(([key,label])=>`<div class="rfp-biz-item"><div><strong>${present.has(key)?"✅":"○"} ${esc(label)}</strong><small>${present.has(key)?"Included in backup":"No data saved in this section yet"}</small></div></div>`).join("")}</div><div class="rfp-biz-actions" style="margin-top:12px"><button type="button" id="rfpDownloadBusinessBackup">⬇️ Download Backup</button><button type="button" id="rfpImportBusinessBackup">⬆️ Restore Backup</button></div><input id="rfpBusinessBackupFile" type="file" accept="application/json,.json" hidden><p class="rfp-muted">Tip: keep a copy somewhere off the phone/computer. Receipt images saved in the Expense Vault are included inside this JSON backup when present.</p><div id="rfpBusinessBackupStatus" class="rfp-muted"></div></section>`;
    document.getElementById("rfpDownloadBusinessBackup")?.addEventListener("click",download);
    const input = document.getElementById("rfpBusinessBackupFile");
    document.getElementById("rfpImportBusinessBackup")?.addEventListener("click",()=>input?.click());
    input?.addEventListener("change",async()=>{
      const status=document.getElementById("rfpBusinessBackupStatus");
      const result=await importFile(input.files?.[0]);
      if(status) status.textContent=result.ok?`✅ Restored ${result.restored} STAGING data sections.`:result.cancelled?"Restore cancelled.":`⚠️ ${result.error||"Restore did not complete."}`;
      input.value="";
    });
  }

  function installTab() {
    const modal=document.getElementById("rfpBusinessModal");
    const tabs=modal?.querySelector(".rfp-biz-tabs");
    if(!tabs || tabs.querySelector('[data-business-backup="1"]')) return false;
    const button=document.createElement("button");
    button.type="button";
    button.dataset.businessBackup="1";
    button.textContent="💾 Backup";
    button.addEventListener("click",()=>{
      tabs.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===button));
      render();
    });
    tabs.appendChild(button);
    return true;
  }

  document.addEventListener("click",e=>{
    if(e.target?.closest?.("#rfpBusinessLauncher")) setTimeout(installTab,0);
  },true);
  window.addEventListener("rfp-staging-business-changed",()=>{ if(document.querySelector('[data-business-backup="1"].active')) render(); });
  if(document.getElementById("rfpBusinessModal")) installTab();

  window.StagingBusinessBackupV1={
    version:VERSION,
    environment:"staging-local-only",
    firebaseReads:0,
    firebaseWrites:0,
    brand:BRAND,
    stores:()=>STORES.map(([key,label])=>({key,label})),
    buildPayload,
    validatePayload,
    restorePayload,
    payloadBytes,
    installTab,
    render
  };
  console.log("🧪 STAGING Business Backup v1 active — local-only export/restore, zero Firebase calls");
})();
