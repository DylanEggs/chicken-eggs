(() => {
  "use strict";
  if (window.__stagingExtrasFunSafeLoaderV1) return;
  window.__stagingExtrasFunSafeLoaderV1 = true;

  try {
    const build = String(window.__ChickenEggsBuild || "staging");
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `extras-fun-legacy-v1.js?v=${encodeURIComponent(build)}`, false);
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 0) throw new Error(`HTTP ${xhr.status}`);

    let source = String(xhr.responseText || "");
    if (!source.includes('__farm_business_v1__')) throw new Error("Legacy fun/business source did not load");

    source = source.replace(
      'function init(){css();overlay();hook();logo();renderFun();milestones();hidden();setInterval(()=>{hook();renderFun()},3000)}',
      'function init(){css();overlay();hook();logo();renderFun();milestones();hidden();const refresh=()=>{hook();renderFun()};window.addEventListener("core-data-synced",refresh);window.addEventListener("farm-data-synced",refresh);window.addEventListener("farm-local-data-changed",refresh);setTimeout(refresh,700)}'
    );
    source = source.replace(
      'function save(){bs.updatedAt=Date.now();localStorage.setItem(BK,JSON.stringify(bs));clearTimeout(saveTimer);saveTimer=setTimeout(cloudSave,400);render()}',
      'function save(){bs.updatedAt=Date.now();localStorage.setItem(BK,JSON.stringify(bs));render()}'
    );
    source = source.replace(
      'function init(){inject();hookScreen();render();cloudLoad();setInterval(()=>{hookScreen();render()},3500)}',
      'function init(){inject();hookScreen();render();const refresh=()=>{bs=load();hookScreen();render()};window.addEventListener("farm-data-synced",refresh);window.addEventListener("farm-local-data-changed",refresh);window.addEventListener("core-data-synced",refresh);setTimeout(refresh,900)}'
    );

    // The fun race uses delayed callbacks. During destructive staging tests the
    // screen can be rebuilt before those callbacks fire. Guard both delayed DOM
    // targets so a vanished animation never throws after the real farm work has
    // already completed successfully.
    source = source.replace(
      'document.getElementById(`xr${i}`).style.left=i===win?',
      '(document.getElementById(`xr${i}`)||{style:{}}).style.left=i===win?'
    );
    source = source.replace(
      'document.getElementById("xrr").textContent=',
      '(document.getElementById("xrr")||{}).textContent='
    );

    if (source.includes('setInterval(()=>{hook();renderFun()},3000)')) throw new Error("Fun redraw interval was not removed");
    if (source.includes('saveTimer=setTimeout(cloudSave,400)')) throw new Error("Legacy business cloud writer was not removed");
    if (source.includes('cloudLoad();setInterval(()=>{hookScreen();render()},3500)')) throw new Error("Legacy business cloud loader/timer was not removed");
    if (source.includes('document.getElementById(`xr${i}`).style.left=i===win?')) throw new Error("Race DOM guard was not installed");

    (0, eval)(`${source}\n//# sourceURL=staging-extras-fun-safe-runtime.js`);
    console.log("🧪 STAGING fun/business active — race callbacks guarded after UI rebuilds");
  } catch (error) {
    console.error("Staging safe fun/business loader failed:", error);
  }
})();
