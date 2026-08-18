(() => {
  "use strict";
  if (window.__extrasDashboardSafeLoaderV4) return;
  window.__extrasDashboardSafeLoaderV4 = true;

  try {
    const build = String(window.__ChickenEggsBuild || "20260818-1760");
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `extras-dashboard-legacy-v1.js?v=${encodeURIComponent(build)}`, false);
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) throw new Error(`HTTP ${xhr.status}`);

    let source = String(xhr.responseText || "");
    if (!source.includes('__farm_deluxe_v1__')) throw new Error("Legacy dashboard source did not load");

    source = source.replace(
      'function save(){st.updatedAt=Date.now();localStorage.setItem(D,JSON.stringify(st));clearTimeout(timer);timer=setTimeout(cloudSave,500);render()}',
      'function save(){st.updatedAt=Date.now();localStorage.setItem(D,JSON.stringify(st));render()}'
    );
    source = source.replace(
      'function init(){inject();hook();render();cloudLoad();setInterval(()=>{hook();render()},3500)}',
      'function init(){inject();hook();render();window.addEventListener("farm-data-synced",render);window.addEventListener("farm-local-data-changed",render);window.addEventListener("core-data-synced",render);window.addEventListener("farm-sync-ready",render);window.addEventListener("bird-photos-changed",render)}'
    );

    // The old Deluxe dashboard had its own photo cache lookup. Flock Profiles now
    // uses FarmBirdPhotosV4, including Firebase-memory recovery and historical-ID
    // aliases, so Chicken of the Day must use that same source of truth.
    source = source.replace(
      'function pics(){return r(P,{})}function pic(id){return pics()[id]||st.birdPhotoUrls[id]||""}',
      'function pics(){return r(P,{})}function pic(id){let svc=window.FarmBirdPhotosV4||window.FarmBirdPhotosV3||window.FarmBirdPhotosV2;return svc?.get?.(String(id||""))||pics()[id]||st.birdPhotoUrls[id]||""}'
    );

    // If a photo is changed from the Home card, send it through the same V4
    // service instead of creating another browser-only photo copy.
    source = source.replace(
      'function filePhoto(e){let f=e.target.files?.[0],id=uploadId;if(!f||!id)return;',
      'function filePhoto(e){let f=e.target.files?.[0],id=uploadId;if(!f||!id)return;let svc=window.FarmBirdPhotosV4||window.FarmBirdPhotosV3||window.FarmBirdPhotosV2;if(svc?.saveFile){svc.saveFile(id,f).then(()=>render());return;}'
    );

    // Flock Manager V7 owns profile/photo controls. Do not let this legacy
    // dashboard layer add its old Photo / URL / Remove buttons to those cards.
    source = source.replace(
      'function render(){inject();renderGreeting();renderSnap();renderInsights();renderBird();patchFlock();patchCust();backup()}',
      'function render(){inject();renderGreeting();renderSnap();renderInsights();renderBird();patchCust();backup()}'
    );

    if (source.includes('timer=setTimeout(cloudSave,500)')) throw new Error("Legacy Deluxe cloud writer was not removed");
    if (source.includes('cloudLoad();setInterval')) throw new Error("Legacy Deluxe cloud loader/timer was not removed");
    if (source.includes('function pic(id){return pics()[id]||st.birdPhotoUrls[id]||""}')) throw new Error("Chicken of the Day still uses the old photo cache");
    if (!source.includes('FarmBirdPhotosV4')) throw new Error("Current flock photo service was not wired into Chicken of the Day");
    if (source.includes('renderBird();patchFlock();patchCust()')) throw new Error("Legacy flock photo patch is still active");

    (0, eval)(`${source}\n//# sourceURL=extras-dashboard-safe-runtime.js`);
    console.log("✅ Dashboard/Insights UI active; Chicken of the Day uses current flock photos; duplicate Deluxe cloud/photo paths retired");
  } catch (error) {
    console.error("Safe dashboard loader failed:", error);
  }
})();
