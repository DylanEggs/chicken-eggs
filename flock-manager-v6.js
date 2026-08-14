(() => {
  "use strict";
  if (window.__flockManagerV6) return;
  window.__flockManagerV6 = true;

  const APP = "chickenEggApp2V1";
  let pendingFile = null;
  let pendingPreviewUrl = "";
  let addHooked = false;
  let photoUnsub = null;
  let renderQueued = false;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const service = () => window.FarmBirdPhotosV2;

  function app() {
    const a = read(APP, {});
    a.flock = Array.isArray(a.flock) ? a.flock : [];
    return a;
  }
  function saveApp(a) {
    a.updatedAt = Date.now();
    localStorage.setItem(APP, JSON.stringify(a));
    if (typeof window.syncFarmNow === "function") window.syncFarmNow();
    scheduleRender();
  }
  function birds() {
    return [...app().flock].sort((a,b) => String(a.name || "").localeCompare(String(b.name || "")));
  }
  function ageText(date) {
    if (!date) return "Age unknown";
    const born = new Date(String(date) + "T12:00:00");
    if (Number.isNaN(born.getTime())) return "Age unknown";
    const days = Math.max(0, Math.floor((Date.now() - born.getTime()) / 86400000));
    if (days < 14) return `${days} days`;
    if (days < 112) return `${Math.floor(days / 7)} weeks`;
    const months = Math.floor(days / 30.44);
    return months < 24 ? `${months} months` : `${Math.floor(months / 12)}y ${months % 12}m`;
  }

  function installStyle() {
    if (document.getElementById("flockManagerV6Style")) return;
    const s = document.createElement("style");
    s.id = "flockManagerV6Style";
    s.textContent = `
      #farm2FlockManagerV5,#farm2BirdPhotoPicker,#farm2BirdPhotoPickerV2,#farm2BirdPhotoPickerV3,#farm2BirdPhotoPickerV4,#farm2BirdPhotoPickerV5{display:none!important}
      #farm2FlockLegacyListV5,#farm2FlockLegacyListV6{display:none!important}
      #farm2FlockManagerV6{display:grid;gap:11px;margin-top:12px}
      #farm2FlockManagerV6 .farm2-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      #farm2FlockManagerV6 .farm2-actions button{width:auto;margin:0}
      .farm-flock-photo-v6{width:96px;height:96px;object-fit:cover;border-radius:18px;float:right;margin:0 0 10px 14px;background:rgba(31,122,58,.08)}
      .farm-photo-file-label-v6{position:relative;display:inline-flex;align-items:center;justify-content:center;width:auto;padding:9px 12px;border-radius:13px;font-size:13px;font-weight:800;line-height:1.2;color:#fff;background:linear-gradient(135deg,#4fcb75,#1f7a3a);cursor:pointer;box-shadow:none;overflow:hidden}
      .farm-photo-file-label-v6.secondary{background:linear-gradient(135deg,#94a3b8,#64748b)}
      .farm-photo-file-label-v6 input{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;left:-9999px!important;pointer-events:none!important}
      #farm2BirdPhotoPickerV6{margin:12px 0 14px}
      #farm2BirdPhotoPickerV6 .farm-photo-add-row-v6{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:7px}
      #farm2BirdPhotoPreviewV6{width:76px;height:76px;border-radius:16px;background:rgba(31,122,58,.08);display:grid;place-items:center;font-size:34px;overflow:hidden;flex:0 0 auto}
      #farm2BirdPhotoPreviewV6 img{width:100%;height:100%;object-fit:cover}
      #farmPhotoStatusV6{font-size:12px;font-weight:750;margin-top:7px;color:var(--farm2-muted)}
      #farmFlockEditOverlayV6{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:18px}
      #farmFlockEditCardV6{width:min(620px,100%);max-height:88vh;overflow:auto;background:var(--card,#fff);color:inherit;border-radius:24px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}
      #farmFlockEditCardV6 label{display:block;margin-top:12px;font-weight:700}
      #farmFlockEditCardV6 input,#farmFlockEditCardV6 select,#farmFlockEditCardV6 textarea{width:100%;margin-top:6px}
      #farmFlockEditCardV6 textarea{min-height:90px;resize:vertical}
      #farmFlockEditCardV6 .farm-edit-actions-v6{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
      #farmFlockEditCardV6 .farm-edit-actions-v6 button{width:auto;margin:0}
      .farm-photo-sync-note-v6{clear:both;margin-top:8px}
    `;
    document.head.appendChild(s);
  }

  function photo(id) {
    return service()?.get?.(String(id || "")) || "";
  }

  function ensureManager() {
    let legacy = document.getElementById("farm2FlockList") || document.getElementById("farm2FlockLegacyListV5") || document.getElementById("farm2FlockLegacyListV6");
    if (!legacy) return null;
    if (legacy.id === "farm2FlockList") legacy.id = "farm2FlockLegacyListV6";
    legacy.style.display = "none";

    let manager = document.getElementById("farm2FlockManagerV6");
    if (!manager) {
      manager = document.createElement("div");
      manager.id = "farm2FlockManagerV6";
      legacy.insertAdjacentElement("afterend", manager);
    }
    return manager;
  }

  function renderSummary() {
    const el = document.getElementById("farm2FlockSummary");
    if (!el) return;
    const all = app().flock;
    const hens = all.filter(b => ["Hen","Pullet"].includes(b.sex)).length;
    const roos = all.filter(b => ["Rooster","Cockerel"].includes(b.sex)).length;
    const html = `<div class="farm2-grid3"><div class="farm2-card"><div class="farm2-kicker">Profiles</div><div class="farm2-moneyBig">${all.length}</div></div><div class="farm2-card"><div class="farm2-kicker">Hens/Pullets</div><div class="farm2-moneyBig">${hens}</div></div><div class="farm2-card"><div class="farm2-kicker">Roosters</div><div class="farm2-moneyBig">${roos}</div></div></div>`;
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  function photoInputHtml(id, hasPhoto) {
    return `<label class="farm-photo-file-label-v6">📷 ${hasPhoto ? "Change Photo" : "Set Photo"}<input type="file" accept="image/*" onchange="farmFlockPhotoPickedV6('${esc(id)}',this)"></label>`;
  }

  function renderManager() {
    const manager = ensureManager();
    if (!manager) return;
    const all = birds();
    const html = all.length ? all.map(b => {
      const id = String(b.id || "");
      const src = photo(id);
      const rooster = ["Rooster","Cockerel"].includes(b.sex);
      return `<div class="farm2-listItem" data-flock-v6-id="${esc(id)}">${src ? `<img class="farm-flock-photo-v6" src="${esc(src)}" alt="${esc(b.name || "Chicken")}">` : ""}<div class="farm2-listTop"><div><h4>${rooster ? "🐓" : "🐔"} ${esc(b.name)}</h4><div class="farm2-subtle">${esc(b.breed || "Breed not set")} • ${esc(b.sex || "Unknown")} • ${esc(ageText(b.hatchDate))}</div></div><span class="farm2-badge purple">${esc(b.status || "Active")}</span></div>${b.hatchDate ? `<div class="farm2-subtle" style="margin-top:7px">Hatched ${esc(b.hatchDate)}</div>` : ""}${b.notes ? `<div class="farm2-subtle">📝 ${esc(b.notes)}</div>` : ""}<div class="farm2-actions"><button type="button" onclick="farmFlockEditBirdV6('${esc(id)}')">✏️ Edit Profile</button>${photoInputHtml(id, !!src)}${src ? `<button type="button" class="secondary" onclick="farmFlockRemovePhotoV6('${esc(id)}')">Remove Photo</button>` : ""}<button type="button" class="farm2-delete" onclick="farmFlockDeleteBirdV6('${esc(id)}')">Delete</button></div><div class="farm2-subtle farm-photo-sync-note-v6">Photo is shared through Firebase.</div></div>`;
    }).join("") : `<div class="farm2-empty">No profiles yet.</div>`;
    if (manager.innerHTML !== html) manager.innerHTML = html;
  }

  function clearPending() {
    pendingFile = null;
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    pendingPreviewUrl = "";
    const input = document.getElementById("farm2BirdPhotoInputV6");
    const preview = document.getElementById("farm2BirdPhotoPreviewV6");
    const clear = document.getElementById("farm2BirdPhotoClearV6");
    if (input) input.value = "";
    if (preview) preview.innerHTML = "🐔";
    if (clear) clear.style.display = "none";
  }

  window.farmFlockPendingPhotoV6 = input => {
    const file = input?.files?.[0] || null;
    pendingFile = file;
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    pendingPreviewUrl = file ? URL.createObjectURL(file) : "";
    const preview = document.getElementById("farm2BirdPhotoPreviewV6");
    const clear = document.getElementById("farm2BirdPhotoClearV6");
    if (preview) preview.innerHTML = pendingPreviewUrl ? `<img src="${pendingPreviewUrl}">` : "🐔";
    if (clear) clear.style.display = file ? "inline-flex" : "none";
  };
  window.farmFlockClearPendingPhotoV6 = clearPending;

  function ensureAddPicker() {
    const screen = document.getElementById("farm2Flock");
    const addButton = screen?.querySelector('button[onclick="farm2AddBird()"]');
    if (!screen || !addButton) return;
    if (!document.getElementById("farm2BirdPhotoPickerV6")) {
      const wrap = document.createElement("div");
      wrap.id = "farm2BirdPhotoPickerV6";
      wrap.innerHTML = `<label>Photo <span class="farm2-subtle">(optional)</span></label><div class="farm-photo-add-row-v6"><div id="farm2BirdPhotoPreviewV6">🐔</div><div style="flex:1;min-width:180px"><label class="farm-photo-file-label-v6 secondary">📷 Choose Photo<input id="farm2BirdPhotoInputV6" type="file" accept="image/*" onchange="farmFlockPendingPhotoV6(this)"></label><button id="farm2BirdPhotoClearV6" type="button" class="secondary" style="width:auto;margin:7px 0 0;display:none" onclick="farmFlockClearPendingPhotoV6()">Remove Selected Photo</button><div id="farmPhotoStatusV6">Photos are compressed and synced separately so they work on every device.</div></div></div>`;
      addButton.parentNode.insertBefore(wrap, addButton);
    }
    if (!addHooked) {
      addHooked = true;
      addButton.addEventListener("click", () => {
        const before = new Set(app().flock.map(b => String(b.id)));
        const selected = pendingFile;
        setTimeout(async () => {
          const added = app().flock.find(b => !before.has(String(b.id)));
          if (!added) return;
          if (selected && service()?.saveFile) await service().saveFile(String(added.id), selected);
          clearPending();
          scheduleRender();
        }, 100);
      }, true);
    }
  }

  window.farmFlockPhotoPickedV6 = async (id, input) => {
    const file = input?.files?.[0];
    if (!file) return;
    input.disabled = true;
    try {
      await service()?.saveFile?.(String(id || ""), file);
    } finally {
      input.value = "";
      input.disabled = false;
      scheduleRender();
    }
  };

  window.farmFlockRemovePhotoV6 = async id => {
    if (!confirm("Remove this chicken's photo?")) return;
    await service()?.remove?.(String(id || ""));
    scheduleRender();
  };

  window.farmFlockDeleteBirdV6 = async id => {
    id = String(id || "");
    if (!id || !confirm("Delete this flock profile?")) return;
    const a = app();
    a.flock = a.flock.filter(b => String(b.id) !== id);
    saveApp(a);
    await service()?.remove?.(id);
    scheduleRender();
  };

  window.farmFlockEditBirdV6 = id => {
    const b = app().flock.find(x => String(x.id) === String(id));
    if (!b) return;
    document.getElementById("farmFlockEditOverlayV6")?.remove();
    const o = document.createElement("div");
    o.id = "farmFlockEditOverlayV6";
    o.innerHTML = `<div id="farmFlockEditCardV6"><h3 style="margin:0 0 4px">✏️ Edit ${esc(b.name || "Chicken")}</h3><div class="farm2-subtle">Update this flock profile and save.</div><label>Name<input id="farmFlockEditNameV6"></label><label>Breed<input id="farmFlockEditBreedV6"></label><label>Hatch / Birth Date<input id="farmFlockEditDateV6" type="date"></label><label>Sex<select id="farmFlockEditSexV6"><option>Hen</option><option>Rooster</option><option>Pullet</option><option>Cockerel</option><option>Unknown</option></select></label><label>Notes<textarea id="farmFlockEditNotesV6"></textarea></label><div class="farm-edit-actions-v6"><button type="button" onclick="farmFlockSaveEditV6('${esc(b.id)}')">Save Changes</button><button type="button" class="secondary" onclick="farmFlockCloseEditV6()">Cancel</button></div></div>`;
    document.body.appendChild(o);
    document.getElementById("farmFlockEditNameV6").value = b.name || "";
    document.getElementById("farmFlockEditBreedV6").value = b.breed || "";
    document.getElementById("farmFlockEditDateV6").value = b.hatchDate || "";
    document.getElementById("farmFlockEditSexV6").value = b.sex || "Unknown";
    document.getElementById("farmFlockEditNotesV6").value = b.notes || "";
    o.onclick = e => { if (e.target === o) o.remove(); };
  };
  window.farmFlockCloseEditV6 = () => document.getElementById("farmFlockEditOverlayV6")?.remove();
  window.farmFlockSaveEditV6 = id => {
    const a = app();
    const b = a.flock.find(x => String(x.id) === String(id));
    if (!b) return;
    const name = document.getElementById("farmFlockEditNameV6")?.value.trim();
    if (!name) { alert("Enter the chicken's name."); return; }
    b.name = name;
    b.breed = document.getElementById("farmFlockEditBreedV6")?.value.trim() || "";
    b.hatchDate = document.getElementById("farmFlockEditDateV6")?.value || "";
    b.sex = document.getElementById("farmFlockEditSexV6")?.value || "Unknown";
    b.notes = document.getElementById("farmFlockEditNotesV6")?.value.trim() || "";
    b.updatedAt = Date.now();
    saveApp(a);
    document.getElementById("farmFlockEditOverlayV6")?.remove();
  };

  function render() {
    renderQueued = false;
    installStyle();
    ensureAddPicker();
    renderSummary();
    renderManager();
  }
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
  }

  function hookStatus() {
    window.addEventListener("bird-photo-status", e => {
      const el = document.getElementById("farmPhotoStatusV6");
      if (el && e.detail?.message) el.textContent = e.detail.message;
    });
  }

  async function init() {
    installStyle();
    hookStatus();
    window.addEventListener("farm-data-synced", e => { if (!e.detail?.key || e.detail.key === APP) scheduleRender(); });
    window.addEventListener("storage", e => { if (e.key === APP) scheduleRender(); });
    render();
    setTimeout(render, 600);
    const photos = service();
    if (photos) {
      photos.ready?.().then(() => scheduleRender()).catch(() => {});
      if (photoUnsub) photoUnsub();
      photoUnsub = photos.subscribe?.(scheduleRender) || null;
    }
    console.log("✅ Flock manager v6 using shared photo service");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 300));
  else setTimeout(init, 300);
})();