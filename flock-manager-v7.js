(() => {
  "use strict";
  if (window.__flockManagerV7) return;
  window.__flockManagerV7 = true;

  const APP = "chickenEggApp2V1";
  let pendingFile = null;
  let pendingPreview = "";
  let addHooked = false;
  let photoUnsub = null;
  let renderQueued = false;
  let statusTimer = null;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const photos = () => window.FarmBirdPhotosV3 || window.FarmBirdPhotosV2;

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
  function age(date) {
    if (!date) return "Age unknown";
    const born = new Date(String(date) + "T12:00:00");
    if (Number.isNaN(born.getTime())) return "Age unknown";
    const days = Math.max(0, Math.floor((Date.now() - born.getTime()) / 86400000));
    if (days < 14) return `${days} days`;
    if (days < 112) return `${Math.floor(days / 7)} weeks`;
    const months = Math.floor(days / 30.44);
    return months < 24 ? `${months} months` : `${Math.floor(months / 12)}y ${months % 12}m`;
  }

  function css() {
    if (document.getElementById("flockManagerV7Style")) return;
    const s = document.createElement("style");
    s.id = "flockManagerV7Style";
    s.textContent = `
      #farm2FlockManagerV5,#farm2FlockManagerV6,#farm2BirdPhotoPicker,#farm2BirdPhotoPickerV2,#farm2BirdPhotoPickerV3,#farm2BirdPhotoPickerV4,#farm2BirdPhotoPickerV5,#farm2BirdPhotoPickerV6{display:none!important}
      #farm2FlockLegacyListV5,#farm2FlockLegacyListV6,#farm2FlockLegacyListV7{display:none!important}
      #farm2FlockManagerV7{display:grid;gap:11px;margin-top:12px}
      #farm2FlockManagerV7 .farm2-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      #farm2FlockManagerV7 .farm2-actions button{width:auto;margin:0}
      .farm-flock-photo-v7{width:96px;height:96px;object-fit:cover;border-radius:18px;float:right;margin:0 0 10px 14px;background:rgba(31,122,58,.08)}
      .farm-photo-button-v7{position:relative;display:inline-flex;align-items:center;justify-content:center;padding:9px 12px;border-radius:13px;font-size:13px;font-weight:850;line-height:1.2;color:#fff;background:linear-gradient(135deg,#4fcb75,#1f7a3a);overflow:hidden;min-height:38px}
      .farm-photo-button-v7.secondary{background:linear-gradient(135deg,#94a3b8,#64748b)}
      .farm-photo-button-v7 input[type=file]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;opacity:.001!important;cursor:pointer!important;pointer-events:auto!important;margin:0!important;padding:0!important;border:0!important;font-size:60px!important}
      #farm2BirdPhotoPickerV7{margin:12px 0 14px}
      #farm2BirdPhotoPickerV7 .row-v7{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:7px}
      #farm2BirdPhotoPreviewV7{width:76px;height:76px;border-radius:16px;background:rgba(31,122,58,.08);display:grid;place-items:center;font-size:34px;overflow:hidden;flex:0 0 auto}
      #farm2BirdPhotoPreviewV7 img{width:100%;height:100%;object-fit:cover}
      #farmPhotoStatusV7{font-size:12px;font-weight:800;margin-top:7px;color:var(--farm2-muted)}
      #farmPhotoToastV7{position:fixed;left:50%;bottom:105px;transform:translateX(-50%);z-index:100000;max-width:min(90vw,460px);padding:11px 15px;border-radius:14px;background:#17351f;color:white;font-weight:850;box-shadow:0 12px 35px rgba(0,0,0,.3);display:none;text-align:center}
      #farmPhotoToastV7.show{display:block}
      #farmFlockEditOverlayV7{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:18px}
      #farmFlockEditCardV7{width:min(620px,100%);max-height:88vh;overflow:auto;background:var(--card,#fff);color:inherit;border-radius:24px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}
      #farmFlockEditCardV7 label{display:block;margin-top:12px;font-weight:700}
      #farmFlockEditCardV7 input,#farmFlockEditCardV7 select,#farmFlockEditCardV7 textarea{width:100%;margin-top:6px}
      #farmFlockEditCardV7 textarea{min-height:90px;resize:vertical}
      #farmFlockEditCardV7 .actions-v7{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
      #farmFlockEditCardV7 .actions-v7 button{width:auto;margin:0}
      .farm-photo-note-v7{clear:both;margin-top:8px}
    `;
    document.head.appendChild(s);
  }

  function photo(id) { return photos()?.get?.(String(id || "")) || ""; }

  function ensureManager() {
    let legacy = document.getElementById("farm2FlockList") || document.getElementById("farm2FlockLegacyListV5") || document.getElementById("farm2FlockLegacyListV6") || document.getElementById("farm2FlockLegacyListV7");
    if (!legacy) return null;
    legacy.id = "farm2FlockLegacyListV7";
    legacy.style.display = "none";
    let manager = document.getElementById("farm2FlockManagerV7");
    if (!manager) {
      manager = document.createElement("div");
      manager.id = "farm2FlockManagerV7";
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

  function photoPicker(id, has) {
    return `<span class="farm-photo-button-v7">📷 ${has ? "Change Photo" : "Set Photo"}<input aria-label="${has ? "Change" : "Set"} chicken photo" type="file" accept="image/*" onchange="farmFlockPhotoPickedV7('${esc(id)}',this)"></span>`;
  }

  function renderManager() {
    const manager = ensureManager();
    if (!manager) return;
    const all = birds();
    const html = all.length ? all.map(b => {
      const id = String(b.id || "");
      const src = photo(id);
      const roo = ["Rooster","Cockerel"].includes(b.sex);
      return `<div class="farm2-listItem" data-flock-v7-id="${esc(id)}">${src ? `<img class="farm-flock-photo-v7" src="${esc(src)}" alt="${esc(b.name || "Chicken")}">` : ""}<div class="farm2-listTop"><div><h4>${roo ? "🐓" : "🐔"} ${esc(b.name)}</h4><div class="farm2-subtle">${esc(b.breed || "Breed not set")} • ${esc(b.sex || "Unknown")} • ${esc(age(b.hatchDate))}</div></div><span class="farm2-badge purple">${esc(b.status || "Active")}</span></div>${b.hatchDate ? `<div class="farm2-subtle" style="margin-top:7px">Hatched ${esc(b.hatchDate)}</div>` : ""}${b.notes ? `<div class="farm2-subtle">📝 ${esc(b.notes)}</div>` : ""}<div class="farm2-actions"><button type="button" onclick="farmFlockEditBirdV7('${esc(id)}')">✏️ Edit Profile</button>${photoPicker(id, !!src)}${src ? `<button type="button" class="secondary" onclick="farmFlockRemovePhotoV7('${esc(id)}')">Remove Photo</button>` : ""}<button type="button" class="farm2-delete" onclick="farmFlockDeleteBirdV7('${esc(id)}')">Delete</button></div><div class="farm2-subtle farm-photo-note-v7">Photo sync: shared Firebase photo record.</div></div>`;
    }).join("") : `<div class="farm2-empty">No profiles yet.</div>`;
    if (manager.innerHTML !== html) manager.innerHTML = html;
  }

  function clearPending() {
    pendingFile = null;
    if (pendingPreview) { try { URL.revokeObjectURL(pendingPreview); } catch {} }
    pendingPreview = "";
    const input = document.getElementById("farm2BirdPhotoInputV7");
    const preview = document.getElementById("farm2BirdPhotoPreviewV7");
    const clear = document.getElementById("farm2BirdPhotoClearV7");
    if (input) input.value = "";
    if (preview) preview.innerHTML = "🐔";
    if (clear) clear.style.display = "none";
  }

  window.farmFlockPendingPhotoV7 = input => {
    const file = input?.files?.[0] || null;
    pendingFile = file;
    if (pendingPreview) { try { URL.revokeObjectURL(pendingPreview); } catch {} }
    pendingPreview = file ? URL.createObjectURL(file) : "";
    const preview = document.getElementById("farm2BirdPhotoPreviewV7");
    const clear = document.getElementById("farm2BirdPhotoClearV7");
    if (preview) preview.innerHTML = pendingPreview ? `<img src="${pendingPreview}">` : "🐔";
    if (clear) clear.style.display = file ? "inline-flex" : "none";
  };
  window.farmFlockClearPendingPhotoV7 = clearPending;

  function ensureAddPicker() {
    const screen = document.getElementById("farm2Flock");
    const addButton = screen?.querySelector('button[onclick="farm2AddBird()"]');
    if (!screen || !addButton) return;
    if (!document.getElementById("farm2BirdPhotoPickerV7")) {
      const wrap = document.createElement("div");
      wrap.id = "farm2BirdPhotoPickerV7";
      wrap.innerHTML = `<label>Photo <span class="farm2-subtle">(optional)</span></label><div class="row-v7"><div id="farm2BirdPhotoPreviewV7">🐔</div><div style="flex:1;min-width:180px"><span class="farm-photo-button-v7 secondary">📷 Choose Photo<input id="farm2BirdPhotoInputV7" aria-label="Choose chicken photo" type="file" accept="image/*" onchange="farmFlockPendingPhotoV7(this)"></span><button id="farm2BirdPhotoClearV7" type="button" class="secondary" style="width:auto;margin:7px 0 0;display:none" onclick="farmFlockClearPendingPhotoV7()">Remove Selected Photo</button><div id="farmPhotoStatusV7">Choose a picture; it will be compressed and synced after saving.</div></div></div>`;
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
          if (selected && photos()?.saveFile) await photos().saveFile(String(added.id), selected);
          clearPending();
          scheduleRender();
        }, 120);
      }, true);
    }
  }

  window.farmFlockPhotoPickedV7 = async (id, input) => {
    const file = input?.files?.[0];
    if (!file) return;
    try {
      const result = await photos()?.saveFile?.(String(id || ""), file);
      if (!result?.saved) showStatus("Photo was not saved. Try another picture.", "error");
    } catch (error) {
      console.warn("Photo picker save failed:", error);
      showStatus("Photo failed to save.", "error");
    } finally {
      try { input.value = ""; } catch {}
      scheduleRender();
    }
  };

  window.farmFlockRemovePhotoV7 = async id => {
    if (!confirm("Remove this chicken's photo?")) return;
    await photos()?.remove?.(String(id || ""));
    scheduleRender();
  };

  window.farmFlockDeleteBirdV7 = async id => {
    id = String(id || "");
    if (!id || !confirm("Delete this flock profile?")) return;
    const a = app();
    a.flock = a.flock.filter(b => String(b.id) !== id);
    saveApp(a);
    await photos()?.remove?.(id);
  };

  window.farmFlockEditBirdV7 = id => {
    const b = app().flock.find(x => String(x.id) === String(id));
    if (!b) return;
    document.getElementById("farmFlockEditOverlayV7")?.remove();
    const o = document.createElement("div");
    o.id = "farmFlockEditOverlayV7";
    o.innerHTML = `<div id="farmFlockEditCardV7"><h3 style="margin:0 0 4px">✏️ Edit ${esc(b.name || "Chicken")}</h3><div class="farm2-subtle">Update this flock profile and save.</div><label>Name<input id="farmFlockEditNameV7"></label><label>Breed<input id="farmFlockEditBreedV7"></label><label>Hatch / Birth Date<input id="farmFlockEditDateV7" type="date"></label><label>Sex<select id="farmFlockEditSexV7"><option>Hen</option><option>Rooster</option><option>Pullet</option><option>Cockerel</option><option>Unknown</option></select></label><label>Notes<textarea id="farmFlockEditNotesV7"></textarea></label><div class="actions-v7"><button type="button" onclick="farmFlockSaveEditV7('${esc(b.id)}')">Save Changes</button><button type="button" class="secondary" onclick="farmFlockCloseEditV7()">Cancel</button></div></div>`;
    document.body.appendChild(o);
    document.getElementById("farmFlockEditNameV7").value = b.name || "";
    document.getElementById("farmFlockEditBreedV7").value = b.breed || "";
    document.getElementById("farmFlockEditDateV7").value = b.hatchDate || "";
    document.getElementById("farmFlockEditSexV7").value = b.sex || "Unknown";
    document.getElementById("farmFlockEditNotesV7").value = b.notes || "";
    o.onclick = e => { if (e.target === o) o.remove(); };
  };
  window.farmFlockCloseEditV7 = () => document.getElementById("farmFlockEditOverlayV7")?.remove();
  window.farmFlockSaveEditV7 = id => {
    const a = app();
    const b = a.flock.find(x => String(x.id) === String(id));
    if (!b) return;
    const name = document.getElementById("farmFlockEditNameV7")?.value.trim();
    if (!name) { alert("Enter the chicken's name."); return; }
    b.name = name;
    b.breed = document.getElementById("farmFlockEditBreedV7")?.value.trim() || "";
    b.hatchDate = document.getElementById("farmFlockEditDateV7")?.value || "";
    b.sex = document.getElementById("farmFlockEditSexV7")?.value || "Unknown";
    b.notes = document.getElementById("farmFlockEditNotesV7")?.value.trim() || "";
    b.updatedAt = Date.now();
    saveApp(a);
    document.getElementById("farmFlockEditOverlayV7")?.remove();
  };

  function showStatus(message, kind = "info") {
    const inline = document.getElementById("farmPhotoStatusV7");
    if (inline) inline.textContent = message;
    let toast = document.getElementById("farmPhotoToastV7");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "farmPhotoToastV7";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => toast.classList.remove("show"), kind === "error" ? 5000 : 2800);
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      css();
      ensureAddPicker();
      renderSummary();
      renderManager();
    });
  }

  async function init() {
    css();
    window.addEventListener("bird-photo-status", e => { if (e.detail?.message) showStatus(e.detail.message, e.detail.kind); });
    window.addEventListener("farm-data-synced", e => { if (!e.detail?.key || e.detail.key === APP) scheduleRender(); });
    window.addEventListener("storage", e => { if (e.key === APP) scheduleRender(); });
    scheduleRender();
    setTimeout(scheduleRender, 500);
    const p = photos();
    if (p) {
      p.ready?.().then(scheduleRender).catch(error => console.warn("Photo service ready failed:", error));
      photoUnsub?.();
      photoUnsub = p.subscribe?.(scheduleRender) || null;
    }
    console.log("✅ Flock manager v7 active with direct iPhone file inputs");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 250));
  else setTimeout(init, 250);
})();