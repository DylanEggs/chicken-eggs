(() => {
  "use strict";
  if (window.__StagingHistoryCustomerV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingHistoryCustomerV1 = true;

  const APP2_KEY = "chickenEggApp2V1";
  const DATA_KEYS = ["chickenEggEntriesV102", "chickenEggSettingsV102", APP2_KEY, "chickenEggInventoryV2", "chickenEggBusinessV1"];

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
    const match = onclick.match(/editEntry\(\s*['\"]([^'\"]+)['\"]\s*\)/);
    return match?.[1] || "";
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

    const name = resolveCustomerName(entryId, state);
    const nameEl = line.querySelector(".history-sale-customer-name");
    if (nameEl) nameEl.textContent = name;
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
    const observer = new MutationObserver(queueEnrich);
    observer.observe(list, { childList: true, subtree: true });
    ["core-data-synced", "farm-data-synced", "farm-local-data-changed"].forEach(name => window.addEventListener(name, queueEnrich));
  }

  const snapshot = () => Object.fromEntries(DATA_KEYS.map(key => [key, localStorage.getItem(key)]));
  const unchanged = (a, b) => DATA_KEYS.every(key => a[key] === b[key]);

  async function runChecks() {
    const results = [];
    const check = (name, pass, detail = "") => results.push({ name, pass: !!pass, detail: String(detail || "") });
    const before = snapshot();
    try {
      const sample = {
        customers: [{ id: "customer-1", name: "Test Customer" }],
        saleMeta: { "sale-1": { customerId: "customer-1", paid: true } }
      };
      check("History customer lookup resolves linked customer", resolveCustomerName("sale-1", sample) === "Test Customer", resolveCustomerName("sale-1", sample));
      check("History customer lookup labels unassigned sale", resolveCustomerName("sale-2", sample) === "Walk-in / Not assigned", resolveCustomerName("sale-2", sample));

      const card = document.createElement("div");
      card.className = "entry";
      card.innerHTML = '<strong>💰 Egg Sale</strong><br><span>2026-08-28</span><br>Dozen Sold: <strong>1</strong><button onclick="editEntry(\'sale-1\')">Edit Entry</button>';
      const enriched = enrichCard(card, sample);
      check("History sale card displays customer name", enriched && card.textContent.includes("Customer: Test Customer"), card.textContent.trim());
      check("History customer display does not change farm data", unchanged(before, snapshot()));
    } catch (error) {
      check("History customer regression completed without exception", false, String(error?.stack || error));
    }
    return results;
  }

  function installTest() {
    const base = window.StagingFullTest;
    if (!base?.run || base.__historyCustomerV1) {
      setTimeout(installTest, 120);
      return;
    }
    const baseRun = base.run.bind(base);
    window.StagingFullTest = {
      ...base,
      async run() {
        const first = await baseRun();
        enrichHistory();
        const extra = await runChecks();
        const results = [...(first?.results || []), ...extra];
        const failed = results.filter(x => !x.pass);
        return { ...first, total: results.length, passed: results.length - failed.length, failed: failed.length, results, suite: `${first?.suite || "staging-full"}+history-customer-v1` };
      },
      __historyCustomerV1: true
    };
    console.log("🧪 STAGING History customer regression active — sale cards must show linked customer names");
  }

  window.StagingHistoryCustomerV1 = {
    version: 1,
    resolveCustomerName,
    entryIdFromCard,
    enrichCard,
    enrichHistory,
    firebaseReads: 0,
    firebaseWrites: 0,
    networkCalls: 0
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(watchHistory, 900);
      setTimeout(installTest, 1800);
    }, { once: true });
  } else {
    setTimeout(watchHistory, 900);
    setTimeout(installTest, 1800);
  }
})();
