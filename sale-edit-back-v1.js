(() => {
  "use strict";
  if (window.__SaleEditBackV1) return;
  window.__SaleEditBackV1 = true;

  const ENTRIES_KEY = "chickenEggEntriesV102";
  let editingSale = false;
  let installed = false;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };

  function goSaleHistory() {
    try { window.setHistoryFilter?.("sale"); } catch {}
    try { window.showScreen?.("history"); } catch {}
  }

  function isBackButton(button) {
    if (!button) return false;
    if (button.classList.contains("backMini")) return true;
    return button.classList.contains("secondary") && button.textContent.trim() === "Back";
  }

  function install() {
    if (installed) return;
    if (typeof window.editEntry !== "function" || typeof window.showScreen !== "function") {
      setTimeout(install, 100);
      return;
    }

    const originalEditEntry = window.editEntry;
    if (!originalEditEntry.__saleEditBackV1) {
      const wrapped = function(id) {
        const entry = read(ENTRIES_KEY, []).find(e => String(e?.id) === String(id));
        editingSale = entry?.type === "sale";
        return originalEditEntry.apply(this, arguments);
      };
      wrapped.__saleEditBackV1 = true;
      wrapped.__saleEditBackOriginal = originalEditEntry;
      window.editEntry = wrapped;
    }

    document.addEventListener("click", event => {
      const button = event.target.closest?.("button");
      if (!button) return;

      const onclick = button.getAttribute("onclick") || "";
      if (/showScreen\(['\"]sale['\"]\)/.test(onclick) && !button.closest("#historyList")) {
        editingSale = false;
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
    console.log("✅ Sale edit return active — backing out of an edited sale returns to Sale History");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(install, 120), {once:true});
  else setTimeout(install, 120);
})();
