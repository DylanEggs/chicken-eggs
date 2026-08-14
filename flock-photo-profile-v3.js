(() => {
  "use strict";
  if (window.__flockPhotoProfileV3) return;
  window.__flockPhotoProfileV3 = true;

  const APP = "chickenEggApp2V1";
  const DELUXE = "chickenEggDeluxeV1";
  const LOCAL = "chickenEggLocalBirdPhotosV1";
  let pendingPhoto = "";
  let photoTarget = "";
  let addHooked = false;
  let deleteHooked = false;
  let listObserver = null;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const app = () => {
    const a = read(APP, {});
    a.flock = Array.isArray(a.flock) ? a.flock : [];
    return a;
  };
  const sortedFlock = () => [...app().flock].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));

  function installCleanupStyle() {
    if (document.getElementById("flockPhotoProfileV3Style")) return;
    const style = document.createElement("style");
    style.id = "flockPhotoProfileV3Style";
    style.textContent = `
      #farm2BirdPhotoPicker,
      #farm2BirdPhotoPickerV2,
      .farm-direct-photo,
      .farm-direct-photo-v2,
      .farm-direct-photo-actions,
      .farm-direct-photo-actions-v2 { display:none !important; }
      .farm-profile-actions-v3 { display:flex; gap:8px; flex-wrap:wrap; margin-right:8px; }
      .farm-profile-photo-v3 { width:88px; height:88px; object-fit:cover; border-radius:18px; float:right; margin:0 0 10px 12px; }
      #farmFlockEditOverlayV3 { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,.62); display:flex; align-items:center; justify-content:center; padding:18px; }
      #farmFlockEditCardV3 { width:min(620px,100%); max-height:88vh; overflow:auto; background:var(--card,#fff); color:inherit; border-radius:24px; padding:20px; box-shadow:0 24px 70px rgba(0,0,0,.35); }
      #farmFlockEditCardV3 label { display:block; margin-top:12px; font-weight:700; }
      #farmFlockEditCardV3 input, #farmFlockEditCardV3 select, #farmFlockEditCardV3 textarea { width:100%; margin-top:6px; }
      #farmFlockEditCardV3 textarea { min-height:90px; resize:vertical; }
      #farmFlockEditCardV3 .farm-edit-actions-v3 { display:flex; gap:10px; flex-wrap:wrap; margin-top:18px; }
    `;
    document.head.appendChild(style);
  }

  function photoFor(id) {
    const local = read(LOCAL, {});
    const deluxe = read(DELUXE, {});
    return local[id] || deluxe?.birdPhotoUrls?.[id] || "";
  }

  function savePhoto(id, dataUrl) {
    if (!id || !dataUrl) return;
    const local = read(LOCAL, {});
    local[id] = dataUrl;
    localStorage.setItem(LOCAL, JSON.stringify(local));

    const deluxe = read(DELUXE, {});
    deluxe.birdPhotoUrls = deluxe.birdPhotoUrls || {};
    deluxe.birdPhotoUrls[id] = dataUrl;
    deluxe.updatedAt = Date.now();
    localStorage.setItem(DELUXE, JSON.stringify(deluxe));
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ key:DELUXE } }));
    render();
  }

  function removePhoto(id, ask=true) {
    if (!id) return;
    if (ask && !confirm("Remove this chicken's photo?")) return;
    const local = read(LOCAL, {});
    delete local[id];
    localStorage.setItem(LOCAL, JSON.stringify(local));

    const deluxe = read(DELUXE, {});
    deluxe.birdPhotoUrls = deluxe.birdPhotoUrls || {};
    delete deluxe.birdPhotoUrls[id];
    deluxe.updatedAt = Date.now();
    localStorage.setItem(DELUXE, JSON.stringify(deluxe));
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ key:DELUXE } }));
    render();
  }

  function compress(file, done) {
    if (!file) return done("");
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const size = 120;
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
        done(canvas.toDataURL("image/jpeg", .48));
      };
      img.onerror = () => done("");
      img.src = e.target.result;
    };
    reader.onerror = () => done("");
    reader.readAsDataURL(file);
  }

  function directPhotoInput() {
    let input = document.getElementById("farmFlockPhotoInputV3");
    if (input) return input;
    input = document.createElement("input");
    input.id = "farmFlockPhotoInputV3";
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.onchange = () => {
      const id = photoTarget;
      compress(input.files?.[0], url => {
        if (id && url) savePhoto(id, url);
        photoTarget = "";
        input.value = "";
      });
    };
    document.body.appendChild(input);
    return input;
  }

  window.farmFlockSetPhotoV3 = id => {
    photoTarget = String(id || "");
    directPhotoInput().click();
  };
  window.farmFlockRemovePhotoV3 = id => removePhoto(String(id || ""), true);

  function ensureAddPicker() {
    const screen = document.getElementById("farm2Flock");
    if (!screen) return;
    const old1 = document.getElementById("farm2BirdPhotoPicker");
    const old2 = document.getElementById("farm2BirdPhotoPickerV2");
    if (old1) old1.style.display = "none";
    if (old2) old2.style.display = "none";
    if (document.getElementById("farm2BirdPhotoPickerV3")) return;

    const addButton = screen.querySelector('button[onclick="farm2AddBird()"]');
    if (!addButton) return;
    const wrap = document.createElement("div");
    wrap.id = "farm2BirdPhotoPickerV3";
    wrap.style.cssText = "margin:12px 0 14px";
    wrap.innerHTML = `
      <label>Photo <span class="farm2-subtle">(optional)</span></label>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:7px">
        <div id="farm2BirdPhotoPreviewV3" style="width:72px;height:72px;border-radius:16px;background:rgba(31,122,58,.08);display:grid;place-items:center;font-size:34px;overflow:hidden">🐔</div>
        <div style="flex:1;min-width:180px">
          <input id="farm2BirdPhotoInputV3" type="file" accept="image/*" style="display:none">
          <button id="farm2BirdPhotoChooseV3" type="button" class="secondary" style="margin:0">📷 Choose Photo</button>
          <button id="farm2BirdPhotoClearV3" type="button" class="secondary" style="margin:7px 0 0;display:none">Remove Selected Photo</button>
          <div class="farm2-subtle" style="margin-top:6px">Optional when adding a new chicken.</div>
        </div>
      </div>`;
    addButton.parentNode.insertBefore(wrap, addButton);

    const input = document.getElementById("farm2BirdPhotoInputV3");
    const preview = document.getElementById("farm2BirdPhotoPreviewV3");
    const clear = document.getElementById("farm2BirdPhotoClearV3");
    document.getElementById("farm2BirdPhotoChooseV3").onclick = () => input.click();
    clear.onclick = () => {
      pendingPhoto = "";
      input.value = "";
      preview.innerHTML = "🐔";
      clear.style.display = "none";
    };
    input.onchange = () => compress(input.files?.[0], url => {
      pendingPhoto = url;
      preview.innerHTML = url ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover">` : "🐔";
      clear.style.display = url ? "block" : "none";
    });
  }

  function resetAddPicker() {
    pendingPhoto = "";
    const input = document.getElementById("farm2BirdPhotoInputV3");
    const preview = document.getElementById("farm2BirdPhotoPreviewV3");
    const clear = document.getElementById("farm2BirdPhotoClearV3");
    if (input) input.value = "";
    if (preview) preview.innerHTML = "🐔";
    if (clear) clear.style.display = "none";
  }

  function hookAddBird() {
    if (addHooked || typeof window.farm2AddBird !== "function") return;
    addHooked = true;
    const original = window.farm2AddBird;
    window.farm2AddBird = function () {
      const before = new Set(app().flock.map(b => String(b.id)));
      const selected = pendingPhoto;
      const result = original.apply(this, arguments);
      const added = app().flock.find(b => !before.has(String(b.id)));
      if (added && selected) savePhoto(String(added.id), selected);
      if (added) resetAddPicker();
      setTimeout(render, 0);
      return result;
    };
    window.farm2AddBird.__flockPhotoProfileV3 = true;
  }

  function hookDeleteBird() {
    if (deleteHooked || typeof window.farm2DeleteBird !== "function") return;
    deleteHooked = true;
    const original = window.farm2DeleteBird;
    window.farm2DeleteBird = function (id) {
      const birdId = String(id || "");
      const existed = app().flock.some(b => String(b.id) === birdId);
      const result = original.apply(this, arguments);
      const stillExists = app().flock.some(b => String(b.id) === birdId);
      if (existed && !stillExists) removePhoto(birdId, false);
      return result;
    };
    window.farm2DeleteBird.__flockPhotoProfileV3 = true;
  }

  window.farmFlockEditBirdV3 = id => {
    const bird = app().flock.find(b => String(b.id) === String(id));
    if (!bird) return;
    document.getElementById("farmFlockEditOverlayV3")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "farmFlockEditOverlayV3";
    overlay.innerHTML = `
      <div id="farmFlockEditCardV3">
        <h3 style="margin:0 0 4px">✏️ Edit ${esc(bird.name || "Chicken")}</h3>
        <div class="farm2-subtle">Update this flock profile and save.</div>
        <label>Name<input id="farmFlockEditNameV3"></label>
        <label>Breed<input id="farmFlockEditBreedV3"></label>
        <label>Hatch / Birth Date<input id="farmFlockEditDateV3" type="date"></label>
        <label>Sex<select id="farmFlockEditSexV3"><option>Hen</option><option>Rooster</option><option>Pullet</option><option>Cockerel</option><option>Unknown</option></select></label>
        <label>Notes<textarea id="farmFlockEditNotesV3"></textarea></label>
        <div class="farm-edit-actions-v3">
          <button type="button" onclick="farmFlockSaveEditV3('${esc(bird.id)}')">Save Changes</button>
          <button type="button" class="secondary" onclick="farmFlockCloseEditV3()">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById("farmFlockEditNameV3").value = bird.name || "";
    document.getElementById("farmFlockEditBreedV3").value = bird.breed || "";
    document.getElementById("farmFlockEditDateV3").value = bird.hatchDate || "";
    document.getElementById("farmFlockEditSexV3").value = bird.sex || "Unknown";
    document.getElementById("farmFlockEditNotesV3").value = bird.notes || "";
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  };

  window.farmFlockCloseEditV3 = () => document.getElementById("farmFlockEditOverlayV3")?.remove();

  window.farmFlockSaveEditV3 = id => {
    const a = app();
    const bird = a.flock.find(b => String(b.id) === String(id));
    if (!bird) return;
    const name = document.getElementById("farmFlockEditNameV3")?.value.trim();
    if (!name) { alert("Enter the chicken's name."); return; }
    bird.name = name;
    bird.breed = document.getElementById("farmFlockEditBreedV3")?.value.trim() || "";
    bird.hatchDate = document.getElementById("farmFlockEditDateV3")?.value || "";
    bird.sex = document.getElementById("farmFlockEditSexV3")?.value || "Unknown";
    bird.notes = document.getElementById("farmFlockEditNotesV3")?.value.trim() || "";
    bird.updatedAt = Date.now();
    a.updatedAt = Date.now();
    localStorage.setItem(APP, JSON.stringify(a));
    document.getElementById("farmFlockEditOverlayV3")?.remove();
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ key:APP } }));
    if (typeof window.syncFarmNow === "function") window.syncFarmNow();
    setTimeout(render, 0);
  };

  function renderCards() {
    const birds = sortedFlock();
    const cards = [...document.querySelectorAll("#farm2FlockList .farm2-listItem")];
    cards.forEach((card, index) => {
      const bird = birds[index];
      if (!bird) return;
      const id = String(bird.id || "");
      card.dataset.farmBirdIdV3 = id;
      const url = photoFor(id);

      let image = card.querySelector(".farm-profile-photo-v3");
      if (url) {
        if (!image) {
          image = document.createElement("img");
          image.className = "farm-profile-photo-v3";
          card.prepend(image);
        }
        if (image.getAttribute("src") !== url) image.setAttribute("src", url);
      } else if (image) image.remove();

      const actions = card.querySelector(".farm2-actions");
      if (!actions) return;
      let controls = actions.querySelector(".farm-profile-actions-v3");
      if (!controls) {
        controls = document.createElement("span");
        controls.className = "farm-profile-actions-v3";
        actions.prepend(controls);
      }
      const html = `<button type="button" onclick="farmFlockEditBirdV3('${esc(id)}')">✏️ Edit Profile</button><button type="button" onclick="farmFlockSetPhotoV3('${esc(id)}')">📷 ${url ? "Change Photo" : "Set Photo"}</button>${url ? `<button type="button" class="secondary" onclick="farmFlockRemovePhotoV3('${esc(id)}')">Remove Photo</button>` : ""}`;
      if (controls.innerHTML !== html) controls.innerHTML = html;
    });
  }

  function render() {
    installCleanupStyle();
    ensureAddPicker();
    hookAddBird();
    hookDeleteBird();
    renderCards();
  }

  function attach() {
    render();
    const list = document.getElementById("farm2FlockList");
    if (!list) { setTimeout(attach, 250); return; }
    if (listObserver) listObserver.disconnect();
    let queued = false;
    listObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; render(); });
    });
    listObserver.observe(list, { childList:true, subtree:true });
    render();
  }

  window.addEventListener("farm-data-synced", render);
  window.addEventListener("storage", e => { if ([APP,DELUXE].includes(e.key)) render(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(attach, 300));
  else setTimeout(attach, 300);
})();