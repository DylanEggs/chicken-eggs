(() => {
  "use strict";
  if (window.__flockManagerV5) return;
  window.__flockManagerV5 = true;

  const APP = "chickenEggApp2V1";
  const DELUXE = "chickenEggDeluxeV1";
  const LOCAL = "chickenEggLocalBirdPhotosV1";
  let pendingPhoto = "";
  let photoTarget = "";
  let addButtonHooked = false;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const nowDate = () => new Date();

  function app() {
    const a = read(APP, {});
    a.flock = Array.isArray(a.flock) ? a.flock : [];
    return a;
  }
  function sortedBirds() {
    return [...app().flock].sort((a,b) => String(a.name || "").localeCompare(String(b.name || "")));
  }
  function ageText(date) {
    if (!date) return "Age unknown";
    const born = new Date(String(date) + "T12:00:00");
    if (Number.isNaN(born.getTime())) return "Age unknown";
    const days = Math.max(0, Math.floor((nowDate() - born) / 86400000));
    if (days < 14) return `${days} days`;
    if (days < 112) return `${Math.floor(days / 7)} weeks`;
    const months = Math.floor(days / 30.44);
    return months < 24 ? `${months} months` : `${Math.floor(months / 12)}y ${months % 12}m`;
  }

  function installStyle() {
    if (document.getElementById("flockManagerV5Style")) return;
    const style = document.createElement("style");
    style.id = "flockManagerV5Style";
    style.textContent = `
      #farm2BirdPhotoPicker,#farm2BirdPhotoPickerV2,#farm2BirdPhotoPickerV3,#farm2BirdPhotoPickerV4{display:none!important}
      #farm2FlockLegacyListV5{display:none!important}
      #farm2FlockManagerV5 .farm2-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      #farm2FlockManagerV5 .farm2-actions button{width:auto;margin:0}
      .farm-flock-photo-v5{width:92px;height:92px;object-fit:cover;border-radius:18px;float:right;margin:0 0 10px 14px}
      #farmFlockEditOverlayV5{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:18px}
      #farmFlockEditCardV5{width:min(620px,100%);max-height:88vh;overflow:auto;background:var(--card,#fff);color:inherit;border-radius:24px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}
      #farmFlockEditCardV5 label{display:block;margin-top:12px;font-weight:700}
      #farmFlockEditCardV5 input,#farmFlockEditCardV5 select,#farmFlockEditCardV5 textarea{width:100%;margin-top:6px}
      #farmFlockEditCardV5 textarea{min-height:90px;resize:vertical}
      #farmFlockEditCardV5 .farm-edit-actions-v5{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
      #farmFlockEditCardV5 .farm-edit-actions-v5 button{width:auto;margin:0}
    `;
    document.head.appendChild(style);
  }

  function photoFor(id) {
    const local = read(LOCAL, {});
    const deluxe = read(DELUXE, {});
    return local[id] || deluxe?.birdPhotoUrls?.[id] || "";
  }
  function writeDeluxePhoto(id, url) {
    const local = read(LOCAL, {});
    if (url) local[id] = url; else delete local[id];
    localStorage.setItem(LOCAL, JSON.stringify(local));

    const deluxe = read(DELUXE, {});
    deluxe.birdPhotoUrls = deluxe.birdPhotoUrls || {};
    if (url) deluxe.birdPhotoUrls[id] = url; else delete deluxe.birdPhotoUrls[id];
    deluxe.updatedAt = Date.now();
    localStorage.setItem(DELUXE, JSON.stringify(deluxe));
    render();
  }
  function compress(file, done) {
    if (!file) return done("");
    const reader = new FileReader();
    reader.onload = event => {
      const image = new Image();
      image.onload = () => {
        const size = 120;
        const side = Math.min(image.width, image.height);
        const sx = (image.width - side) / 2;
        const sy = (image.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(image, sx, sy, side, side, 0, 0, size, size);
        done(canvas.toDataURL("image/jpeg", 0.46));
      };
      image.onerror = () => done("");
      image.src = event.target.result;
    };
    reader.onerror = () => done("");
    reader.readAsDataURL(file);
  }

  function directPhotoInput() {
    let input = document.getElementById("farmFlockDirectPhotoV5");
    if (input) return input;
    input = document.createElement("input");
    input.id = "farmFlockDirectPhotoV5";
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.onchange = () => {
      const id = photoTarget;
      compress(input.files?.[0], url => {
        if (id && url) writeDeluxePhoto(id, url);
        photoTarget = "";
        input.value = "";
      });
    };
    document.body.appendChild(input);
    return input;
  }

  window.farmFlockSetPhotoV5 = id => {
    photoTarget = String(id || "");
    directPhotoInput().click();
  };
  window.farmFlockRemovePhotoV5 = id => {
    id = String(id || "");
    if (!id || !confirm("Remove this chicken's photo?")) return;
    writeDeluxePhoto(id, "");
  };

  function ensureSingleOwnerList() {
    let legacy = document.getElementById("farm2FlockList");
    if (legacy) {
      legacy.id = "farm2FlockLegacyListV5";
      legacy.style.display = "none";
    } else {
      legacy = document.getElementById("farm2FlockLegacyListV5");
    }
    if (!legacy) return null;

    let manager = document.getElementById("farm2FlockManagerV5");
    if (!manager) {
      manager = document.createElement("div");
      manager.id = "farm2FlockManagerV5";
      legacy.insertAdjacentElement("afterend", manager);
    }
    return manager;
  }

  function renderSummary() {
    const summary = document.getElementById("farm2FlockSummary");
    if (!summary) return;
    const birds = app().flock;
    const hens = birds.filter(b => ["Hen","Pullet"].includes(b.sex)).length;
    const roos = birds.filter(b => ["Rooster","Cockerel"].includes(b.sex)).length;
    const html = `<div class="farm2-grid3"><div class="farm2-card"><div class="farm2-kicker">Profiles</div><div class="farm2-moneyBig">${birds.length}</div></div><div class="farm2-card"><div class="farm2-kicker">Hens/Pullets</div><div class="farm2-moneyBig">${hens}</div></div><div class="farm2-card"><div class="farm2-kicker">Roosters</div><div class="farm2-moneyBig">${roos}</div></div></div>`;
    if (summary.innerHTML !== html) summary.innerHTML = html;
  }

  function renderManager() {
    const manager = ensureSingleOwnerList();
    if (!manager) return;
    const birds = sortedBirds();
    const html = birds.length ? birds.map(b => {
      const id = String(b.id || "");
      const url = photoFor(id);
      const icon = ["Rooster","Cockerel"].includes(b.sex) ? "🐓" : "🐔";
      return `<div class="farm2-listItem" data-flock-v5-id="${esc(id)}">${url ? `<img class="farm-flock-photo-v5" src="${url}">` : ""}<div class="farm2-listTop"><div><h4>${icon} ${esc(b.name)}</h4><div class="farm2-subtle">${esc(b.breed || "Breed not set")} • ${esc(b.sex || "Unknown")} • ${esc(ageText(b.hatchDate))}</div></div><span class="farm2-badge purple">${esc(b.status || "Active")}</span></div>${b.notes ? `<div class="farm2-subtle">📝 ${esc(b.notes)}</div>` : ""}<div class="farm2-actions"><button type="button" onclick="farmFlockEditBirdV5('${esc(id)}')">✏️ Edit Profile</button><button type="button" onclick="farmFlockSetPhotoV5('${esc(id)}')">📷 ${url ? "Change Photo" : "Set Photo"}</button>${url ? `<button type="button" class="secondary" onclick="farmFlockRemovePhotoV5('${esc(id)}')">Remove Photo</button>` : ""}<button type="button" class="farm2-delete" onclick="farmFlockDeleteBirdV5('${esc(id)}')">Delete</button></div></div>`;
    }).join("") : `<div class="farm2-empty">No profiles yet.</div>`;
    if (manager.innerHTML !== html) manager.innerHTML = html;
  }

  function resetPendingPicker() {
    pendingPhoto = "";
    const input = document.getElementById("farm2BirdPhotoInputV5");
    const preview = document.getElementById("farm2BirdPhotoPreviewV5");
    const clear = document.getElementById("farm2BirdPhotoClearV5");
    if (input) input.value = "";
    if (preview) preview.innerHTML = "🐔";
    if (clear) clear.style.display = "none";
  }

  function ensureAddPicker() {
    const screen = document.getElementById("farm2Flock");
    const addButton = screen?.querySelector('button[onclick="farm2AddBird()"]');
    if (!screen || !addButton) return;

    if (!document.getElementById("farm2BirdPhotoPickerV5")) {
      const wrap = document.createElement("div");
      wrap.id = "farm2BirdPhotoPickerV5";
      wrap.style.cssText = "margin:12px 0 14px";
      wrap.innerHTML = `<label>Photo <span class="farm2-subtle">(optional)</span></label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:7px"><div id="farm2BirdPhotoPreviewV5" style="width:72px;height:72px;border-radius:16px;background:rgba(31,122,58,.08);display:grid;place-items:center;font-size:34px;overflow:hidden">🐔</div><div style="flex:1;min-width:180px"><input id="farm2BirdPhotoInputV5" type="file" accept="image/*" style="display:none"><button id="farm2BirdPhotoChooseV5" type="button" class="secondary" style="margin:0">📷 Choose Photo</button><button id="farm2BirdPhotoClearV5" type="button" class="secondary" style="margin:7px 0 0;display:none">Remove Selected Photo</button><div class="farm2-subtle" style="margin-top:6px">Optional when adding a new chicken.</div></div></div>`;
      addButton.parentNode.insertBefore(wrap, addButton);
      const input = document.getElementById("farm2BirdPhotoInputV5");
      const preview = document.getElementById("farm2BirdPhotoPreviewV5");
      const clear = document.getElementById("farm2BirdPhotoClearV5");
      document.getElementById("farm2BirdPhotoChooseV5").onclick = () => input.click();
      clear.onclick = resetPendingPicker;
      input.onchange = () => compress(input.files?.[0], url => {
        pendingPhoto = url;
        preview.innerHTML = url ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover">` : "🐔";
        clear.style.display = url ? "block" : "none";
      });
    }

    if (!addButtonHooked) {
      addButtonHooked = true;
      addButton.addEventListener("click", () => {
        const before = new Set(app().flock.map(b => String(b.id)));
        const selected = pendingPhoto;
        setTimeout(() => {
          const added = app().flock.find(b => !before.has(String(b.id)));
          if (added && selected) writeDeluxePhoto(String(added.id), selected);
          if (added) resetPendingPicker();
          render();
        }, 40);
      }, true);
    }
  }

  window.farmFlockEditBirdV5 = id => {
    const bird = app().flock.find(b => String(b.id) === String(id));
    if (!bird) return;
    document.getElementById("farmFlockEditOverlayV5")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "farmFlockEditOverlayV5";
    overlay.innerHTML = `<div id="farmFlockEditCardV5"><h3 style="margin:0 0 4px">✏️ Edit ${esc(bird.name || "Chicken")}</h3><div class="farm2-subtle">Update this flock profile and save.</div><label>Name<input id="farmFlockEditNameV5"></label><label>Breed<input id="farmFlockEditBreedV5"></label><label>Hatch / Birth Date<input id="farmFlockEditDateV5" type="date"></label><label>Sex<select id="farmFlockEditSexV5"><option>Hen</option><option>Rooster</option><option>Pullet</option><option>Cockerel</option><option>Unknown</option></select></label><label>Notes<textarea id="farmFlockEditNotesV5"></textarea></label><div class="farm-edit-actions-v5"><button type="button" onclick="farmFlockSaveEditV5('${esc(bird.id)}')">Save Changes</button><button type="button" class="secondary" onclick="farmFlockCloseEditV5()">Cancel</button></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById("farmFlockEditNameV5").value = bird.name || "";
    document.getElementById("farmFlockEditBreedV5").value = bird.breed || "";
    document.getElementById("farmFlockEditDateV5").value = bird.hatchDate || "";
    document.getElementById("farmFlockEditSexV5").value = bird.sex || "Unknown";
    document.getElementById("farmFlockEditNotesV5").value = bird.notes || "";
    overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };
  };
  window.farmFlockCloseEditV5 = () => document.getElementById("farmFlockEditOverlayV5")?.remove();
  window.farmFlockSaveEditV5 = id => {
    const a = app();
    const bird = a.flock.find(b => String(b.id) === String(id));
    if (!bird) return;
    const name = document.getElementById("farmFlockEditNameV5")?.value.trim();
    if (!name) { alert("Enter the chicken's name."); return; }
    bird.name = name;
    bird.breed = document.getElementById("farmFlockEditBreedV5")?.value.trim() || "";
    bird.hatchDate = document.getElementById("farmFlockEditDateV5")?.value || "";
    bird.sex = document.getElementById("farmFlockEditSexV5")?.value || "Unknown";
    bird.notes = document.getElementById("farmFlockEditNotesV5")?.value.trim() || "";
    bird.updatedAt = Date.now();
    a.updatedAt = Date.now();
    localStorage.setItem(APP, JSON.stringify(a));
    document.getElementById("farmFlockEditOverlayV5")?.remove();
    render();
  };

  window.farmFlockDeleteBirdV5 = id => {
    id = String(id || "");
    const a = app();
    const bird = a.flock.find(b => String(b.id) === id);
    if (!bird) return;
    if (!confirm(`Delete ${bird.name || "this flock profile"}?`)) return;
    a.flock = a.flock.filter(b => String(b.id) !== id);
    a.updatedAt = Date.now();
    localStorage.setItem(APP, JSON.stringify(a));
    writeDeluxePhoto(id, "");
    render();
  };

  function render() {
    installStyle();
    ensureSingleOwnerList();
    ensureAddPicker();
    renderSummary();
    renderManager();
  }

  function init() {
    render();
    window.addEventListener("farm-data-synced", render);
    window.addEventListener("core-data-synced", render);
    window.addEventListener("storage", event => {
      if ([APP, DELUXE].includes(event.key)) render();
    });
    const screen = document.getElementById("farm2Flock");
    if (screen) new MutationObserver(() => requestAnimationFrame(render)).observe(screen, { childList:true, subtree:true });
    console.log("✅ Flock Manager v5 owns flock profiles, editing, and photos");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1000));
  else setTimeout(init, 1000);
})();