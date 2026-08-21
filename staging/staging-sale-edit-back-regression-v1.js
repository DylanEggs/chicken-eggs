(() => {
  "use strict";
  if (window.__StagingSaleEditBackRegressionV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingSaleEditBackRegressionV1 = true;

  const ENTRIES_KEY = "chickenEggEntriesV102";
  const DATA_KEYS = ["chickenEggEntriesV102","chickenEggSettingsV102","chickenEggApp2V1","chickenEggInventoryV2","chickenEggBusinessV1"];
  let editingSale = false;
  let lastRequestedFilter = "";
  let installed = false;

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
  const snapshot = () => Object.fromEntries(DATA_KEYS.map(k => [k, localStorage.getItem(k)]));
  const unchanged = (a,b) => DATA_KEYS.every(k => a[k] === b[k]);
  const active = () => document.querySelector(".screen.active")?.id || "";
  const saleEntry = () => read(ENTRIES_KEY, []).find(e => e?.type === "sale" && e?.id);

  function goSaleHistory() {
    lastRequestedFilter = "sale";
    try { window.setHistoryFilter?.("sale"); } catch {}
    try { window.showScreen?.("history"); } catch {}
  }

  function isBackButton(button) {
    if (!button) return false;
    if (button.classList.contains("backMini")) return true;
    return button.classList.contains("secondary") && button.textContent.trim() === "Back";
  }

  function installBehavior() {
    if (installed) return true;
    if (typeof window.editEntry !== "function" || typeof window.showScreen !== "function") {
      setTimeout(installBehavior, 100);
      return false;
    }

    const originalEditEntry = window.editEntry;
    if (!originalEditEntry.__saleEditBackStagingV1) {
      const wrapped = function(id) {
        const entry = read(ENTRIES_KEY, []).find(e => String(e?.id) === String(id));
        editingSale = entry?.type === "sale";
        lastRequestedFilter = "";
        return originalEditEntry.apply(this, arguments);
      };
      wrapped.__saleEditBackStagingV1 = true;
      wrapped.__saleEditBackOriginal = originalEditEntry;
      window.editEntry = wrapped;
    }

    document.addEventListener("click", event => {
      const button = event.target.closest?.("button");
      if (!button) return;

      const onclick = button.getAttribute("onclick") || "";
      if (/showScreen\(['\"]sale['\"]\)/.test(onclick) && !button.closest("#historyList")) {
        editingSale = false;
        lastRequestedFilter = "";
      }

      if (!editingSale) return;
      const screen = button.closest(".screen");
      if (screen?.id !== "sale" || !isBackButton(button)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      editingSale = false;
      goSaleHistory();
    }, true);

    installed = true;
    window.StagingSaleEditBackV1 = {
      isEditing: () => editingSale,
      lastFilter: () => lastRequestedFilter,
      reset: () => { editingSale = false; lastRequestedFilter = ""; }
    };
    console.log("🧪 STAGING sale edit back behavior active — edit sale returns to filtered Sale History");
    return true;
  }

  async function runChecks() {
    const results = [];
    const check = (name, pass, detail="") => results.push({name, pass:!!pass, detail:String(detail||"")});
    const before = snapshot();
    const start = active() || "dashboard";
    try {
      check("Sale edit return behavior is installed", installBehavior() && !!window.StagingSaleEditBackV1);
      const sale = saleEntry();
      check("Staging has a sale entry available for edit navigation test", !!sale, sale?.id || "no sale entry");
      if (sale) {
        window.editEntry(sale.id);
        const saleScreen = document.getElementById("sale");
        const top = saleScreen?.querySelector(".screenTitle .backMini");
        top?.click();
        check("Edit Sale top arrow returns to Sale History", active() === "history", `active=${active()}`);
        check("Edit Sale return selects Sales filter", window.StagingSaleEditBackV1.lastFilter() === "sale", `filter=${window.StagingSaleEditBackV1.lastFilter()}`);

        window.editEntry(sale.id);
        const bottom = [...(saleScreen?.querySelectorAll("button.secondary") || [])].find(b => b.textContent.trim() === "Back");
        bottom?.click();
        check("Edit Sale bottom Back returns to Sale History", active() === "history", `active=${active()}`);
      }

      window.StagingSaleEditBackV1.reset();
      window.showScreen?.("sale");
      const normalBack = document.querySelector("#sale .screenTitle .backMini");
      normalBack?.click();
      check("New Sale navigation is not hijacked by edit-return logic", active() === "dashboard", `active=${active()}`);
      check("Sale edit back navigation does not change farm data", unchanged(before, snapshot()));
    } catch (error) {
      check("Sale edit back regression completed without exception", false, String(error?.stack || error));
    } finally {
      window.StagingSaleEditBackV1?.reset?.();
      try { window.showScreen?.(start); } catch {}
    }
    return results;
  }

  function installTest() {
    installBehavior();
    const base = window.StagingFullTest;
    if (!base?.run || base.__saleEditBackV1) { setTimeout(installTest, 100); return; }
    const baseRun = base.run.bind(base);
    window.StagingFullTest = {
      ...base,
      async run() {
        const first = await baseRun();
        const extra = await runChecks();
        const results = [...(first?.results || []), ...extra];
        const failed = results.filter(x => !x.pass);
        return {...first, total:results.length, passed:results.length-failed.length, failed:failed.length, results, suite:`${first?.suite || "staging-full"}+sale-edit-back-v1`};
      },
      __saleEditBackV1:true
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(installTest, 1900), {once:true});
  else setTimeout(installTest, 1900);
})();
