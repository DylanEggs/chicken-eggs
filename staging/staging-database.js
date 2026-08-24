(() => {
  "use strict";
  if (window.__ChickenEggsStagingDatabase) return;
  window.__ChickenEggsStagingDatabase = true;

  try {
    const rotationUrl=new URL("staging-chicken-of-day-rotation-v1.js",document.currentScript?.src||location.href);
    rotationUrl.searchParams.set("stage",String(window.__ChickenEggsStagingBuild||Date.now()));
    const xhr=new XMLHttpRequest();xhr.open("GET",rotationUrl.href,false);xhr.send(null);
    if(!(xhr.status>=200&&xhr.status<300)&&xhr.status!==0)throw new Error(`rotation HTTP ${xhr.status}`);
    (0,eval)(`${String(xhr.responseText||"")}\n//# sourceURL=staging-chicken-of-day-rotation-v1.js`);
  } catch (error) {
    console.error("STAGING Chicken of the Day rotation preload failed:",error);
  }

  const ENTRIES = "chickenEggEntriesV102";
  const SETTINGS = "chickenEggSettingsV102";
  const listeners = new Set();

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("core-data-synced", { detail:{ staging:true, key } }));
    for (const fn of listeners) {
      try { fn(read(ENTRIES, [])); } catch {}
    }
  };

  window.ChickenEggsDB = {
    async waitUntilReady() {
      try { await window.FarmSyncSafety?.ready?.(); } catch {}
      return true;
    },
    async saveFarmSettings(settings) {
      write(SETTINGS, { ...(settings || {}), updatedAt: Date.now() });
      return true;
    },
    async loadFarmSettings() {
      return read(SETTINGS, null);
    },
    async saveEntry(entry) {
      const rows = read(ENTRIES, []);
      const id = String(entry?.id || "");
      if (!id) return false;
      const next = rows.filter(x => String(x?.id || "") !== id);
      next.push({ ...entry, id, updatedAt: Date.now() });
      write(ENTRIES, next);
      return true;
    },
    async loadEntries() {
      return read(ENTRIES, []).filter(r => r && (r.type === "eggs" || r.type === "sale"));
    },
    async subscribeEntries(onChange) {
      if (typeof onChange === "function") {
        listeners.add(onChange);
        onChange(await this.loadEntries());
      }
      return () => listeners.delete(onChange);
    },
    async deleteEntry(id) {
      const rows = read(ENTRIES, []).filter(x => String(x?.id || "") !== String(id));
      write(ENTRIES, rows);
      return true;
    }
  };

  console.log("🧪 STAGING database adapter active — no Firebase writes");
})();
