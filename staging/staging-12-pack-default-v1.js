(() => {
  "use strict";
  if (window.__StagingTwelvePackDefaultV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingTwelvePackDefaultV1 = true;

  const KEY = "chickenEggInventoryV2";
  const priorSetItem = Storage.prototype.setItem;
  const whole = v => Math.max(0, Math.round(Number(v) || 0));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const total = s => whole(s?.dozens) * 12 + whole(s?.packs18) * 18 + whole(s?.loose);

  function normalized(raw = {}, preferredPacks18 = null) {
    const s = raw && typeof raw === "object" ? { ...raw } : {};
    const eggs = total(s);
    let packs18 = preferredPacks18 == null ? whole(s.packs18) : whole(preferredPacks18);
    packs18 = Math.min(packs18, Math.floor(eggs / 18));
    const after18 = Math.max(0, eggs - packs18 * 18);
    s.dozens = Math.floor(after18 / 12);
    s.packs18 = packs18;
    s.loose = after18 % 12;
    return s;
  }

  function displayState(raw = read()) {
    const s = raw && typeof raw === "object" ? raw : {};
    return {dozens:whole(s.dozens),packs18:whole(s.packs18),remainder:whole(s.loose),total:total(s)};
  }

  function packageText(raw = read(), includeTotal = true) {
    const s = displayState(raw);
    const parts = [
      `${s.dozens} 12-pack${s.dozens === 1 ? "" : "s"}`,
      `${s.packs18} 18-pack${s.packs18 === 1 ? "" : "s"}`,
      `${s.remainder} individual egg${s.remainder === 1 ? "" : "s"}`
    ];
    if (includeTotal) parts.push(`${s.total} eggs total`);
    return parts.join(" • ");
  }

  // Ordinary inventory activity goes back to the 12-pack-first rule. Verified
  // restores and the exact manual-save route bypass this one repack step.
  Storage.prototype.setItem = function(key, value) {
    if (
      this === window.localStorage &&
      String(key) === KEY &&
      !window.__farmApplyingRemote &&
      !window.__inventoryRestoreV6 &&
      !window.__completeSafetyRestoreV3 &&
      !window.__stagingManualInventoryExactWrite
    ) {
      try { value = JSON.stringify(normalized(JSON.parse(String(value)))); } catch {}
    }
    return priorSetItem.call(this, key, value);
  };

  let saving = false;

  function prepareEditor() {
    const overlay = document.getElementById("inv6Overlay");
    if (!overlay) return;
    const s = displayState();
    const d = document.getElementById("inv6Dozens");
    const p = document.getElementById("inv6Packs");
    const l = document.getElementById("inv6Loose");
    const title = overlay.querySelector("h3");
    const save = document.getElementById("inv6Save");
    const dLabel = overlay.querySelector('label[for="inv6Dozens"]');
    const pLabel = overlay.querySelector('label[for="inv6Packs"]');
    const lLabel = overlay.querySelector('label[for="inv6Loose"]');
    if (title) title.textContent = "🥚 Set Exact Egg Inventory";
    if (dLabel) dLabel.textContent = "12-Packs";
    if (pLabel) pLabel.textContent = "18-Packs";
    if (lLabel) lLabel.textContent = "Individual Eggs";
    if (d) { d.value=s.dozens; d.readOnly=false; d.closest("div")?.style?.setProperty("opacity","1"); }
    if (p) { p.value=s.packs18; p.readOnly=false; }
    if (l) { l.value=s.remainder; l.readOnly=false; if(l.closest("div")) l.closest("div").style.display=""; }
    if (save) save.textContent = "Save Exact Inventory";
    updateEditorPreview();
  }

  function updateEditorPreview() {
    const d=whole(document.getElementById("inv6Dozens")?.value);
    const p=whole(document.getElementById("inv6Packs")?.value);
    const l=whole(document.getElementById("inv6Loose")?.value);
    const out=document.getElementById("inv6DraftTotal");
    if(out) out.textContent=`${d} 12-pack${d===1?"":"s"} • ${p} 18-pack${p===1?"":"s"} • ${l} individual egg${l===1?"":"s"} • ${d*12+p*18+l} eggs total`;
  }

  async function saveManualExact(dozens, packs18, loose) {
    dozens=whole(dozens); packs18=whole(packs18); loose=whole(loose);
    const api=window.InventorySystemV6;
    if(!api?.replaceFromRestore) throw new Error("Inventory authority is not ready.");
    const before=api.state?.()||{};
    const beforeTotal=total(before);
    const next={...before,dozens,packs18,loose,updatedAt:Date.now()};
    const afterTotal=total(next);
    const adjustments=Array.isArray(before.adjustments)?before.adjustments.slice():[];
    adjustments.unshift({
      id:`staging-manual-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      date:new Date().toISOString().slice(0,10),at:Date.now(),delta:afterTotal-beforeTotal,
      reason:"Exact inventory count",
      details:`${dozens} 12-packs, ${packs18} 18-packs, ${loose} individual eggs`,
      totalAfter:afterTotal,cartonBreakdown:{dozens,packs18,loose},authority:"staging-manual-inventory-v2"
    });
    next.adjustments=adjustments.slice(0,100);

    const old=!!window.__stagingManualInventoryExactWrite;
    window.__stagingManualInventoryExactWrite=true;
    try { await api.replaceFromRestore(next); }
    finally { window.__stagingManualInventoryExactWrite=old; }

    const rawSaved=api.state?.()||next;
    const saved=displayState(rawSaved);
    if(saved.dozens!==dozens||saved.packs18!==packs18||saved.remainder!==loose) throw new Error("Exact manual inventory verification failed");
    window.dispatchEvent(new CustomEvent("inventory-authority-changed",{detail:{before:beforeTotal,after:saved.total,reason:"Exact inventory count",staging:true,manualExact:true,at:Date.now()}}));
    // Return the real inventory shape (including .loose), not the display-only
    // {remainder} shape. Tests and callers must see the exact stored values.
    return rawSaved;
  }

  async function saveInventory() {
    if(saving)return;
    const d=whole(document.getElementById("inv6Dozens")?.value);
    const p=whole(document.getElementById("inv6Packs")?.value);
    const l=whole(document.getElementById("inv6Loose")?.value);
    const status=document.getElementById("inv6SaveStatus"),button=document.getElementById("inv6Save");
    saving=true;if(button)button.disabled=true;
    try{
      if(status)status.textContent="Saving exact 12-pack, 18-pack and individual egg inventory…";
      const saved=await saveManualExact(d,p,l);
      if(status)status.textContent=`Saved: ${packageText(saved)}. New inventory activity will default back to 12-packs.`;
      patchVisible();setTimeout(()=>document.getElementById("inv6Overlay")?.classList.remove("show"),850);
    }catch(error){if(status)status.textContent=`Could not verify inventory. ${String(error?.message||error)}`;}
    finally{saving=false;if(button)button.disabled=false;}
  }

  function patchVisible() {
    const s=displayState();
    const current=document.getElementById("inv6Current");if(current)current.textContent=packageText(s);
    const screen=document.getElementById("farm2Inventory");
    if(screen){
      const h3=[...screen.querySelectorAll("h3")].find(x=>/Exact Carton Inventory|12-Pack & 18-Pack Inventory|Egg Inventory/i.test(x.textContent||""));
      if(h3)h3.textContent="📦 Egg Inventory";
      const open=document.getElementById("inv6Open");if(open)open.textContent="Edit Inventory";
      const add=document.getElementById("inv6Add");if(add)add.textContent="Add Eggs";
      [...screen.querySelectorAll(".farm2-subtle")].forEach(el=>{if(/Cartons stay exactly|repack|loose|12-packs fill automatically|18-packs appear only|Manually set 12-packs/i.test(el.textContent||""))el.textContent="Manually set 12-packs, 18-packs, and individual eggs. After the next normal inventory change, available eggs default back into 12-packs while your manual 18-packs stay designated.";});
    }
    const dash=document.getElementById("inventoryDashboardCard");if(dash){const x=dash.querySelector(".farm2-subtle");if(x)x.textContent=packageText(s);}
    const hub=document.getElementById("farm2HubSummary");if(hub){const card=[...hub.querySelectorAll(".farm2-card")].find(c=>/sellable inventory/i.test(c.querySelector(".farm2-kicker")?.textContent||c.textContent||""));const x=card?.querySelector(".farm2-subtle");if(x)x.textContent=packageText(s);}
    const today=document.getElementById("farm2TodayCard");if(today)[...today.querySelectorAll(".farm2-subtle")].forEach(el=>{if((el.textContent||"").trim().startsWith("Inventory:"))el.textContent=`Inventory: ${packageText(s)}`;});
  }

  document.addEventListener("click",event=>{
    const btn=event.target.closest?.("button");if(!btn)return;
    if(btn.id==="inv6Open"){setTimeout(prepareEditor,0);return;}
    if(btn.id==="inv6Save"){event.preventDefault();event.stopImmediatePropagation();void saveInventory();}
  },true);
  document.addEventListener("input",event=>{if(["inv6Dozens","inv6Packs","inv6Loose"].includes(event.target?.id))updateEditorPreview();},true);

  function start(){
    setTimeout(patchVisible,140);setTimeout(patchVisible,500);
    window.addEventListener("inventory-authority-changed",()=>setTimeout(patchVisible,0));
    window.addEventListener("farm-integrity-synced",()=>setTimeout(patchVisible,0));
    window.addEventListener("farm-data-synced",e=>{if(!e.detail?.key||e.detail.key===KEY)setTimeout(patchVisible,0);});
    window.addEventListener("core-data-synced",()=>setTimeout(patchVisible,0));
  }

  window.StagingTwelvePackDefaultV1={version:4,normalized,displayState,packageText,total,setManual18(totalEggs,packs18){return normalized({dozens:0,packs18:0,loose:whole(totalEggs)},packs18);},saveManualExact,refresh:patchVisible};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  console.log("📦 STAGING inventory v4 — exact manual 12/18/individual save; normal changes return to 12-pack default");
})();