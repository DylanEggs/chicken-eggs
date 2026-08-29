(() => {
  "use strict";
  if (window.__HistoryCustomerV1) return;
  window.__HistoryCustomerV1 = true;

  const APP2_KEY = "chickenEggApp2V1";

  function readApp2() {
    try {
      const value = JSON.parse(localStorage.getItem(APP2_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function entryIdFromCard(card) {
    const button = card?.querySelector?.('button[onclick*="editEntry"]');
    const onclick = String(button?.getAttribute("onclick") || "");
    const quoted = onclick.match(/editEntry\(\s*['\"]([^'\"]+)['\"]\s*\)/);
    if (quoted?.[1]) return quoted[1];
    const bare = onclick.match(/editEntry\(\s*([^\s)]+)\s*\)/);
    return String(bare?.[1] || "").replace(/^['\"]|['\"]$/g, "");
  }

  function resolveCustomerName(entryId, state = readApp2()) {
    const id = String(entryId || "");
    const customerId = String(state?.saleMeta?.[id]?.customerId || "");
    if (!customerId) return "Walk-in / Not assigned";
    const customer = (Array.isArray(state?.customers) ? state.customers : []).find(c => String(c?.id || "") === customerId);
    const name = String(customer?.name || "").trim();
    return name || "Walk-in / Not assigned";
  }

  function enrichCard(card, state = readApp2()) {
    if (!card || !/Egg Sale/i.test(String(card.textContent || ""))) return false;
    const entryId = entryIdFromCard(card);
    if (!entryId) return false;

    let line = card.querySelector(".history-sale-customer");
    if (!line) {
      line = document.createElement("div");
      line.className = "history-sale-customer";
      line.style.margin = "4px 0 2px";
      line.innerHTML = 'Customer: <strong class="history-sale-customer-name"></strong>';

      const dateSpan = card.querySelector("span");
      let anchor = dateSpan?.nextSibling || null;
      while (anchor && !(anchor.nodeType === 1 && anchor.tagName === "BR")) anchor = anchor.nextSibling;
      if (anchor?.parentNode === card) anchor.insertAdjacentElement("afterend", line);
      else {
        const firstButton = card.querySelector("button");
        if (firstButton) card.insertBefore(line, firstButton);
        else card.appendChild(line);
      }
    }

    const nameEl = line.querySelector(".history-sale-customer-name");
    if (nameEl) nameEl.textContent = resolveCustomerName(entryId, state);
    line.dataset.saleEntryId = entryId;
    return true;
  }

  function enrichHistory() {
    const list = document.getElementById("historyList");
    if (!list) return 0;
    const state = readApp2();
    let count = 0;
    for (const card of list.querySelectorAll(".entry")) if (enrichCard(card, state)) count++;
    return count;
  }

  let queued = false;
  function queueEnrich() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enrichHistory();
    });
  }

  function watchHistory() {
    const list = document.getElementById("historyList");
    if (!list) {
      setTimeout(watchHistory, 200);
      return;
    }
    enrichHistory();
    new MutationObserver(queueEnrich).observe(list, { childList: true, subtree: true });
    ["core-data-synced", "farm-data-synced", "farm-local-data-changed"].forEach(name => window.addEventListener(name, queueEnrich));
  }

  window.HistoryCustomerV1 = {
    version: 1,
    resolveCustomerName,
    entryIdFromCard,
    enrichCard,
    enrichHistory,
    firebaseReads: 0,
    firebaseWrites: 0,
    networkCalls: 0
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(watchHistory, 700), { once: true });
  else setTimeout(watchHistory, 700);
})();
