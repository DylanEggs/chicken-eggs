(() => {
  "use strict";
  if (window.CompleteSafetyBackupV3) return;

  const FORMAT = "chicken-eggs-complete-safety-backup-v3";
  const PREFIX = "chickenEgg";
  const IMPORTANT = [
    "chickenEggEntriesV102",
    "chickenEggSettingsV102",
    "chickenEggApp2V1",
    "chickenEggInventoryV2",
    "chickenEggBusinessV1",
    "chickenEggWeatherIntelligenceV2",
    "chickenEggDeluxeV1",
    "chickenEggLocalBirdPhotosV1",
    "chickenEggBirdPhotoMetaV4",
    "chickenEggApp2SnapshotsV1",
    "chickenEggFunV1"
  ];

  function localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function safeParse(raw) {
    if (typeof raw !== "string") return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }
  function farmKeys() {
    const out=[];
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if (key && key.startsWith(PREFIX)) out.push(key);
    }
    return out.sort();
  }
  function rawDatasets() {
    const out={};
    for (const key of farmKeys()) out[key]=localStorage.getItem(key);
    return out;
  }
  function photoSummary(datasets) {
    const raw=datasets.chickenEggLocalBirdPhotosV1;
    const map=safeParse(raw);
    if (!map || typeof map !== "object" || Array.isArray(map)) return {count:0,bytes:0};
    let count=0,bytes=0;
    for (const value of Object.values(map)) {
      if (typeof value !== "string" || !value) continue;
      count++;
      bytes+=value.length;
    }
    return {count,bytes};
  }
  function build(reason="manual") {
    const datasets=rawDatasets();
    const photos=photoSummary(datasets);
    const presentImportant=IMPORTANT.filter(k=>Object.prototype.hasOwnProperty.call(datasets,k));
    const missingImportant=IMPORTANT.filter(k=>!Object.prototype.hasOwnProperty.call(datasets,k));
    return {
      format:FORMAT,
      version:3,
      reason:String(reason||"manual"),
      backupDate:new Date().toISOString(),
      appBuild:String(window.__ChickenEggsBuild||""),
      origin:location.origin,
      datasetPrefix:PREFIX,
      datasetCount:Object.keys(datasets).length,
      important:{present:presentImportant,missing:missingImportant},
      photos,
      datasets
    };
  }
  function validate(backup) {
    const errors=[];
    if (!backup || typeof backup !== "object") errors.push("Backup file is not a valid object");
    if (backup?.format !== FORMAT) errors.push("This is not a Complete Safety Backup v3 file");
    if (!backup?.datasets || typeof backup.datasets !== "object" || Array.isArray(backup.datasets)) errors.push("Backup datasets are missing");
    if (!errors.length) {
      for (const [key,value] of Object.entries(backup.datasets)) {
        if (!key.startsWith(PREFIX)) errors.push(`Unsafe dataset key: ${key}`);
        if (value !== null && typeof value !== "string") errors.push(`Dataset ${key} is not stored as raw text`);
      }
    }
    return {ok:errors.length===0,errors};
  }
  function blobFor(backup) {
    return new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  }
  function downloadBackup(reason="manual", filename="") {
    const backup=build(reason);
    const blob=blobFor(backup);
    const link=document.createElement("a");
    const url=URL.createObjectURL(blob);
    link.href=url;
    link.download=filename || `chicken-eggs-COMPLETE-safety-backup-${localDate()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    return backup;
  }
  async function readFile(file) {
    const text=await file.text();
    return JSON.parse(text);
  }
  function applyBackup(backup) {
    const check=validate(backup);
    if (!check.ok) throw new Error(check.errors.join("\n"));
    const oldComplete=window.__completeSafetyRestoreV3;
    const oldInventory=window.__inventoryRestoreV6;
    window.__completeSafetyRestoreV3=true;
    window.__inventoryRestoreV6=true;
    try {
      for (const [key,value] of Object.entries(backup.datasets)) {
        if (!key.startsWith(PREFIX)) continue;
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key,value);
      }
    } finally {
      window.__completeSafetyRestoreV3=oldComplete;
      window.__inventoryRestoreV6=oldInventory;
    }
    return true;
  }
  async function restoreFromFile(file) {
    if (!file) return false;
    let backup;
    try { backup=await readFile(file); }
    catch { alert("That backup file could not be read."); return false; }
    const check=validate(backup);
    if (!check.ok) { alert("Restore blocked:\n\n"+check.errors.join("\n")); return false; }

    const photos=Number(backup.photos?.count)||0;
    const when=String(backup.backupDate||"unknown date");
    if (!confirm(`Restore COMPLETE farm backup from ${when}?\n\nIt contains ${backup.datasetCount||Object.keys(backup.datasets).length} farm datasets and ${photos} saved flock photos.\n\nAn emergency backup of the current farm will download first.`)) return false;

    downloadBackup("automatic-pre-restore",`chicken-eggs-PRE-RESTORE-${localDate()}.json`);
    if (!confirm("Emergency pre-restore backup downloaded. Continue restoring the farm now?")) return false;

    try {
      applyBackup(backup);
      alert("Complete farm backup restored. The app will reload now.");
      location.reload();
      return true;
    } catch (error) {
      console.error("Complete safety restore failed:",error);
      alert("Restore stopped before reload: "+String(error?.message||error));
      return false;
    }
  }

  function insertUi() {
    if (document.getElementById("completeSafetyBackupV3")) return true;
    const settings=document.getElementById("farm2Settings") || document.getElementById("farm");
    if (!settings) return false;
    const card=document.createElement("div");
    card.id="completeSafetyBackupV3";
    card.className="farm2-card";
    card.innerHTML=`<h3>🛡️ Complete Safety Backup</h3><p class="farm2-subtle">Includes egg/sale history, exact inventory, customers/orders/flock, expenses, weather history, business data, settings, milestones, and saved chicken photos.</p><button type="button" id="completeSafetyDownloadV3">💾 Download Complete Safety Backup</button><input type="file" id="completeSafetyRestoreFileV3" accept=".json,application/json" style="display:none"><button type="button" class="secondary" id="completeSafetyRestoreV3">📂 Restore Complete Safety Backup</button><div id="completeSafetyStatusV3" class="farm2-subtle" style="margin-top:9px"></div>`;
    settings.appendChild(card);
    const dl=card.querySelector("#completeSafetyDownloadV3");
    const restore=card.querySelector("#completeSafetyRestoreV3");
    const input=card.querySelector("#completeSafetyRestoreFileV3");
    const status=card.querySelector("#completeSafetyStatusV3");
    dl?.addEventListener("click",()=>{
      const backup=downloadBackup("manual-complete-safety-backup");
      if (status) status.textContent=`Backup downloaded • ${backup.datasetCount} farm datasets • ${backup.photos.count} flock photos`;
    });
    restore?.addEventListener("click",()=>input?.click());
    input?.addEventListener("change",async()=>{
      const file=input.files?.[0];
      input.value="";
      await restoreFromFile(file);
    });
    return true;
  }
  function installUi() {
    if (insertUi()) return;
    const obs=new MutationObserver(()=>{ if (insertUi()) obs.disconnect(); });
    obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>obs.disconnect(),15000);
  }

  window.CompleteSafetyBackupV3={format:FORMAT,build,validate,applyBackup,downloadBackup,restoreFromFile,farmKeys,importantKeys:()=>IMPORTANT.slice()};
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(installUi,300),{once:true});
  else setTimeout(installUi,300);
})();
