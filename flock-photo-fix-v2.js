(() => {
  "use strict";
  if (window.__flockPhotoFixV2) return;
  window.__flockPhotoFixV2 = true;

  const APP = "chickenEggApp2V1";
  const DELUXE = "chickenEggDeluxeV1";
  const LOCAL = "chickenEggLocalBirdPhotosV1";
  let pendingPhoto = "";
  let targetBird = "";
  let addHooked = false;
  let listObserver = null;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };

  const flock = () => {
    const a = read(APP, {});
    return Array.isArray(a.flock) ? a.flock : [];
  };

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
    render();
  }

  function removePhoto(id) {
    const local = read(LOCAL, {});
    delete local[id];
    localStorage.setItem(LOCAL, JSON.stringify(local));

    const deluxe = read(DELUXE, {});
    deluxe.birdPhotoUrls = deluxe.birdPhotoUrls || {};
    delete deluxe.birdPhotoUrls[id];
    deluxe.updatedAt = Date.now();
    localStorage.setItem(DELUXE, JSON.stringify(deluxe));
    render();
  }

  function compress(file, done) {
    if (!file) return done("");
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const size = 140;
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
        done(canvas.toDataURL("image/jpeg", 0.5));
      };
      img.onerror = () => done("");
      img.src = e.target.result;
    };
    reader.onerror = () => done("");
    reader.readAsDataURL(file);
  }

  function directInput() {
    let input = document.getElementById("farmFlockDirectPhotoInputV2");
    if (input) return input;
    input = document.createElement("input");
    input.id = "farmFlockDirectPhotoInputV2";
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.onchange = () => {
      const id = targetBird;
      compress(input.files?.[0], url => {
        if (id && url) savePhoto(id, url);
        targetBird = "";
        input.value = "";
      });
    };
    document.body.appendChild(input);
    return input;
  }

  window.farmPhotoChooseForBird = id => {
    targetBird = String(id || "");
    directInput().click();
  };

  window.farmPhotoRemoveForBird = id => {
    if (confirm("Remove this chicken's photo?")) removePhoto(String(id || ""));
  };

  function ensureAddPicker() {
    const screen = document.getElementById("farm2Flock");
    if (!screen || document.getElementById("farm2BirdPhotoPickerV2")) return;
    const addButton = screen.querySelector('button[onclick="farm2AddBird()"]');
    if (!addButton) return;

    const wrap = document.createElement("div");
    wrap.id = "farm2BirdPhotoPickerV2";
    wrap.style.cssText = "margin:12px 0 14px";
    wrap.innerHTML = `
      <label>Photo <span class="farm2-subtle">(optional)</span></label>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:7px">
        <div id="farm2BirdPhotoPreviewV2" style="width:72px;height:72px;border-radius:16px;background:rgba(31,122,58,.08);display:grid;place-items:center;font-size:34px;overflow:hidden">🐔</div>
        <div style="flex:1;min-width:180px">
          <input id="farm2BirdPhotoInputV2" type="file" accept="image/*" style="display:none">
          <button id="farm2BirdPhotoChooseV2" type="button" class="secondary" style="margin:0">📷 Choose Photo</button>
          <button id="farm2BirdPhotoClearV2" type="button" class="secondary" style="margin:7px 0 0;display:none">Remove Selected Photo</button>
        </div>
      </div>`;
    addButton.parentNode.insertBefore(wrap, addButton);

    const input = document.getElementById("farm2BirdPhotoInputV2");
    const preview = document.getElementById("farm2BirdPhotoPreviewV2");
    const clear = document.getElementById("farm2BirdPhotoClearV2");
    document.getElementById("farm2BirdPhotoChooseV2").onclick = () => input.click();
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

  function hookAddBird() {
    if (addHooked) return;
    if (typeof window.farm2AddBird !== "function") return;
    addHooked = true;
    const original = window.farm2AddBird;
    window.farm2AddBird = function () {
      const before = new Set(flock().map(b => String(b.id)));
      const selected = pendingPhoto;
      const result = original.apply(this, arguments);
      const added = flock().find(b => !before.has(String(b.id)));
      if (added && selected) savePhoto(String(added.id), selected);
      if (added) pendingPhoto = "";
      setTimeout(render, 0);
      return result;
    };
  }

  function renderCards() {
    const birds = new Set(flock().map(b => String(b.id)));
    document.querySelectorAll("#farm2FlockList .farm2-listItem").forEach(card => {
      const del = card.querySelector('button[onclick*="farm2DeleteBird"]');
      const id = del?.getAttribute("onclick")?.match(/farm2DeleteBird\('([^']+)'\)/)?.[1];
      if (!id || !birds.has(String(id))) return;

      const url = photoFor(id);
      let image = card.querySelector(".farm-direct-photo-v2");
      if (url) {
        if (!image) {
          image = document.createElement("img");
          image.className = "farm-direct-photo-v2";
          image.style.cssText = "width:82px;height:82px;object-fit:cover;border-radius:17px;float:right;margin:0 0 9px 12px";
          card.prepend(image);
        }
        if (image.getAttribute("src") !== url) image.setAttribute("src", url);
      } else if (image) image.remove();

      const actions = card.querySelector(".farm2-actions");
      if (!actions) return;
      let photoActions = actions.querySelector(".farm-direct-photo-actions-v2");
      if (!photoActions) {
        photoActions = document.createElement("span");
        photoActions.className = "farm-direct-photo-actions-v2";
        actions.prepend(photoActions);
      }
      const html = `<button type="button" onclick="farmPhotoChooseForBird('${id}')">📷 ${url ? "Change Photo" : "Set Photo"}</button>${url ? `<button type="button" class="secondary" onclick="farmPhotoRemoveForBird('${id}')">Remove Photo</button>` : ""}`;
      if (photoActions.innerHTML !== html) photoActions.innerHTML = html;
    });
  }

  function render() {
    ensureAddPicker();
    hookAddBird();
    renderCards();
  }

  function attachWhenReady() {
    render();
    const list = document.getElementById("farm2FlockList");
    if (!list) {
      setTimeout(attachWhenReady, 250);
      return;
    }
    if (listObserver) listObserver.disconnect();
    let queued = false;
    listObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        render();
      });
    });
    listObserver.observe(list, { childList:true, subtree:true });
    render();
  }

  window.addEventListener("farm-data-synced", render);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(attachWhenReady, 250));
  } else {
    setTimeout(attachWhenReady, 250);
  }
})();