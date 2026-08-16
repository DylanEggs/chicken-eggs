(() => {
  "use strict";
  if (window.__extrasFunSafeLoaderV2) return;
  window.__extrasFunSafeLoaderV2 = true;

  try {
    const build = String(window.__ChickenEggsBuild || "20260816-1690");
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

    if (source.includes('setInterval(()=>{hook();renderFun()},3000)')) throw new Error("Fun redraw interval was not removed");
    if (source.includes('saveTimer=setTimeout(cloudSave,400)')) throw new Error("Legacy business cloud writer was not removed");
    if (source.includes('cloudLoad();setInterval(()=>{hookScreen();render()},3500)')) throw new Error("Legacy business cloud loader/timer was not removed");

    (0, eval)(`${source}\n//# sourceURL=extras-fun-safe-runtime.js`);
    console.log("✅ Fun and Chicken Sales active — event-driven with protected Firebase authority");
  } catch (error) {
    console.error("Safe fun/business loader failed:", error);
  }
})();
